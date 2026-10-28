# AI Captioning & Transcription Tools

Production-ready backend for real-time live microphone captioning and pre-recorded audio/video transcription using Google Gemini's speech-to-text models and the official `google-genai` SDK.

---

## 🎯 Features

1. **Real-Time Live Captioning (`/ws/live`)**
   - Direct streaming bridge over WebSockets to Google Gemini Live API.
   - Powered by `gemini-3.5-transcribe-live`.
   - Automatic language detection and streaming verbatim speech recognition.
   - Dispatches distinct `interim` (real-time speculative preview) and `final` (authoritative committed text) JSON events.
   - Accepts 16kHz mono 16-bit PCM binary chunks or base64 JSON frames.

2. **Audio & Video Upload Transcription (`/api/captions/upload`)**
   - High-accuracy speech transcription powered by `gemini-3.5-transcribe`.
   - Automatic language identification across 80+ spoken languages.
   - Word-level timestamp extraction.
   - FFmpeg extraction of audio tracks from video containers (MP4, MOV, MKV, WebM).
   - Generates downloadable subtitle formats:
     - **TXT**: Clean, readable transcript.
     - **SRT**: Standard numbered cue subtitle format (`HH:MM:SS,mmm`).
     - **WebVTT**: Valid `WEBVTT` format (`HH:MM:SS.mmm`).
   - Grouping logic creates natural, human-readable cues instead of single-word cues.
   - Dynamic re-export endpoint (`/api/captions/re-export`) supporting user edits.
   - Safe local and remote Files API cleanup after processing.

---

## 🏗️ Architecture & Data Flow

### 1. Live Captioning Flow
```
Microphone (Browser)
       │ (16kHz, mono, 16-bit PCM chunks)
       ▼
FastAPI WebSocket (/ws/live)
       │ (types.Blob audio/pcm;rate=16000)
       ▼
Gemini Live API (gemini-3.5-transcribe-live)
       │ (Bidi streaming responses)
       ▼
FastAPI Bridge
       │ {"type": "interim", "text": "..."} / {"type": "final", "text": "..."}
       ▼
Browser Client Display
```

### 2. File Upload & Subtitle Pipeline
```
Audio / Video File (User Upload)
       │ (POST /api/captions/upload)
       ▼
FastAPI Request Validation (app/utils/file_validator.py)
       │ (Extension, size limit, path sanitization)
       ▼
Temporary Storage (backend/temp/)
       │
       ├─ Video? ──► FFmpeg Audio Extraction ──► 16kHz Mono MP3
       │
       └─ Audio? ──► Native audio container (MP3, WAV, FLAC, M4A, etc.)
       │
       ▼
Gemini Files API (client.aio.files.upload)
       │
       ▼
Transcription Model (gemini-3.5-transcribe)
       │ (word_timestamp=True, language_codes=[])
       ▼
Response Parser & Subtitle Generator (app/services/subtitle_generator.py)
       │ (Generates TXT, SRT, WebVTT + Segments)
       ▼
Cleanup (Local temp files unlinked + Remote Files API deleted)
       │
       ▼
JSON Response to Client
```

---

