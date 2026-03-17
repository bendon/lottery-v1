from datetime import datetime
from typing import Optional, Dict, Any
from beanie import Document, Indexed, PydanticObjectId
from pydantic import Field


class Transaction(Document):
    transaction_number: Indexed(str, unique=True)
    payment_type: str = "till"  # "till" | "paybill" | "card" | "stk_push"
    amount: int  # in cents
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    payment_date: datetime = Field(default_factory=datetime.utcnow)
    product_type: Optional[str] = None  # "lottery"
    product_id: Optional[PydanticObjectId] = None
    promotion_id: Optional[PydanticObjectId] = None  # Set when Paybill account_number matches
    till_number: Optional[str] = None
    paybill_number: Optional[str] = None
    bill_ref_number: Optional[str] = None  # Paybill account (BillRefNumber from C2B)
    api_integration_id: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "transactions"
        indexes = [
            "transaction_number",
            "payment_type",
            "product_type",
            "product_id",
            "promotion_id",
            "paybill_number",
            "bill_ref_number",
            "payment_date",
        ]
