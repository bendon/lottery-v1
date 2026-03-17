import base64
import logging
from datetime import datetime
from typing import Optional

import httpx

from backend.config.config import get_settings

logger = logging.getLogger(__name__)


def _get_settings():
    return get_settings()


def _generate_timestamp() -> str:
    return datetime.now().strftime("%Y%m%d%H%M%S")


def _generate_password(shortcode: str, passkey: str, timestamp: str) -> str:
    raw = f"{shortcode}{passkey}{timestamp}"
    return base64.b64encode(raw.encode()).decode()


def _basic_auth_header(consumer_key: str, consumer_secret: str) -> str:
    credentials = base64.b64encode(f"{consumer_key}:{consumer_secret}".encode()).decode()
    return f"Basic {credentials}"


async def get_access_token() -> Optional[str]:
    settings = _get_settings()
    if not settings.MPESA_CONSUMER_KEY:
        logger.warning("M-Pesa credentials not configured")
        return None
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.MPESA_BASE_URL}/oauth/v1/generate",
            params={"grant_type": "client_credentials"},
            headers={"Authorization": _basic_auth_header(
                settings.MPESA_CONSUMER_KEY,
                settings.MPESA_CONSUMER_SECRET,
            )},
        )
    if resp.status_code == 200:
        return resp.json().get("access_token")
    logger.error("M-Pesa token error %s: %s", resp.status_code, resp.text)
    return None


async def initiate_stk_push(
    phone: str,
    amount: int,  # in cents → converted to KES whole number
    account_reference: str = "LotteryPayment",
    description: str = "Lottery Payment",
) -> dict:
    settings = _get_settings()
    token = await get_access_token()
    if not token:
        return {"error": "M-Pesa not configured or authentication failed"}

    timestamp = _generate_timestamp()
    password = _generate_password(
        settings.MPESA_BUSINESS_SHORT_CODE,
        settings.MPESA_PASSKEY,
        timestamp,
    )
    kes_amount = max(1, amount // 100)  # convert cents to whole KES

    # Normalize phone: strip leading 0 or +, ensure 2547XXXXXXXX format
    phone = phone.strip().lstrip("+")
    if phone.startswith("0"):
        phone = "254" + phone[1:]

    # Till (Buy Goods) uses CustomerBuyGoodsOnline; Paybill uses CustomerPayBillOnline
    transaction_type = (
        "CustomerBuyGoodsOnline" if settings.MPESA_ACCOUNT_TYPE.lower() == "till"
        else "CustomerPayBillOnline"
    )
    payload = {
        "BusinessShortCode": settings.MPESA_BUSINESS_SHORT_CODE,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": transaction_type,
        "Amount": kes_amount,
        "PartyA": phone,
        "PartyB": settings.MPESA_BUSINESS_SHORT_CODE,
        "PhoneNumber": phone,
        "CallBackURL": settings.MPESA_CALLBACK_URL,
        "AccountReference": account_reference[:12],
        "TransactionDesc": description[:13],
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.MPESA_BASE_URL}/mpesa/stkpush/v1/processrequest",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=payload,
        )
    return resp.json()


async def query_stk_status(checkout_request_id: str) -> dict:
    settings = _get_settings()
    token = await get_access_token()
    if not token:
        return {"error": "M-Pesa not configured or authentication failed"}

    timestamp = _generate_timestamp()
    password = _generate_password(
        settings.MPESA_BUSINESS_SHORT_CODE,
        settings.MPESA_PASSKEY,
        timestamp,
    )

    payload = {
        "BusinessShortCode": settings.MPESA_BUSINESS_SHORT_CODE,
        "Password": password,
        "Timestamp": timestamp,
        "CheckoutRequestID": checkout_request_id,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.MPESA_BASE_URL}/mpesa/stkpushquery/v1/query",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=payload,
        )
    return resp.json()


async def register_c2b_urls(
    confirmation_url: Optional[str] = None,
    validation_url: Optional[str] = None,
    shortcode: Optional[str] = None,
) -> dict:
    settings = _get_settings()
    token = await get_access_token()
    if not token:
        return {"error": "M-Pesa not configured or authentication failed"}

    payload = {
        "ShortCode": shortcode or settings.MPESA_BUSINESS_SHORT_CODE,
        "ResponseType": "Completed",
        "ConfirmationURL": confirmation_url or settings.MPESA_C2B_CONFIRMATION_URL,
        "ValidationURL": validation_url or settings.MPESA_C2B_VALIDATION_URL,
    }

    # Production uses C2B v2; Sandbox uses v1
    c2b_version = "v2" if "api.safaricom.co.ke" in settings.MPESA_BASE_URL else "v1"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{settings.MPESA_BASE_URL}/mpesa/c2b/{c2b_version}/registerurl",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=payload,
        )
    return resp.json()
