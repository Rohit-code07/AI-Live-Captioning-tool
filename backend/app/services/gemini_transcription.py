import asyncio
import json
import logging
import re
from pathlib import Path
from typing import Any
from fastapi import HTTPException, status
from google import genai
from google.genai import types

from app.core.config import settings
from app.schemas.caption import (
    SubtitleSegment,
    TranscriptionResponse,
    WordItem,
)
from app.services.subtitle_generator import (
    export_from_segments,
    parse_offset_to_seconds,
    process_transcription_results,
    seconds_to_srt_time,
    seconds_to_vtt_time,
)

logger = logging.getLogger(__name__)


def get_genai_client() -> genai.Client:
    """
    Instantiates the Google Gen AI client with the configured API key.
    """
    if not settings.GEMINI_API_KEY or not settings.GEMINI_API_KEY.strip():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Gemini API key is not configured. Please set the GEMINI_API_KEY "
                "environment variable in your backend/.env file."
            ),
        )
    return genai.Client(api_key=settings.GEMINI_API_KEY.strip())


async def transcribe_with_flash_fallback(
    client: genai.Client,
    uploaded_file: Any,
    original_filename: str,
    total_duration_seconds: float | None = None,
) -> TranscriptionResponse:
    """
    Fallback transcription using gemini-2.5-flash with structured JSON output.
    Extracts word timestamps, confidence scores, and subtitle segments.
    """
    logger.info("Using gemini-2.5-flash fallback transcription for %s...", original_filename)

    prompt = (
        "Transcribe the spoken audio in this file. Provide word-by-word timestamps and confidence scores (0.0 to 1.0).\n"
        "Return a valid JSON object matching this schema:\n"
        "{\n"
        '  "transcript": "Full transcript of all spoken words",\n'
        '  "language": "en",\n'
        '  "segments": [\n'
        "    {\n"
        '      "id": 1,\n'
        '      "start": "00:00:01,000",\n'
        '      "end": "00:00:04,200",\n'
        '      "speaker": "Speaker 1",\n'
        '      "text": "Welcome to AI Studio",\n'
        '      "words": [\n'
        '        {"text": "Welcome", "confidence": 0.98, "start": "00:00:01,000", "end": "00:00:01,500"}\n'
        "      ]\n"
        "    }\n"
        "  ]\n"
        "}\n"
        'If no speech is heard in the audio, return {"transcript": "", "language": "no_speech", "segments": []}.\n'
        "Return ONLY the raw JSON object."
    )

    try:
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=[uploaded_file, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )

        resp_text = (response.text or "").strip()
        data = {}
        if resp_text:
            try:
                data = json.loads(resp_text)
            except Exception:
                # Remove possible markdown fences if returned
                cleaned = re.sub(r"^```(?:json)?\s*", "", resp_text)
                cleaned = re.sub(r"\s*```$", "", cleaned)
                data = json.loads(cleaned)

        raw_transcript = data.get("transcript", "")
        language = data.get("language", "en")
        raw_segments = data.get("segments", [])

        parsed_segments: list[SubtitleSegment] = []
        for idx, seg in enumerate(raw_segments, start=1):
            s_start = seg.get("start", "00:00:00,000")
            s_end = seg.get("end", "00:00:02,000")
            s_text = seg.get("text", "")
            s_speaker = seg.get("speaker", "Speaker 1")

            # Parse words
            words_list: list[WordItem] = []
            for w in seg.get("words", []):
                if isinstance(w, dict):
                    w_text = w.get("text", "")
                    w_conf = float(w.get("confidence", 0.95))
                    words_list.append(
                        WordItem(
                            text=w_text,
                            confidence=max(0.0, min(1.0, w_conf)),
                            start_time=w.get("start"),
                            end_time=w.get("end"),
                        )
                    )
                elif isinstance(w, str):
                    words_list.append(WordItem(text=w, confidence=0.95))

            start_sec = parse_offset_to_seconds(s_start)
            end_sec = parse_offset_to_seconds(s_end)
            if end_sec <= start_sec:
                end_sec = start_sec + 2.0

            parsed_segments.append(
                SubtitleSegment(
                    id=idx,
                    start_time=s_start,
                    end_time=s_end,
                    start_seconds=start_sec,
                    end_seconds=end_sec,
                    text=s_text or " ".join(w.text for w in words_list),
                    speaker=s_speaker,
                    words=words_list,
                )
            )

        if not parsed_segments and raw_transcript:
            # Fall back to sentence boundary cue grouping
            parsed_segments, exports, timestamps_estimated = process_transcription_results(
                raw_transcript=raw_transcript,
                words=[],
                total_duration_seconds=total_duration_seconds,
            )
        else:
            exports = export_from_segments(parsed_segments)
            timestamps_estimated = False

        return TranscriptionResponse(
            success=True,
            filename=original_filename,
            transcript=raw_transcript,
            language=language,
            timestamps_estimated=timestamps_estimated,
            segments=parsed_segments,
            exports=exports,
        )

    except Exception as e:
        logger.exception("gemini-2.5-flash fallback also encountered an error: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {str(e)}",
        )


