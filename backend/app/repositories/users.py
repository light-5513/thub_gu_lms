"""User + student data access."""

import builtins
import re
from typing import Any

from app.repositories.base import oid, to_str


def escape_regex(value: str) -> str:
    return re.escape(value)


class UserRepository:
    def __init__(self, db):
        self.db = db
        self.col = db.users

    async def get_by_email(self, email: str) -> dict | None:
        return await self.col.find_one({"email": email.lower().strip()})

    async def get_by_id(self, user_id: str) -> dict | None:
        return await self.col.find_one({"_id": oid(user_id)})

    async def create(self, data: dict) -> dict:
        data = dict(data)
        data.setdefault("email", (data.get("email") or "").lower().strip())
        result = await self.col.insert_one(data)
        data["_id"] = result.inserted_id
        return data

    async def update(self, user_id: str, update: dict) -> None:
        await self.col.update_one({"_id": oid(user_id)}, {"$set": update})


class StudentRepository:
    def __init__(self, db):
        self.db = db
        self.col = db.students

    async def get_by_id(self, student_id: str) -> dict | None:
        try:
            return await self.col.find_one({"_id": oid(student_id)})
        except Exception:
            return None

    async def find_by_ids(self, student_ids: builtins.list[str]) -> builtins.list[dict]:
        object_ids = []
        for student_id in student_ids:
            try:
                object_ids.append(oid(student_id))
            except Exception:
                continue
        if not object_ids:
            return []
        cursor = self.col.find({"_id": {"$in": object_ids}})
        return await cursor.to_list(length=len(object_ids))

    async def get_by_email(self, email: str) -> dict | None:
        return await self.col.find_one({"email": email.lower().strip()})

    async def get_by_roll(self, roll_number: str) -> dict | None:
        return await self.col.find_one({"roll_number": roll_number.strip()})

    async def create(self, data: dict) -> dict:
        data = dict(data)
        data["email"] = data["email"].lower().strip()
        result = await self.col.insert_one(data)
        data["_id"] = result.inserted_id
        return data

    async def update(self, student_id: str, update: dict) -> None:
        await self.col.update_one({"_id": oid(student_id)}, {"$set": update})

    async def delete(self, student_id: str) -> None:
        await self.col.delete_one({"_id": oid(student_id)})

    async def count(self, filters: dict | None = None) -> int:
        return await self.col.count_documents(filters or {})

    def build_filters(
        self,
        search: str | None = None,
        course: str | None = None,
        branch: str | None = None,
        section: str | None = None,
        batch_id: str | None = None,
        academic_year_id: str | None = None,
        status: str | None = None,
    ) -> dict:
        filters: dict[str, Any] = {}
        if search:
            pattern = {"$regex": escape_regex(search), "$options": "i"}
            filters["$or"] = [
                {"first_name": pattern},
                {"last_name": pattern},
                {"email": pattern},
                {"roll_number": pattern},
            ]
        for field, value in {
            "course": course,
            "branch": branch,
            "section": section,
            "batch_id": batch_id,
            "academic_year_id": academic_year_id,
            "status": status,
        }.items():
            if value:
                filters[field] = value
        return filters

    async def list(
        self,
        filters: dict | None = None,
        page: int = 1,
        page_size: int = 20,
        sort_by: str = "first_name",
        sort_dir: int = 1,
    ) -> tuple[list[dict], int]:
        filters = filters or {}
        total = await self.col.count_documents(filters)
        cursor = (
            self.col.find(filters)
            .sort([(sort_by, sort_dir)])
            .skip((max(page, 1) - 1) * page_size)
            .limit(page_size)
        )
        return await cursor.to_list(length=page_size), total

    async def find_by_group(
        self,
        course: str | None = None,
        branch: str | None = None,
        section: str | None = None,
        batch_id: str | None = None,
        academic_year_id: str | None = None,
        active_only: bool = True,
    ) -> builtins.list[dict]:
        # Invitation-created and older profiles may predate the status field.
        # Treat those like the active default exposed by StudentService.serialize,
        # while keeping explicitly inactive or unknown statuses out of new rosters.
        filters: dict[str, Any] = {
            "$or": [{"status": "active"}, {"status": {"$exists": False}}]
        } if active_only else {}
        if course: filters["course"] = course
        if branch: filters["branch"] = branch
        if section: filters["section"] = section
        if batch_id: filters["batch_id"] = batch_id
        if academic_year_id: filters["academic_year_id"] = academic_year_id
        
        cursor = self.col.find(filters).sort([("roll_number", 1)])
        return await cursor.to_list(length=None)

    async def all_active_ids(self) -> builtins.list[str]:
        cursor = self.col.find({"status": "active"}, {"_id": 1})
        docs = await cursor.to_list(length=100000)
        return [to_str(d["_id"]) for d in docs]
