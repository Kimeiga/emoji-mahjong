/**
 * WebSocket connection manager with auto-reconnect.
 * Handles disconnects during gameplay by automatically reconnecting
 * and re-joining the room with the same player name.
 */

import { connectToRoom, sendMessage, parseServerMessage } from './client'
import { getSession, clearSession } from '../utils/session'
import { useAppStore } from '../store/app-store'
import { useMultiplayerStore } from '../store/multiplayer-store'
import type { ServerMessage } from './protocol'

let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let currentWs: WebSocket | null = null
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAYS = [1000, 2000, 3000, 5000, 8000]

function getDelay(): number {
  return RECONNECT_DELAYS[Math.min(reconnectAttempts, RECONNECT_DELAYS.length - 1)]
}

/**
 * Set up a managed WebSocket connection with auto-reconnect.
 * Call this once when joining a room.
 */
export function setupConnection(
  roomCode: string,
  playerName: string,
  onMessage: (msg: ServerMessage) => void
) {
  cleanup()
  reconnectAttempts = 0
  connect(roomCode, playerName, onMessage)
}

function connect(
  roomCode: string,
  playerName: string,
  onMessage: (msg: ServerMessage) => void
) {
  const ws = connectToRoom(roomCode)
  currentWs = ws

  ws.onopen = () => {
    reconnectAttempts = 0
    sendMessage(ws, { type: 'join', playerName })
    useAppStore.getState().setWs(ws)
    useMultiplayerStore.getState().setReconnecting(false)
  }

  ws.onmessage = (event) => {
    const msg = parseServerMessage(event.data)
    if (!msg) return
    onMessage(msg)
  }

  ws.onerror = () => {
    // onerror is always followed by onclose
  }

  ws.onclose = () => {
    currentWs = null
    useAppStore.getState().setWs(null)

    // Only auto-reconnect if we're in a game (not intentionally disconnected)
    const { screen } = useAppStore.getState()
    const session = getSession()
    if ((screen === 'multiplayer-game' || screen === 'lobby') && session && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++
      useMultiplayerStore.getState().setReconnecting(true)
      console.log(`[connection] Reconnecting (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}) in ${getDelay()}ms...`)
      reconnectTimer = setTimeout(() => {
        connect(roomCode, playerName, onMessage)
      }, getDelay())
    } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log('[connection] Max reconnect attempts reached')
      clearSession()
      useMultiplayerStore.getState().setReconnecting(false)
    }
  }
}

/** Clean up connection and timers. Call when intentionally leaving. */
export function cleanup() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (currentWs) {
    reconnectAttempts = MAX_RECONNECT_ATTEMPTS // prevent auto-reconnect
    currentWs.close()
    currentWs = null
  }
}
