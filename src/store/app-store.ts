import { create } from 'zustand'
import type { AIDifficulty } from '../multiplayer/protocol'
import { clearSession } from '../utils/session'
import { cleanup as cleanupConnection } from '../multiplayer/connection'

export type Screen = 'menu' | 'single-player' | 'lobby' | 'multiplayer-game' | 'result'

interface AppStore {
  screen: Screen
  roomCode: string | null
  ws: WebSocket | null
  myPlayerId: number
  aiDifficulty: AIDifficulty
  setScreen: (screen: Screen) => void
  setRoomCode: (code: string) => void
  setWs: (ws: WebSocket | null) => void
  setMyPlayerId: (id: number) => void
  setAiDifficulty: (d: AIDifficulty) => void
  disconnect: () => void
}

export const useAppStore = create<AppStore>((set) => ({
  screen: 'menu',
  roomCode: null,
  ws: null,
  myPlayerId: 0,
  aiDifficulty: 'medium',
  setScreen: (screen) => set({ screen }),
  setRoomCode: (code) => set({ roomCode: code }),
  setWs: (ws) => set({ ws }),
  setMyPlayerId: (id) => set({ myPlayerId: id }),
  setAiDifficulty: (d) => set({ aiDifficulty: d }),
  disconnect: () => {
    cleanupConnection()
    clearSession()
    set({ ws: null, roomCode: null, screen: 'menu' })
  },
}))
