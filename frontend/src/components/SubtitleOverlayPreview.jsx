import React, { useState } from 'react'
import { Eye, Palette, Type, AlignCenter } from 'lucide-react'

export default function SubtitleOverlayPreview({ currentText = 'Sample live preview subtitle caption text.' }) {
  const [fontSize, setFontSize] = useState('text-base')
  const [textColor, setTextColor] = useState('text-white')
  const [bgStyle, setBgStyle] = useState('bg-black/80')
  const [position, setPosition] = useState('bottom')

  return (
    <div className="bg-white border border-[#C4D9FF] rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-bold text-black font-['Outfit'] flex items-center gap-1.5">
          <Eye size={14} className="text-[#5B8AC7]" />
          Subtitle Overlay Preview (Player Appearance)
        </p>

        {/* Style Controls */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Size */}
          <div className="flex items-center gap-1 bg-slate-50 border border-[#C4D9FF] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setFontSize('text-xs')}
              className={`px-2 py-0.5 rounded font-bold cursor-pointer ${fontSize === 'text-xs' ? 'bg-[#C5BAFF] text-black' : 'text-slate-600'}`}
            >
              S
            </button>
            <button
              type="button"
              onClick={() => setFontSize('text-base')}
              className={`px-2 py-0.5 rounded font-bold cursor-pointer ${fontSize === 'text-base' ? 'bg-[#C5BAFF] text-black' : 'text-slate-600'}`}
            >
              M
            </button>
            <button
              type="button"
              onClick={() => setFontSize('text-xl')}
              className={`px-2 py-0.5 rounded font-bold cursor-pointer ${fontSize === 'text-xl' ? 'bg-[#C5BAFF] text-black' : 'text-slate-600'}`}
            >
              L
            </button>
          </div>

          {/* Color */}
          <div className="flex items-center gap-1 bg-slate-50 border border-[#C4D9FF] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setTextColor('text-white')}
              className={`w-5 h-5 rounded-full bg-white border border-slate-300 cursor-pointer ${textColor === 'text-white' ? 'ring-2 ring-[#7A70BA]' : ''}`}
              title="White"
            />
            <button
              type="button"
              onClick={() => setTextColor('text-yellow-300')}
              className={`w-5 h-5 rounded-full bg-yellow-300 cursor-pointer ${textColor === 'text-yellow-300' ? 'ring-2 ring-[#7A70BA]' : ''}`}
              title="Yellow"
            />
            <button
              type="button"
              onClick={() => setTextColor('text-cyan-300')}
              className={`w-5 h-5 rounded-full bg-cyan-300 cursor-pointer ${textColor === 'text-cyan-300' ? 'ring-2 ring-[#7A70BA]' : ''}`}
              title="Cyan"
            />
          </div>

          {/* Position */}
          <button
            type="button"
            onClick={() => setPosition(position === 'bottom' ? 'top' : 'bottom')}
            className="px-2 py-1 rounded-lg border border-[#C4D9FF] bg-slate-50 font-bold text-black cursor-pointer hover:bg-slate-100"
          >
            {position === 'bottom' ? 'Bottom' : 'Top'}
          </button>
        </div>
      </div>

      {/* Simulated Video Frame Preview */}
      <div className="relative w-full h-32 rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 overflow-hidden flex items-center justify-center p-3 select-none">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
        
        <div
          className={`absolute ${position === 'bottom' ? 'bottom-3' : 'top-3'} left-1/2 -translate-x-1/2 max-w-[90%] px-4 py-1.5 rounded-lg ${bgStyle} backdrop-blur-sm text-center shadow-lg transition-all duration-150`}
        >
          <p className={`${fontSize} ${textColor} font-bold tracking-wide drop-shadow-md`}>
            {currentText}
          </p>
        </div>
      </div>
    </div>
  )
}
