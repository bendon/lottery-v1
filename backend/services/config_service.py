import time
from typing import Any, Optional

from backend.config.config import get_settings
from backend.models.system_setting import SystemSetting

# Default values if not found in DB
DEFAULTS = {
    "draw_cooldown_minutes": 5,
    "min_transactions_per_draw": 1,
    "max_draws_per_promotion": 0,  # 0 = unlimited
    "default_payout_amount": 0,
    "default_payout_percentage": 0,
}

# M-Pesa config keys (DB overrides env when set)
MPESA_KEYS = [
    "mpesa_consumer_key",
    "mpesa_consumer_secret",
    "mpesa_business_short_code",
    "mpesa_passkey",
    "mpesa_base_url",
    "mpesa_account_type",
    "mpesa_callback_url",
    "mpesa_c2b_confirmation_url",
    "mpesa_c2b_validation_url",
]

ENV_TO_MPESA_KEY = {
    "MPESA_CONSUMER_KEY": "mpesa_consumer_key",
    "MPESA_CONSUMER_SECRET": "mpesa_consumer_secret",
    "MPESA_BUSINESS_SHORT_CODE": "mpesa_business_short_code",
    "MPESA_PASSKEY": "mpesa_passkey",
    "MPESA_BASE_URL": "mpesa_base_url",
    "MPESA_ACCOUNT_TYPE": "mpesa_account_type",
    "MPESA_CALLBACK_URL": "mpesa_callback_url",
    "MPESA_C2B_CONFIRMATION_URL": "mpesa_c2b_confirmation_url",
    "MPESA_C2B_VALIDATION_URL": "mpesa_c2b_validation_url",
}

_cache: dict = {}
_cache_ts: float = 0
CACHE_TTL = 300  # 5 minutes

_mpesa_cache: Optional[dict] = None
_mpesa_cache_ts: float = 0


async def get_mpesa_config() -> dict:
    """Get effective M-Pesa config: DB values override env when set."""
    global _mpesa_cache, _mpesa_cache_ts
    now = time.time()
    if _mpesa_cache is not None and (now - _mpesa_cache_ts) < 60:  # 1 min TTL for M-Pesa
        return _mpesa_cache

    env = get_settings()
    result = {
        "mpesa_consumer_key": env.MPESA_CONSUMER_KEY,
        "mpesa_consumer_secret": env.MPESA_CONSUMER_SECRET,
        "mpesa_business_short_code": env.MPESA_BUSINESS_SHORT_CODE,
        "mpesa_passkey": env.MPESA_PASSKEY,
        "mpesa_base_url": env.MPESA_BASE_URL,
        "mpesa_account_type": env.MPESA_ACCOUNT_TYPE,
        "mpesa_callback_url": env.MPESA_CALLBACK_URL,
        "mpesa_c2b_confirmation_url": env.MPESA_C2B_CONFIRMATION_URL,
        "mpesa_c2b_validation_url": env.MPESA_C2B_VALIDATION_URL,
    }

    db_settings = await SystemSetting.find({"key": {"$in": MPESA_KEYS}}).to_list()
    for s in db_settings:
        if s.value and str(s.value).strip():
            result[s.key] = s.value.strip()

    _mpesa_cache = result
    _mpesa_cache_ts = now
    return result


def invalidate_mpesa_cache():
    global _mpesa_cache, _mpesa_cache_ts
    _mpesa_cache = None
    _mpesa_cache_ts = 0


async def get_all_settings() -> dict:
    global _cache, _cache_ts
    now = time.time()
    if _cache and (now - _cache_ts) < CACHE_TTL:
        return _cache

    settings = await SystemSetting.find_all().to_list()
    result = dict(DEFAULTS)
    for s in settings:
        if s.value_type == "string":
            result[s.key] = s.value
        else:
            result[s.key] = s.structured_value or s.value

    _cache = result
    _cache_ts = now
    return result


async def get_setting(key: str, default: Any = None) -> Any:
    all_settings = await get_all_settings()
    return all_settings.get(key, default if default is not None else DEFAULTS.get(key))


def invalidate_cache():
    global _cache_ts
    _cache_ts = 0
    invalidate_mpesa_cache()
