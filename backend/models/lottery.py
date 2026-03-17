from datetime import datetime
from typing import Optional, List, Dict, Any
from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field


class Lottery(Document):
    name: Indexed(str, unique=True)
    description: Optional[str] = None
    lottery_type: str = "random_pick"  # "random_pick" | "sequential"
    till_number: Optional[str] = None
    paybill_number: Optional[str] = None
    api_integration_id: Optional[str] = None
    payment_types: List[str] = ["till"]  # "till" | "paybill" | "card"
    settings: Dict[str, Any] = Field(default_factory=dict)
    payout_amount: Optional[int] = None  # in cents
    payout_percentage: Optional[float] = None
    is_active: bool = True
    created_by: Optional[PydanticObjectId] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "lotteries"
        indexes = ["name", "lottery_type", "is_active", "till_number", "paybill_number"]
