import pytest
from fastapi import HTTPException
from app.utils.file_validator import (
    sanitize_filename,
    validate_file_extension,
    is_video,
    validate_file_size,
)


def test_sanitize_filename():
    assert sanitize_filename("simple_audio.mp3") == "simple_audio.mp3"
    assert sanitize_filename("../../etc/passwd.mp3") == "passwd.mp3"
    assert sanitize_filename("..\\..\\windows\\system32\\calc.wav") == "calc.wav"
    assert sanitize_filename("lecture (1) - 2026!?.mp4") == "lecture (1) - 2026.mp4" or "_" in sanitize_filename("lecture (1) - 2026!?.mp4")


def test_validate_file_extension_supported():
    for ext in [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac", ".mp4", ".mov", ".mkv", ".webm"]:
        filename = f"test_file{ext}"
        assert validate_file_extension(filename) == ext


def test_validate_file_extension_unsupported():
    for ext in [".exe", ".txt", ".pdf", ".zip", ".jpg"]:
        filename = f"test_file{ext}"
        with pytest.raises(HTTPException) as exc_info:
            validate_file_extension(filename)
        assert exc_info.value.status_code == 400


def test_is_video():
    assert is_video("movie.mp4") is True
    assert is_video("clip.mov") is True
    assert is_video("video.mkv") is True
    assert is_video("stream.webm") is True
    assert is_video("audio.mp3") is False
    assert is_video("sound.wav") is False
    assert is_video("song.flac") is False
    assert is_video("unknown.bin", content_type="video/mp4") is True
    assert is_video("unknown.bin", content_type="audio/mpeg") is False


def test_validate_file_size():
    # Valid size (e.g. 10MB)
    validate_file_size(10 * 1024 * 1024)

    # Empty file
    with pytest.raises(HTTPException) as exc_info:
        validate_file_size(0)
    assert exc_info.value.status_code == 400

    # Over max size (e.g. 500MB)
    with pytest.raises(HTTPException) as exc_info:
        validate_file_size(500 * 1024 * 1024)
    assert exc_info.value.status_code == 413
