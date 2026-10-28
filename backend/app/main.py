import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.routes.live_caption import router as live_router
from app.routes.upload_caption import router as upload_router
from app.schemas.caption import HealthResponse
from app.services.media_processor import is_ffmpeg_available

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("captioning_app")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up %s (version %s)", settings.PROJECT_NAME, settings.VERSION)
    logger.info("Allowed CORS origins: %s", settings.cors_origins)
    logger.info("FFmpeg available: %s", is_ffmpeg_available())
    logger.info("Gemini API key configured: %s", bool(settings.GEMINI_API_KEY.strip()))
    yield
    logger.info("Shutting down %s", settings.PROJECT_NAME)


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Real-time live microphone captioning and audio/video transcription using Google Gemini",
    lifespan=lifespan,
)

# CORS Middleware with configurable allowed origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(upload_router)
app.include_router(live_router)


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
@app.get("/api/v1/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Health check endpoint returning system status, model configurations, and dependencies.
    """
    return HealthResponse(
        status="ok",
        version=settings.VERSION,
        gemini_configured=bool(settings.GEMINI_API_KEY.strip()),
        live_model=settings.GEMINI_LIVE_MODEL,
        transcribe_model=settings.GEMINI_TRANSCRIBE_MODEL,
        ffmpeg_available=is_ffmpeg_available(),
    )


# Alias /api/v1/upload to the upload handler
from app.routes.upload_caption import upload_and_transcribe
from fastapi import File, UploadFile, HTTPException
from app.schemas.caption import TranscriptionResponse

@app.post("/api/v1/upload", response_model=TranscriptionResponse, tags=["v1"])
async def api_v1_upload(file: UploadFile = File(...)):
    return await upload_and_transcribe(file=file)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """
    Preserve original status codes and detail messages from HTTPExceptions.
    """
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Safely handle uncaught exceptions with helpful error messaging.
    """
    logger.exception("Unhandled server exception on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": f"Server error: {str(exc)}"},
    )
