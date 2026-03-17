from datetime import datetime
from typing import Optional
from beanie import Document, PydanticObjectId
from pydantic import Field


class Draw(Document):
    promotion_id: PydanticObjectId
    presenter_id: Optional[PydanticObjectId] = None
    transaction_id: PydanticObjectId
    winning_number: str
    draw_type: str = "manual"  # "manual" | "auto"
    drawn_at: datetime = Field(default_factory=datetime.utcnow)
    notes: Optional[str] = None

    class Settings:
        name = "draws"
        indexes = ["promotion_id", "presenter_id", "transaction_id", "drawn_at"]
