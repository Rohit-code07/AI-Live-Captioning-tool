import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  LayoutDashboard, Mic, Upload, Film, Download,
  CheckCircle2, AlertCircle, XCircle, Loader2,
  Play, Square, Wifi, WifiOff, RefreshCw,
  FileText, FileVideo, ClipboardCopy, Trash2,
  ChevronRight, Volume2, Clock, Languages,
  Zap, TrendingUp, Info, Sparkles, Sliders,
  Video, VideoOff, Monitor
} from 'lucide-react'

import { API_BASE_URL, API_ENDPOINTS, getWsUrl } from './config/api'
import { convertTo16kHzPcm } from './utils/audio'
import AudioVisualizer from './components/AudioVisualizer'
import SearchReplaceBar from './components/SearchReplaceBar'
import SubtitleOverlayPreview from './components/SubtitleOverlayPreview'
import LiveVideoFeed from './components/LiveVideoFeed'

// ─────────────────────────────────────────────
// Default fallback dummy segments (when offline)
// ─────────────────────────────────────────────
const DUMMY_SEGMENTS = [
  {
    id: 1,
    start: '00:00:01,000',
    end: '00:00:04,200',
    start_time: '00:00:01,000',
    end_time: '00:00:04,200',
    start_seconds: 1.0,
    end_seconds: 4.2,
    speaker: 'Speaker 1',
    text: 'Welcome to AI Caption Studio.',
    words: [
      { text: 'Welcome', confidence: 0.99 },
      { text: 'to', confidence: 0.98 },
      { text: 'AI', confidence: 0.55 },
      { text: 'Caption', confidence: 0.94 },
      { text: 'Studio.', confidence: 0.96 },
    ],
  },
  {
    id: 2,
    start: '00:00:05,100',
    end: '00:00:09,800',
    start_time: '00:00:05,100',
    end_time: '00:00:09,800',
    start_seconds: 5.1,
    end_seconds: 9.8,
    speaker: 'Speaker 1',
    text: 'Real-time transcription powered by Gemini.',
    words: [
      { text: 'Real-time', confidence: 0.93 },
      { text: 'transcription', confidence: 0.61 },
      { text: 'powered', confidence: 0.97 },
      { text: 'by', confidence: 0.99 },
      { text: 'Gemini.', confidence: 0.88 },
    ],
  },
]

// ─────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────
const srtTimeToSeconds = (t) => {
  if (!t) return 0
  const clean = String(t).replace(',', '.')
  const parts = clean.split(':')
  if (parts.length === 3) {
    return +parts[0] * 3600 + +parts[1] * 60 + +parts[2]
  }
  return parseFloat(clean) || 0
}

const generateSRT = (segments) =>
  segments
    .map((s, i) => {
      const start = s.start_time || s.start || '00:00:00,000'
      const end = s.end_time || s.end || '00:00:00,000'
      const text = s.words && s.words.length > 0 ? s.words.map((w) => w.text).join(' ') : s.text
      return `${i + 1}\n${start} --> ${end}\n${text}`
    })
    .join('\n\n') + '\n'

const generateVTT = (segments) => {
  const lines = ['WEBVTT', '']
  segments.forEach((s, i) => {
    const st = (s.start_time || s.start || '00:00:00,000').replace(',', '.')
    const et = (s.end_time || s.end || '00:00:00,000').replace(',', '.')
    const text = s.words && s.words.length > 0 ? s.words.map((w) => w.text).join(' ') : s.text
    lines.push(`${i + 1}`)
    lines.push(`${st} --> ${et}`)
    lines.push(text)
    lines.push('')
  })
  return lines.join('\n')
}

const generateTXT = (segments) =>
  segments.map((s) => (s.words && s.words.length > 0 ? s.words.map((w) => w.text).join(' ') : s.text)).join('\n')

