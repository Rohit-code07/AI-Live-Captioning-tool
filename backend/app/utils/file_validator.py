import os
import re
from pathlib import Path
from fastapi import HTTPException, UploadFile, status
from app.core.config import settings

# Supported extensions
SUPPORTED_AUDIO_EXTENSIONS = {
    ".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".weba"
}

SUPPORTED_VIDEO_EXTENSIONS = {
    ".mp4", ".mov", ".mkv", ".webm"
}

ALL_SUPPORTED_EXTENSIONS = SUPPORTED_AUDIO_EXTENSIONS | SUPPORTED_VIDEO_EXTENSIONS

# Common MIME types
AUDIO_MIME_TYPES = {
    "audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav",
    "audio/m4a", "audio/x-m4a", "audio/aac", "audio/ogg",
    "audio/flac", "audio/webm", "audio/mp4"
}

VIDEO_MIME_TYPES = {
    "video/mp4", "video/quicktime", "video/x-matroska", "video/webm"
}


def sanitize_filename(filename: str) -> str:
    """
    Remove path traversal sequences and illegal characters from filename.
    """
    # Extract only the base name
    base_name = os.path.basename(filename)
    # Remove any directory separators that might have slipped through
    base_name = re.sub(r"[\\/]+", "", base_name)
    # Clean up non-standard or dangerous characters
    cleaned = re.sub(r"[^\w\s\.-]", "_", base_name).strip()
    return cleaned or "uploaded_media"


def validate_file_extension(filename: str) -> str:
    """
    Validates file extension against allowed audio/video extensions.
    Returns normalized lowercase extension.
    """
    ext = Path(filename).suffix.lower()
    if not ext or ext not in ALL_SUPPORTED_EXTENSIONS:
        supported_list = ", ".join(sorted(ALL_SUPPORTED_EXTENSIONS))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '{ext}'. Supported formats: {supported_list}",
        )
    return ext


def is_video(filename: str, content_type: str | None = None) -> bool:
    """
    Determines whether a file is video or audio based on extension and MIME type.
    """
    ext = Path(filename).suffix.lower()
    if ext in SUPPORTED_VIDEO_EXTENSIONS:
        return True
    if content_type and content_type.lower() in VIDEO_MIME_TYPES:
        return True
    return False


async def validate_upload_file(file: UploadFile) -> tuple[str, bool]:
    """
    Validates uploaded file for presence, name, extension, and non-empty size.
    Returns (sanitized_filename, is_video_flag).
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a filename.",
        )

    clean_name = sanitize_filename(file.filename)
    validate_file_extension(clean_name)
    video_flag = is_video(clean_name, file.content_type)

    return clean_name, video_flag


def validate_file_size(size_bytes: int) -> None:
    """
    Validates file size against configured max upload limit.
    """
    if size_bytes <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )
    if size_bytes > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_MB}MB.",
        )
