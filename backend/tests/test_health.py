from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "gemini_configured" in data
    assert data["live_model"] == "gemini-3.5-transcribe-live"
    assert data["transcribe_model"] == "gemini-3.5-transcribe"
    assert "ffmpeg_available" in data
