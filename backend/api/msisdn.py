"""
MSISDN decode API — mpesa-hash-decoder compatible.

Your own decode endpoint. Call from mpesa-hash-decoder or any client.
"""
import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from backend.models.msisdn_hash_lookup import MsisdnHashLookup

router = APIRouter(prefix="/api/msisdn", tags=["msisdn"])
logger = logging.getLogger(__name__)


class DecodeRequest(BaseModel):
    hashedPhone: str
    algo: str = "Sha256"


class DecodeResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None


@router.post("/decode", response_model=DecodeResponse)
async def decode_msisdn(body: DecodeRequest):
    """
    Decode a hashed MSISDN to phone number (mpesa-hash-decoder format).

    **Request:**
    ```json
    {
      "hashedPhone": "<64-char-sha256-hex>",
      "algo": "Sha256"
    }
    ```

    **Response (success):**
    ```json
    {
      "success": true,
      "message": "Decoded successfully",
      "data": {
        "_id": "<lookup-id>",
        "telco": "safaricom",
        "phone": "254712345678",
        "sha256Hash": "<hash>"
      }
    }
    ```

    **Response (not found):**
    ```json
    {
      "success": false,
      "message": "No phone found for hash",
      "data": null
    }
    ```
    """
    hashed = (body.hashedPhone or "").strip().lower()
    if not hashed or len(hashed) != 64 or not all(c in "0123456789abcdef" for c in hashed):
        return DecodeResponse(
            success=False,
            message="Invalid hash format. Expected 64-char hex.",
            data=None,
        )

    lookup = await MsisdnHashLookup.find_one({"sha256_hash": hashed})
    if not lookup:
        logger.debug("MSISDN decode: hash not found %s", hashed[:16] + "...")
        return DecodeResponse(
            success=False,
            message="No phone found for hash",
            data=None,
        )

    return DecodeResponse(
        success=True,
        message="Decoded successfully",
        data={
            "_id": str(lookup.id),
            "telco": "safaricom",
            "phone": lookup.phone,
            "sha256Hash": lookup.sha256_hash,
        },
    )
