import { create } from 'zustand'
import type { PlayerId, Tile, Player, GamePhase, PonInfo, RevealedSet } from '../types'
import type { GameStateView, LobbyPlayer, AIDifficulty, ServerMessage } from '../multiplayer/protocol'
import { playPon, playRiichi, playWin } from '../audio/sounds'

interface MultiplayerState {
  // Game state (mirrors GameState)
  phase: GamePhase
  players: [Player, Player, Player, Player]
  wallCount: number
  currentPlayer: PlayerId
  turnCount: number
  selectedTileId: string | null
  winner: PlayerId | null
  ponAvailable: PonInfo | null
  revealedSets: RevealedSet[]
  market: Tile[]
  tagCounts: Record<string, number>
  myPlayerId: PlayerId

  // Lobby state
  lobbyPlayers: LobbyPlayer[]
  gameStarted: boolean
  roomCode: string
  aiDifficulty: AIDifficulty

  // Rematch
  rematchVotes: { count: number; total: number } | null

  // Toast events
  lastPonEvent: { playerName: string; emoji: string; tag: string } | null
  lastRiichiEvent: { playerName: string } | null

  // Actions
  applyServerMessage: (msg: ServerMessage) => void
  selectTile: (tileId: string | null) => void
  clearPonEvent: () => void
  clearRiichiEvent: () => void
  reset: () => void
}

const emptyPlayer = (id: PlayerId): Player => ({
  id,
  name: `Player ${id}`,
  hand: [],
  discards: [],
  isHuman: false,
  riichi: false,
})

function convertGameState(state: GameStateView): Partial<MultiplayerState> {
  const players = state.players.map((view) => {
    const hand: Tile[] = view.hand.length > 0
      ? view.hand.map((t) => ({ id: t.id, emoji: t.emoji, name: t.name, tags: t.tags }))
      : Array.from({ length: view.handSize }, (_, i) => ({
          id: `hidden-${view.id}-${i}`,
          emoji: '?',
          name: '',
          tags: [],
        }))

    return {
      id: view.id,
      name: view.name,
      hand,
      discards: view.discards.map((t) => ({ id: t.id, emoji: t.emoji, name: t.name, tags: t.tags })),
      isHuman: view.isHuman,
      riichi: view.riichi,
    } as Player
  }) as [Player, Player, Player, Player]

  const ponAvailable: PonInfo | null = state.ponAvailable
    ? {
        playerId: state.ponAvailable.playerId,
        tile: state.ponAvailable.tile,
        matchingTag: state.ponAvailable.matchingTag,
        matchingTiles: [state.ponAvailable.matchingTiles[0], state.ponAvailable.matchingTiles[1]] as [Tile, Tile],
      }
    : null

  return {
    phase: state.phase as GamePhase,
    players,
    wallCount: state.wallSize,
    currentPlayer: state.currentPlayer,
    turnCount: state.turnCount,
    winner: state.winner,
    myPlayerId: state.myPlayerId,
    ponAvailable,
    revealedSets: state.revealedSets.map((rs) => ({
      playerId: rs.playerId,
      tiles: rs.tiles.map((t) => ({ id: t.id, emoji: t.emoji, name: t.name, tags: t.tags })),
      tag: rs.tag,
    })),
    market: state.market?.map(t => ({ id: t.id, emoji: t.emoji, name: t.name, tags: t.tags })) ?? [],
    tagCounts: state.tagCounts ?? {},
  }
}

export const useMultiplayerStore = create<MultiplayerState>((set) => ({
  phase: 'idle',
  players: [emptyPlayer(0), emptyPlayer(1), emptyPlayer(2), emptyPlayer(3)],
  wallCount: 0,
  currentPlayer: 0 as PlayerId,
  turnCount: 0,
  selectedTileId: null,
  winner: null,
  ponAvailable: null,
  revealedSets: [],
  market: [],
  tagCounts: {},
  myPlayerId: 0 as PlayerId,

  lobbyPlayers: [],
  gameStarted: false,
  roomCode: '',
  aiDifficulty: 'medium',

  rematchVotes: null,

  lastPonEvent: null,
  lastRiichiEvent: null,

  applyServerMessage: (msg: ServerMessage) => {
    switch (msg.type) {
      case 'room-state':
        set({
          lobbyPlayers: msg.players,
          gameStarted: msg.gameStarted,
          roomCode: msg.roomCode,
          aiDifficulty: msg.aiDifficulty,
        })
        break
      case 'game-state': {
        const converted = convertGameState(msg.state)
        set({ ...converted, selectedTileId: null })
        if (converted.phase === 'win') playWin()
        break
      }
      case 'toast':
        if (msg.kind === 'pon') {
          set({ lastPonEvent: { playerName: msg.playerName, emoji: msg.emoji, tag: msg.tag } })
          playPon()
        } else if (msg.kind === 'riichi') {
          set({ lastRiichiEvent: { playerName: msg.playerName } })
          playRiichi()
        }
        break
      case 'player-joined':
        set((s) => ({
          lobbyPlayers: [...s.lobbyPlayers.filter((p) => p.id !== msg.player.id), msg.player],
        }))
        break
      case 'player-left':
        set((s) => ({
          lobbyPlayers: s.lobbyPlayers.map((p) =>
            p.id === msg.playerId ? { ...p, connected: false } : p
          ),
        }))
        break
      case 'error':
        console.error('[multiplayer] Server error:', msg.message)
        break
      case 'rematch-votes':
        set({ rematchVotes: { count: msg.count, total: msg.total } })
        break
      case 'rematch-starting':
        set({
          phase: 'draw',
          players: [emptyPlayer(0), emptyPlayer(1), emptyPlayer(2), emptyPlayer(3)],
          wallCount: 0,
          currentPlayer: 0 as PlayerId,
          turnCount: 0,
          selectedTileId: null,
          winner: null,
          ponAvailable: null,
          revealedSets: [],
          market: [],
          tagCounts: {},
          gameStarted: true,
          rematchVotes: null,
          lastPonEvent: null,
          lastRiichiEvent: null,
        })
        break
      case 'assigned':
        // Handled in the App level (sets myPlayerId on app-store)
        break
    }
  },

  selectTile: (tileId) => set({ selectedTileId: tileId }),
  clearPonEvent: () => set({ lastPonEvent: null }),
  clearRiichiEvent: () => set({ lastRiichiEvent: null }),
  reset: () => set({
      phase: 'idle',
      players: [emptyPlayer(0), emptyPlayer(1), emptyPlayer(2), emptyPlayer(3)],
      wallCount: 0,
      currentPlayer: 0 as PlayerId,
      turnCount: 0,
      selectedTileId: null,
      winner: null,
      ponAvailable: null,
      revealedSets: [],
      market: [],
      tagCounts: {},
      lobbyPlayers: [],
      gameStarted: false,
      rematchVotes: null,
      lastPonEvent: null,
      lastRiichiEvent: null,
    }),
}))

if (typeof window !== 'undefined') {
  (window as any).__gameState = () => useMultiplayerStore.getState()
}
