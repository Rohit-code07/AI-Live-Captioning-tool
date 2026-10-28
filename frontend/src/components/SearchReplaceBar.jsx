import React, { useState } from 'react'
import { Search, Replace, Sliders, Check, ArrowRight } from 'lucide-react'

export default function SearchReplaceBar({
  segments,
  setSegments,
  confidenceThreshold,
  setConfidenceThreshold,
  onJumpToNextFlagged,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [replaceTerm, setReplaceTerm] = useState('')
  const [message, setMessage] = useState('')

  const handleReplaceAll = () => {
    if (!searchTerm.trim()) return

    let count = 0
    const regex = new RegExp(searchTerm.trim(), 'gi')

    const updated = segments.map((seg) => {
      let segChanged = false
      const newWords = (seg.words || []).map((w) => {
        if (regex.test(w.text)) {
          count++
          segChanged = true
          return { ...w, text: w.text.replace(regex, replaceTerm) }
        }
        return w
      })

      const newText = seg.text ? seg.text.replace(regex, replaceTerm) : newWords.map((w) => w.text).join(' ')
      return segChanged ? { ...seg, words: newWords, text: newText } : seg
    })

    if (count > 0) {
      setSegments(updated)
      setMessage(`Replaced ${count} occurrence${count > 1 ? 's' : ''}!`)
      setTimeout(() => setMessage(''), 3000)
    } else {
      setMessage('No matches found.')
      setTimeout(() => setMessage(''), 3000)
    }
  }

  // Count words below current confidence threshold
  const lowCount = segments.flatMap((s) => s.words || []).filter((w) => typeof w.confidence === 'number' && w.confidence < confidenceThreshold).length

  return (
    <div className="bg-white border border-[#C4D9FF] rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Search & Replace Form */}
        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[130px]">
            <Search size={14} className="absolute left-2.5 top-2.5 text-black" />
            <input
              type="text"
              placeholder="Find word…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-xl border border-[#C4D9FF] text-black font-semibold placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#C5BAFF]"
            />
          </div>
          <ArrowRight size={14} className="text-black shrink-0 hidden sm:block" />
          <div className="relative flex-1 min-w-[130px]">
            <Replace size={14} className="absolute left-2.5 top-2.5 text-black" />
            <input
              type="text"
              placeholder="Replace with…"
              value={replaceTerm}
              onChange={(e) => setReplaceTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-xl border border-[#C4D9FF] text-black font-semibold placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#C5BAFF]"
            />
          </div>
          <button
            type="button"
            onClick={handleReplaceAll}
            disabled={!searchTerm.trim()}
            className="px-3 py-1.5 text-xs font-bold rounded-xl bg-[#C4D9FF] hover:bg-[#A0C4FF] text-black disabled:opacity-40 transition-all cursor-pointer shadow-sm"
          >
            Replace All
          </button>
        </div>

        {/* Confidence Threshold Slider */}
        <div className="flex items-center gap-2 bg-[#E8F9FF] px-3 py-1.5 rounded-xl border border-[#C4D9FF]">
          <Sliders size={13} className="text-black" />
          <span className="text-xs font-bold text-black">Flag Threshold:</span>
          <input
            type="range"
            min="0.50"
            max="0.90"
            step="0.05"
            value={confidenceThreshold}
            onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
            className="w-20 accent-[#7A70BA] cursor-pointer"
          />
          <span className="text-xs font-mono font-bold text-black">
            {Math.round(confidenceThreshold * 100)}%
          </span>
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-amber-200 text-amber-950 border border-amber-300">
            {lowCount} flagged
          </span>
        </div>
      </div>

      {message && (
        <p className="text-xs font-bold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5">
          <Check size={12} /> {message}
        </p>
      )}
    </div>
  )
}
