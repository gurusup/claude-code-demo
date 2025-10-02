# ABOUTME: Application settings loading configuration from environment variables
# ABOUTME: Uses Pydantic Settings for validation and type safety
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    openai_api_key: str
    model: str = "gpt-4o"

    class Config:
        env_file = ".env"
        case_sensitive = False
        extra = "ignore"


def get_settings() -> Settings:
    """Get application settings instance"""
    return Settings(
        openai_api_key=os.environ.get("OPENAI_API_KEY", "")
    )