async def wait_for_file_active(
    client: genai.Client,
    file_obj: Any,
    max_wait_seconds: int = 180,
    poll_interval: float = 1.0,
) -> Any:
    """
    Waits until an uploaded file in the Gemini Files API transitions from
    PROCESSING to ACTIVE state. Prevents 400 FAILED_PRECONDITION errors.
    """
    state_str = str(getattr(file_obj, "state", "") or "").upper()
    if "ACTIVE" in state_str:
        return file_obj

    # If state is None (e.g. mock objects in unit tests) or empty, proceed immediately
    if getattr(file_obj, "state", None) is None:
        return file_obj

    start_time = asyncio.get_event_loop().time()
    file_name = getattr(file_obj, "name", "")
    current_obj = file_obj

    while True:
        state_str = str(getattr(current_obj, "state", "") or "").upper()

        if "ACTIVE" in state_str or not state_str:
            logger.info("File %s is in ACTIVE state and ready for inference.", file_name)
            return current_obj

        if "FAILED" in state_str:
            error_detail = getattr(current_obj, "error", None) or "Media processing failed on Gemini server."
            logger.error("File %s processing failed: %s", file_name, error_detail)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Gemini was unable to process uploaded media: {error_detail}",
            )

        elapsed = asyncio.get_event_loop().time() - start_time
        if elapsed > max_wait_seconds:
            logger.error("Timed out waiting for file %s to become ACTIVE (%.1fs elapsed)", file_name, elapsed)
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Timed out waiting for Gemini to finish processing uploaded file.",
            )

        logger.info("File %s is currently %s; waiting %.1fs...", file_name, state_str, poll_interval)
        await asyncio.sleep(poll_interval)
        current_obj = await client.aio.files.get(name=file_name)


async def transcribe_audio_file(
    audio_path: Path,
    original_filename: str,
    total_duration_seconds: float | None = None,
) -> TranscriptionResponse:
    """
    Uploads audio file to Gemini Files API, waits until it enters ACTIVE state,
    calls gemini-3.5-transcribe with word timestamps, and falls back to
    gemini-2.5-flash on high-demand or server errors.
    """
    client = get_genai_client()
    uploaded_file: Any = None

    try:
        logger.info("Uploading %s to Gemini Files API...", audio_path.name)
        raw_file = await client.aio.files.upload(file=str(audio_path))
        logger.info("Uploaded successfully with file name: %s, verifying ACTIVE state...", raw_file.name)

        # Wait for file to become ACTIVE before calling models
        uploaded_file = await wait_for_file_active(client, raw_file)

        config = types.GenerateContentConfig(
            audio_transcription_config=types.AudioTranscriptionConfig(
                word_timestamp=True,
                language_codes=[],  # Enable automatic language identification
            ),
        )

        try:
            logger.info(
                "Calling transcription model %s for file %s...",
                settings.GEMINI_TRANSCRIBE_MODEL,
                uploaded_file.name,
            )
            response = await client.aio.models.generate_content(
                model=settings.GEMINI_TRANSCRIBE_MODEL,
                contents=[uploaded_file],
                config=config,
            )

            # Parse response candidates and audio transcription parts
            raw_transcript_parts: list[str] = []
            words: list[Any] = []
            detected_language: str | None = None

            if hasattr(response, "candidates") and response.candidates:
                for candidate in response.candidates:
                    content = getattr(candidate, "content", None)
                    if content and getattr(content, "parts", None):
                        for part in content.parts:
                            audio_tx = getattr(part, "audio_transcription", None)
                            if audio_tx:
                                if getattr(audio_tx, "text", None):
                                    raw_transcript_parts.append(audio_tx.text)
                                if getattr(audio_tx, "language_code", None) and not detected_language:
                                    detected_language = audio_tx.language_code
                                tx_words = getattr(audio_tx, "words", None)
                                if tx_words:
                                    words.extend(tx_words)
                            elif getattr(part, "text", None):
                                raw_transcript_parts.append(part.text)

            full_transcript = " ".join(raw_transcript_parts).strip()
            if not full_transcript:
                try:
                    full_transcript = (response.text or "").strip()
                except Exception:
                    full_transcript = ""

            segments, exports, timestamps_estimated = process_transcription_results(
                raw_transcript=full_transcript,
                words=words,
                total_duration_seconds=total_duration_seconds,
            )

            return TranscriptionResponse(
                success=True,
                filename=original_filename,
                transcript=full_transcript,
                language=detected_language,
                timestamps_estimated=timestamps_estimated,
                segments=segments,
                exports=exports,
            )

        except Exception as model_err:
            logger.warning(
                "Primary model %s failed (%s). Triggering gemini-2.5-flash fallback...",
                settings.GEMINI_TRANSCRIBE_MODEL,
                model_err,
            )
            return await transcribe_with_flash_fallback(
                client=client,
                uploaded_file=uploaded_file,
                original_filename=original_filename,
                total_duration_seconds=total_duration_seconds,
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Gemini transcription failed for %s", original_filename)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Transcription failed: {str(e)}",
        )
    finally:
        # Remote file cleanup
        if uploaded_file and hasattr(uploaded_file, "name"):
            try:
                logger.info("Cleaning up remote Gemini file: %s", uploaded_file.name)
                await client.aio.files.delete(name=uploaded_file.name)
            except Exception as clean_err:
                logger.warning("Could not delete remote file %s: %s", uploaded_file.name, clean_err)
