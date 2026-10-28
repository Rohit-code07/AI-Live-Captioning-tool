from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from google.genai import types

from app.main import app
from app.core.config import settings

client = TestClient(app)


def test_live_websocket_without_api_key():
    # When GEMINI_API_KEY is empty, websocket should receive error message and close
    with patch.object(settings, "GEMINI_API_KEY", ""):
        with client.websocket_connect("/ws/live") as websocket:
            data = websocket.receive_json()
            assert data["type"] == "error"
            assert "Gemini API key is not configured" in data["message"]


@patch("app.services.gemini_live.genai.Client")
def test_live_websocket_streaming_flow(mock_genai_cls):
    with patch.object(settings, "GEMINI_API_KEY", "fake_key_for_testing"):
        mock_client = AsyncMock()
        mock_genai_cls.return_value = mock_client

        # Mock async live connect context manager
        mock_session = AsyncMock()

        # Mock receiving from Gemini
        class FakeResponse:
            def __init__(self, interim=None, final=None):
                self.server_content = AsyncMock()
                self.server_content.interim_input_transcription = interim
                self.server_content.input_transcription = final

        class InterimObj:
            text = "Testing interim speech"

        class FinalObj:
            text = "Testing interim speech finalized."

        async def fake_receive_stream():
            yield FakeResponse(interim=InterimObj(), final=None)
            yield FakeResponse(interim=None, final=FinalObj())

        mock_session.receive = fake_receive_stream
        mock_session.send_realtime_input = AsyncMock()

        class MockAsyncContextManager:
            async def __aenter__(self):
                return mock_session

            async def __aexit__(self, exc_type, exc_val, exc_tb):
                return None

        from unittest.mock import MagicMock
        mock_client.aio.live.connect = MagicMock(return_value=MockAsyncContextManager())

        with client.websocket_connect("/ws/live") as websocket:
            # 1. First event should be session_started
            msg1 = websocket.receive_json()
            assert msg1["type"] == "session_started"
            assert msg1["model"] == settings.GEMINI_LIVE_MODEL

            # Send a fake PCM chunk (16-bit PCM mono 16000Hz bytes)
            pcm_chunk = b"\x00\x00" * 1600
            websocket.send_bytes(pcm_chunk)

            # 2. Should receive interim transcript
            msg2 = websocket.receive_json()
            assert msg2["type"] == "interim"
            assert msg2["text"] == "Testing interim speech"

            # 3. Should receive final transcript
            msg3 = websocket.receive_json()
            assert msg3["type"] == "final"
            assert msg3["text"] == "Testing interim speech finalized."

            # Tell backend to stop
            websocket.send_json({"type": "stop"})
