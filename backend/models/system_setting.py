from datetime import datetime
from typing import Optional, Dict, Any
from beanie import Document, Indexed
from pydantic import Field


class SystemSetting(Document):
    key: Indexed(str, unique=True)
    value: Optional[str] = None
    structured_value: Optional[Dict[str, Any]] = None
    value_type: str = "string"  # "string" | "json" | "object"
    description: Optional[str] = None
    category: Optional[str] = None  # "payment" | "smtp" | "api" | "general"
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "system_settings"