const downloadFile = (content, filename, mime) => {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─────────────────────────────────────────────
// Shared UI primitives
// ─────────────────────────────────────────────
const Card = ({ children, className = '' }) => (
  <div className={`bg-[#E8F9FF] rounded-2xl border border-[#C4D9FF] p-5 shadow-xs text-black ${className}`}>
    {children}
  </div>
)

const Badge = ({ children, color = 'blue' }) => {
  const colors = {
    blue: 'bg-[#C4D9FF] text-black border border-[#A0C4FF]',
    purple: 'bg-[#C5BAFF] text-black border border-[#A898F0]',
    green: 'bg-emerald-100 text-black border border-emerald-300',
    red: 'bg-rose-100 text-black border border-rose-300',
    amber: 'bg-amber-100 text-black border border-amber-300',
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-full font-['Outfit'] ${colors[color]}`}>
      {children}
    </span>
  )
}

const Btn = ({ children, onClick, disabled, variant = 'primary', size = 'md', className = '', type = 'button' }) => {
  const base = "inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#C5BAFF] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-['Outfit']"
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-2.5 text-base' }
  const variants = {
    primary: 'bg-[#C4D9FF] hover:bg-[#A0C4FF] text-black shadow-xs hover:shadow active:scale-95 border border-[#A0C4FF]',
    purple: 'bg-[#C5BAFF] hover:bg-[#B0A3F5] text-black shadow-xs hover:shadow active:scale-95 border border-[#A898F0]',
    ghost: 'bg-white hover:bg-[#E8F9FF] text-black border border-[#C4D9FF] shadow-xs',
    danger: 'bg-rose-50 hover:bg-rose-100 text-rose-900 border border-rose-300',
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  )
}

const StatusDot = ({ ok, loading }) => {
  if (loading) return <Loader2 size={14} className="animate-spin text-black" />
  return ok
    ? <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shadow shadow-emerald-300" />
    : <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500 shadow shadow-rose-200" />
}

// ─────────────────────────────────────────────
// Tab 1: Dashboard
// ─────────────────────────────────────────────
const Dashboard = ({ segments, health, healthLoading }) => {
  const allWords = segments.flatMap((s) => s.words || [])
  const lowConf = allWords.filter((w) => typeof w.confidence === 'number' && w.confidence < 0.7)
  const totalWords = allWords.length
  const avgConf = totalWords > 0
    ? Math.round((allWords.reduce((acc, w) => acc + (w.confidence || 0), 0) / totalWords) * 100)
    : null

  const metrics = [
    { label: 'Total Segments', value: segments.length, icon: <Film size={20} className="text-[#3B72B9]" /> },
    { label: 'Total Words', value: totalWords, icon: <FileText size={20} className="text-[#7A70BA]" /> },
    {
      label: 'Low Confidence (< 70%)',
      value: lowConf.length,
      icon: <AlertCircle size={20} className={lowConf.length > 0 ? 'text-amber-600' : 'text-neutral-500'} />,
    },
    {
      label: 'Avg Accuracy',
      value: avgConf !== null ? `${avgConf}%` : '—',
      icon: <TrendingUp size={20} className="text-emerald-700" />,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-black font-['Outfit'] tracking-tight">Studio Dashboard</h2>
        <p className="text-sm font-semibold text-neutral-800 mt-0.5">Real-time metrics, system health, and subtitle accuracy overview</p>
      </div>

      {/* Backend Status Card */}
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <StatusDot ok={health?.status === 'ok'} loading={healthLoading} />
            <div>
              <p className="font-bold text-sm text-black font-['Outfit']">FastAPI Backend Server</p>
              <p className="text-xs text-neutral-700 font-mono font-semibold">{API_BASE_URL}</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {health ? (
              <>
                <Badge color={health.gemini_configured ? 'purple' : 'red'}>
                  <Zap size={12} /> Gemini {health.gemini_configured ? 'Ready' : 'Missing API Key'}
                </Badge>
                <Badge color={health.ffmpeg_available ? 'green' : 'amber'}>
                  FFmpeg {health.ffmpeg_available ? 'Available' : 'Missing in PATH'}
                </Badge>
              </>
            ) : !healthLoading ? (
              <Badge color="red"><XCircle size={12} /> Offline</Badge>
            ) : null}
          </div>
        </div>

        {health && (
          <div className="mt-4 pt-3 border-t border-[#C4D9FF] grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-black">
            <div><span className="font-bold text-black">Live Model:</span> <span className="font-mono font-semibold text-black">{health.live_model}</span></div>
            <div><span className="font-bold text-black">Transcribe Model:</span> <span className="font-mono font-semibold text-black">{health.transcribe_model}</span></div>
          </div>
        )}

        {!health && !healthLoading && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs text-black flex items-start gap-2">
            <Info size={15} className="mt-0.5 shrink-0 text-amber-700" />
            <div>
              <p className="font-bold text-black font-['Outfit']">Backend is not responding</p>
              <p className="mt-0.5 text-neutral-800 font-medium">
                Start your backend server in terminal:
                <code className="ml-1 bg-white px-2 py-0.5 rounded border border-amber-300 font-mono font-bold text-black">
                  python -m uvicorn app.main:app --reload
                </code>
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-neutral-800 uppercase tracking-wider">{m.label}</p>
                <p className="text-3xl font-black text-black font-['Outfit'] mt-1">{m.value}</p>
              </div>
              <div className="bg-white rounded-xl p-2.5 shadow-xs border border-[#C4D9FF]">
                {m.icon}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Flagged Review Words */}
      {lowConf.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-black font-['Outfit'] flex items-center gap-1.5">
              <AlertCircle size={15} className="text-amber-600" /> Low-Confidence Words Flagged for Review
            </p>
            <span className="text-xs font-bold text-black font-mono">{lowConf.length} words &lt; 70%</span>
          </div>
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1">
            {lowConf.map((w, i) => (
              <span key={i} className="text-xs bg-amber-100 border border-amber-300 text-black rounded-lg px-2.5 py-1 font-mono flex items-center gap-1.5 shadow-xs">
                <span className="font-bold text-black">{w.text}</span>
                <span className="text-amber-900 font-extrabold text-[10px]">{Math.round(w.confidence * 100)}%</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Feature Capabilities Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white border border-[#C4D9FF] rounded-2xl p-4 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-[#C4D9FF]/50 flex items-center justify-center text-black mb-2.5">
            <Mic size={17} />
          </div>
          <p className="text-xs font-bold text-black font-['Outfit']">Real-Time Streaming</p>
          <p className="text-[11px] font-semibold text-neutral-800 mt-1">
            Browser Web Audio API captures microphone audio and streams 16kHz PCM chunks directly to Gemini Live API.
          </p>
        </div>

        <div className="bg-white border border-[#C4D9FF] rounded-2xl p-4 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-[#C5BAFF]/50 flex items-center justify-center text-black mb-2.5">
            <Sparkles size={17} />
          </div>
          <p className="text-xs font-bold text-black font-['Outfit']">Word Timestamps</p>
          <p className="text-[11px] font-semibold text-neutral-800 mt-1">
            Per-word start and end timing precision paired with AI recognition confidence scores for verified editing.
          </p>
        </div>

        <div className="bg-white border border-[#C4D9FF] rounded-2xl p-4 shadow-xs">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-black mb-2.5">
            <Download size={17} />
          </div>
          <p className="text-xs font-bold text-black font-['Outfit']">Multi-Format Export</p>
          <p className="text-[11px] font-semibold text-neutral-800 mt-1">
            Export standard SubRip (.SRT), WebVTT (.VTT), and clean transcripts (.TXT) synchronized with edits.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Tab 2: Live Captions (Live Video & Audio)
// ─────────────────────────────────────────────
const LiveCaptions = () => {
  const [connected, setConnected] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [liveLines, setLiveLines] = useState([])
  const [interimText, setInterimText] = useState('')
  const [error, setError] = useState(null)
  const [activeStream, setActiveStream] = useState(null)
  const [videoEnabled, setVideoEnabled] = useState(true)
  const [videoSource, setVideoSource] = useState('webcam') // 'webcam' | 'screen'

  const wsRef = useRef(null)
  const streamRef = useRef(null)
  const audioCtxRef = useRef(null)
  const processorRef = useRef(null)
  const scrollRef = useRef(null)

  // Auto-scroll as captions stream in
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [liveLines, interimText])

  const stop = useCallback(() => {
    // 1. Stop audio processing nodes
    if (processorRef.current) {
      try {
        processorRef.current.disconnect()
      } catch (_) {}
      processorRef.current = null
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close()
      } catch (_) {}
      audioCtxRef.current = null
    }

    // 2. Stop all media tracks (microphone & camera/screen)
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop())
      } catch (_) {}
      streamRef.current = null
      setActiveStream(null)
    }

    // 3. Gracefully close WebSocket
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'stop' }))
        }
        wsRef.current.close()
      } catch (_) {}
      wsRef.current = null
    }

    setConnected(false)
    setConnecting(false)
    setInterimText('')
  }, [])

  // Cleanup on unmount to prevent audio and camera leaks
  useEffect(() => {
    return () => {
      stop()
    }
  }, [stop])

  const start = useCallback(async () => {
    if (connected || connecting) return

    setError(null)
    setConnecting(true)

    // 1. Request or reuse media stream (Video + Audio)
    let stream = streamRef.current
    const isStreamActive = stream && stream.active && stream.getTracks().some((t) => t.readyState === 'live')

    if (!isStreamActive) {
      try {
        if (videoSource === 'screen') {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          })
          if (screenStream.getAudioTracks().length === 0) {
            const micStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            })
            stream = new MediaStream([
              ...screenStream.getVideoTracks(),
              ...micStream.getAudioTracks(),
            ])
          } else {
            stream = screenStream
          }
        } else {
          // Webcam + Microphone
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: videoEnabled ? {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user',
              } : false,
              audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            })
          } catch (videoErr) {
            console.warn('Webcam not accessible, falling back to audio-only:', videoErr)
            stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            })
            setVideoEnabled(false)
          }
        }
      } catch (err) {
        setError(`Media capture permission denied: ${err.message || 'Please enable camera & microphone access and try again.'}`)
        setConnecting(false)
        return
      }
      streamRef.current = stream
      setActiveStream(stream)
    } else {
      // Existing preview stream exists; ensure microphone audio track is present
      if (stream.getAudioTracks().length === 0) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              channelCount: 1,
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
          })
          stream.addTrack(micStream.getAudioTracks()[0])
          setActiveStream(new MediaStream(stream.getTracks()))
        } catch (micErr) {
          setError(`Microphone permission denied: ${micErr.message}`)
          setConnecting(false)
          return
        }
      }
    }

    // 2. Open WebSocket connection to backend
    const targetWsUrl = API_ENDPOINTS.WS_LIVE_CAPTIONS
    let ws
    try {
      ws = new WebSocket(targetWsUrl)
      wsRef.current = ws
    } catch (wsErr) {
      setError(`Could not open WebSocket at ${targetWsUrl}: ${wsErr.message}`)
      stop()
      return
    }

    ws.onopen = () => {
      setConnected(true)
      setConnecting(false)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === 'interim') {
          setInterimText(data.text || '')
        } else if (data.type === 'final') {
          if (data.text && data.text.trim()) {
            setLiveLines((prev) => [
              ...prev,
              { text: data.text.trim(), ts: new Date().toLocaleTimeString() },
            ])
          }
          setInterimText('')
        } else if (data.type === 'error') {
          setError(data.message || 'An error occurred during live transcription.')
          stop()
        }
      } catch (_) {}
    }

    ws.onerror = () => {
      setError(`WebSocket error. Confirm backend is running at ${API_BASE_URL}`)
      stop()
    }

    ws.onclose = () => {
      setConnected(false)
      setConnecting(false)
    }

    // 3. Audio pipeline: Web Audio API -> 16kHz mono 16-bit PCM buffer
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      audioCtxRef.current = ctx

      const source = ctx.createMediaStreamSource(stream)
      const bufferSize = 2048
      const processor = ctx.createScriptProcessor(bufferSize, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
        const float32 = e.inputBuffer.getChannelData(0)
        // Downsample/convert to 16 kHz 16-bit little-endian PCM
        const pcmBuffer = convertTo16kHzPcm(float32, ctx.sampleRate)
        wsRef.current.send(pcmBuffer)
      }

      source.connect(processor)
      processor.connect(ctx.destination)
    } catch (audioErr) {
      setError(`Audio processing setup failed: ${audioErr.message}`)
      stop()
    }
  }, [connected, connecting, stop, videoEnabled, videoSource])

  // Live video toggle handler (starts preview immediately if not yet active)
  const toggleVideo = async () => {
    setError(null)
    if (streamRef.current && streamRef.current.active) {
      const videoTracks = streamRef.current.getVideoTracks()
      if (videoTracks.length > 0) {
        const next = !videoTracks[0].enabled
        videoTracks.forEach((t) => (t.enabled = next))
        setVideoEnabled(next)
        if (!next && !connected) {
          // If in preview (not connected) and turning camera off, stop all tracks
          streamRef.current.getTracks().forEach((t) => t.stop())
          streamRef.current = null
          setActiveStream(null)
        }
      } else {
        try {
          const vStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          })
          const track = vStream.getVideoTracks()[0]
          streamRef.current.addTrack(track)
          setVideoEnabled(true)
          setActiveStream(new MediaStream(streamRef.current.getTracks()))
        } catch (err) {
          setError(`Camera access error: ${err.message}`)
        }
      }
    } else {
      // Stream is not open yet: start camera preview immediately!
      try {
        const previewStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        streamRef.current = previewStream
        setActiveStream(previewStream)
        setVideoEnabled(true)
      } catch (err) {
        setError(`Cannot access camera: ${err.message}. Please check browser camera permissions.`)
        setVideoEnabled(false)
      }
    }
  }

  // Switch between webcam and screen share
  const switchVideoSource = async () => {
    if (videoSource === 'webcam') {
      if (connected && streamRef.current) {
        try {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
          const screenTrack = screenStream.getVideoTracks()[0]
          streamRef.current.getVideoTracks().forEach((t) => {
            t.stop()
            streamRef.current.removeTrack(t)
          })
          streamRef.current.addTrack(screenTrack)
          screenTrack.onended = () => {
            setVideoSource('webcam')
          }
          setVideoSource('screen')
          setActiveStream(new MediaStream(streamRef.current.getTracks()))
        } catch (_) {}
      } else {
        setVideoSource('screen')
      }
    } else {
      if (connected && streamRef.current) {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: true })
          const camTrack = camStream.getVideoTracks()[0]
          streamRef.current.getVideoTracks().forEach((t) => {
            t.stop()
            streamRef.current.removeTrack(t)
          })
          streamRef.current.addTrack(camTrack)
          setVideoSource('webcam')
          setActiveStream(new MediaStream(streamRef.current.getTracks()))
        } catch (_) {}
      } else {
        setVideoSource('webcam')
      }
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-black font-['Outfit'] tracking-tight">Live Video & Captions</h2>
        <p className="text-sm font-semibold text-neutral-800 mt-0.5">
          Stream live camera or screen video with real-time speech transcription to Gemini Live API
        </p>
      </div>

      {/* Control Header Card */}
      <Card>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-3.5 h-3.5 rounded-full ${connected ? 'bg-emerald-500 shadow-md shadow-emerald-300 animate-pulse' : 'bg-neutral-400'}`} />
            <div>
              <p className="text-sm font-bold text-black font-['Outfit']">
                {connected ? (videoEnabled ? 'Live Video Broadcast — Active' : 'Session Live — Audio Only') : connecting ? 'Establishing session…' : 'Ready to Start'}
              </p>
              <p className="text-xs text-neutral-700 font-mono font-semibold">{API_ENDPOINTS.WS_LIVE_CAPTIONS}</p>
            </div>
          </div>

          <div className="flex gap-2 items-center flex-wrap">
            {/* Camera Toggle Button */}
            <Btn
              onClick={toggleVideo}
              variant="ghost"
              size="sm"
              title={videoEnabled ? 'Disable Camera' : 'Enable Camera'}
            >
              {videoEnabled ? <Video size={14} className="text-[#3B72B9]" /> : <VideoOff size={14} className="text-neutral-500" />}
              {videoEnabled ? 'Camera On' : 'Camera Off'}
            </Btn>

            {/* Screen Share Mode Switcher */}
            <Btn
              onClick={switchVideoSource}
              variant="ghost"
              size="sm"
              title="Toggle Screen Share Mode"
            >
              <Monitor size={14} className={videoSource === 'screen' ? 'text-[#7A70BA]' : 'text-neutral-700'} />
              {videoSource === 'screen' ? 'Screen Share' : 'Webcam'}
            </Btn>

            {/* Start / Stop Session */}
            {!connected ? (
              <Btn onClick={start} disabled={connecting} variant="purple">
                {connecting ? <Loader2 size={15} className="animate-spin" /> : <Mic size={15} />}
                {connecting ? 'Connecting…' : 'Start Live Broadcast'}
              </Btn>
            ) : (
              <Btn onClick={stop} variant="danger">
                <Square size={15} /> End Broadcast
              </Btn>
            )}

            <Btn onClick={() => { setLiveLines([]); setInterimText('') }} variant="ghost" size="sm">
              <Trash2 size={14} /> Clear
            </Btn>
          </div>
        </div>
      </Card>

      {/* Live Video Feed Component with On-Screen Subtitle Overlay */}
      <LiveVideoFeed
        stream={activeStream}
        isVideoEnabled={videoEnabled}
        onToggleVideo={toggleVideo}
        onSwitchToScreen={switchVideoSource}
        videoSource={videoSource}
        interimText={interimText}
        latestFinalText={liveLines.length > 0 ? liveLines[liveLines.length - 1].text : ''}
      />

      {/* Live Audio Visualizer Component */}
      <AudioVisualizer audioStream={activeStream} isRecording={connected} />

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-300 rounded-xl p-4 text-sm text-black">
          <XCircle size={17} className="mt-0.5 shrink-0 text-rose-700" />
          <p className="leading-relaxed font-semibold">{error}</p>
        </div>
      )}

      {/* Live Caption Display Window */}
      <Card className="min-h-[260px] flex flex-col">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#C4D9FF]">
          <p className="text-xs font-bold text-black font-['Outfit'] uppercase tracking-wider">
            Live Recognized Transcript History
          </p>
          <span className="text-[11px] font-mono font-bold text-neutral-700">
            {liveLines.length} utterances
          </span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2.5 max-h-64 pr-1">
          {liveLines.length === 0 && !interimText && (
            <div className="flex flex-col items-center justify-center h-40 text-neutral-600 gap-2">
              <Volume2 size={34} className="opacity-40 text-black" />
              <p className="text-sm font-bold text-black font-['Outfit']">Click "Start Live Broadcast" and speak into your microphone</p>
              <p className="text-xs font-semibold text-neutral-700">Captions will appear directly on top of the live video and log here</p>
            </div>
          )}

          {/* Finalized Lines */}
          {liveLines.map((line, i) => (
            <div key={i} className="flex gap-3 items-baseline bg-white p-2.5 rounded-xl border border-[#C4D9FF] shadow-xs">
              <span className="text-[11px] font-mono text-neutral-600 shrink-0 select-none font-bold">{line.ts}</span>
              <p className="text-sm text-black leading-relaxed font-semibold">{line.text}</p>
            </div>
          ))}

          {/* Interim Speculative Preview */}
          {interimText && (
            <div className="flex gap-3 items-baseline bg-[#E8F9FF] p-2.5 rounded-xl border border-[#C5BAFF] animate-pulse">
              <span className="text-[10px] font-mono font-bold text-[#7A70BA] shrink-0 uppercase tracking-wider">LIVE</span>
              <p className="text-sm text-black italic leading-relaxed font-semibold">{interimText}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        {liveLines.length > 0 && (
          <div className="border-t border-[#C4D9FF] mt-3 pt-3 flex gap-2 justify-end">
            <Btn size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(liveLines.map((l) => l.text).join('\n'))}>
              <ClipboardCopy size={13} /> Copy Transcript
            </Btn>
            <Btn size="sm" variant="primary" onClick={() => downloadFile(liveLines.map((l) => l.text).join('\n'), 'live_captions.txt', 'text/plain')}>
              <Download size={13} /> Download TXT
            </Btn>
          </div>
        )}
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────
// Tab 3: Media Upload & Preview
// ─────────────────────────────────────────────
const MediaUpload = ({ onSegments, onSwitchTab }) => {
  const [file, setFile] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)
  const fileInputRef = useRef(null)

  const ACCEPT = '.mp3,.wav,.m4a,.aac,.ogg,.flac,.mp4,.mov,.mkv,.webm,.weba'
  const MAX_MB = 200

  const handleFile = (f) => {
    if (!f) return
    setError(null)
    setDone(false)
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File exceeds maximum size limit of ${MAX_MB}MB.`)
      return
    }
    setFile(f)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(f))
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleUpload = async () => {
    if (!file || loading) return
    setLoading(true)
    setError(null)
    setProgress('Uploading file to backend server…')

    const formData = new FormData()
    formData.append('file', file)

    try {
      // Post to /api/v1/upload (with fallback to /api/captions/upload)
      let res = await fetch(API_ENDPOINTS.UPLOAD, { method: 'POST', body: formData }).catch(() => null)
      if (!res || !res.ok) {
        res = await fetch(API_ENDPOINTS.UPLOAD_FALLBACK, { method: 'POST', body: formData })
      }

      setProgress('Transcribing audio with Gemini AI model…')
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({ detail: res.statusText }))
        throw new Error(errJson.detail || `Server returned HTTP ${res.status}`)
      }

      const data = await res.json()

      // Ensure segment words have confidence values
      const enriched = (data.segments || []).map((seg) => ({
        ...seg,
        start: seg.start_time || seg.start || '00:00:00,000',
        end: seg.end_time || seg.end || '00:00:00,000',
        speaker: seg.speaker || 'Speaker 1',
        words: seg.words && seg.words.length > 0
          ? seg.words
          : (seg.text || '').split(/\s+/).filter(Boolean).map((t) => ({ text: t, confidence: 0.95 })),
      }))

      onSegments(enriched, data, previewUrl)
      setDone(true)
      setProgress('Completed! Opening Review Studio…')
      setTimeout(() => onSwitchTab('studio'), 500)
    } catch (err) {
      setError(err.message || 'An error occurred during file upload and transcription.')
    } finally {
      setLoading(false)
    }
  }

  const isVideo = file && ['mp4', 'mov', 'mkv', 'webm'].includes(file.name.split('.').pop().toLowerCase())

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-black font-['Outfit'] tracking-tight">Media Upload & Transcription</h2>
        <p className="text-sm font-semibold text-neutral-800 mt-0.5">Upload audio or video files to generate timestamps and editable captions</p>
      </div>

      {/* Drag & Drop Area */}
      <div
        className={`border-2 border-dashed rounded-2xl transition-all duration-200 cursor-pointer
          ${dragging ? 'border-[#3B72B9] bg-[#E8F9FF] scale-[1.01]' : 'border-[#C4D9FF] bg-white hover:border-[#3B72B9] hover:bg-[#F5FBFF]'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#C4D9FF]/50 flex items-center justify-center text-black shadow-xs">
            <Upload size={28} className="text-[#3B72B9]" />
          </div>
          <div>
            <p className="font-bold text-black font-['Outfit'] text-base">Drag & drop your audio or video file here, or click to browse</p>
            <p className="text-xs font-semibold text-neutral-700 mt-1">
              Audio: MP3, WAV, M4A, AAC, OGG, FLAC &nbsp;|&nbsp; Video: MP4, MOV, MKV, WebM
            </p>
            <p className="text-xs font-bold text-black mt-1">Maximum file size: {MAX_MB}MB</p>
          </div>
        </div>
      </div>

      {/* Selected File Card & Preview Player */}
      {file && (
        <Card>
          <div className="flex items-center gap-3 mb-4">
            {isVideo ? <FileVideo size={22} className="text-[#3B72B9]" /> : <Volume2 size={22} className="text-[#7A70BA]" />}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-black truncate font-['Outfit']">{file.name}</p>
              <p className="text-xs text-neutral-700 font-mono font-semibold">
                {(file.size / 1024 / 1024).toFixed(2)} MB &nbsp;·&nbsp; {isVideo ? 'Video format' : 'Audio format'}
              </p>
            </div>
            <Btn size="sm" variant="ghost" onClick={() => { setFile(null); setPreviewUrl(null); setDone(false) }}>
              <Trash2 size={13} /> Remove
            </Btn>
          </div>

          {previewUrl && (
            <div className="rounded-xl overflow-hidden bg-black mb-4 shadow-sm border border-[#C4D9FF]">
              {isVideo ? (
                <video src={previewUrl} controls className="w-full max-h-72 rounded-xl" />
              ) : (
                <div className="p-3">
                  <audio src={previewUrl} controls className="w-full" />
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <Btn onClick={handleUpload} disabled={loading || done} variant="purple" size="md">
              {loading ? <Loader2 size={16} className="animate-spin" /> : done ? <CheckCircle2 size={16} /> : <Zap size={16} />}
              {loading ? progress : done ? 'Done! Opening Studio…' : 'Transcribe with Gemini'}
            </Btn>
            {done && <Badge color="green"><CheckCircle2 size={12} /> Transcription completed</Badge>}
          </div>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-start gap-2.5 bg-rose-50 border border-rose-300 rounded-xl p-4 text-sm text-black">
          <XCircle size={17} className="mt-0.5 shrink-0 text-rose-700" />
          <div>
            <p className="font-bold text-black font-['Outfit']">Transcription failed</p>
            <p className="mt-0.5 text-xs text-rose-900 font-semibold">{error}</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Tab 4: Interactive Review Studio
// ─────────────────────────────────────────────
const Studio = ({ segments, setSegments, mediaUrl, transcriptData }) => {
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.70)
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0)
  const videoRef = useRef(null)

  const updateWord = (segId, wordIdx, newText) => {
    setSegments((prev) =>
      prev.map((s) =>
        s.id === segId
          ? {
              ...s,
              words: s.words.map((w, i) => (i === wordIdx ? { ...w, text: newText } : w)),
              text: s.words.map((w, i) => (i === wordIdx ? newText : w.text)).join(' '),
            }
          : s
      )
    )
  }

  const seekTo = (timeValue, segIndex) => {
    if (typeof segIndex === 'number') {
      setActiveSegmentIndex(segIndex)
    }
    const seconds = typeof timeValue === 'number' ? timeValue : srtTimeToSeconds(timeValue)
    if (videoRef.current) {
      videoRef.current.currentTime = seconds
      videoRef.current.play().catch(() => {})
    }
  }

  const currentSegment = segments[activeSegmentIndex] || segments[0]
  const currentPreviewText = currentSegment
    ? (currentSegment.words && currentSegment.words.length > 0
        ? currentSegment.words.map((w) => w.text).join(' ')
        : currentSegment.text)
    : 'No subtitle segment selected'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-black text-black font-['Outfit'] tracking-tight">Interactive Review Studio</h2>
          <p className="text-sm font-semibold text-neutral-800 mt-0.5">
            Click any word to inline edit. Amber badges highlight words below confidence threshold.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {transcriptData && (
            <Badge color={transcriptData.timestamps_estimated ? 'amber' : 'green'}>
              {transcriptData.timestamps_estimated ? (
                <><Clock size={11} /> Timestamps Estimated</>
              ) : (
                <><CheckCircle2 size={11} /> Word Timestamps Verified</>
              )}
            </Badge>
          )}
          <Badge color="purple">{segments.length} segments</Badge>
        </div>
      </div>

      {/* Video Player in Studio */}
      {mediaUrl && (
        <Card className="p-2 overflow-hidden bg-black border-[#C4D9FF]">
          <video
            ref={videoRef}
            src={mediaUrl}
            controls
            className="w-full max-h-80 rounded-xl"
          />
        </Card>
      )}

      {/* Global Search & Replace Bar with Dynamic Confidence Threshold Slider */}
      <SearchReplaceBar
        segments={segments}
        setSegments={setSegments}
        confidenceThreshold={confidenceThreshold}
        setConfidenceThreshold={setConfidenceThreshold}
      />

      {/* Subtitle Overlay Preview Component */}
      <SubtitleOverlayPreview currentText={currentPreviewText} />

      {/* Segment Cards */}
      {segments.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Film size={40} className="text-neutral-400" />
          <p className="font-bold text-black font-['Outfit'] text-base">No transcription segments available</p>
          <p className="text-xs font-semibold text-neutral-700">Upload an audio or video file to view and edit captions</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {segments.map((seg, sIdx) => {
            const isActive = activeSegmentIndex === sIdx
            return (
              <Card
                key={seg.id}
                className={`transition-all duration-150 ${isActive ? 'ring-2 ring-[#7A70BA] bg-[#E1F3FE]' : ''}`}
              >
                {/* Cue Header */}
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge color="blue">Cue #{seg.id}</Badge>
                    <button
                      type="button"
                      onClick={() => seekTo(seg.start_seconds || seg.start_time || seg.start, sIdx)}
                      className="text-xs font-mono font-bold text-black hover:text-[#3B72B9] flex items-center gap-1 cursor-pointer bg-white px-2.5 py-1 rounded-lg border border-[#C4D9FF] shadow-xs"
                      title="Seek player to timestamp"
                    >
                      <Play size={10} className="fill-current text-black" />
                      {seg.start_time || seg.start} {'→'} {seg.end_time || seg.end}
                    </button>
                    {seg.speaker && <Badge color="purple"><Volume2 size={10} /> {seg.speaker}</Badge>}
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSegmentIndex(sIdx)}
                    className="text-xs font-bold text-black hover:underline cursor-pointer"
                  >
                    {isActive ? '● Currently Active' : 'Select for Preview'}
                  </button>
                </div>

                {/* Word by word chips */}
                <div className="flex flex-wrap gap-1.5">
                  {(seg.words || []).map((w, wi) => {
                    const isLow = typeof w.confidence === 'number' && w.confidence < confidenceThreshold
                    return (
                      <div
                        key={wi}
                        className={`flex flex-col items-center rounded-lg border px-2 py-0.5 transition-colors shadow-xs
                          ${isLow ? 'bg-amber-100 border-amber-400 text-black' : 'bg-white border-[#C4D9FF] text-black'}`}
                      >
                        <input
                          className={`text-sm font-bold text-center bg-transparent outline-none focus:ring-1 rounded text-black
                            ${isLow ? 'focus:ring-amber-600' : 'focus:ring-blue-500'}`}
                          style={{ width: `${Math.max((w.text || '').length, 3)}ch` }}
                          value={w.text || ''}
                          onChange={(e) => updateWord(seg.id, wi, e.target.value)}
                        />
                        <span className={`text-[9px] font-mono leading-none select-none ${isLow ? 'text-amber-950 font-black' : 'text-neutral-600 font-bold'}`}>
                          {typeof w.confidence === 'number' ? `${Math.round(w.confidence * 100)}%` : '—'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Tab 5: Export Hub
// ─────────────────────────────────────────────
const ExportHub = ({ segments, transcriptData }) => {
  const [reExporting, setReExporting] = useState(false)
  const [serverExports, setServerExports] = useState(null)

  // Dynamically generated client subtitle strings (always in sync with inline edits)
  const srtText = generateSRT(segments)
  const vttText = generateVTT(segments)
  const txtText = generateTXT(segments)

  const handleSyncWithBackend = async () => {
    setReExporting(true)
    try {
      const res = await fetch(API_ENDPOINTS.RE_EXPORT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segments }),
      })
      if (res.ok) {
        const data = await res.json()
        setServerExports(data)
      }
    } catch (_) {}
    setReExporting(false)
  }

  const exportFormats = [
    {
      label: 'Plain Text Transcript',
      ext: 'txt',
      mime: 'text/plain',
      desc: 'Clean text transcript formatted for documentation and summaries',
      icon: <FileText size={22} className="text-[#3B72B9]" />,
      content: serverExports?.txt || txtText,
    },
    {
      label: 'SubRip Subtitles (SRT)',
      ext: 'srt',
      mime: 'text/plain',
      desc: 'Standard numbered cue subtitle format for Premiere, YouTube, and VLC',
      icon: <FileVideo size={22} className="text-[#7A70BA]" />,
      content: serverExports?.srt || srtText,
    },
    {
      label: 'WebVTT Subtitles (VTT)',
      ext: 'vtt',
      mime: 'text/vtt',
      desc: 'HTML5 native video track subtitle format for web players',
      icon: <FileVideo size={22} className="text-emerald-700" />,
      content: serverExports?.vtt || vttText,
    },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-black text-black font-['Outfit'] tracking-tight">Export Hub</h2>
        <p className="text-sm font-semibold text-neutral-800 mt-0.5">Download your edited transcript with valid formatting and cue timings</p>
      </div>

      {transcriptData?.timestamps_estimated && (
        <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-black flex items-start gap-2">
          <Info size={15} className="mt-0.5 shrink-0 text-amber-700" />
          <p className="font-semibold">
            <strong className="font-bold">Note on Timing:</strong> Word-level timestamps were not returned by the model for this file.
            Subtitle cue timings have been estimated based on sentence boundaries.
          </p>
        </div>
      )}

      {segments.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <Download size={40} className="text-neutral-400" />
          <p className="font-bold text-black font-['Outfit'] text-base">No captions to export yet</p>
          <p className="text-xs font-semibold text-neutral-700">Upload and transcribe a file first to download subtitles</p>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Btn onClick={handleSyncWithBackend} disabled={reExporting} variant="ghost" size="sm">
              {reExporting ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              Sync edits with backend server
            </Btn>
            {serverExports && <Badge color="green"><CheckCircle2 size={11} /> Server synced</Badge>}
          </div>

          <div className="space-y-3">
            {exportFormats.map((ex) => (
              <Card key={ex.ext}>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-white border border-[#C4D9FF] flex items-center justify-center shadow-xs">
                      {ex.icon}
                    </div>
                    <div>
                      <p className="font-bold text-black text-sm font-['Outfit']">{ex.label}</p>
                      <p className="text-xs font-semibold text-neutral-700">{ex.desc}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Btn size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(ex.content)}>
                      <ClipboardCopy size={13} /> Copy
                    </Btn>
                    <Btn size="sm" variant="primary" onClick={() => downloadFile(ex.content, `captions.${ex.ext}`, ex.mime)}>
                      <Download size={13} /> Download .{ex.ext}
                    </Btn>
                  </div>
                </div>

                {/* Subtitle Preview Box */}
                <div className="mt-3 bg-white rounded-xl border border-[#C4D9FF] p-3 max-h-32 overflow-y-auto">
                  <pre className="text-xs font-mono font-bold text-black whitespace-pre-wrap leading-relaxed select-all">
                    {ex.content.slice(0, 600)}
                    {ex.content.length > 600 ? '\n…' : ''}
                  </pre>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// Root Application
// ─────────────────────────────────────────────
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'live', label: 'Live Captions', icon: Mic },
  { id: 'upload', label: 'Media Upload', icon: Upload },
  { id: 'studio', label: 'Review Studio', icon: Film },
  { id: 'export', label: 'Export Hub', icon: Download },
]

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [segments, setSegments] = useState(DUMMY_SEGMENTS)
  const [transcriptData, setTranscriptData] = useState(null)
  const [mediaUrl, setMediaUrl] = useState(null)
  const [health, setHealth] = useState(null)
  const [healthLoading, setHealthLoading] = useState(true)

  // Fetch backend health on mount
  useEffect(() => {
    setHealthLoading(true)
    fetch(API_ENDPOINTS.HEALTH)
      .catch(() => fetch(API_ENDPOINTS.HEALTH_FALLBACK))
      .then((r) => r.json())
      .then((data) => setHealth(data))
      .catch(() => setHealth(null))
      .finally(() => setHealthLoading(false))
  }, [])

  const handleSegments = (newSegments, rawData, url) => {
    setSegments(newSegments)
    setTranscriptData(rawData)
    if (url) setMediaUrl(url)
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row font-['Inter',sans-serif] bg-[#FBFBFB] text-black">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 md:min-h-screen bg-white border-b md:border-b-0 md:border-r border-[#C4D9FF] flex md:flex-col p-3 md:p-4 gap-1 shrink-0">
        {/* App Brand Header */}
        <div className="hidden md:flex items-center gap-2.5 px-3 py-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C4D9FF] to-[#C5BAFF] flex items-center justify-center shadow-xs border border-[#A0C4FF]">
            <Zap size={20} className="text-black" />
          </div>
          <div>
            <p className="font-black text-base text-black font-['Outfit'] leading-tight">AI Caption</p>
            <p className="text-[11px] font-bold text-neutral-700 font-['Outfit'] tracking-wider uppercase">Studio Pro</p>
          </div>
        </div>

        {/* Tab Items */}
        <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible flex-1">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-['Outfit'] transition-all whitespace-nowrap cursor-pointer
                  ${active
                    ? 'bg-[#E8F9FF] text-black border border-[#C4D9FF] shadow-xs font-bold'
                    : 'text-neutral-800 hover:bg-[#F5FBFF] hover:text-black font-semibold'
                  }`}
              >
                <Icon size={17} className={active ? 'text-[#3B72B9]' : 'text-neutral-700'} />
                <span className="hidden md:inline">{tab.label}</span>
                {active && <ChevronRight size={14} className="ml-auto hidden md:block text-[#3B72B9]" />}
              </button>
            )
          })}
        </nav>

        {/* Bottom Health Status Pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-2.5 mt-auto bg-[#F5FBFF] rounded-xl border border-[#C4D9FF]">
          <StatusDot ok={health?.status === 'ok'} loading={healthLoading} />
          <span className="text-xs text-black font-bold truncate font-['Outfit']">
            {health?.status === 'ok' ? 'Backend Online' : healthLoading ? 'Checking server…' : 'Backend Offline'}
          </span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-5 md:p-8 max-w-4xl mx-auto w-full">
        {activeTab === 'dashboard' && <Dashboard segments={segments} health={health} healthLoading={healthLoading} />}
        {activeTab === 'live' && <LiveCaptions />}
        {activeTab === 'upload' && <MediaUpload onSegments={handleSegments} onSwitchTab={setActiveTab} />}
        {activeTab === 'studio' && <Studio segments={segments} setSegments={setSegments} mediaUrl={mediaUrl} transcriptData={transcriptData} />}
        {activeTab === 'export' && <ExportHub segments={segments} transcriptData={transcriptData} />}
      </main>
    </div>
  )
}
