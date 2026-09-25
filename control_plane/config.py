"""
CDM-OS — Application Settings (loaded from .env)

Uses pydantic-settings to parse environment variables with defaults
suitable for local Docker Compose development.
"""

from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Central configuration loaded from environment variables / .env file."""

    # ── System ────────────────────────────────────────────────
    CDM_ENV: str = "development"
    CDM_LOG_LEVEL: str = "INFO"
    CDM_PORT: int = 8000

    # ── Database ──────────────────────────────────────────────
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str = "cdm_os_db"
    POSTGRES_USER: str = "cdm_admin"
    POSTGRES_PASSWORD: str = "cdm_secure_password"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def async_database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # ── Redis ─────────────────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── Identity & Auth ───────────────────────────────────────
    CDM_JWT_SECRET: str = "super-secret-jwt-key-change-in-production"
    CDM_AUTH_ENABLED: bool = False  # Disabled for local dev by default

    # ── Model Gateway ─────────────────────────────────────────
    MODEL_DEFAULT_PROVIDER: str = "gemini"
    MODEL_FALLBACK_PROVIDER: str = "anthropic"
    ANTHROPIC_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    GEMINI_FREE_TIER: bool = True

    # ── Policy Engine ─────────────────────────────────────────
    POLICY_MODE: str = "enforce"  # enforce | audit_only | dry_run
    POLICY_DEFINITIONS_PATH: str = "policy/definitions"

    # ── MCP Tool Gateway ──────────────────────────────────────
    MCP_GATEWAY_PORT: int = 8080
    MCP_REQUEST_TIMEOUT_SEC: int = 30

    # ── Audit ─────────────────────────────────────────────────
    AUDIT_HMAC_SECRET: str = "hmac-signing-key-for-audit-trail"
    AUDIT_LOG_DIR: str = "audit/logs"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


# Singleton instance — import this everywhere
settings = Settings()
