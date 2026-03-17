from functools import lru_cache
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGO_DB_NAME: str = "lottery_system"
    SECRET_KEY: str = "change-me-in-production"
    JWT_EXPIRE_MINUTES: int = 30
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # M-Pesa Daraja API
    # Production: https://api.safaricom.co.ke | Sandbox: https://sandbox.safaricom.co.ke
    MPESA_CONSUMER_KEY: str = ""
    MPESA_CONSUMER_SECRET: str = ""
    MPESA_BUSINESS_SHORT_CODE: str = ""    # Till number or Paybill short code
    MPESA_PASSKEY: str = ""
    MPESA_BASE_URL: str = "https://api.safaricom.co.ke"
    # till = CustomerBuyGoodsOnline (Lipa Na M-Pesa), paybill = CustomerPayBillOnline
    MPESA_ACCOUNT_TYPE: str = "till"
    MPESA_CALLBACK_URL: str = ""           # Public HTTPS URL for STK Push results
    MPESA_C2B_CONFIRMATION_URL: str = ""   # Public HTTPS URL for C2B confirmations
    MPESA_C2B_VALIDATION_URL: str = ""     # Public HTTPS URL for C2B validations

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