## 📁 Repository Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                          # FastAPI app entrypoint, CORS, exception handlers
│   ├── core/
│   │   ├── __init__.py
│   │   └── config.py                    # Environment settings, upload limits, CORS origins
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── live_caption.py              # WebSocket /ws/live endpoint
│   │   └── upload_caption.py            # POST /api/captions/upload and /re-export
│   ├── services/
│   │   ├── __init__.py
│   │   ├── gemini_live.py               # Async bridge to Gemini Live API
│   │   ├── gemini_transcription.py      # Files API + gemini-3.5-transcribe integration
│   │   ├── media_processor.py           # FFmpeg audio extractor & temp file cleaner
│   │   └── subtitle_generator.py        # Word grouping, SRT, WebVTT & TXT builder
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── caption.py                   # Pydantic schemas for requests and responses
│   └── utils/
│       ├── __init__.py
│       └── file_validator.py            # MIME/Extension validation and path security
├── temp/
│   └── .gitkeep                         # Temporary upload processing directory
├── tests/
│   ├── __init__.py
│   ├── test_file_validator.py           # Unit tests for validation logic
│   ├── test_health.py                   # Health check endpoint test
│   ├── test_live_endpoint.py            # WebSocket live streaming tests (mocked)
│   ├── test_subtitle_generator.py       # SRT/VTT/TXT generation tests
│   └── test_upload_endpoint.py          # Upload endpoint test (mocked Gemini SDK)
├── .env.example
├── .gitignore
├── requirements.txt
└── README.md
```

---

## ⚙️ Prerequisites

1. **Python 3.11+** (Tested on Python 3.14 / 3.12 / 3.11)
2. **UV Package Manager** (or standard pip)
3. **Google Gemini API Key** (from [Google AI Studio](https://aistudio.google.com/apikey))
4. **FFmpeg** (required for extracting audio from video uploads)

---

## 🛠️ Windows Setup & Installation

Open **Windows PowerShell** in the project directory:

```powershell
cd C:\Users\rohit\Projects\captioning-tools\backend
```

### 1. Environment Configuration

Copy `.env.example` to `.env`:

```powershell
Copy-Item .env.example .env
```

Open `.env` in your text editor and add your Gemini API Key:

```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
GEMINI_LIVE_MODEL=gemini-3.5-transcribe-live
GEMINI_TRANSCRIBE_MODEL=gemini-3.5-transcribe
FRONTEND_ORIGIN=http://localhost:5173
MAX_UPLOAD_MB=200
```

### 2. Python Virtual Environment Setup (using UV)

If creating a fresh virtual environment:

```powershell
uv venv .venv
.\.venv\Scripts\activate
uv pip install -r requirements.txt
```

Or using an existing virtual environment:

```powershell
uv pip install -r requirements.txt --python .\.venv\Scripts\python.exe
```

### 3. FFmpeg Installation (for Video Support)

FFmpeg is required to extract audio tracks when users upload video files (`.mp4`, `.mov`, `.mkv`, `.webm`).

#### Option A: Install via Winget (Recommended)
```powershell
winget install Gyan.FFmpeg
```

#### Option B: Install via Chocolatey
```powershell
choco install ffmpeg
```

#### Option C: Install via Scoop
```powershell
scoop install ffmpeg
```

#### Option D: Manual Download
1. Download a release build from [gyan.dev/ffmpeg/builds](https://www.gyan.dev/ffmpeg/builds/) (e.g. `ffmpeg-release-essentials.zip`).
2. Extract to `C:\ffmpeg`.
3. Add `C:\ffmpeg\bin` to your System `PATH` environment variable.

#### Verify FFmpeg Installation:
```powershell
ffmpeg -version
```

*(Note: Direct audio file uploads like MP3, WAV, FLAC, M4A, OGG work out of the box even without FFmpeg).*

---

## 🚀 Starting the Server

Activate the virtual environment and launch Uvicorn:

```powershell
# From C:\Users\rohit\Projects\captioning-tools\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Server endpoints will be live at:
- **API Base**: `http://localhost:8000`
- **Swagger Documentation**: `http://localhost:8000/docs`
- **OpenAPI Schema**: `http://localhost:8000/openapi.json`
- **Health Check**: `http://localhost:8000/api/health`
- **WebSocket Live**: `ws://localhost:8000/ws/live`

---

## 🧪 Running Automated Tests

Run the complete test suite with pytest:

```powershell
# From C:\Users\rohit\Projects\captioning-tools
$env:PYTHONPATH=".\backend"
.\backend\.venv\Scripts\python.exe -m pytest .\backend\tests -v
```

All 18 automated tests execute locally using mocks, meaning they don't consume Gemini API quota or require an active internet connection.

---

## 📡 API Reference

### 1. Health Check
`GET /api/health`

**Response (`200 OK`):**
```json
{
  "status": "ok",
  "version": "1.0.0",
  "gemini_configured": true,
  "live_model": "gemini-3.5-transcribe-live",
  "transcribe_model": "gemini-3.5-transcribe",
  "ffmpeg_available": true
}
```

---

### 2. File Upload & Transcription
`POST /api/captions/upload`
- Content-Type: `multipart/form-data`
- Body Parameter: `file` (Binary audio/video)

**Supported Formats:**
- **Audio:** `.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`, `.flac`, `.weba`
- **Video:** `.mp4`, `.mov`, `.mkv`, `.webm`

