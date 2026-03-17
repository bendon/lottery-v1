import base64
import logging
from datetime import datetime
from typing import Optional

import httpx

from backend.services import config_service

logger = logging.getLogger(__name__)


async def _get_config():
    """Effective M-Pesa config: DB overrides env."""
    return await config_service.get_mpesa_config()


def _generate_timestamp() -> str:
    return datetime.now().strftime("%Y%m%d%H%M%S")


def _generate_password(shortcode: str, passkey: str, timestamp: str) -> str:
    raw = f"{shortcode}{passkey}{timestamp}"
    return base64.b64encode(raw.encode()).decode()


def _basic_auth_header(consumer_key: str, consumer_secret: str) -> str:
    credentials = base64.b64encode(f"{consumer_key}:{consumer_secret}".encode()).decode()
    return f"Basic {credentials}"


async def get_access_token() -> Optional[str]:
    cfg = await _get_config()
    if not cfg.get("mpesa_consumer_key"):
        logger.warning("M-Pesa credentials not configured")
        return None
    base = (cfg.get("mpesa_base_url") or "https://api.safaricom.co.ke").rstrip("/")
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{base}/oauth/v1/generate",
            params={"grant_type": "client_credentials"},
            headers={"Authorization": _basic_auth_header(
                cfg["mpesa_consumer_key"],
                cfg["mpesa_consumer_secret"],
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
    cfg = await _get_config()
    token = await get_access_token()
    if not token:
        return {"error": "M-Pesa not configured or authentication failed"}

    shortcode = cfg.get("mpesa_business_short_code") or ""
    passkey = cfg.get("mpesa_passkey") or ""
    base = (cfg.get("mpesa_base_url") or "https://api.safaricom.co.ke").rstrip("/")
    callback = cfg.get("mpesa_callback_url") or ""
    account_type = (cfg.get("mpesa_account_type") or "till").lower()

    timestamp = _generate_timestamp()
    password = _generate_password(shortcode, passkey, timestamp)
    kes_amount = max(1, amount // 100)  # convert cents to whole KES

    # Normalize phone: strip leading 0 or +, ensure 2547XXXXXXXX format
    phone = phone.strip().lstrip("+")
    if phone.startswith("0"):
        phone = "254" + phone[1:]

    # Till (Buy Goods) uses CustomerBuyGoodsOnline; Paybill uses CustomerPayBillOnline
    transaction_type = "CustomerBuyGoodsOnline" if account_type == "till" else "CustomerPayBillOnline"
    payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "TransactionType": transaction_type,
        "Amount": kes_amount,
        "PartyA": phone,
        "PartyB": shortcode,
        "PhoneNumber": phone,
        "CallBackURL": callback,
        "AccountReference": account_reference[:12],
        "TransactionDesc": description[:13],
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{base}/mpesa/stkpush/v1/processrequest",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=payload,
        )
    return resp.json()


async def query_stk_status(checkout_request_id: str) -> dict:
    cfg = await _get_config()
    token = await get_access_token()
    if not token:
        return {"error": "M-Pesa not configured or authentication failed"}

    shortcode = cfg.get("mpesa_business_short_code") or ""
    passkey = cfg.get("mpesa_passkey") or ""
    base = (cfg.get("mpesa_base_url") or "https://api.safaricom.co.ke").rstrip("/")

    timestamp = _generate_timestamp()
    password = _generate_password(shortcode, passkey, timestamp)

    payload = {
        "BusinessShortCode": shortcode,
        "Password": password,
        "Timestamp": timestamp,
        "CheckoutRequestID": checkout_request_id,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{base}/mpesa/stkpushquery/v1/query",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=payload,
        )
    return resp.json()


async def register_c2b_urls(
    confirmation_url: Optional[str] = None,
    validation_url: Optional[str] = None,
    shortcode: Optional[str] = None,
) -> dict:
    cfg = await _get_config()
    token = await get_access_token()
    if not token:
        return {"error": "M-Pesa not configured or authentication failed"}

    base = (cfg.get("mpesa_base_url") or "https://api.safaricom.co.ke").rstrip("/")
    payload = {
        "ShortCode": shortcode or cfg.get("mpesa_business_short_code") or "",
        "ResponseType": "Completed",
        "ConfirmationURL": confirmation_url or cfg.get("mpesa_c2b_confirmation_url") or "",
        "ValidationURL": validation_url or cfg.get("mpesa_c2b_validation_url") or "",
    }

    # Production uses C2B v2; Sandbox uses v1
    c2b_version = "v2" if "api.safaricom.co.ke" in base else "v1"
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{base}/mpesa/c2b/{c2b_version}/registerurl",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json=payload,
        )
    return resp.json()
