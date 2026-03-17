import logging
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, Request

from backend.models.transaction import Transaction
from backend.services.transaction_router import route_transaction

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

logger = logging.getLogger(__name__)

# M-Pesa requires a 200 with this body, or it will keep retrying
MPESA_ACK = {"ResultCode": 0, "ResultDesc": "Accepted"}


def _extract_stk_metadata(items: list) -> Dict[str, Any]:
    """Extract key-value pairs from M-Pesa CallbackMetadata.Item list."""
    return {item["Name"]: item.get("Value") for item in items if "Name" in item}


def _parse_mpesa_time(raw: Optional[str]) -> datetime:
    """Parse M-Pesa TransTime format: YYYYMMDDHHmmss"""
    if raw:
        try:
            return datetime.strptime(str(raw), "%Y%m%d%H%M%S")
        except ValueError:
            pass
    return datetime.utcnow()


@router.post("/mpesa/c2b")
async def mpesa_c2b_confirmation(request: Request):
    """
    C2B Confirmation — fired by M-Pesa when a customer pays via Till or Paybill.
    Required fields: TransID, TransAmount, MSISDN, FirstName, LastName,
                     BusinessShortCode, BillRefNumber, TransTime
    """
    try:
        data: Dict[str, Any] = await request.json()
        trans_id: str = data.get("TransID", "")
        logger.info("M-Pesa C2B confirmation: %s", trans_id)

        if not trans_id:
            return MPESA_ACK

        if await Transaction.find_one({"transaction_number": trans_id}):
            logger.info("Duplicate C2B: %s", trans_id)
            return MPESA_ACK

        raw_amount = float(data.get("TransAmount", 0))
        amount_cents = int(raw_amount * 100)
        shortcode = str(data.get("BusinessShortCode", ""))
        first = data.get("FirstName", "")
        last = data.get("LastName", "")
        customer_name = f"{first} {last}".strip() or None

        txn = Transaction(
            transaction_number=trans_id,
            payment_type="till",
            amount=amount_cents,
            customer_name=customer_name,
            customer_phone=str(data.get("MSISDN", "")),
            payment_date=_parse_mpesa_time(data.get("TransTime")),
            till_number=shortcode,
            metadata=data,
        )
        await txn.insert()
        await route_transaction(txn)

        return MPESA_ACK
    except Exception as e:
        logger.error("C2B webhook error: %s", e)
        return MPESA_ACK  # Always 200 to M-Pesa


@router.post("/mpesa/c2b/validate")
async def mpesa_c2b_validation(request: Request):
    """
    C2B Validation — called before confirmation (optional).
    Return ResultCode 0 to accept the payment, non-zero to reject.
    """
    data = await request.json()
    logger.info("M-Pesa C2B validation: %s", data.get("TransID"))
    return MPESA_ACK


@router.post("/mpesa/stk-callback")
async def mpesa_stk_callback(request: Request):
    """
    STK Push result — fired after customer responds to the M-Pesa prompt.
    Success: ResultCode=0 with CallbackMetadata (Amount, MpesaReceiptNumber, PhoneNumber).
    Failure: ResultCode != 0 (cancelled, wrong PIN, timeout).
    """
    try:
        data: Dict[str, Any] = await request.json()
        callback = data.get("Body", {}).get("stkCallback", {})
        result_code: int = callback.get("ResultCode", -1)
        checkout_id: str = callback.get("CheckoutRequestID", "")

        logger.info("STK callback %s — ResultCode: %s", checkout_id, result_code)

        if result_code != 0:
            logger.info("STK not completed: %s", callback.get("ResultDesc"))
            return MPESA_ACK

        meta_items = callback.get("CallbackMetadata", {}).get("Item", [])
        meta = _extract_stk_metadata(meta_items)

        receipt: Optional[str] = meta.get("MpesaReceiptNumber")
        if not receipt:
            return MPESA_ACK

        if await Transaction.find_one({"transaction_number": receipt}):
            return MPESA_ACK

        raw_amount = float(meta.get("Amount", 0))
        amount_cents = int(raw_amount * 100)

        txn = Transaction(
            transaction_number=receipt,
            payment_type="stk_push",
            amount=amount_cents,
            customer_phone=str(meta.get("PhoneNumber", "")),
            payment_date=datetime.utcnow(),
            metadata=data,
        )
        await txn.insert()
        await route_transaction(txn)

        return MPESA_ACK
    except Exception as e:
        logger.error("STK callback error: %s", e)
        return MPESA_ACK


@router.post("/{webhook_id}")
async def generic_webhook(webhook_id: str, request: Request):
    """Generic catch-all webhook endpoint."""
    try:
        data = await request.json()
        logger.info("Generic webhook %s received", webhook_id)
        return {"status": "received", "webhook_id": webhook_id}
    except Exception as e:
        logger.error("Generic webhook error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
