from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient

from backend.config.config import get_settings


async def init_db():
    settings = get_settings()
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.MONGO_DB_NAME]

    # Import here to avoid circular imports
    from backend.models.user import User
    from backend.models.lottery import Lottery
    from backend.models.promotion import Promotion
    from backend.models.transaction import Transaction
    from backend.models.draw import Draw
    from backend.models.system_setting import SystemSetting
    from backend.models.msisdn_hash_lookup import MsisdnHashLookup
    from backend.models.payment_provider import PaymentProvider
    from backend.models.webhook import Webhook, WebhookLog
    from backend.models.smtp_config import SMTPConfiguration
    from backend.models.sms_config import SMSConfiguration
    from backend.models.notification import NotificationPreferences

    await init_beanie(
        database=db,
        document_models=[
            User,
            Lottery,
            Promotion,
            Transaction,
            Draw,
            SystemSetting,
            MsisdnHashLookup,
            PaymentProvider,
            Webhook,
            WebhookLog,
            SMTPConfiguration,
            SMSConfiguration,
            NotificationPreferences,
        ],
    )
