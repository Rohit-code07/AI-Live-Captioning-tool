# AI Caption Studio

Full-stack web application for real-time live microphone captioning and pre-recorded audio/video transcription using Google Gemini models:
- **Backend (FastAPI)**: Google Gen AI SDK integration (`gemini-3.5-transcribe-live` & `gemini-3.5-transcribe`), WebSockets, FFmpeg media processing, subtitle generator (SRT, WebVTT, TXT).
- **Frontend (React + Vite + Tailwind CSS)**: Pastel Blue & Lavender themed UI with 5 interactive tabs: Dashboard, Live Captions, Media Upload, Review Studio with word confidence highlighting (< 70% amber warning), and Export Hub.

---

## 📂 Project Structure

```
captioning-tools/
├── backend/
│   ├── app/
│   │   ├── main.py                    # FastAPI app, lifespan, CORS, global error handling
│   │   ├── core/config.py             # Environment settings & upload limits
│   │   ├── routes/
│   │   │   ├── live_caption.py        # WebSocket /ws/live and /ws/live-captions
│   │   │   └── upload_caption.py      # POST /api/v1/upload and /api/captions/upload
│   │   ├── services/
│   │   │   ├── gemini_live.py         # Gemini Live API bidirectional audio streaming
│   │   │   ├── gemini_transcription.py# Gemini Files API + gemini-3.5-transcribe
│   │   │   ├── media_processor.py     # FFmpeg audio extraction and cleanup
│   │   │   └── subtitle_generator.py  # Word grouping, SRT, WebVTT, TXT generation
│   │   ├── schemas/caption.py         # Pydantic models for segments, cues, and exports
│   │   └── utils/file_validator.py    # MIME, size check & path traversal protection
│   ├── temp/                          # Temporary upload processing directory
│   ├── tests/                         # Pytest test suite (18 unit and integration tests)
│   ├── .env.example
│   ├── requirements.txt
│   └── README.md
│
└── frontend/
    ├── src/
    │   ├── App.jsx                    # 5-tab AI Caption Studio single-page app
    │   ├── main.jsx                   # React root entrypoint
    │   └── index.css                  # Tailwind CSS styling & custom scrollbars
    ├── index.html
    ├── package.json
    └── vite.config.js
```

---

## 🚀 Quick Start (Windows PowerShell)

### Terminal 1: Backend (FastAPI)

```powershell
cd C:\Users\rohit\Projects\captioning-tools\backend

# 1. Configure Gemini API key
Copy-Item .env.example .env
# Open .env and set: GEMINI_API_KEY=your_gemini_api_key

# 2. Activate virtual environment & install requirements
.\.venv\Scripts\activate
uv pip install -r requirements.txt

# 3. Start the FastAPI server
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

- Backend API: `http://localhost:8000`
- Swagger Docs: `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/api/v1/health`

---

### Terminal 2: Frontend (Vite + React)

```powershell
cd C:\Users\rohit\Projects\captioning-tools\frontend

# 1. Start the Vite dev server
npm run dev
```

- Web App: `http://localhost:5173`

---

## 🎨 Frontend Features & Studio Tabs

1. **Dashboard**: Shows metrics (Total Segments, Low Confidence words count < 70%, Backend Status) and checks API health on mount.
2. **Live Captions**: Web Audio API captures microphone audio as 16kHz mono 16-bit PCM and streams via WebSocket to Gemini Live API (`gemini-3.5-transcribe-live`), displaying interim previews and committed captions in real time.
3. **Media Upload & Preview**: Drag-and-drop or file picker for audio (`.mp3`, `.wav`, `.m4a`, `.aac`, `.flac`, `.ogg`) and video (`.mp4`, `.mov`, `.mkv`, `.webm`). Previews immediately with HTML5 player, uploads to backend, and switches automatically to Review Studio upon completion.
4. **Interactive Review Studio**: Video player synced with captions. Renders each word as an input field with low-confidence (< 70%) words highlighted in amber. Allows inline editing and seeking the video player to any segment's timestamp.
5. **Export Hub**: One-click download of edited transcripts as `.SRT`, `.VTT`, or `.TXT` files, with an option to sync edits back to the backend.

---

## 🧪 Running Automated Tests

```powershell
cd C:\Users\rohit\Projects\captioning-tools
$env:PYTHONPATH=".\backend"
.\backend\.venv\Scripts\python.exe -m pytest .\backend\tests -v
```

All 18 automated tests run locally using mocks without consuming API credits.
