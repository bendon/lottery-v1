"""How a lottery accepts M-Pesa: Till vs Paybill (account split)."""

from backend.models.lottery import Lottery


def lottery_uses_paybill_accounts(lottery: Lottery) -> bool:
    """True when lottery is configured for Pay Bill (BillRefNumber / promotion account_number)."""
    return "paybill" in (lottery.payment_types or [])
