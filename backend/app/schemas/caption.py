from typing import Optional
from pydantic import BaseModel, Field


class WordItem(BaseModel):
    text: str
    confidence: float = 0.95


class SubtitleSegment(BaseModel):
    id: int = Field(..., description="Cue sequence index (1-based)")
    start_seconds: float = Field(..., description="Start offset in seconds")
    end_seconds: float = Field(..., description="End offset in seconds")
    start_time: str = Field(..., description="Formatted start time (e.g. 00:00:01,000)")
    end_time: str = Field(..., description="Formatted end time (e.g. 00:00:04,500)")
    start: Optional[str] = None
    end: Optional[str] = None
    text: str = Field(..., description="Cue text content")
    speaker: Optional[str] = Field("Speaker 1", description="Speaker identifier if detected")
    words: list[WordItem] = Field(default_factory=list, description="Word level breakdown with confidence")


class SubtitleExportFormats(BaseModel):
    txt: str = Field(..., description="Full text transcript")
    srt: str = Field(..., description="SRT format subtitle text")
    vtt: str = Field(..., description="WebVTT format subtitle text")


class TranscriptionResponse(BaseModel):
    success: bool = True
    filename: str
    transcript: str
    language: Optional[str] = None
    timestamps_estimated: bool = False
    segments: list[SubtitleSegment] = []
    exports: SubtitleExportFormats


class ReExportRequest(BaseModel):
    segments: list[SubtitleSegment]


class HealthResponse(BaseModel):
    status: str
    version: str
    gemini_configured: bool
    live_model: str
    transcribe_model: str
    ffmpeg_available: bool
