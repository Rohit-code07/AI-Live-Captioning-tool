import os
from pathlib import Path
from dotenv import load_dotenv

# Locate base directory and load .env
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_PATH = BASE_DIR / ".env"
if ENV_PATH.exists():
    load_dotenv(dotenv_path=ENV_PATH)
else:
    load_dotenv()


class Settings:
    PROJECT_NAME: str = "AI Captioning & Transcription API"
    VERSION: str = "1.0.0"

    # Gemini API settings
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_LIVE_MODEL: str = os.getenv("GEMINI_LIVE_MODEL", "gemini-3.5-transcribe-live")
    GEMINI_TRANSCRIBE_MODEL: str = os.getenv("GEMINI_TRANSCRIBE_MODEL", "gemini-3.5-transcribe")

    # Security & CORS
    FRONTEND_ORIGIN: str = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
    
    @property
    def cors_origins(self) -> list[str]:
        origins = [origin.strip() for origin in self.FRONTEND_ORIGIN.split(",") if origin.strip()]
        if not origins:
            origins = ["http://localhost:5173"]
        return origins

    # Uploads
    MAX_UPLOAD_MB: int = int(os.getenv("MAX_UPLOAD_MB", "200"))

    @property
    def max_upload_bytes(self) -> int:
        return self.MAX_UPLOAD_MB * 1024 * 1024

    # Storage paths
    TEMP_DIR: Path = BASE_DIR / "temp"


settings = Settings()
settings.TEMP_DIR.mkdir(parents=True, exist_ok=True)
