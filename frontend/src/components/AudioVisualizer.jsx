import React, { useEffect, useRef, useState } from 'react'
import { Activity, Mic } from 'lucide-react'

export default function AudioVisualizer({ audioStream, isRecording }) {
  const canvasRef = useRef(null)
  const animFrameRef = useRef(null)
  const [audioLevel, setAudioLevel] = useState(0)

  useEffect(() => {
    if (!isRecording || !audioStream) {
      setAudioLevel(0)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      return
    }

    let audioCtx
    let analyser
    let source

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      audioCtx = new AudioContextClass()
      analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.8

      source = audioCtx.createMediaStreamSource(audioStream)
      source.connect(analyser)

      const bufferLength = analyser.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      const canvas = canvasRef.current
      const ctx = canvas ? canvas.getContext('2d') : null

      const draw = () => {
        animFrameRef.current = requestAnimationFrame(draw)
        analyser.getByteFrequencyData(dataArray)

        let sum = 0
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i]
        }
        const avg = sum / bufferLength
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)))

        if (!ctx || !canvas) return

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const barWidth = (canvas.width / bufferLength) * 1.8
        let x = 0

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height * 0.9

          // Gradient from pastel blue to lavender
          const grad = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height)
          grad.addColorStop(0, '#7A70BA')
          grad.addColorStop(1, '#98C1D9')

          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.roundRect(x, canvas.height - Math.max(barHeight, 4), barWidth - 2, Math.max(barHeight, 4), 3)
          ctx.fill()

          x += barWidth + 1
        }
      }

      draw()
    } catch (e) {
      console.warn('AudioVisualizer setup error:', e)
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (source) {
        try { source.disconnect() } catch (_) {}
      }
      if (audioCtx) {
        try { audioCtx.close() } catch (_) {}
      }
    }
  }, [isRecording, audioStream])

  return (
    <div className="bg-white/90 border border-[#C4D9FF] rounded-xl p-3 flex items-center justify-between gap-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg ${isRecording ? 'bg-[#C5BAFF] text-black animate-pulse' : 'bg-slate-100 text-slate-400'}`}>
          <Mic size={16} />
        </div>
        <div>
          <p className="text-xs font-bold text-black font-['Outfit']">
            {isRecording ? 'Live Voice Activity' : 'Microphone Idle'}
          </p>
          <p className="text-[11px] font-semibold text-black">
            {isRecording ? (audioLevel > 15 ? 'Receiving Speech Audio' : 'Listening for Speech…') : 'Start Recording to Monitor Signal'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isRecording && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono font-bold text-black">{audioLevel}%</span>
            <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden border border-[#C4D9FF]">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-75"
                style={{ width: `${audioLevel}%` }}
              />
            </div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          width={120}
          height={32}
          className="rounded bg-slate-50 border border-[#C4D9FF]/60"
        />
      </div>
    </div>
  )
}
