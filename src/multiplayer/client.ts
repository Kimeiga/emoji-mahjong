import {GameClient, type ClientCheckpoint} from 'twinwire/client'
import { type ServerMessage, type ClientMessage } from './protocol'

/**
 * The Worker backend URL.
 * When served from the Worker itself (workers.dev), use same origin.
 * When served from Pages (pages.dev), connect to the Worker.
 */
function getWorkerOrigin(): string {
  if (typeof location === 'undefined') return ''
  // If we're on the worker URL already, use same origin
  if (location.hostname.endsWith('.workers.dev') || location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return ''
  }
  // Pages deployment → point to worker
  return 'https://emoji-mahjong.hak7alp.workers.dev'
}

export function getApiUrl(path: string): string {
  return `${getWorkerOrigin()}${path}`
}

/** The game's small connection view; Twinwire owns sockets, retry, ACKs and session replay. */
export interface RoomClient {
  net: GameClient
  readonly readyState: number
  send(data: string): void
  close(): void
  saveCheckpoint(): void
  clearCheckpoint(): void
}
export function connectToRoom(roomCode: string): RoomClient {
  const base = getWorkerOrigin() || location.origin
  const url = new URL('/api/rooms/' + roomCode + '/ws?tw=4', base)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  const key = 'twinwire.mahjong.' + roomCode
  const forget = () => { try { sessionStorage.removeItem(key) } catch { /* Storage is optional for in-page recovery. */ } }
  let checkpoint: ClientCheckpoint | undefined
  try { checkpoint = JSON.parse(sessionStorage.getItem(key) || 'null') ?? undefined } catch { forget() }
  const options = {url: url.href, room: 'mahjong.' + roomCode, rtc: false as const}
  let net: GameClient
  try { net = new GameClient({...options, checkpoint}) } catch { forget(); net = new GameClient(options) }
  const client: RoomClient = {
    net,
    get readyState() { return net.status === 'online' ? 1 : net.status === 'closed' || net.status === 'lost' ? 3 : 0 },
    send(data) { if (!net.sendEvent(JSON.parse(data))) throw new Error('Connection queue is full; reconnect to your saved game'); client.saveCheckpoint() },
    close() { net.close() },
    saveCheckpoint() { try { const saved = net.checkpoint(); if (saved) sessionStorage.setItem(key,JSON.stringify(saved)) } catch { /* The private game-seat token is a separate recovery path. */ } },
    clearCheckpoint: forget,
  }
  return client
}

export function sendMessage(client: RoomClient, msg: ClientMessage) {
  if (client.readyState === 1) client.send(JSON.stringify(msg))
}

export function parseServerMessage(data: string): ServerMessage | null {
  try {
    const value: unknown = JSON.parse(data)
    if (!value || typeof value !== 'object' || !('type' in value) || typeof value.type !== 'string') return null
    return value as ServerMessage
  } catch {
    return null
  }
}
