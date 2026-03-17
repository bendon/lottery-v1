import logging
from datetime import datetime
from typing import Any, Dict

import httpx

from backend.models.webhook import Webhook, WebhookLog

logger = logging.getLogger(__name__)


async def fire_event(event_type: str, payload: Dict[str, Any]):
    """Send event payload to all active webhooks subscribed to event_type."""
    webhooks = await Webhook.find({"is_active": True, "events": event_type}).to_list()

    for webhook in webhooks:
        log = WebhookLog(
            webhook_id=webhook.id,
            event_type=event_type,
            payload=payload,
            executed_at=datetime.utcnow(),
        )
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.request(
                    method=webhook.method,
                    url=webhook.url,
                    headers=webhook.headers,
                    json=payload,
                )
            log.response_status = resp.status_code
            log.response_body = resp.text[:1000]
            log.success = resp.status_code < 400
        except Exception as e:
            logger.error("Webhook %s failed: %s", webhook.url, e)
            log.response_body = str(e)
            log.success = False

        await log.insert()
