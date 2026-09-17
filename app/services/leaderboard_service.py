"""Leaderboard service: recalculation jobs, snapshots and queries."""

from datetime import datetime, timezone

from app.models.enums import AuditAction
from app.repositories.system import LeaderboardRepository
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

        students = await self.students.col.find({"status": "active"}).to_list(
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
        query: dict = {"platform": tab}
        for key in ("course", "branch", "section", "batch_id", "academic_year_id"):
            value = (filters or {}).get(key)
            if value:
                query[key] = value
        cursor = (
            self.db.leaderboard_scores.find(query).sort([("score", -1)]).limit(limit)
        )
        docs = await cursor.to_list(length=limit)
        snapshot = await self.repo.latest_snapshot()
        entries = []
        for i, doc in enumerate(docs, start=1):
            metrics = doc.get("metrics") or {}
            trend = metrics.pop("trend_delta", None)
            entries.append(
                {
                    "rank": i,
                    "student_id": str(doc["student_id"]),
                    "student_name": doc.get("student_name"),
                    "roll_number": doc.get("roll_number"),
                    "course": doc.get("course"),
                    "branch": doc.get("branch"),
                    "score": round(float(doc.get("score") or 0), 2),
                    "attendance_percentage": doc.get("attendance_percentage"),
                    "current_streak": doc.get("current_streak"),
                    "metrics": metrics,
                    "trend": trend,
                }
            )
        return {
            "tab": tab,
            "entries": entries,
            "total": len(entries),
            "generated_at": snapshot["created_at"].isoformat()
            if snapshot and isinstance(snapshot.get("created_at"), datetime)
            else None,
        }
