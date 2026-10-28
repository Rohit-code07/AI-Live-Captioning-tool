import asyncio
import json
import logging
from fastapi import WebSocket, WebSocketDisconnect
from google import genai
from google.genai import types

from app.core.config import settings

logger = logging.getLogger(__name__)


async def handle_live_caption_session(websocket: WebSocket) -> None:
    """
    Bridges browser microphone WebSockets to Google Gemini Live API.
    Streams 16kHz mono PCM audio chunks from browser -> Gemini,
    and returns interim & final transcription events to browser.
    """
    await websocket.accept()

    if not settings.GEMINI_API_KEY or not settings.GEMINI_API_KEY.strip():
        logger.error("GEMINI_API_KEY is not set.")
        await websocket.send_json({
            "type": "error",
            "message": "Gemini API key is not configured on the server. Please check your .env file."
        })
        await websocket.close(code=1008)
        return

    client = genai.Client(api_key=settings.GEMINI_API_KEY.strip())
    config = types.LiveConnectConfig(
        response_modalities=["TEXT"],
        input_audio_transcription=types.AudioTranscriptionConfig(
            language_codes=[],  # Automatic language detection
        ),
    )

    try:
        logger.info("Connecting to Gemini Live API with model: %s", settings.GEMINI_LIVE_MODEL)
        async with client.aio.live.connect(model=settings.GEMINI_LIVE_MODEL, config=config) as session:
            await websocket.send_json({
                "type": "session_started",
                "model": settings.GEMINI_LIVE_MODEL,
            })

            stop_event = asyncio.Event()

            async def browser_to_gemini():
                """Reads PCM audio chunks from browser WebSocket and forwards to Gemini."""
                try:
                    while not stop_event.is_set():
                        message = await websocket.receive()
                        if "bytes" in message and message["bytes"]:
                            audio_bytes = message["bytes"]
                            await session.send_realtime_input(
                                audio=types.Blob(
                                    data=audio_bytes,
                                    mime_type="audio/pcm;rate=16000",
                                )
                            )
                        elif "text" in message and message["text"]:
                            try:
                                data = json.loads(message["text"])
                                action = data.get("type") or data.get("action")
                                if action in ("stop", "end"):
                                    logger.info("Client requested end of audio stream.")
                                    await session.send_realtime_input(audio_stream_end=True)
                                    break
                                
                                # Check for base64 encoded audio in json
                                b64_audio = data.get("audio") or data.get("data")
                                if b64_audio and isinstance(b64_audio, str):
                                    import base64
                                    audio_bytes = base64.b64decode(b64_audio)
                                    await session.send_realtime_input(
                                        audio=types.Blob(
                                            data=audio_bytes,
                                            mime_type="audio/pcm;rate=16000",
                                        )
                                    )
                            except Exception:
                                pass
                except WebSocketDisconnect:
                    logger.info("Browser WebSocket disconnected.")
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    logger.warning("Error receiving from browser: %s", e)
                finally:
                    stop_event.set()

            async def gemini_to_browser():
                """Reads transcription responses from Gemini and sends JSON events to browser."""
                try:
                    async for response in session.receive():
                        if stop_event.is_set():
                            break

                        server_content = getattr(response, "server_content", None)
                        if not server_content:
                            continue

                        # Check interim hypothesis
                        interim = getattr(server_content, "interim_input_transcription", None)
                        if interim and getattr(interim, "text", None):
                            await websocket.send_json({
                                "type": "interim",
                                "text": interim.text,
                            })

                        # Check finalized transcription
                        final = getattr(server_content, "input_transcription", None)
                        if final and getattr(final, "text", None):
                            await websocket.send_json({
                                "type": "final",
                                "text": final.text,
                            })
                except WebSocketDisconnect:
                    logger.info("WebSocket disconnected while streaming from Gemini.")
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    logger.warning("Error receiving from Gemini Live session: %s", e)
                    try:
                        await websocket.send_json({
                            "type": "error",
                            "message": f"Gemini Live transcription error: {str(e)}",
                        })
                    except Exception:
                        pass
                finally:
                    stop_event.set()

            # Run forwarder and receiver concurrently
            fwd_task = asyncio.create_task(browser_to_gemini())
            recv_task = asyncio.create_task(gemini_to_browser())

            # Wait until either stops
            done, pending = await asyncio.wait(
                [fwd_task, recv_task],
                return_when=asyncio.FIRST_COMPLETED,
            )

            for task in pending:
                task.cancel()

    except WebSocketDisconnect:
        logger.info("Client WebSocket disconnected during session setup.")
    except Exception as e:
        logger.exception("Failed to establish or maintain Gemini Live session: %s", e)
        try:
            await websocket.send_json({
                "type": "error",
                "message": f"Connection error: {str(e)}",
            })
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
        logger.info("Live caption session closed.")
