from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/equipos_lab"
    APP_TITLE: str = "Gestión de Equipo de Cómputo - Laboratorio"
    APP_VERSION: str = "1.0.0"

    class Config:
        env_file = ".env"


settings = Settings()
