import { type ServerMessage, type ClientMessage } from './protocol'

/**
 * The Worker backend URL.
 * When served from the Worker itself (workers.dev), use same origin.
 * When served from Pages (pages.dev), connect to the Worker.
 */
function getWorkerOrigin(): string {
  if (typeof location === 'undefined') return ''
  // If we're on the worker URL already, use same origin
  if (location.host.includes('workers.dev') || location.host.includes('localhost')) {
    return ''
  }
  // Pages deployment → point to worker
  return 'https://emoji-mahjong.hak7alp.workers.dev'
}

export function getApiUrl(path: string): string {
  return `${getWorkerOrigin()}${path}`
}

export function connectToRoom(roomCode: string): WebSocket {
  const origin = getWorkerOrigin()
  if (origin) {
    return new WebSocket(`wss://${origin.replace('https://', '')}/api/rooms/${roomCode}/ws`)
  }
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return new WebSocket(`${proto}//${location.host}/api/rooms/${roomCode}/ws`)
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
