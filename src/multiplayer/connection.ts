import { connectToRoom, sendMessage, parseServerMessage } from './client'
import { getSession, saveSession } from '../utils/session'
import { useAppStore } from '../store/app-store'
import { useMultiplayerStore } from '../store/multiplayer-store'
import type { ServerMessage } from './protocol'

let currentWs: WebSocket | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let handshakeTimer: ReturnType<typeof setTimeout> | undefined
let generation = 0
let removeNetworkListeners: (() => void) | undefined
let retry: (() => void) | undefined
const DELAYS = [1000, 2000, 3000, 5000, 8000]

/** A replaced socket must never clear a newer connection or rejoin an old room. */
export function setupConnection(roomCode: string, playerName: string, onMessage: (msg: ServerMessage) => void) {
  cleanup()
  const id = generation
  let attempts = 0
  let stopped = false
  const session = getSession()
  let resumeToken = session?.roomCode === roomCode ? session.resumeToken : undefined
  const store = () => useMultiplayerStore.getState()
  function fail(message: string, code?: string) {
    stopped = true
    store().setReconnecting(false)
    store().setConnectionError(message)
    onMessage({ type: 'error', message, code })
  }
  function connect() {
    if (id !== generation || stopped) return
    clearTimeout(timer)
    store().setReconnecting(true)
    store().setConnectionError(null)
    const ws = connectToRoom(roomCode)
    currentWs = ws
    const active = () => id === generation && currentWs === ws && !stopped
    handshakeTimer = setTimeout(() => { if (active()) ws.close() }, 10_000)
    ws.onopen = () => {
      if (active()) sendMessage(ws, { type: 'join', playerName, resumeToken })
    }
    ws.onmessage = (event) => {
      if (!active()) return
      const msg = parseServerMessage(event.data)
      if (!msg) return
      if (msg.type === 'assigned') {
        clearTimeout(handshakeTimer)
        attempts = 0
        resumeToken = msg.resumeToken ?? resumeToken
        saveSession({ roomCode, playerName, myPlayerId: msg.playerId, resumeToken })
        useAppStore.getState().setWs(ws)
        store().setReconnecting(false)
      }
      if (msg.type === 'error' && msg.code) {
        clearTimeout(handshakeTimer)
        fail(msg.message, msg.code)
        ws.close()
        return
      }
      onMessage(msg)
    }
    ws.onerror = () => { /* close handles network failures */ }
    ws.onclose = (event) => {
      if (id !== generation || currentWs !== ws) return
      clearTimeout(handshakeTimer)
      currentWs = null
      useAppStore.getState().setWs(null)
      if (stopped) return
      if (event.code === 4001) {
        fail('This game was opened in another tab. Close that tab before retrying.')
        return
      }
      store().setReconnecting(true)
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      if (attempts >= DELAYS.length) {
        fail('Connection lost. Your game is saved. Retry when you are back online.')
        return
      }
      timer = setTimeout(connect, DELAYS[attempts++])
    }
  }
  retry = () => {
    if (id !== generation) return
    attempts = 0
    stopped = false
    clearTimeout(timer)
    clearTimeout(handshakeTimer)
    const previous = currentWs
    currentWs = null
    previous?.close()
    useAppStore.getState().setWs(null)
    connect()
  }
  if (typeof window !== 'undefined') {
    const offline = () => {
      if (id !== generation || stopped) return
      clearTimeout(timer)
      clearTimeout(handshakeTimer)
      const previous = currentWs
      currentWs = null
      useAppStore.getState().setWs(null)
      store().setReconnecting(true)
      previous?.close()
    }
    const online = () => { if (!currentWs || currentWs.readyState !== WebSocket.OPEN) retry?.() }
    const visible = () => { if (document.visibilityState === 'visible' && getSession()?.roomCode === roomCode) retry?.() }
    window.addEventListener('offline', offline)
    window.addEventListener('online', online)
    document.addEventListener('visibilitychange', visible)
    removeNetworkListeners = () => { window.removeEventListener('offline', offline); window.removeEventListener('online', online); document.removeEventListener('visibilitychange', visible) }
  }
  connect()
}

export function retryConnection() { retry?.() }

export function cleanup() {
  generation++
  clearTimeout(timer)
  clearTimeout(handshakeTimer)
  removeNetworkListeners?.()
  removeNetworkListeners = undefined
  retry = undefined
  const previous = currentWs
  currentWs = null
  previous?.close()
  useAppStore.getState().setWs(null)
  useMultiplayerStore.getState().setReconnecting(false)
  useMultiplayerStore.getState().setConnectionError(null)
}
