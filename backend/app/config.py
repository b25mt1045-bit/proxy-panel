from pydantic_settings import BaseSettings, SettingsConfigDict

# Non-overlapping buckets accepted by Qloo's signal.demographics.age (day-1 probe 2).
AGE_BUCKETS = ["24_and_younger", "25_to_29", "30_to_34", "35_to_44", "45_to_54", "55_and_older"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    QLOO_API_KEY: str = ""
    QLOO_BASE_URL: str = "https://hackathon.api.qloo.com"
    QLOO_MOCK: bool = True
    DEMOGRAPHICS_ENABLED: bool = True

    LLM_API_KEY: str = ""
    LLM_SMALL: str = ""
    LLM_BIG: str = ""
    LLM_MOCK: bool = True

    DATABASE_URL: str = "sqlite+aiosqlite:///./proxy.db"
    DAILY_LLM_CAP_USD: float = 5
    RUNS_PER_IP_PER_DAY: int = 5
    TRUST_PROXY: bool = False
    CORS_ORIGINS: str = "http://localhost:3000"


settings = Settings()
