from datetime import datetime
from beanie import Document, PydanticObjectId
from pydantic import Field


class NotificationPreferences(Document):
    user_id: PydanticObjectId
    email_enabled: bool = True
    sms_enabled: bool = False
    email_draw_results: bool = True
    email_promotion_updates: bool = True
    sms_draw_results: bool = False
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "notification_preferences"
        indexes = ["user_id"]
