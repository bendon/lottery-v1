from datetime import datetime
from typing import Optional
from beanie import Document, Indexed
from pydantic import Field


class SMTPConfiguration(Document):
    name: Indexed(str, unique=True)
    host: str
    port: int = 587
    username: str
    password: str
    use_tls: bool = True
    from_email: str
    from_name: Optional[str] = None
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "smtp_configurations"