**Response (`200 OK`):**
```json
{
  "success": true,
  "filename": "sample_lecture.mp3",
  "transcript": "Good morning everyone. Today we are exploring real-time speech transcription with Google Gemini.",
  "language": "en",
  "timestamps_estimated": false,
  "segments": [
    {
      "id": 1,
      "start_seconds": 0.12,
      "end_seconds": 1.85,
      "start_time": "00:00:00,120",
      "end_time": "00:00:01,850",
      "text": "Good morning everyone.",
      "speaker": null
    },
    {
      "id": 2,
      "start_seconds": 2.10,
      "end_seconds": 6.45,
      "start_time": "00:00:02,100",
      "end_time": "00:00:06,450",
      "text": "Today we are exploring real-time speech transcription with Google Gemini.",
      "speaker": null
    }
  ],
  "exports": {
    "txt": "Good morning everyone. Today we are exploring real-time speech transcription with Google Gemini.\n",
    "srt": "1\n00:00:00,120 --> 00:00:01,850\nGood morning everyone.\n\n2\n00:00:02,100 --> 00:00:06,450\nToday we are exploring real-time speech transcription with Google Gemini.\n",
    "vtt": "WEBVTT\n\n1\n00:00:00.120 --> 00:00:01.850\nGood morning everyone.\n\n2\n00:00:02.100 --> 00:00:06.450\nToday we are exploring real-time speech transcription with Google Gemini.\n"
  }
}
```

---

### 3. Re-Export Edited Subtitles
`POST /api/captions/re-export`
- Content-Type: `application/json`

**Request Body:**
```json
{
  "segments": [
    {
      "id": 1,
      "start_seconds": 0.12,
      "end_seconds": 1.85,
      "start_time": "00:00:00,120",
      "end_time": "00:00:01,850",
      "text": "Good morning everyone, welcome back."
    }
  ]
}
```

**Response (`200 OK`):**
Returns updated `txt`, `srt`, and `vtt` subtitle text matching the user's edits.

---

### 4. Real-Time Live Captioning WebSocket
`ws://localhost:8000/ws/live`

#### Protocol & Client Requirements:
- **Audio Format:** Mono 16-bit PCM, 16 kHz, little-endian.
- **Chunk Size:** Send audio chunks approximately every 100ms (1,600 samples / 3,200 bytes per chunk).
- **Binary Stream:** Send raw PCM bytes directly as binary WebSocket frames.
- **JSON Stream End:** Send `{"type": "stop"}` when turning off captions to signal stream completion.

#### Server Event Types:
1. **Session Started**:
   ```json
   { "type": "session_started", "model": "gemini-3.5-transcribe-live" }
   ```
2. **Interim Caption (Live speculative hypothesis as user talks)**:
   ```json
   { "type": "interim", "text": "Good morning every" }
   ```
3. **Final Caption (Committed, authoritative phrase upon pause/turn)**:
   ```json
   { "type": "final", "text": "Good morning everyone." }
   ```
4. **Error**:
   ```json
   { "type": "error", "message": "Description of error" }
   ```

---

## 🔍 Manual Testing Instructions

### 1. Test Health Endpoint (PowerShell)
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/health" -Method Get
```

### 2. Test File Upload (PowerShell / curl)
```powershell
curl.exe -X POST "http://localhost:8000/api/captions/upload" `
  -F "file=@path\to\your_audio.mp3"
```

### 3. Test Live WebSocket (Python Test Script)
You can test the WebSocket with a short Python script:
```python
import asyncio
import websockets
import json

async def test_live():
    uri = "ws://localhost:8000/ws/live"
    async with websockets.connect(uri) as ws:
        msg = await ws.recv()
        print("Connected:", msg)
        
        # Send 1 second of silence in 16kHz 16-bit PCM (32000 bytes)
        silence_chunk = b"\x00\x00" * 1600
        for _ in range(10):
            await ws.send(silence_chunk)
            await asyncio.sleep(0.1)
            
        await ws.send(json.dumps({"type": "stop"}))
        print("Sent stop signal.")

asyncio.run(test_live())
```

---

## ❓ Troubleshooting

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `Gemini API key is not configured` | Missing or blank `GEMINI_API_KEY` in `backend/.env` | Open `backend/.env` and paste your Google AI Studio API key. |
| `FFmpeg is required to extract audio from video files` | FFmpeg executable not found in PATH | Install FFmpeg via `winget install Gyan.FFmpeg` or download manual binary and add to PATH. |
| `File exceeds maximum allowed size` | File larger than `MAX_UPLOAD_MB` | Adjust `MAX_UPLOAD_MB` in `backend/.env` (default is 200MB). |
| `Unsupported file format` | File extension not recognized | Upload supported audio (.mp3, .wav, .m4a, .aac, .flac, .ogg) or video (.mp4, .mov, .mkv, .webm). |
| `WebSocket connection failed` | Server not running or port blocked | Confirm backend is running on `http://127.0.0.1:8000`. |
