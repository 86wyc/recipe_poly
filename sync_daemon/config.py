"""
Configuration settings for the Local Admin Sync Daemon.

Loads environment variables from `.env.daemon` in the project root.
Uses pydantic-settings for validation and type coercion.
"""

from pathlib import Path
from typing import Optional

from pydantic import AnyHttpUrl, Field, validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class DaemonSettings(BaseSettings):
    """
    Runtime configuration for the sync daemon.

    All values can be overridden by environment variables or a `.env.daemon` file.
    """

    # PostgreSQL
    DATABASE_URL: str = Field(..., env="DATABASE_URL")

    # Ollama
    OLLAMA_URL: AnyHttpUrl = Field(default="http://localhost:11434")
    OLLAMA_MODEL: str = Field(default="llama3:8b-instruct-q8_0")

    # ComfyUI
    COMFYUI_URL: AnyHttpUrl = Field(default="http://localhost:8188")

    # Cloudflare R2
    R2_ENDPOINT_URL: AnyHttpUrl = Field(..., env="R2_ENDPOINT_URL")
    R2_ACCESS_KEY_ID: str = Field(..., env="R2_ACCESS_KEY_ID")
    R2_SECRET_ACCESS_KEY: str = Field(..., env="R2_SECRET_ACCESS_KEY")
    R2_BUCKET_NAME: str = Field(..., env="R2_BUCKET_NAME")
    # Public base URL for uploaded objects
    R2_PUBLIC_BASE_URL: Optional[AnyHttpUrl] = Field(default=None, env="R2_PUBLIC_BASE_URL")

    # Hono API
    HONO_API_URL: AnyHttpUrl = Field(default="http://localhost:3000")

    # Pipeline
    CONCURRENCY_LIMIT: int = Field(default=1, ge=1)
    TEMP_DIR: Path = Field(default=Path("/tmp/sync-daemon"))
    LOG_LEVEL: str = Field(default="INFO")

    # Optional timeouts (seconds)
    OLLAMA_TIMEOUT: float = Field(default=120.0)
    COMFYUI_TIMEOUT: float = Field(default=300.0)
    R2_UPLOAD_TIMEOUT: float = Field(default=60.0)
    HONO_API_TIMEOUT: float = Field(default=30.0)

    model_config = SettingsConfigDict(
        env_file=".env.daemon",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    @validator("TEMP_DIR", pre=True)
    def create_temp_dir(cls, v):
        """Ensure TEMP_DIR exists; if not, create it."""
        path = Path(v)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @validator("LOG_LEVEL", pre=True)
    def validate_log_level(cls, v):
        allowed = {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}
        v = str(v).upper()
        if v not in allowed:
            raise ValueError(f"LOG_LEVEL must be one of {allowed}")
        return v

    @validator("CONCURRENCY_LIMIT", pre=True)
    def validate_concurrency(cls, v):
        v = int(v)
        if v < 1:
            raise ValueError("CONCURRENCY_LIMIT must be at least 1")
        return v

