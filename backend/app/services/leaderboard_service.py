"""Leaderboard service: recalculation jobs, snapshots and queries."""

from datetime import datetime, timezone

from app.core.errors import AppError
from app.integrations import available_platforms
from app.integrations.activity_time import activity_date_key
from app.models.enums import AuditAction
from app.repositories.system import LeaderboardRepository
from app.repositories.base import oid
from app.repositories.users import StudentRepository
from app.services.scoring_engine import compute_coding_score, compute_overall
from app.services.streak_service import compute_streaks


class LeaderboardService:
    def __init__(self, db):
        self.db = db
        self.repo = LeaderboardRepository(db)
        self.students = StudentRepository(db)
        self.attendance = db.attendance_records
        self.coding_stats = db.coding_statistics
        self.settings = db.settings

    async def recalculate(self) -> dict:
        """Recompute scores for all active students and store a snapshot."""
        from app.services.settings_service import SettingsService

        settings_svc = SettingsService(self.db)
        weights = await settings_svc.weights()
        rules = await settings_svc.streak_rules()

        students = await self.students.col.find(self._active_students_query()).to_list(
            length=100000
        )
        all_rows: list[dict] = []
        for student in students:
            sid = student["_id"]
            records = (
                await self.attendance.find({"student_id": sid})
                .sort([("date", 1)])
                .to_list(length=50000)
            )
            streak_info = compute_streaks(records, rules)
            attendance_pct = streak_info.get("attendance_percentage")

            platform_entries = []
            stats_docs = await self.coding_stats.find({"student_id": sid}).to_list(
                length=20
            )
            for doc in stats_docs:
                platform_entries.append(
                    {
                        "platform": doc["platform"],
                        "statistics": doc.get("statistics", {}),
                    }
                )

            coding = compute_coding_score(platform_entries)
            overall = compute_overall(
                attendance_pct, coding, streak_info["current_streak"], weights
            )

            base = {
                "student_id": sid,
                "student_name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip(),
                "roll_number": student.get("roll_number"),
                "course": student.get("course"),
                "branch": student.get("branch"),
                "section": student.get("section"),
                "batch_id": student.get("batch_id"),
                "academic_year_id": student.get("academic_year_id"),
                "attendance_percentage": attendance_pct,
                "current_streak": streak_info["current_streak"],
                "updated_at": datetime.now(timezone.utc),
            }
            all_rows.append(
                {
                    **base,
                    "platform": "overall",
                    "score": overall["overall_score"],
                    "metrics": {
                        **overall,
                        "attendance_percentage": attendance_pct or 0,
                        "current_streak": streak_info["current_streak"],
                    },
                }
            )
            for pe in platform_entries:
                from app.services.scoring_engine import platform_coding_score

                pscore = platform_coding_score(pe["platform"], pe["statistics"])
                all_rows.append(
                    {
                        **base,
                        "platform": pe["platform"],
                        "score": pscore,
                        "metrics": {
                            k: float(v)
                            for k, v in (pe["statistics"] or {}).items()
                            if isinstance(v, (int, float))
                        },
                    }
                )

        await self.repo.replace_scores(all_rows)
        snapshot_payload = {
            "overall_count": sum(1 for r in all_rows if r["platform"] == "overall"),
            "top_10": [
                {
                    "student_id": str(r["student_id"]),
                    "name": r["student_name"],
                    "score": r["score"],
                }
                for r in sorted(
                    [r for r in all_rows if r["platform"] == "overall"],
                    key=lambda x: x["score"],
                    reverse=True,
                )[:10]
            ],
        }
        snapshot = await self.repo.save_snapshot(snapshot_payload)
        return {
            "recalculated": len(students),
            "snapshot_id": str(snapshot["_id"]),
            "audit": AuditAction.LEADERBOARD_RECALCULATED.value,
        }

    async def get_leaderboard(
        self, tab: str = "overall", filters: dict | None = None, limit: int = 200
    ) -> dict:
        tab = tab.lower().strip() or "overall"
        query = await self._lifetime_query(tab, filters)
        total = await self.db.leaderboard_scores.count_documents(query)
        cursor = (
            self.db.leaderboard_scores.find(query)
            .sort([("score", -1), ("student_name", 1), ("student_id", 1)])
            .limit(limit)
        )
        docs = await cursor.to_list(length=limit)
        snapshot = await self.repo.latest_snapshot()
        entries = []
        last_score = None
        rank = 0
        for i, doc in enumerate(docs, start=1):
            score = round(float(doc.get("score") or 0), 2)
            if last_score is None or score != last_score:
                rank = i
                last_score = score
            metrics = dict(doc.get("metrics") or {})
            trend = metrics.pop("trend_delta", None)
            entries.append(
                {
                    "rank": rank,
                    "student_id": str(doc["student_id"]),
                    "student_name": doc.get("student_name"),
                    "roll_number": doc.get("roll_number"),
                    "course": doc.get("course"),
                    "branch": doc.get("branch"),
                    "score": score,
                    "attendance_percentage": doc.get("attendance_percentage"),
                    "current_streak": doc.get("current_streak"),
                    "metrics": metrics,
                    "trend": trend,
                }
            )
        return {
            "tab": tab,
            "entries": entries,
            "total": total,
            "generated_at": snapshot["created_at"].isoformat()
            if snapshot and isinstance(snapshot.get("created_at"), datetime)
            else None,
        }

    @staticmethod
    def _active_students_query() -> dict:
        # Older invited profiles may lack a status field, which means active.
        return {"$or": [{"status": "active"}, {"status": {"$exists": False}}]}

    async def _lifetime_query(self, tab: str, filters: dict | None) -> dict:
        """Use live membership for a batch, not its last score snapshot."""
        filters = filters or {}
        query: dict = {"platform": tab}
        keys = ("course", "branch", "section", "batch_id", "academic_year_id")
        if filters.get("batch_id"):
            student_query = self._active_students_query()
            for key in keys:
                if filters.get(key):
                    student_query[key] = filters[key]
            members = await self.students.col.find(student_query, {"_id": 1}).to_list(
                length=100000
            )
            query["student_id"] = {"$in": [member["_id"] for member in members]}
        else:
            for key in keys:
                if filters.get(key):
                    query[key] = filters[key]
        return query

    async def rank_of(
        self, student_id: str, tab: str = "overall", filters: dict | None = None
    ) -> int | None:
        """Return rank within the same live scope used by get_leaderboard."""
        tab = tab.lower().strip() or "overall"
        query = await self._lifetime_query(tab, filters)
        own = await self.db.leaderboard_scores.find_one(
            {"$and": [query, {"student_id": oid(student_id)}]}
        )
        if not own:
            return None
        return await self.db.leaderboard_scores.count_documents(
            {**query, "score": {"$gt": own.get("score", 0)}}
        ) + 1

    async def get_date_leaderboard(
        self,
        tab: str,
        start_date: str,
        end_date: str,
        filters: dict | None = None,
        current_student_id: str | None = None,
        activity_timezone: str = "Asia/Kolkata",
        limit: int = 200,
    ) -> dict:
        """Rank activity measured inside one complete, shared date interval.

        Platform tabs use that platform's primary daily metric. The `activity`
        tab ranks unique dates with any reported coding activity; it does not
        add unlike platform counts together.
        """
        from app.integrations.activity_time import get_activity_timezone

        tab = tab.lower().strip()
        activity_timezone = get_activity_timezone(activity_timezone).key
        platforms = available_platforms()
        if tab != "activity" and tab not in platforms:
            raise AppError("Date-based leaderboard requires a coding platform or activity tab")

        student_query = self._active_students_query()
        for key in ("course", "branch", "section", "batch_id", "academic_year_id"):
            value = (filters or {}).get(key)
            if value:
                student_query[key] = value
        students = await self.students.col.find(student_query).to_list(length=100000)
        students_by_id = {student["_id"]: student for student in students}
        student_ids = list(students_by_id)
        if not student_ids:
            return self._date_leaderboard_result(
                tab,
                start_date,
                end_date,
                [],
                0,
                0,
                0,
                current_student_id,
                limit,
                activity_timezone=activity_timezone,
            )

        profile_docs = await self.db.coding_profiles.find(
            {"student_id": {"$in": student_ids}, **({"platform": tab} if tab != "activity" else {})}
        ).to_list(length=100000)
        stats_docs = await self.coding_stats.find(
            {"student_id": {"$in": student_ids}}
        ).to_list(length=100000)
        stats_by_key = {
            (doc["student_id"], doc["platform"]): doc for doc in stats_docs
        }
        profiles_by_key = {
            (doc["student_id"], doc["platform"]): doc for doc in profile_docs
        }

        eligible: dict[tuple, dict] = {}
        excluded_for_coverage = 0
        excluded_estimated_profiles = 0
        available_starts: list[str] = []
        available_ends: list[str] = []
        available_metric_labels: list[str] = []
        for key, profile in profiles_by_key.items():
            stats_doc = stats_by_key.get(key) or {}
            metadata = stats_doc.get("activity_metadata") or {}
            coverage_start = metadata.get("coverage_start")
            coverage_end = metadata.get("coverage_end")
            if not (
                metadata.get("available")
                and metadata.get("metric_key")
                and metadata.get("activity_timezone") == activity_timezone
                and coverage_start
                and coverage_end
            ):
                excluded_for_coverage += 1
                continue
            available_starts.append(coverage_start)
            available_ends.append(coverage_end)
            if metadata.get("metric_label"):
                available_metric_labels.append(metadata["metric_label"])
            if coverage_start > start_date or coverage_end < end_date:
                excluded_for_coverage += 1
                continue
            if tab == "activity" and metadata.get("fill_gaps") is False:
                # Snapshot deltas identify an interval total, not the actual
                # dates the problems were solved. Keep them out of active-day
                # rankings, which claim day-level precision.
                excluded_for_coverage += 1
                excluded_estimated_profiles += 1
                continue
            eligible[key] = {
                "metadata": metadata,
                "profile": profile,
                "stats_doc": stats_doc,
            }

        if tab == "activity":
            activity_totals: dict[object, dict] = {}
            activity_docs = await self.db.coding_activity.find(
                {
                    "student_id": {"$in": student_ids},
                    "date": {"$gte": start_date, "$lte": end_date},
                }
            ).to_list(length=500000)
            for row in activity_docs:
                key = (row["student_id"], row["platform"])
                coverage = eligible.get(key)
                if not coverage:
                    continue
                if not self._activity_row_fits_range(
                    row,
                    coverage["metadata"],
                    start_date,
                    end_date,
                    activity_timezone,
                ):
                    continue
                metrics = row.get("metrics") or {}
                if not any(isinstance(value, (int, float)) and value > 0 for value in metrics.values()):
                    continue
                student_activity = activity_totals.setdefault(
                    row["student_id"], {"dates": set(), "platforms": set(), "platform_days": set()}
                )
                student_activity["dates"].add(row["date"])
                student_activity["platforms"].add(row["platform"])
                student_activity["platform_days"].add((row["date"], row["platform"]))

            entries = []
            eligible_students = {
                student_id for student_id, _platform in eligible
            }
            for student_id in eligible_students:
                student = students_by_id.get(student_id)
                if not student:
                    continue
                activity = activity_totals.get(
                    student_id,
                    {"dates": set(), "platforms": set(), "platform_days": set()},
                )
                active_days = len(activity["dates"])
                entries.append(
                    {
                        **self._date_student_fields(student),
                        "score": float(active_days),
                        "attendance_percentage": None,
                        "current_streak": None,
                        "metrics": {
                            "active_days": float(active_days),
                            "platforms_active": float(len(activity["platforms"])),
                            "platform_days": float(len(activity["platform_days"])),
                        },
                    }
                )
            estimated_profiles = excluded_estimated_profiles + sum(
                1 for value in eligible.values()
                if value["metadata"].get("fill_gaps") is False
            )
            note = (
                "Profiles with sync-to-sync totals are excluded because their exact active dates are unavailable."
                if excluded_estimated_profiles
                else "A date counts once if any fully covered connected platform reports activity that day."
            )
            return self._date_leaderboard_result(
                tab,
                start_date,
                end_date,
                entries,
                excluded_for_coverage,
                estimated_profiles,
                len(eligible),
                current_student_id,
                limit,
                metric_label="Unique coding active days",
                note=note,
                activity_timezone=activity_timezone,
                activity_available_from=min(available_starts) if available_starts else None,
                activity_available_through=max(available_ends) if available_ends else None,
            )

        platform = tab
        metric_keys = {value["metadata"]["metric_key"] for value in eligible.values()}
        if len(metric_keys) > 1:
            # A platform should use one primary metric. Keep the most common
            # schema and exclude profiles with stale metadata.
            metric_counts: dict[str, int] = {}
            for value in eligible.values():
                key = value["metadata"]["metric_key"]
                metric_counts[key] = metric_counts.get(key, 0) + 1
            preferred_key = max(metric_counts, key=metric_counts.get)
            eligible_count = len(eligible)
            eligible = {
                key: value for key, value in eligible.items()
                if value["metadata"]["metric_key"] == preferred_key
            }
            excluded_for_coverage += eligible_count - len(eligible)
        metric_key = next(iter({value["metadata"]["metric_key"] for value in eligible.values()}), None)
        metric_label = next(
            (value["metadata"].get("metric_label") for value in eligible.values()),
            next(iter(available_metric_labels), "Daily activity"),
        )
        entries_by_student: dict[object, dict] = {}
        activity_docs = await self.db.coding_activity.find(
            {
                "platform": platform,
                "student_id": {"$in": [student_id for student_id, _ in eligible]},
                "date": {"$gte": start_date, "$lte": end_date},
            }
        ).to_list(length=500000)
        for row in activity_docs:
            student_id = row["student_id"]
            config = eligible.get((student_id, platform))
            if not config or not self._activity_row_fits_range(
                row,
                config["metadata"],
                start_date,
                end_date,
                activity_timezone,
            ):
                continue
            values = entries_by_student.setdefault(
                student_id, {"total": 0.0, "days": 0, "metrics": {}}
            )
            metrics = row.get("metrics") or {}
            value = metrics.get(metric_key, 0)
            if isinstance(value, (int, float)):
                values["total"] += float(value)
                if value > 0:
                    values["days"] += 1
            for name, count in metrics.items():
                if isinstance(count, (int, float)):
                    values["metrics"][name] = values["metrics"].get(name, 0.0) + float(count)

        entries = []
        for (student_id, _platform), config in eligible.items():
            student = students_by_id.get(student_id)
            if not student:
                continue
            values = entries_by_student.get(
                student_id, {"total": 0.0, "days": 0, "metrics": {}}
            )
            values["metrics"][metric_key] = values["total"]
            values["metrics"]["activity_days"] = float(values["days"])
            entries.append(
                {
                    **self._date_student_fields(student),
                    "score": round(values["total"], 2),
                    "attendance_percentage": None,
                    "current_streak": None,
                    "metrics": values["metrics"],
                }
            )
        estimated_profiles = sum(
            1 for value in eligible.values()
            if value["metadata"].get("fill_gaps") is False
        )
        note = None
        if estimated_profiles:
            note = (
                "Some totals are estimates from changes detected between profile syncs. "
                "They are not source-provided solve timestamps."
            )
        return self._date_leaderboard_result(
            tab,
            start_date,
            end_date,
            entries,
            excluded_for_coverage,
            estimated_profiles,
            len(eligible),
            current_student_id,
            limit,
            metric_label=metric_label,
            metric_key=metric_key,
            note=note,
            activity_timezone=activity_timezone,
            activity_available_from=min(available_starts) if available_starts else None,
            activity_available_through=max(available_ends) if available_ends else None,
        )

    @staticmethod
    def _date_student_fields(student: dict) -> dict:
        return {
            "student_id": str(student["_id"]),
            "student_name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip(),
            "roll_number": student.get("roll_number"),
            "course": student.get("course"),
            "branch": student.get("branch"),
        }

    @staticmethod
    def _activity_row_fits_range(
        row: dict,
        metadata: dict,
        start_date: str,
        end_date: str,
        activity_timezone: str = "Asia/Kolkata",
    ) -> bool:
        if metadata.get("fill_gaps") is not False:
            return True
        if not row.get("estimated"):
            return False
        interval_start = activity_date_key(
            row.get("interval_start"), activity_timezone
        )
        interval_end = activity_date_key(row.get("interval_end"), activity_timezone)
        return bool(
            interval_start
            and interval_end
            and interval_start >= start_date
            and interval_end <= end_date
        )

    @staticmethod
    def _date_leaderboard_result(
        tab: str,
        start_date: str,
        end_date: str,
        entries: list[dict],
        excluded_profiles: int,
        estimated_profiles: int,
        covered_profiles: int,
        current_student_id: str | None,
        limit: int,
        metric_label: str | None = None,
        metric_key: str | None = None,
        note: str | None = None,
        activity_timezone: str = "Asia/Kolkata",
        activity_available_from: str | None = None,
        activity_available_through: str | None = None,
    ) -> dict:
        entries.sort(
            key=lambda item: (
                -item["score"],
                item["student_name"].casefold(),
                item["student_id"],
            )
        )
        previous_score = None
        rank = 0
        for index, entry in enumerate(entries, start=1):
            if previous_score is None or entry["score"] != previous_score:
                rank = index
                previous_score = entry["score"]
            entry["rank"] = rank
        me = next(
            (
                {"student_id": entry["student_id"], "rank": entry["rank"]}
                for entry in entries
                if current_student_id and entry["student_id"] == current_student_id
            ),
            None,
        )
        return {
            "tab": tab,
            "entries": entries[:limit],
            "total": len(entries),
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "period_mode": True,
            "start_date": start_date,
            "end_date": end_date,
            "activity_timezone": activity_timezone,
            "activity_available_from": activity_available_from,
            "activity_available_through": activity_available_through,
            "period_metric_label": metric_label,
            "period_metric_key": metric_key,
            "covered_profiles": covered_profiles,
            "excluded_profiles": excluded_profiles,
            "estimated_profiles": estimated_profiles,
            "quality_note": note,
            "me": me,
        }
