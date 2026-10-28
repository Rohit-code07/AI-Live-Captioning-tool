import logging
import os
import shutil
import subprocess
from pathlib import Path
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


def is_ffmpeg_available() -> bool:
    """
    Checks if ffmpeg executable is available in PATH.
    """
    return shutil.which("ffmpeg") is not None


def extract_audio_from_video(video_path: Path, output_audio_path: Path) -> Path:
    """
    Extracts audio track from a video file using FFmpeg.
    Converts to 16kHz mono MP3 or WAV for optimal transcription compatibility.
    """
    if not is_ffmpeg_available():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "FFmpeg is required to extract audio from video files, but it was not found "
                "in the system PATH. Please install FFmpeg or upload an audio file directly."
            ),
        )

    if not video_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Video file not found: {video_path.name}",
        )

    cmd = [
        "ffmpeg",
        "-y",                   # Overwrite output
        "-i", str(video_path),  # Input video
        "-vn",                  # Disable video recording
        "-acodec", "libmp3lame",
        "-ar", "16000",         # 16kHz sample rate
        "-ac", "1",             # Mono channel
        "-q:a", "4",            # Good quality VBR
        str(output_audio_path),
    ]

    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=180,  # 3 minute timeout for extraction
        )
        if result.returncode != 0:
            logger.error("FFmpeg audio extraction failed: %s", result.stderr)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to extract audio from video: {result.stderr[-300:] if result.stderr else 'Unknown error'}",
            )
        return output_audio_path
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="FFmpeg audio extraction timed out.",
        )
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        logger.exception("Unexpected error during FFmpeg execution")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"FFmpeg processing error: {str(e)}",
        )


def cleanup_file(file_path: Path | str | None) -> None:
    """
    Safely deletes a local file if it exists.
    """
    if not file_path:
        return
    try:
        p = Path(file_path)
        if p.exists() and p.is_file():
            p.unlink(missing_ok=True)
    except Exception as e:
        logger.warning("Failed to clean up temporary file %s: %s", file_path, e)
