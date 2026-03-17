import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config.config import get_settings
from backend.database.connection import init_db
from backend.api import (
    auth,
    users,
    lotteries,
    promotions,
    transactions,
    draws,
    settings,
    dashboard,
    payment_providers,
    webhooks,
    notifications,
    payments,
)
from backend.auth.jwt import hash_password
from backend.models.user import User

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await _seed_admin()
    yield


async def _seed_admin():
    """Create default admin user if none exists."""
    if not await User.find_one({"role": "admin"}):
        admin = User(
            username="admin",
            email="admin@lgain.local",
            hashed_password=hash_password("admin123"),
            full_name="System Admin",
            role="admin",
        )
        await admin.insert()
        logger.info("Default admin created: admin / admin123")


app_settings = get_settings()

app = FastAPI(
    title="L-Gain Lottery System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=app_settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(lotteries.router)
app.include_router(promotions.router)
app.include_router(transactions.router)
app.include_router(draws.router)
app.include_router(settings.router)
app.include_router(dashboard.router)
app.include_router(payment_providers.router)
app.include_router(webhooks.router)
app.include_router(notifications.router)
app.include_router(payments.router)


@app.get("/")
async def root():
    return {"message": "L-Gain Lottery System API", "docs": "/docs"}
