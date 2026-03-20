export type Category = string // Unicode emoji group name

export interface TileDef {
  emoji: string
  category: Category
  tags: string[]
  name?: string
  group?: string
  subgroup?: string
}

export interface Tile {
  id: string
  emoji: string
  name: string
  tags: string[]
}

export type PlayerId = 0 | 1 | 2 | 3

export interface Player {
  id: PlayerId
  name: string
  hand: Tile[]
  discards: Tile[]
  isHuman: boolean
  riichi: boolean
}

export type GamePhase = 'idle' | 'dealing' | 'draw' | 'discard' | 'pon-available' | 'win' | 'draw-game'

export interface PonInfo {
  playerId: PlayerId
  tile: Tile
  matchingTag: string
  matchingTiles: [Tile, Tile]
}

export interface RevealedSet {
  playerId: PlayerId
  tiles: Tile[]
  tag: string
}

export interface GameState {
  phase: GamePhase
  players: [Player, Player, Player, Player]
  wall: Tile[]
  currentPlayer: PlayerId
  turnCount: number
  selectedTileId: string | null
  winner: PlayerId | null
  ponAvailable: PonInfo | null
  revealedSets: RevealedSet[]
}
