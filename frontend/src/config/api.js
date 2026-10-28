/**
 * Centralized API and WebSocket configuration.
 * Configured via VITE_API_BASE_URL environment variable.
 */

// Strip trailing slash if present
export const getApiBaseUrl = () => {
  const url = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
  return url.replace(/\/+$/, '')
}

export const API_BASE_URL = getApiBaseUrl()

/**
 * Converts HTTP/HTTPS base URL into WS/WSS URL
 * Example:
 *   http://localhost:8000   -> ws://localhost:8000/ws/live
 *   https://api.example.com -> wss://api.example.com/ws/live
 */
export const getWsUrl = (path = '/ws/live') => {
  const base = getApiBaseUrl()
  const cleanPath = path.startsWith('/') ? path : `/${path}`

  if (base.startsWith('https://')) {
    return base.replace(/^https:\/\//i, 'wss://') + cleanPath
  }
  if (base.startsWith('http://')) {
    return base.replace(/^http:\/\//i, 'ws://') + cleanPath
  }
  return `ws://${base}${cleanPath}`
}

export const API_ENDPOINTS = {
  HEALTH: `${API_BASE_URL}/api/v1/health`,
  HEALTH_FALLBACK: `${API_BASE_URL}/api/health`,
  UPLOAD: `${API_BASE_URL}/api/v1/upload`,
  UPLOAD_FALLBACK: `${API_BASE_URL}/api/captions/upload`,
  RE_EXPORT: `${API_BASE_URL}/api/captions/re-export`,
  WS_LIVE: getWsUrl('/ws/live'),
  WS_LIVE_CAPTIONS: getWsUrl('/ws/live-captions'),
}
