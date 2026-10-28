import io
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from google.genai import types

from app.main import app

client = TestClient(app)


@patch("app.services.gemini_transcription.get_genai_client")
def test_upload_audio_success(mock_get_client):
    mock_client = AsyncMock()
    mock_get_client.return_value = mock_client

    # Mock file upload
    mock_uploaded_file = types.File(name="files/sample123")
    mock_client.aio.files.upload = AsyncMock(return_value=mock_uploaded_file)
    mock_client.aio.files.delete = AsyncMock(return_value=None)

    # Mock Gemini model response
    mock_response = types.GenerateContentResponse(
        candidates=[
            types.Candidate(
                content=types.Content(
                    parts=[
                        types.Part(
                            text="Hello world test.",
                            audio_transcription=types.Transcription(
                                text="Hello world test.",
                                language_code="en",
                                words=[
                                    types.WordInfo(word="Hello", start_offset="0.0s", end_offset="0.4s"),
                                    types.WordInfo(word="world", start_offset="0.5s", end_offset="0.9s"),
                                    types.WordInfo(word="test.", start_offset="1.0s", end_offset="1.4s"),
                                ],
                            ),
                        )
                    ]
                )
            )
        ]
    )
    mock_client.aio.models.generate_content = AsyncMock(return_value=mock_response)

    # Fake audio file bytes
    fake_audio = io.BytesIO(b"RIFF....WAVEfmt ....data....")
    files = {"file": ("test_speech.wav", fake_audio, "audio/wav")}

    response = client.post("/api/captions/upload", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["filename"] == "test_speech.wav"
    assert data["transcript"] == "Hello world test."
    assert data["language"] == "en"
    assert data["timestamps_estimated"] is False
    assert len(data["segments"]) >= 1
    assert "exports" in data
    assert "Hello world test." in data["exports"]["srt"]


def test_upload_invalid_extension():
    fake_file = io.BytesIO(b"fake text content")
    files = {"file": ("test.txt", fake_file, "text/plain")}
    response = client.post("/api/captions/upload", files=files)
    assert response.status_code == 400
    assert "Unsupported file format" in response.json()["detail"]


def test_re_export_endpoint():
    req_payload = {
        "segments": [
            {
                "id": 1,
                "start_seconds": 0.0,
                "end_seconds": 2.5,
                "start_time": "00:00:00,000",
                "end_time": "00:00:02,500",
                "text": "User edited transcript line.",
            }
        ]
    }
    response = client.post("/api/captions/re-export", json=req_payload)
    assert response.status_code == 200
    data = response.json()
    assert "User edited transcript line." in data["txt"]
    assert "User edited transcript line." in data["srt"]
    assert "User edited transcript line." in data["vtt"]
