import { createContext, useContext } from 'react'
import type { PlayerId, Player, GamePhase, PonInfo, RevealedSet } from '../types'

export interface GameContextValue {
  mode: 'local' | 'multiplayer'
  phase: GamePhase
  players: [Player, Player, Player, Player]
  wallCount: number
  currentPlayer: PlayerId
  turnCount: number
  selectedTileId: string | null
  winner: PlayerId | null
  ponAvailable: PonInfo | null
  revealedSets: RevealedSet[]
  myPlayerId: PlayerId
  lastDrawnTileId: string | null
  gameStartTime: number

  // Actions
  selectTile: (id: string | null) => void
  discardTile: (id: string) => void
  callPon: (playerId: PlayerId) => void
  declinePon: () => void
  declareRiichi: (playerId: PlayerId) => void

  // Toasts
  lastPonEvent: { playerName: string; emoji: string; tag: string } | null
  lastRiichiEvent: { playerName: string } | null
  clearPonEvent: () => void
  clearRiichiEvent: () => void
}

const GameContext = createContext<GameContextValue>(null!)
export const useGame = () => useContext(GameContext)
export const GameProvider = GameContext.Provider
