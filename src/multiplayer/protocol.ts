/**
 * Multiplayer protocol — shared message types between client and server.
 */

import type { PlayerId } from '../types'

export type AIDifficulty = 'easy' | 'medium' | 'hard'

/** Room info returned by the server list */
export interface RoomListEntry {
  code: string
  players: string[]
  playerCount: number
  gameStarted: boolean
  createdAt: number
}

// ── Client → Server ──

export type ClientMessage =
  | { type: 'join'; playerName: string }
  | { type: 'set-ai-difficulty'; difficulty: AIDifficulty }
  | { type: 'start' }
  | { type: 'discard'; tileId: string }
  | { type: 'call-pon' }
  | { type: 'decline-pon' }
  | { type: 'declare-riichi' }
  | { type: 'pick-market'; tileId: string }
  | { type: 'draw-blind' }
  | { type: 'rematch' }

// ── Server → Client ──

export interface LobbyPlayer {
  id: PlayerId
  name: string
  isHuman: boolean
  connected: boolean
}

export interface TileData {
  id: string
  emoji: string
  name: string
  tags: string[]
}

export interface PlayerView {
  id: PlayerId
  name: string
  isHuman: boolean
  riichi: boolean
  handSize: number
  /** Only populated for the receiving player */
  hand: TileData[]
  discards: TileData[]
}

export interface GameStateView {
  phase: string
  currentPlayer: PlayerId
  turnCount: number
  wallSize: number
  winner: PlayerId | null
  myPlayerId: PlayerId
  ponAvailable: {
    playerId: PlayerId
    tile: TileData
    matchingTag: string
    matchingTiles: TileData[]
  } | null
  revealedSets: { playerId: PlayerId; tiles: TileData[]; tag: string }[]
  players: PlayerView[]
  market: TileData[]
  tagCounts: Record<string, number>
}

export type ServerMessage =
  | { type: 'room-state'; players: LobbyPlayer[]; gameStarted: boolean; roomCode: string; aiDifficulty: AIDifficulty }
  | { type: 'game-state'; state: GameStateView }
  | { type: 'toast'; kind: 'pon'; playerName: string; emoji: string; tag: string }
  | { type: 'toast'; kind: 'riichi'; playerName: string }
  | { type: 'player-joined'; player: LobbyPlayer }
  | { type: 'player-left'; playerId: PlayerId }
  | { type: 'error'; message: string }
  | { type: 'assigned'; playerId: PlayerId }
  | { type: 'rematch-votes'; count: number; total: number }
  | { type: 'rematch-starting' }
