from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.auth.dependencies import get_current_user, require_admin
from backend.models.transaction import Transaction
from backend.services.mpesa_service import (
    initiate_stk_push,
    query_stk_status,
    register_c2b_urls,
)

router = APIRouter(prefix="/api/payments", tags=["payments"])


class STKPushRequest(BaseModel):
    phone: str
    amount: int  # in cents
    account_reference: str = "LotteryPayment"
    description: str = "Lottery Payment"


class C2BRegisterRequest(BaseModel):
    confirmation_url: str = ""
    validation_url: str = ""
    shortcode: str = ""


@router.post("/stk-push")
async def stk_push(body: STKPushRequest, _=Depends(get_current_user)):
    """Initiate an M-Pesa STK Push (Lipa Na M-Pesa) to a customer's phone."""
    result = await initiate_stk_push(
        phone=body.phone,
        amount=body.amount,
        account_reference=body.account_reference,
        description=body.description,
    )
    if "error" in result:
        raise HTTPException(status_code=503, detail=result["error"])
    return result


@router.get("/stk-status/{checkout_request_id}")
async def stk_status(checkout_request_id: str, _=Depends(get_current_user)):
    """Query the status of an STK Push request from M-Pesa Daraja."""
    result = await query_stk_status(checkout_request_id)
    if "error" in result:
        raise HTTPException(status_code=503, detail=result["error"])
    return result


@router.post("/c2b/register")
async def c2b_register(body: C2BRegisterRequest, _=Depends(require_admin)):
    """Register C2B confirmation and validation URLs with M-Pesa Daraja."""
    result = await register_c2b_urls(
        confirmation_url=body.confirmation_url or None,
        validation_url=body.validation_url or None,
        shortcode=body.shortcode or None,
    )
    if "error" in result:
        raise HTTPException(status_code=503, detail=result["error"])
    return result


@router.get("/status/{transaction_id}")
async def payment_status(transaction_id: str, _=Depends(get_current_user)):
    """Look up a transaction by its M-Pesa receipt number."""
    txn = await Transaction.find_one({"transaction_number": transaction_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {
        "transaction_number": txn.transaction_number,
        "amount": txn.amount,
        "payment_type": txn.payment_type,
        "payment_date": txn.payment_date,
        "product_type": txn.product_type,
        "product_id": str(txn.product_id) if txn.product_id else None,
    }
