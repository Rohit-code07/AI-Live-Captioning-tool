import React, { useRef, useEffect, useState } from 'react'
import {
  Video, VideoOff, Monitor, Maximize2,
  Subtitles, Volume2, VolumeX, Circle, Sparkles
} from 'lucide-react'

export default function LiveVideoFeed({
  stream,
  isVideoEnabled,
  onToggleVideo,
  onSwitchToScreen,
  videoSource = 'webcam', // 'webcam' | 'screen'
  interimText = '',
  latestFinalText = '',
}) {
  const videoRef = useRef(null)
  const containerRef = useRef(null)
  const [showCaptions, setShowCaptions] = useState(true)
  const [captionSize, setCaptionSize] = useState('md') // 'sm' | 'md' | 'lg'
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  // Attach MediaStream to HTML5 video element with play() fallback
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (stream && isVideoEnabled) {
      video.srcObject = stream
      video.onloadedmetadata = () => {
        video.play().catch((err) => console.warn('Video autoPlay prevented:', err))
      }
      video.play().catch(() => {})
    } else {
      video.srcObject = null
    }
  }, [stream, isVideoEnabled])

  // Recording timer
  useEffect(() => {
    let interval = null
    if (stream) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1)
      }, 1000)
    } else {
      setElapsedSeconds(0)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [stream])

  const formatTimer = (secs) => {
    const mins = Math.floor(secs / 60)
    const rem = secs % 60
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`
  }

  const toggleFullscreen = () => {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen().catch(() => {})
      setIsFullscreen(false)
    }
  }

  const activeCaption = interimText || latestFinalText

  const sizeClasses = {
    sm: 'text-xs sm:text-sm py-1 px-3',
    md: 'text-sm sm:text-base py-1.5 px-4',
    lg: 'text-base sm:text-xl py-2 px-5 font-bold',
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-2xl bg-black border border-[#C4D9FF] overflow-hidden shadow-md aspect-video max-h-[440px] flex items-center justify-center select-none"
    >
      {/* Live Video Element - Kept permanently in DOM so ref and srcObject are always preserved */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover ${
          videoSource === 'webcam' ? 'scale-x-[-1]' : ''
        } ${isVideoEnabled && stream ? 'block' : 'hidden'}`}
      />

      {/* Offline / Inactive Camera Placeholder */}
      {(!isVideoEnabled || !stream) && (
        <div className="flex flex-col items-center justify-center text-center p-6 gap-3 text-white">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center border border-white/20">
            <VideoOff size={30} className="text-white/70" />
          </div>
          <div>
            <p className="font-['Outfit'] font-bold text-white text-base">Live Video Feed Offline</p>
            <p className="text-xs text-white/70 mt-1 max-w-sm">
              Click the button below to turn on your camera and preview live video with synchronized closed captions.
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleVideo}
            className="mt-1 px-4 py-2 rounded-xl bg-[#C4D9FF] hover:bg-[#A0C4FF] text-black font-['Outfit'] font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm transition-all active:scale-95"
          >
            <Video size={14} /> Turn Camera On
          </button>
        </div>
      )}

      {/* Top Overlay Bar: Status, Source Badge & Controls */}
      <div className="absolute top-3 inset-x-3 flex items-center justify-between gap-2 z-20 pointer-events-auto">
        <div className="flex items-center gap-2">
          {stream && (
            <div className="flex items-center gap-1.5 bg-black/70 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 shadow-sm text-white">
              <Circle size={9} className="fill-red-500 text-red-500 animate-pulse" />
              <span className="text-[10px] font-black font-['Outfit'] tracking-wider uppercase text-red-400">LIVE</span>
              <span className="text-[10px] font-mono font-bold text-white/90 ml-1">{formatTimer(elapsedSeconds)}</span>
            </div>
          )}

          {isVideoEnabled && stream && (
            <div className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20 text-white text-[10px] font-bold font-['Outfit'] flex items-center gap-1">
              {videoSource === 'screen' ? <Monitor size={11} /> : <Video size={11} />}
              <span>{videoSource === 'screen' ? 'Screen Share' : 'HD Webcam'}</span>
            </div>
          )}
        </div>

        {/* Video Toolbar */}
        <div className="flex items-center gap-1.5 bg-black/60 backdrop-blur-md p-1 rounded-xl border border-white/20">
          {/* Toggle Video */}
          <button
            type="button"
            onClick={onToggleVideo}
            title={isVideoEnabled && stream ? 'Turn Camera Off' : 'Turn Camera On'}
            className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isVideoEnabled && stream ? 'bg-[#C5BAFF] text-black' : 'text-white hover:bg-white/20'
            }`}
          >
            {isVideoEnabled && stream ? <Video size={15} /> : <VideoOff size={15} />}
          </button>

          {/* Switch to Screen Share */}
          {onSwitchToScreen && (
            <button
              type="button"
              onClick={onSwitchToScreen}
              title={videoSource === 'screen' ? 'Switch to Webcam' : 'Switch to Screen Share'}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                videoSource === 'screen' ? 'bg-[#C4D9FF] text-black' : 'text-white hover:bg-white/20'
              }`}
            >
              <Monitor size={15} />
            </button>
          )}

          {/* Toggle CC overlay */}
          <button
            type="button"
            onClick={() => setShowCaptions(!showCaptions)}
            title={showCaptions ? 'Hide Captions' : 'Show Captions'}
            className={`px-2 py-1 rounded-lg text-xs font-['Outfit'] font-black transition-all cursor-pointer ${
              showCaptions ? 'bg-amber-300 text-black' : 'text-white/60 hover:bg-white/20'
            }`}
          >
            CC
          </button>

          {/* Caption Size Toggle */}
          {showCaptions && (
            <button
              type="button"
              onClick={() => setCaptionSize(captionSize === 'sm' ? 'md' : captionSize === 'md' ? 'lg' : 'sm')}
              title="Caption Font Size"
              className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-white bg-white/10 hover:bg-white/20 cursor-pointer"
            >
              {captionSize.toUpperCase()}
            </button>
          )}

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
            className="p-1.5 rounded-lg text-white hover:bg-white/20 cursor-pointer transition-all"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Real-Time Live Closed Caption (CC) Overlay on Video */}
      {showCaptions && activeCaption && (
        <div className="absolute bottom-5 inset-x-4 flex justify-center z-20 pointer-events-none">
          <div
            className={`max-w-[92%] rounded-xl bg-black/85 backdrop-blur-md border border-white/25 shadow-2xl text-center text-white font-['Outfit'] font-bold tracking-wide transition-all duration-100 ${sizeClasses[captionSize]}`}
          >
            {activeCaption}
            {interimText && (
              <span className="inline-block w-2 h-2 ml-1.5 rounded-full bg-amber-400 animate-ping" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
