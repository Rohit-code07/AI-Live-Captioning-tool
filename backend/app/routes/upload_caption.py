import logging
import uuid
from pathlib import Path
from fastapi import APIRouter, File, HTTPException, UploadFile, status
from app.core.config import settings
from app.schemas.caption import (
    TranscriptionResponse,
    ReExportRequest,
    SubtitleExportFormats,
)
from app.services.gemini_transcription import transcribe_audio_file
from app.services.media_processor import (
    cleanup_file,
    extract_audio_from_video,
    is_ffmpeg_available,
)
from app.services.subtitle_generator import export_from_segments
from app.utils.file_validator import (
    validate_upload_file,
    validate_file_size,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/captions", tags=["Captions"])


@router.post("/upload", response_model=TranscriptionResponse)
async def upload_and_transcribe(file: UploadFile = File(...)):
    """
    Receives an audio or video file, validates it, extracts audio with FFmpeg if video,
    transcribes it with Gemini, and returns formatted cues and downloadable subtitles.
    """
    clean_filename, is_video_file = await validate_upload_file(file)

    unique_id = uuid.uuid4().hex
    input_suffix = Path(clean_filename).suffix.lower()
    temp_input_path = settings.TEMP_DIR / f"{unique_id}_input{input_suffix}"
    temp_extracted_audio: Path | None = None

    try:
        # Stream file to disk while validating size
        total_bytes = 0
        chunk_size = 1024 * 1024  # 1MB chunks

        with open(temp_input_path, "wb") as f_out:
            while chunk := await file.read(chunk_size):
                total_bytes += len(chunk)
                if total_bytes > settings.max_upload_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                        detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_MB}MB.",
                    )
                f_out.write(chunk)

        validate_file_size(total_bytes)
        logger.info("Saved upload %s (%d bytes) to %s", clean_filename, total_bytes, temp_input_path.name)

        # If video, extract audio using FFmpeg if available, or upload video container directly to Gemini
        if is_video_file:
            if is_ffmpeg_available():
                temp_extracted_audio = settings.TEMP_DIR / f"{unique_id}_extracted.mp3"
                logger.info("Extracting audio from video %s using FFmpeg...", clean_filename)
                audio_for_transcription = extract_audio_from_video(temp_input_path, temp_extracted_audio)
            else:
                logger.info("FFmpeg not installed. Uploading video container %s directly to Gemini API...", clean_filename)
                audio_for_transcription = temp_input_path
        else:
            audio_for_transcription = temp_input_path

        # Send to Gemini transcription
        response = await transcribe_audio_file(
            audio_path=audio_for_transcription,
            original_filename=clean_filename,
        )
        return response

    finally:
        # Safely remove all local temp media files
        cleanup_file(temp_input_path)
        if temp_extracted_audio:
            cleanup_file(temp_extracted_audio)


@router.post("/re-export", response_model=SubtitleExportFormats)
async def re_export_subtitles(req: ReExportRequest):
    """
    Re-exports TXT, SRT, and WebVTT based on updated or edited segments from the frontend.
    """
    if not req.segments:
        return SubtitleExportFormats(txt="", srt="", vtt="")
    return export_from_segments(req.segments)
