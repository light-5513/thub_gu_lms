"""Shared response schemas."""

from typing import Any

from pydantic import BaseModel


class Message(BaseModel):
    message: str


class PaginatedResponse(BaseModel):
    items: list[Any]
    total: int
    page: int
    page_size: int
    total_pages: int
