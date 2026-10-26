import {connectToRoom, sendMessage, parseServerMessage, type RoomClient} from './client'
import {getSession, saveSession} from '../utils/session'
import {useAppStore} from '../store/app-store'
import {useMultiplayerStore} from '../store/multiplayer-store'
import type {ServerMessage} from './protocol'

let current: RoomClient | null = null
let generation = 0
let retry: (() => void) | undefined
let removePagehide: (() => void) | undefined

export function setupConnection(roomCode: string, playerName: string, onMessage: (message: ServerMessage) => void) {
  cleanup()
  const id = generation, client = connectToRoom(roomCode), net = client.net
  current = client
  const active = () => id === generation && current === client
  const store = () => useMultiplayerStore.getState()
  let recoveringSavedWorld = false
  function fail(message: string) {
    if (!active()) return
    useAppStore.getState().setWs(null)
    store().setReconnecting(false)
    store().setConnectionError(message)
  }
  net.onStatus = status => {
    if (!active()) return
    if (status === 'connecting' || status === 'paused') {
      useAppStore.getState().setWs(null)
      store().setReconnecting(true)
      store().setConnectionError(null)
    }
  }
  net.onSession = info => {
    if (!active()) return
    client.saveCheckpoint()
    if (!info.resumed) {
      const saved = getSession()
      sendMessage(client, {type:'join',playerName,resumeToken:saved?.roomCode === roomCode ? saved.resumeToken : undefined})
    }
  }
  net.onEvent = data => {
    if (!active()) return
    queueMicrotask(() => { if (active()) client.saveCheckpoint() })
    if (data && typeof data === 'object' && !Array.isArray(data) && data.type === '$twinwire-ready') {
      // This marker follows the current private board and the durable state commit, in event order.
      recoveringSavedWorld = false
      useAppStore.getState().setWs(client)
      store().setReconnecting(false)
      store().setConnectionError(null)
      return
    }
    const message = parseServerMessage(JSON.stringify(data))
    if (!message) return
    if (message.type === 'assigned') saveSession({roomCode,playerName,myPlayerId:message.playerId,resumeToken:message.resumeToken})
    if (message.type === 'error' && message.code) { fail(message.message); net.pause() }
    onMessage(message)
  }
  net.onSessionLost = info => {
    if (!active()) return
    if (/elsewhere|another tab|taken over/i.test(info.reason)) {
      fail('This game was opened in another tab. Close that tab before retrying.')
      return
    }
    const saved = getSession()
    if (!recoveringSavedWorld && saved?.roomCode === roomCode && saved.resumeToken) {
      // A Worker restart loses transport memory, while the game-owned private seat token persists.
      // Start a fresh transport without replaying old actions; the game must authenticate the original seat.
      recoveringSavedWorld = true
      client.clearCheckpoint()
      queueMicrotask(() => { if (active()) net.newSession() })
    } else fail('Connection lost. Your game is saved. Retry when you are back online.')
  }
  net.onError = error => { if (active()) store().setConnectionError(error.message) }
  retry = () => {
    if (!active()) return
    store().setConnectionError(null); store().setReconnecting(true)
    if (net.status === 'lost' || net.status === 'closed') { client.clearCheckpoint(); net.newSession() }
    else net.connect()
  }
  net.bindPageLifecycle({unload:'pause'})
  const pagehide = () => { if (active()) client.saveCheckpoint() }
  window.addEventListener('pagehide',pagehide)
  removePagehide = () => window.removeEventListener('pagehide',pagehide)
  net.connect()
}

export function retryConnection() { retry?.() }
export function cleanup() {
  generation++
  removePagehide?.(); removePagehide = undefined; retry = undefined
  const previous = current; current = null
  previous?.clearCheckpoint()
  previous?.close()
  useAppStore.getState().setWs(null)
  useMultiplayerStore.getState().setReconnecting(false)
  useMultiplayerStore.getState().setConnectionError(null)
}
