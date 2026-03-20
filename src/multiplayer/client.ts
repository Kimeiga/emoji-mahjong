import { type ServerMessage, type ClientMessage } from './protocol'

/**
 * The Worker backend URL. In production, the static site is on pages.dev
 * while the multiplayer API is on workers.dev.
 * In dev, both are on the same origin (vite proxies to the worker).
 */
const WORKER_URL = import.meta.env.DEV
  ? ''  // same origin in dev
  : 'https://emoji-mahjong.hak7alp.workers.dev'

export function getApiUrl(path: string): string {
  return `${WORKER_URL}${path}`
}

export function connectToRoom(roomCode: string): WebSocket {
  if (import.meta.env.DEV) {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    return new WebSocket(`${proto}//${location.host}/api/rooms/${roomCode}/ws`)
  }
  return new WebSocket(`wss://emoji-mahjong.hak7alp.workers.dev/api/rooms/${roomCode}/ws`)
}

export function sendMessage(ws: WebSocket, msg: ClientMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg))
  }
}

export function parseServerMessage(data: string): ServerMessage | null {
  try {
    return JSON.parse(data) as ServerMessage
  } catch {
    return null
  }
}
