import os
import secrets

from dotenv import load_dotenv

load_dotenv()


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", secrets.token_hex(32))
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = "Lax"
    SESSION_COOKIE_SECURE = (
        os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"
    )
    PERMANENT_SESSION_LIFETIME = 60 * 60 * 24 * 30

    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    FLASK_DEBUG = os.getenv("FLASK_DEBUG", "1") == "1"
    PORT = int(os.getenv("PORT", "5000"))

    @classmethod
    def validate(cls):
        if not cls.SUPABASE_URL:
            raise RuntimeError(".env에 SUPABASE_URL이 없습니다.")

        if not cls.SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError(".env에 SUPABASE_SERVICE_ROLE_KEY가 없습니다.")
