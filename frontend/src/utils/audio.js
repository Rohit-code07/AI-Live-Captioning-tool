/**
 * Audio conversion utilities for Gemini Live API streaming.
 * Converts Web Audio API float32 buffers to 16 kHz, 16-bit little-endian PCM.
 */

export function convertTo16kHzPcm(float32Array, inputSampleRate = 16000) {
  if (inputSampleRate === 16000) {
    const int16 = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
    return int16.buffer
  }

  // Downsample to 16000 Hz if hardware runs at 44100 Hz, 48000 Hz, etc.
  const sampleRateRatio = inputSampleRate / 16000
  const newLength = Math.round(float32Array.length / sampleRateRatio)
  const result = new Int16Array(newLength)

  let offsetResult = 0
  let offsetInput = 0

  while (offsetResult < result.length) {
    const nextOffsetInput = Math.round((offsetResult + 1) * sampleRateRatio)
    let accum = 0
    let count = 0
    for (let i = offsetInput; i < nextOffsetInput && i < float32Array.length; i++) {
      accum += float32Array[i]
      count++
    }
    const sample = count > 0 ? accum / count : 0
    const clamped = Math.max(-1, Math.min(1, sample))
    result[offsetResult] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff
    offsetResult++
    offsetInput = nextOffsetInput
  }

  return result.buffer
}
