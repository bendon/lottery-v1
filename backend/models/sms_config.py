from datetime import datetime
from typing import Optional
from beanie import Document, Indexed
from pydantic import Field


class SMSConfiguration(Document):
    name: Indexed(str, unique=True)
    provider_type: str  # "twilio" | "africas_talking"
    api_key: str
    api_secret: Optional[str] = None
    sender_id: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "sms_configurations"
