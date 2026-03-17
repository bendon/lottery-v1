from datetime import datetime
from typing import Optional
from beanie import Document, PydanticObjectId
from pydantic import Field


class Promotion(Document):
    user_id: PydanticObjectId
    lottery_id: PydanticObjectId
    name: Optional[str] = None
    account_number: Optional[str] = None  # Paybill account (BillRefNumber) — enables concurrent promotions
    start_date: datetime
    end_date: datetime
    status: str = "active"  # "active" | "completed" | "cancelled"
    created_by: Optional[PydanticObjectId] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "promotions"
        indexes = ["user_id", "lottery_id", "account_number", "start_date", "end_date", "status"]
