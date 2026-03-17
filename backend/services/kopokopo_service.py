import logging
from typing import Optional

import httpx

from backend.config.config import get_settings

logger = logging.getLogger(__name__)


async def _get_access_token() -> Optional[str]:
    settings = get_settings()
    if not settings.KOPOKOPO_CLIENT_ID:
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.KOPOKOPO_BASE_URL}/oauth/token",
            data={
                "grant_type": "client_credentials",
                "client_id": settings.KOPOKOPO_CLIENT_ID,
                "client_secret": settings.KOPOKOPO_CLIENT_SECRET,
            },
        )
    if resp.status_code == 200:
        return resp.json().get("access_token")
    logger.error("KopoKopo token error: %s", resp.text)
    return None


async def initiate_stk_push(
    phone: str,
    amount: int,
    till_number: str,
    description: str = "Payment",
) -> dict:
    settings = get_settings()
    token = await _get_access_token()
    if not token:
        return {"error": "KopoKopo not configured"}

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.KOPOKOPO_BASE_URL}/api/v1/incoming-payments",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={
                "payment_channel": "M-PESA STK Push",
                "till_number": till_number,
                "subscriber": {"phone_number": phone},
                "amount": {"currency": "KES", "value": amount / 100},
                "metadata": {"notes": description},
            },
        )
    return resp.json()
