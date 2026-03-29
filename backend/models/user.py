from datetime import datetime
from typing import Optional
from beanie import Document, Indexed
from pydantic import Field


class User(Document):
    username: Indexed(str, unique=True)
    email: Indexed(str, unique=True)
    hashed_password: str
    full_name: Optional[str] = None
    role: str = "presenter"  # "admin" | "auditor" | "presenter"
    user_type: Optional[str] = None  # "radio_station" | "ad_agency" | "influencer" | "promoter"
    organization: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "users"
        indexes = ["username", "email", "user_type"]
