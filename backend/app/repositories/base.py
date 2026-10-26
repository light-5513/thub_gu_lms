"""Shared repository helpers."""

from typing import Any

import bson


def oid(value: Any) -> bson.ObjectId:
    if isinstance(value, bson.ObjectId):
        return value
    return bson.ObjectId(str(value))


def to_str(value: Any) -> str | None:
    return str(value) if value else None


def serialize(doc: dict | None) -> dict | None:
    """Convert Mongo document to JSON-safe dict with string ids."""
    if doc is None:
        return None
    out = {}
    for key, value in doc.items():
        if isinstance(value, bson.ObjectId):
            out[key] = str(value)
        elif isinstance(value, dict):
            out[key] = serialize(value)
        elif isinstance(value, list):
            out[key] = [
                serialize(v)
                if isinstance(v, dict)
                else (str(v) if isinstance(v, bson.ObjectId) else v)
                for v in value
            ]
        else:
            out[key] = value
    if "_id" in out:
        out["id"] = out.pop("_id")
    return out
