"""Centralized application configuration loaded from environment variables."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Prefer the repository-root .env; fall back to a .env next to the CWD.
_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


# Sentinel: used in dev only. Production must override via env vars.
_DEV_SECRET_DEFAULT = "dev-only-insecure-secret-change-me"
_DEV_JWT_DEFAULT = "dev-only-insecure-jwt-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(_ROOT_ENV) if _ROOT_ENV.exists() else ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    APP_NAME: str = "LMS"
    APP_ENV: str = "development"
    APP_URL: str = "http://localhost:3000"
    API_URL: str = "http://localhost:8000"

    # Monolith mode: serve the built frontend from this directory.
    # Leave empty to auto-detect `<repo>/frontend/dist`. Set to a path to override.
    FRONTEND_DIST_DIR: str = ""

    # Database
    MONGODB_URI: str | None = None
    MONGODB_DATABASE: str = "lms"

    # Secrets. The defaults are intentionally placeholder strings that will be
    # rejected at startup in any non-development environment.
    SECRET_KEY: str = Field(default=_DEV_SECRET_DEFAULT)
    JWT_SECRET: str = Field(default=_DEV_JWT_DEFAULT)

    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Email (Gmail SMTP with App Password)
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM: str | None = None
    SMTP_USE_TLS: bool = True

    # WhatsApp (OpenWA)
    OPENWA_URL: str | None = None
    OPENWA_API_KEY: str | None = None

    # Redis / worker
    REDIS_URL: str = "redis://localhost:6379/0"

    # Coding platform tokens
    GITHUB_API_TOKEN: str | None = None
    LEETCODE_API_URL: str = "https://leetcode.com/graphql"
    CODECHEF_API_URL: str = "https://www.codechef.com/users/"
    CODEFORCES_API_URL: str = "https://codeforces.com/api"
    ATCODER_API_URL: str = "https://kenkoooo.com/atcoder/atcoder-api/v3"

    @property
    def is_dev(self) -> bool:
        return self.APP_ENV.lower() in {"development", "dev", "local"}

    @property
    def is_production(self) -> bool:
        return not self.is_dev

    @property
    def cors_origins(self) -> list[str]:
        origins = {self.APP_URL.rstrip("/")}
        if self.is_dev:
            origins.update({"http://localhost:3000", "http://127.0.0.1:3000"})
        return sorted(origins)

    @property
    def smtp_configured(self) -> bool:
        return bool(self.SMTP_HOST and self.SMTP_USERNAME and self.SMTP_PASSWORD)

    @property
    def has_insecure_secret(self) -> bool:
        return (
            self.SECRET_KEY == _DEV_SECRET_DEFAULT
            or self.JWT_SECRET == _DEV_JWT_DEFAULT
        )

    @property
    def cookies_secure(self) -> bool:
        """HttpOnly cookies get the Secure flag in any non-dev environment."""
        return self.is_production

    @model_validator(mode="after")
    def _enforce_production_safety(self) -> "Settings":
        """Fail loud in production if the deployer forgot to set secrets."""
        if self.is_production:
            if self.has_insecure_secret:
                raise ValueError(
                    "SECRET_KEY and JWT_SECRET must be overridden via environment "
                    "variables in production. The dev defaults are not safe."
                )
            if self.APP_URL.startswith("http://") or self.API_URL.startswith("http://"):
                raise ValueError("APP_URL and API_URL must use https:// in production.")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
