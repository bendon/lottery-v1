from datetime import datetime
from typing import Any, Dict, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from backend.auth.dependencies import require_admin
from backend.models.transaction import Transaction
from backend.services.transaction_router import route_transaction

router = APIRouter(prefix="/api/admin/transactions", tags=["transactions"])


class TransactionCreate(BaseModel):
    transaction_number: str
    payment_type: str = "till"
    amount: int  # in cents
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    payment_date: Optional[datetime] = None
    till_number: Optional[str] = None
    paybill_number: Optional[str] = None
    api_integration_id: Optional[str] = None
    metadata: Dict[str, Any] = {}


@router.post("")
async def create_transaction(body: TransactionCreate, _=Depends(require_admin)):
    if await Transaction.find_one({"transaction_number": body.transaction_number}):
        raise HTTPException(status_code=400, detail="Transaction number already exists")

    data = body.dict()
    data["payment_date"] = data.get("payment_date") or datetime.utcnow()
    txn = Transaction(**data)
    await txn.insert()
    await route_transaction(txn)
    return {"id": str(txn.id), **txn.dict()}


@router.get("")
async def list_transactions(
    payment_type: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    search: Optional[str] = Query(None),
    _=Depends(require_admin),
):
    query: dict = {}
    if payment_type:
        query["payment_type"] = payment_type
    if date_from or date_to:
        query["payment_date"] = {}
        if date_from:
            query["payment_date"]["$gte"] = date_from
        if date_to:
            query["payment_date"]["$lte"] = date_to
    if search:
        query["$or"] = [
            {"customer_name": {"$regex": search, "$options": "i"}},
            {"customer_phone": {"$regex": search, "$options": "i"}},
            {"transaction_number": {"$regex": search, "$options": "i"}},
        ]

    txns = await Transaction.find(query).sort("-payment_date").to_list()
    return [{"id": str(t.id), **t.dict()} for t in txns]


@router.get("/{transaction_id}")
async def get_transaction(transaction_id: PydanticObjectId, _=Depends(require_admin)):
    txn = await Transaction.get(transaction_id)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return {"id": str(txn.id), **txn.dict()}
