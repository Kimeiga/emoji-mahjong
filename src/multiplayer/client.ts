import { type ServerMessage, type ClientMessage } from './protocol'

export function connectToRoom(roomCode: string): WebSocket {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const ws = new WebSocket(`${proto}//${location.host}/api/rooms/${roomCode}/ws`)
  return ws
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
