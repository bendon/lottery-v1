import logging
from typing import Optional

import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from backend.models.smtp_config import SMTPConfiguration

logger = logging.getLogger(__name__)


async def send_email(to: str, subject: str, body: str, html: bool = False) -> bool:
    config = await SMTPConfiguration.find_one({"is_active": True})
    if not config:
        logger.warning("No active SMTP configuration found")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{config.from_name or ''} <{config.from_email}>"
    msg["To"] = to

    part = MIMEText(body, "html" if html else "plain")
    msg.attach(part)

    try:
        await aiosmtplib.send(
            msg,
            hostname=config.host,
            port=config.port,
            username=config.username,
            password=config.password,
            use_tls=config.use_tls,
        )
        return True
    except Exception as e:
        logger.error("Failed to send email: %s", e)
        return False
