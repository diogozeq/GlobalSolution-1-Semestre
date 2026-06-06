"""Application configuration loaded from environment / .env file."""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # App
    app_name: str = "OrbitGuard AI"
    version: str = "1.0.0"
    environment: str = "development"

    # Database
    database_url: str = "sqlite:///./orbitguard.db"

    # CORS (comma separated)
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    # NASA FIRMS
    firms_map_key: str = ""

    # OpenRouter / LLM
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    llm_report_models: str = (
        "anthropic/claude-3.5-sonnet,openai/gpt-4o-mini,"
        "meta-llama/llama-3.1-8b-instruct"
    )
    llm_agent_models: str = "openai/gpt-4o-mini,meta-llama/llama-3.1-8b-instruct"

    # RAG
    embeddings_provider: str = "local"  # local | none
    chroma_path: str = "./.chroma"
    knowledge_base_path: str = "app/knowledge_base"

    # HTTP
    http_timeout: float = 20.0
    http_retries: int = 2

    # Risk engine weights
    risk_w_fire: float = 0.40
    risk_w_weather: float = 0.30
    risk_w_spread: float = 0.15
    risk_w_trend: float = 0.15

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def report_models(self) -> list[str]:
        return [m.strip().lstrip("~") for m in self.llm_report_models.split(",") if m.strip()]

    @property
    def agent_models(self) -> list[str]:
        return [m.strip().lstrip("~") for m in self.llm_agent_models.split(",") if m.strip()]

    @property
    def llm_enabled(self) -> bool:
        return bool(self.openrouter_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
