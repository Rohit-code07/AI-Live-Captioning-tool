import re
from typing import Any
from app.schemas.caption import SubtitleSegment, SubtitleExportFormats, WordItem


def parse_offset_to_seconds(offset: Any) -> float:
    """
    Parses start/end offset which might be a string like '1.25s', '1.25',
    or float/int seconds, into a float.
    """
    if offset is None:
        return 0.0
    if isinstance(offset, (int, float)):
        return float(offset)
    if isinstance(offset, str):
        cleaned = offset.strip().rstrip("sS")
        try:
            return float(cleaned)
        except ValueError:
            return 0.0
    return 0.0


def seconds_to_srt_time(seconds: float) -> str:
    """
    Converts float seconds to SRT time format: HH:MM:SS,mmm
    """
    if seconds < 0:
        seconds = 0.0
    total_ms = int(round(seconds * 1000))
    hours = total_ms // 3600000
    minutes = (total_ms % 3600000) // 60000
    secs = (total_ms % 60000) // 1000
    millis = total_ms % 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def seconds_to_vtt_time(seconds: float) -> str:
    """
    Converts float seconds to WebVTT time format: HH:MM:SS.mmm
    """
    if seconds < 0:
        seconds = 0.0
    total_ms = int(round(seconds * 1000))
    hours = total_ms // 3600000
    minutes = (total_ms % 3600000) // 60000
    secs = (total_ms % 60000) // 1000
    millis = total_ms % 1000
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def group_words_into_cues(
    words: list[Any],
    max_words_per_cue: int = 8,
    max_duration_seconds: float = 6.0,
    max_chars_per_cue: int = 42,
    pause_threshold_seconds: float = 0.8,
) -> list[SubtitleSegment]:
    """
    Groups individual word timestamps into readable subtitle cues.
    Respects sentence boundaries, pause thresholds, word counts, and line lengths.
    """
    if not words:
        return []

    cues: list[SubtitleSegment] = []
    current_words: list[str] = []
    cue_start: float | None = None
    cue_end: float = 0.0
    last_word_end: float = 0.0

    for word_obj in words:
        # Support both objects with attributes and dicts
        if isinstance(word_obj, dict):
            word_text = str(word_obj.get("word", "")).strip()
            w_start = parse_offset_to_seconds(word_obj.get("start_offset"))
            w_end = parse_offset_to_seconds(word_obj.get("end_offset"))
        else:
            word_text = str(getattr(word_obj, "word", "")).strip()
            w_start = parse_offset_to_seconds(getattr(word_obj, "start_offset", None))
            w_end = parse_offset_to_seconds(getattr(word_obj, "end_offset", None))

        if not word_text:
            continue

        if w_end <= w_start:
            w_end = w_start + 0.35

        # Check if pause between last word and this word triggers a new cue
        is_long_pause = (cue_start is not None) and (w_start - last_word_end > pause_threshold_seconds)
        
        # Check current length and duration
        tentative_text = " ".join(current_words + [word_text])
        duration_exceeded = (cue_start is not None) and ((w_end - cue_start) > max_duration_seconds)
        words_exceeded = len(current_words) >= max_words_per_cue
        chars_exceeded = len(tentative_text) > max_chars_per_cue

        if current_words and (is_long_pause or duration_exceeded or words_exceeded or chars_exceeded):
            # Finalize current cue
            s_time = seconds_to_srt_time(cue_start if cue_start is not None else 0.0)
            e_time = seconds_to_srt_time(max(cue_end, (cue_start or 0.0) + 0.5))
            cues.append(
                SubtitleSegment(
                    id=len(cues) + 1,
                    start_seconds=round(cue_start if cue_start is not None else 0.0, 3),
                    end_seconds=round(max(cue_end, (cue_start or 0.0) + 0.5), 3),
                    start_time=s_time,
                    end_time=e_time,
                    start=s_time,
                    end=e_time,
                    text=" ".join(current_words),
                    speaker="Speaker 1",
                    words=[WordItem(text=w, confidence=0.95) for w in current_words],
                )
            )
            current_words = []
            cue_start = None

        if cue_start is None:
            cue_start = w_start

        current_words.append(word_text)
        cue_end = w_end
        last_word_end = w_end

        # Check if word ends with sentence-terminating punctuation (. ! ?)
        if word_text.endswith((".", "!", "?")) and len(current_words) >= 3:
            s_time = seconds_to_srt_time(cue_start)
            e_time = seconds_to_srt_time(max(cue_end, cue_start + 0.5))
            cues.append(
                SubtitleSegment(
                    id=len(cues) + 1,
                    start_seconds=round(cue_start, 3),
                    end_seconds=round(max(cue_end, cue_start + 0.5), 3),
                    start_time=s_time,
                    end_time=e_time,
                    start=s_time,
                    end=e_time,
                    text=" ".join(current_words),
                    speaker="Speaker 1",
                    words=[WordItem(text=w, confidence=0.95) for w in current_words],
                )
            )
            current_words = []
            cue_start = None

    # Emit leftover words
    if current_words and cue_start is not None:
        s_time = seconds_to_srt_time(cue_start)
        e_time = seconds_to_srt_time(max(cue_end, cue_start + 0.5))
        cues.append(
            SubtitleSegment(
                id=len(cues) + 1,
                start_seconds=round(cue_start, 3),
                end_seconds=round(max(cue_end, cue_start + 0.5), 3),
                start_time=s_time,
                end_time=e_time,
                start=s_time,
                end=e_time,
                text=" ".join(current_words),
                speaker="Speaker 1",
                words=[WordItem(text=w, confidence=0.95) for w in current_words],
            )
        )

    return cues


