"""Analytics aggregations for the admin dashboard and analytics pages."""

from datetime import datetime, timedelta, timezone
from typing import Any


def _range(days: int) -> datetime:
    return datetime.now(timezone.utc) - timedelta(days=days)


class AnalyticsService:
    def __init__(self, db):
        self.db = db

    async def admin_dashboard(self) -> dict:
        students = self.db.students
        total_students = await students.count_documents({})
        active_students = await students.count_documents({"status": "active"})

        # Average attendance across active students (from leaderboard scores metrics)
        pipeline = [
            {"$match": {"platform": "overall"}},
            {
                "$group": {
                    "_id": None,
                    "avg_attendance": {"$avg": "$metrics.attendance_percentage"},
                    "avg_overall": {"$avg": "$score"},
                    "max_streak": {"$max": "$metrics.current_streak"},
                }
            },
        ]
        agg = await self.db.leaderboard_scores.aggregate(pipeline).to_list(1)
        avg_attendance = (
            round(agg[0]["avg_attendance"], 1)
            if agg and agg[0].get("avg_attendance") is not None
            else None
        )
        avg_overall = (
            round(agg[0]["avg_overall"], 1)
            if agg and agg[0].get("avg_overall") is not None
            else None
        )
        max_streak = agg[0].get("max_streak") if agg else 0

        threshold = 75.0
        settings_doc = await self.db.settings.find_one({"key": "app"})
        if settings_doc:
            threshold = float(settings_doc.get("attendance_threshold", 75.0))
        low_attendance = await self.db.leaderboard_scores.count_documents(
            {
                "platform": "overall",
                "metrics.attendance_percentage": {"$ne": None, "$lt": threshold},
            }
        )

        classes_today = await self.db.classes.count_documents(
            {
                "date": {
                    "$gte": datetime.combine(
                        datetime.now(timezone.utc).date(),
                        datetime.min.time(),
                        tzinfo=timezone.utc,
                    ),
                    "$lte": datetime.combine(
                        datetime.now(timezone.utc).date(),
                        datetime.max.time(),
                        tzinfo=timezone.utc,
                    ),
                }
            }
        )

        profiles_synced = await self.db.coding_profiles.count_documents(
            {"sync_status": "success"}
        )
        profiles_total = await self.db.coding_profiles.count_documents({})

        # Attendance trend (last 30 days)
        trend = await self.attendance_trend(days=30)
        platform_distribution = await self.platform_distribution()
        top_performers = await self.top_performers(limit=8)

        return {
            "total_students": total_students,
            "active_students": active_students,
            "average_attendance": avg_attendance,
            "attendance_threshold": threshold,
            "low_attendance_students": low_attendance,
            "average_coding_score": avg_overall,
            "highest_current_streak": int(max_streak or 0),
            "classes_today": classes_today,
            "profiles_synced": profiles_synced,
            "profiles_total": profiles_total,
            "attendance_trend": trend,
            "platform_distribution": platform_distribution,
            "top_performers": top_performers,
        }

    async def attendance_trend(
        self, days: int = 30, filters: dict | None = None
    ) -> list[dict]:
        match: dict[str, Any] = {"date": {"$gte": _range(days)}}
        pipeline = [
            {"$match": match},
            {
                "$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$date"}},
                    "present": {
                        "$sum": {
                            "$cond": [{"$in": ["$status", ["present", "late"]]}, 1, 0]
                        }
                    },
                    "total": {"$sum": 1},
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "date": "$_id",
                    "percentage": {
                        "$cond": [
                            {"$eq": ["$total", 0]},
                            0,
                            {
                                "$round": [
                                    {
                                        "$multiply": [
                                            {"$divide": ["$present", "$total"]},
                                            100,
                                        ]
                                    },
                                    1,
                                ]
                            },
                        ]
                    },
                }
            },
            {"$sort": {"date": 1}},
        ]
        return await self.db.attendance_records.aggregate(pipeline).to_list(200)

    async def platform_distribution(self) -> list[dict]:
        pipeline = [
            {"$group": {"_id": "$platform", "count": {"$sum": 1}}},
            {"$project": {"_id": 0, "platform": "$_id", "count": 1}},
        ]
        rows = await self.db.coding_profiles.aggregate(pipeline).to_list(20)
        return sorted(rows, key=lambda r: r["count"], reverse=True)

    async def top_performers(self, limit: int = 8) -> list[dict]:
        cursor = (
            self.db.leaderboard_scores.find({"platform": "overall"})
            .sort([("score", -1)])
            .limit(limit)
        )
        docs = await cursor.to_list(limit)
        return [
            {
                "student_id": str(d["student_id"]),
                "name": d.get("student_name"),
                "score": round(float(d.get("score") or 0), 1),
                "attendance": (d.get("metrics") or {}).get("attendance_percentage"),
            }
            for d in docs
        ]

    async def attendance_breakdown(self, group_by: str = "course") -> list[dict]:
        field = {"course": "$course", "branch": "$branch", "section": "$section"}.get(
            group_by, "$course"
        )
        pipeline = [
            {
                "$group": {
                    "_id": f"${group_by}",
                    "present": {
                        "$sum": {
                            "$cond": [{"$in": ["$status", ["present", "late"]]}, 1, 0]
                        }
                    },
                    "total": {"$sum": 1},
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "name": {"$ifNull": ["$_id", "Unknown"]},
                    "percentage": {
                        "$cond": [
                            {"$eq": ["$total", 0]},
                            0,
                            {
                                "$round": [
                                    {
                                        "$multiply": [
                                            {"$divide": ["$present", "$total"]},
                                            100,
                                        ]
                                    },
                                    1,
                                ]
                            },
                        ]
                    },
                }
            },
            {"$sort": {"percentage": -1}},
        ]
        return await self.db.attendance_records.aggregate(pipeline).to_list(50)

    async def attendance_distribution(self) -> list[dict]:
        pipeline = [
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
            {"$project": {"_id": 0, "status": "$_id", "count": 1}},
        ]
        return await self.db.attendance_records.aggregate(pipeline).to_list(10)

    async def coding_performance_trend(self, days: int = 90) -> list[dict]:
        """Average coding score over recent sync snapshots."""
        pipeline = [
            {"$match": {"platform": "overall"}},
            {
                "$project": {
                    "date": {
                        "$dateToString": {"format": "%Y-%m-%d", "date": "$updated_at"}
                    },
                    "coding": "$metrics.coding_score",
                }
            },
            {"$group": {"_id": "$date", "avg": {"$avg": "$coding"}}},
            {"$project": {"_id": 0, "date": "$_id", "value": {"$round": ["$avg", 1]}}},
            {"$sort": {"date": 1}},
        ]
        return await self.db.leaderboard_scores.aggregate(pipeline).to_list(100)

    async def attendance_vs_coding(self) -> list[dict]:
        cursor = self.db.leaderboard_scores.find(
            {"platform": "overall"}, {"metrics": 1, "student_name": 1}
        ).limit(2000)
        docs = await cursor.to_list(2000)
        points = []
        for d in docs:
            m = d.get("metrics") or {}
            att = m.get("attendance_percentage")
            coding = m.get("coding_score")
            if att is not None and coding is not None:
                points.append(
                    {"attendance": att, "coding": coding, "name": d.get("student_name")}
                )
        return points

    async def student_trend(self, student_id: str, days: int = 30) -> list[dict]:
        from app.repositories.base import oid

        sid = oid(student_id)
        since = _range(days)
        pipeline = [
            {"$match": {"student_id": sid, "date": {"$gte": since}}},
            {
                "$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$date"}},
                    "present": {
                        "$sum": {
                            "$cond": [{"$in": ["$status", ["present", "late"]]}, 1, 0]
                        }
                    },
                    "total": {"$sum": 1},
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "date": "$_id",
                    "percentage": {
                        "$cond": [
                            {"$eq": ["$total", 0]},
                            0,
                            {
                                "$round": [
                                    {
                                        "$multiply": [
                                            {"$divide": ["$present", "$total"]},
                                            100,
                                        ]
                                    },
                                    1,
                                ]
                            },
                        ]
                    },
                }
            },
            {"$sort": {"date": 1}},
        ]
        return await self.db.attendance_records.aggregate(pipeline).to_list(200)

    async def student_report(self, student_id: str, days: int = 90) -> dict:
        """Comprehensive per-student report used by the admin student report page.

        Returns:
            - profile:           Student + user fields (name, email, course, branch, section, status)
            - attendance:        { present, absent, late, leave, total, percentage, threshold, is_low }
            - attendance_trend:  [{date, percentage, present, total}, ...]  (last `days` days)
            - by_subject:        [{subject, percentage, total, present}, ...]  (last `days` days)
            - recent_records:    [last 15 attendance records joined with class info]
            - coding:            { score, platforms: [{platform, username, rating, problems_solved,
                                                         last_synced, sync_status, profile_url}] }
            - leaderboard:       { overall_score, rank, total_students, current_streak, longest_streak,
                                  metrics: {attendance, coding_score, ...} }
        """
        from app.repositories.base import oid

        try:
            sid = oid(student_id)
        except Exception:
            return {"error": "invalid_student_id"}

        try:
            return await self._student_report_inner(sid, days)
        except Exception as exc:
            import traceback

            traceback.print_exc()
            return {"error": "report_failed", "detail": str(exc)[:200]}

    async def _student_report_inner(self, sid, days: int) -> dict:
        from app.repositories.base import oid

        # 1. Profile
        student = await self.db.students.find_one({"_id": sid})
        if not student:
            return {"error": "student_not_found"}
        # Look up the user via the linked user_id. user_id may be stored as a string
        # in legacy data; convert to ObjectId when possible.
        raw_user_id = student.get("user_id")
        if raw_user_id:
            try:
                user_oid = oid(str(raw_user_id))
            except Exception:
                user_oid = None
            user_doc = (
                await self.db.users.find_one({"_id": user_oid})
                if user_oid
                else await self.db.users.find_one({"_id": raw_user_id})
            )
        else:
            user_doc = None
        profile = {
            "id": str(student["_id"]),
            "roll_number": student.get("roll_number"),
            "first_name": student.get("first_name", ""),
            "last_name": student.get("last_name", ""),
            "name": f"{student.get('first_name', '')} {student.get('last_name', '')}".strip(),
            "email": student.get("email") or (user_doc or {}).get("email"),
            "course": student.get("course"),
            "branch": student.get("branch"),
            "section": student.get("section"),
            "status": student.get("status", "active"),
            "batch_id": student.get("batch_id"),
            "academic_year_id": student.get("academic_year_id"),
            "phone": student.get("phone"),
            "is_active": (user_doc or {}).get("is_active", True),
        }

        # 2. Threshold
        settings_doc = await self.db.settings.find_one({"key": "app"})
        threshold = float((settings_doc or {}).get("attendance_threshold", 75.0))

        # 3. Attendance summary (all time)
        summary_pipeline = [
            {"$match": {"student_id": sid}},
            {"$group": {"_id": "$status", "count": {"$sum": 1}}},
        ]
        status_counts = {
            d["_id"]: d["count"]
            async for d in self.db.attendance_records.aggregate(summary_pipeline)
        }
        total = sum(status_counts.values())
        present = status_counts.get("present", 0)
        late = status_counts.get("late", 0)
        absent = status_counts.get("absent", 0)
        leave = status_counts.get("leave", 0)
        attended = present + late
        percentage = round((attended / total) * 100, 1) if total else None
        attendance = {
            "present": present,
            "absent": absent,
            "late": late,
            "leave": leave,
            "total_classes": total,
            "percentage": percentage,
            "threshold": threshold,
            "is_low": percentage is not None and percentage < threshold,
        }

        # 4. Attendance trend (last `days` days, daily)
        since = _range(days)
        trend_pipeline = [
            {"$match": {"student_id": sid, "date": {"$gte": since}}},
            {
                "$group": {
                    "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$date"}},
                    "present": {
                        "$sum": {
                            "$cond": [{"$in": ["$status", ["present", "late"]]}, 1, 0]
                        }
                    },
                    "absent": {
                        "$sum": {"$cond": [{"$eq": ["$status", "absent"]}, 1, 0]}
                    },
                    "total": {"$sum": 1},
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "date": "$_id",
                    "present": 1,
                    "absent": 1,
                    "total": 1,
                    "percentage": {
                        "$cond": [
                            {"$eq": ["$total", 0]},
                            0,
                            {
                                "$round": [
                                    {
                                        "$multiply": [
                                            {"$divide": ["$present", "$total"]},
                                            100,
                                        ]
                                    },
                                    1,
                                ]
                            },
                        ]
                    },
                }
            },
            {"$sort": {"date": 1}},
        ]
        attendance_trend = await self.db.attendance_records.aggregate(
            trend_pipeline
        ).to_list(400)

        # 5. By subject (last `days` days)
        by_subject_pipeline = [
            {"$match": {"student_id": sid, "date": {"$gte": since}}},
            {
                "$lookup": {
                    "from": "classes",
                    "localField": "class_id",
                    "foreignField": "_id",
                    "as": "class_doc",
                }
            },
            {"$unwind": {"path": "$class_doc", "preserveNullAndEmptyArrays": True}},
            {
                "$group": {
                    "_id": {"$ifNull": ["$class_doc.subject", "Unscheduled"]},
                    "present": {
                        "$sum": {
                            "$cond": [{"$in": ["$status", ["present", "late"]]}, 1, 0]
                        }
                    },
                    "total": {"$sum": 1},
                }
            },
            {
                "$project": {
                    "_id": 0,
                    "subject": "$_id",
                    "present": 1,
                    "total": 1,
                    "percentage": {
                        "$cond": [
                            {"$eq": ["$total", 0]},
                            0,
                            {
                                "$round": [
                                    {
                                        "$multiply": [
                                            {"$divide": ["$present", "$total"]},
                                            100,
                                        ]
                                    },
                                    1,
                                ]
                            },
                        ]
                    },
                }
            },
            {"$sort": {"percentage": -1}},
            {"$limit": 12},
        ]
        by_subject = await self.db.attendance_records.aggregate(
            by_subject_pipeline
        ).to_list(12)

        # 6. Recent attendance records (last 15, with class details)
        recent_pipeline = [
            {"$match": {"student_id": sid}},
            {"$sort": {"date": -1}},
            {"$limit": 15},
            {
                "$lookup": {
                    "from": "classes",
                    "localField": "class_id",
                    "foreignField": "_id",
                    "as": "class_doc",
                }
            },
            {"$unwind": {"path": "$class_doc", "preserveNullAndEmptyArrays": True}},
            {
                "$project": {
                    "_id": 0,
                    "record_id": {"$toString": "$_id"},
                    "date": {"$dateToString": {"format": "%Y-%m-%d", "date": "$date"}},
                    "status": 1,
                    "marked_at": "$marked_at",
                    "class_id": {"$toString": {"$ifNull": ["$class_id", None]}},
                    "subject": "$class_doc.subject",
                    "start_time": "$class_doc.start_time",
                    "end_time": "$class_doc.end_time",
                    "room": "$class_doc.room",
                }
            },
        ]
        recent_records = await self.db.attendance_records.aggregate(
            recent_pipeline
        ).to_list(15)

        # 7. Coding profiles + statistics
        coding_profiles_cursor = self.db.coding_profiles.find({"student_id": sid})
        coding_list = []
        for p in await coding_profiles_cursor.to_list(20):
            stats = await self.db.coding_statistics.find_one(
                {"student_id": sid, "platform": p["platform"]}
            )
            st = (stats or {}).get("statistics") or {}
            fetched = stats.get("fetched_at") if stats else None
            coding_list.append(
                {
                    "platform": p.get("platform"),
                    "username": p.get("username"),
                    "profile_url": p.get("profile_url"),
                    "sync_status": p.get("sync_status"),
                    "last_synced": p.get("last_synced_at"),
                    "fetched_at": fetched,
                    "rating": st.get("rating"),
                    "problems_solved": int(st.get("problems_solved") or 0),
                    "contests": st.get("contests"),
                    "stars": st.get("stars"),
                }
            )
        # Sort: successfully synced first, then by problems_solved desc
        coding_list.sort(
            key=lambda x: (x["sync_status"] != "success", -(x["problems_solved"] or 0))
        )

        # 8. Leaderboard (overall)
        overall = await self.db.leaderboard_scores.find_one(
            {"student_id": sid, "platform": "overall"}
        )
        rank = None
        if overall:
            rank = (
                await self.db.leaderboard_scores.count_documents(
                    {"platform": "overall", "score": {"$gt": overall.get("score", 0)}}
                )
                + 1
            )
        total_students = await self.db.leaderboard_scores.count_documents(
            {"platform": "overall"}
        )
        leaderboard = {
            "overall_score": round(float(overall.get("score", 0) or 0), 2)
            if overall
            else 0,
            "rank": rank,
            "total_students": total_students,
            "current_streak": (overall.get("metrics") or {}).get("current_streak")
            if overall
            else 0,
            "longest_streak": (overall.get("metrics") or {}).get("longest_streak")
            if overall
            else 0,
            "metrics": (overall.get("metrics") or {}) if overall else {},
        }

        return {
            "profile": profile,
            "attendance": attendance,
            "attendance_trend": attendance_trend,
            "by_subject": by_subject,
            "recent_records": recent_records,
            "coding": {"platforms": coding_list},
            "leaderboard": leaderboard,
            "days": days,
        }

    async def perfect_attendance_students(self, min_pct: float = 100.0) -> list[dict]:
        cursor = self.db.leaderboard_scores.find(
            {"platform": "overall", "metrics.attendance_percentage": {"$gte": min_pct}}
        ).limit(50)
        docs = await cursor.to_list(50)
        return [
            {
                "student_id": str(d["student_id"]),
                "name": d.get("student_name"),
                "attendance": d["metrics"]["attendance_percentage"],
            }
            for d in docs
            if d.get("metrics")
        ]

    async def low_attendance_students(
        self, threshold: float | None = None
    ) -> list[dict]:
        if threshold is None:
            settings_doc = await self.db.settings.find_one({"key": "app"})
            threshold = float((settings_doc or {}).get("attendance_threshold", 75.0))
        cursor = (
            self.db.leaderboard_scores.find(
                {
                    "platform": "overall",
                    "metrics.attendance_percentage": {"$ne": None, "$lt": threshold},
                }
            )
            .sort([("metrics.attendance_percentage", 1)])
            .limit(100)
        )
        docs = await cursor.to_list(100)
        return [
            {
                "student_id": str(d["student_id"]),
                "name": d.get("student_name"),
                "roll_number": d.get("roll_number"),
                "attendance": (d.get("metrics") or {}).get("attendance_percentage"),
            }
            for d in docs
        ]
