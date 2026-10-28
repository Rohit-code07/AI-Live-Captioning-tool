from fastapi import APIRouter, WebSocket
from app.services.gemini_live import handle_live_caption_session

router = APIRouter()


@router.websocket("/ws/live")
@router.websocket("/ws/live-captions")
async def live_caption_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for real-time live captioning.
    Accepts 16kHz mono 16-bit PCM chunks and returns interim and final transcripts.
    """
    await handle_live_caption_session(websocket)