def build_cues_from_plain_text(
    full_text: str,
    total_duration_seconds: float | None = None,
    seconds_per_chunk: float = 4.0,
) -> list[SubtitleSegment]:
    """
    Splits plain transcript text into estimated cues when word timestamps are unavailable.
    """
    clean_text = full_text.strip()
    if not clean_text:
        return []

    # Split into sentence or phrase chunks
    sentences = re.split(r"(?<=[.!?])\s+", clean_text)
    chunks: list[str] = []

    for s in sentences:
        s = s.strip()
        if not s:
            continue
        # If sentence is very long, break it into clauses
        if len(s) > 80:
            subparts = re.split(r"(?<=[,;])\s+", s)
            for sub in subparts:
                sub = sub.strip()
                if sub:
                    chunks.append(sub)
        else:
            chunks.append(s)

    if not chunks:
        chunks = [clean_text]

    cues: list[SubtitleSegment] = []
    num_chunks = len(chunks)

    if total_duration_seconds and total_duration_seconds > 0:
        chunk_dur = max(1.5, total_duration_seconds / num_chunks)
    else:
        chunk_dur = seconds_per_chunk

    curr_time = 0.0
    for idx, chunk in enumerate(chunks, start=1):
        start_sec = curr_time
        end_sec = start_sec + chunk_dur
        s_time = seconds_to_srt_time(start_sec)
        e_time = seconds_to_srt_time(end_sec)
        cues.append(
            SubtitleSegment(
                id=idx,
                start_seconds=round(start_sec, 3),
                end_seconds=round(end_sec, 3),
                start_time=s_time,
                end_time=e_time,
                start=s_time,
                end=e_time,
                text=chunk,
                speaker="Speaker 1",
                words=[WordItem(text=w, confidence=0.95) for w in chunk.split()],
            )
        )
        curr_time = end_sec + 0.2

    return cues


def generate_srt(segments: list[SubtitleSegment]) -> str:
    """
    Generates standard SRT formatted string from segments.
    """
    lines: list[str] = []
    for idx, seg in enumerate(segments, start=1):
        lines.append(str(idx))
        lines.append(f"{seg.start_time} --> {seg.end_time}")
        lines.append(seg.text)
        lines.append("")  # Blank line separator
    return "\n".join(lines).strip() + "\n" if lines else ""


def generate_vtt(segments: list[SubtitleSegment]) -> str:
    """
    Generates valid WebVTT formatted string from segments.
    """
    lines: list[str] = ["WEBVTT", ""]
    for idx, seg in enumerate(segments, start=1):
        start_vtt = seconds_to_vtt_time(seg.start_seconds)
        end_vtt = seconds_to_vtt_time(seg.end_seconds)
        lines.append(str(idx))
        lines.append(f"{start_vtt} --> {end_vtt}")
        lines.append(seg.text)
        lines.append("")
    return "\n".join(lines).strip() + "\n" if len(lines) > 2 else "WEBVTT\n"


def generate_txt(transcript: str, segments: list[SubtitleSegment]) -> str:
    """
    Generates clean readable transcript text.
    """
    if transcript.strip():
        return transcript.strip() + "\n"
    if segments:
        return " ".join(seg.text for seg in segments).strip() + "\n"
    return ""


def export_from_segments(
    segments: list[SubtitleSegment], raw_transcript: str = ""
) -> SubtitleExportFormats:
    """
    Builds TXT, SRT, and WebVTT exports from a list of segments.
    """
    txt_content = generate_txt(raw_transcript, segments)
    srt_content = generate_srt(segments)
    vtt_content = generate_vtt(segments)
    return SubtitleExportFormats(txt=txt_content, srt=srt_content, vtt=vtt_content)


def process_transcription_results(
    raw_transcript: str,
    words: list[Any] | None = None,
    total_duration_seconds: float | None = None,
) -> tuple[list[SubtitleSegment], SubtitleExportFormats, bool]:
    """
    Processes transcription output into segments and subtitle files.
    Returns (segments, exports, timestamps_estimated).
    """
    if words and len(words) > 0:
        segments = group_words_into_cues(words)
        timestamps_estimated = False
    else:
        segments = build_cues_from_plain_text(
            raw_transcript, total_duration_seconds=total_duration_seconds
        )
        timestamps_estimated = True

    exports = export_from_segments(segments, raw_transcript=raw_transcript)
    return segments, exports, timestamps_estimated
