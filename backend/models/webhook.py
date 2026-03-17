from datetime import datetime
from typing import Optional, List, Dict, Any
from beanie import Document, PydanticObjectId
from pydantic import Field


class Webhook(Document):
    name: str
    url: str
    method: str = "POST"
    headers: Dict[str, str] = Field(default_factory=dict)
    is_active: bool = True
    events: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "webhooks"


class WebhookLog(Document):
    webhook_id: PydanticObjectId
    event_type: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    response_status: Optional[int] = None
    response_body: Optional[str] = None
    executed_at: datetime = Field(default_factory=datetime.utcnow)
    success: bool = False

    class Settings:
        name = "webhook_logs"
