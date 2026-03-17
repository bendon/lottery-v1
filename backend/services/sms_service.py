import logging

import httpx

from backend.models.sms_config import SMSConfiguration

logger = logging.getLogger(__name__)


async def send_sms(phone: str, message: str) -> bool:
    config = await SMSConfiguration.find_one({"is_active": True})
    if not config:
        logger.warning("No active SMS configuration found")
        return False

    try:
        if config.provider_type == "africas_talking":
            return await _send_africas_talking(config, phone, message)
        elif config.provider_type == "twilio":
            return await _send_twilio(config, phone, message)
        else:
            logger.error("Unknown SMS provider: %s", config.provider_type)
            return False
    except Exception as e:
        logger.error("Failed to send SMS: %s", e)
        return False


async def _send_africas_talking(config: SMSConfiguration, phone: str, message: str) -> bool:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.africastalking.com/version1/messaging",
            headers={
                "apiKey": config.api_key,
                "Content-Type": "application/x-www-form-urlencoded",
                "Accept": "application/json",
            },
            data={
                "username": config.sender_id or "sandbox",
                "to": phone,
                "message": message,
            },
        )
    return resp.status_code == 201


async def _send_twilio(config: SMSConfiguration, phone: str, message: str) -> bool:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{config.api_key}/Messages.json",
            auth=(config.api_key, config.api_secret or ""),
            data={"From": config.sender_id, "To": phone, "Body": message},
        )
    return resp.status_code == 201
