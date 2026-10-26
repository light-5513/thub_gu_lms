"""Batches repository."""

from datetime import datetime, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient

from app.core.errors import AppError, NotFoundError
class BatchRepository:
    def __init__(self, db):
        self.db = db
        self.collection = db.batches

    async def get_by_code(self, batch_code: str) -> dict[str, Any]:
        """Get a batch by its unique code."""
        doc = await self.collection.find_one({"batch_code": batch_code})
        if not doc:
            raise NotFoundError(f"Batch with code {batch_code} not found")
        doc["id"] = str(doc.pop("_id"))
        return doc

    async def create_batch(self, batch_data: dict[str, Any]) -> dict[str, Any]:
        """Create a new batch."""
        # Check uniqueness of batch_code
        existing = await self.collection.find_one({"batch_code": batch_data["batch_code"]})
        if existing:
            raise AppError("A batch with this code already exists", status_code=409)

        doc = {
            **batch_data,
            "student_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        result = await self.collection.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        return doc

    async def update_student_count(self, batch_id: str, diff: int) -> None:
        """Update the student count for a batch."""
        from bson import ObjectId
        await self.collection.update_one(
            {"_id": ObjectId(batch_id)},
            {"$inc": {"student_count": diff}}
        )

    async def get(self, batch_id: str) -> dict[str, Any]:
        """Get a batch by ID."""
        from bson import ObjectId
        doc = await self.collection.find_one({"_id": ObjectId(batch_id)})
        if not doc:
            raise NotFoundError("Batch not found")
        doc["id"] = str(doc.pop("_id"))
        return doc
        
    async def delete(self, batch_id: str) -> None:
        """Delete a batch."""
        from bson import ObjectId
        await self.collection.delete_one({"_id": ObjectId(batch_id)})

    async def update_batch(self, batch_id: str, updates: dict[str, Any]) -> dict[str, Any]:
        """Update batch fields."""
        from bson import ObjectId
        await self.collection.update_one(
            {"_id": ObjectId(batch_id)},
            {"$set": updates}
        )
        return await self.get(batch_id)
