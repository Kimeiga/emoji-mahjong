import { create } from 'zustand'
import type { GameState, Player, PlayerId, Tile } from '../types'
import { GameRunner } from '../engine/game-runner'

/**
 * Zustand store that wraps GameRunner for React integration.
 * The GameRunner is also exposed on window.__game for console/agent access.
 */

const runner = new GameRunner()

// Expose on window for console/agent play
if (typeof window !== 'undefined') {
  ;(window as any).__game = runner
  ;(window as any).__gameHelp = () => console.log(runner.help())
  console.log(
    '%c🀄 Semantic Mahjong',
    'font-size: 16px; font-weight: bold',
    '\nType __game.help() for console commands'
  )
}

interface GameActions {
  startGame: () => void
  drawCurrentPlayer: () => void
  selectTile: (tileId: string | null) => void
  discardTile: (tileId: string) => void
  aiTurn: () => void
  callPon: (playerId: PlayerId) => void
  declinePon: () => void
  declareRiichi: (playerId: PlayerId) => void
  resetGame: () => void
  syncFromRunner: () => void
  /** Last pon event for toast display */
  lastPonEvent: { playerName: string; emoji: string; tag: string } | null
  clearPonEvent: () => void
  /** Last riichi event for toast display */
  lastRiichiEvent: { playerName: string } | null
  clearRiichiEvent: () => void
}

type Store = GameState & GameActions

function stateFromRunner(): GameState {
  const rs = runner.getState()
  return {
    phase: rs.phase,
    players: rs.players.map(p => ({ ...p, hand: [...p.hand], discards: [...p.discards], riichi: p.riichi })) as [Player, Player, Player, Player],
    wall: [...rs.wall],
    currentPlayer: rs.currentPlayer,
    turnCount: rs.turnCount,
    selectedTileId: rs.selectedTileId,
    winner: rs.winner,
    ponAvailable: rs.ponAvailable ? {
      playerId: rs.ponAvailable.playerId,
      tile: { ...rs.ponAvailable.tile },
      matchingTag: rs.ponAvailable.matchingTag,
      matchingTiles: [{ ...rs.ponAvailable.matchingTiles[0] }, { ...rs.ponAvailable.matchingTiles[1] }] as [Tile, Tile],
    } : null,
    revealedSets: rs.revealedSets.map(rs => ({
      playerId: rs.playerId,
      tiles: rs.tiles.map(t => ({ ...t })),
      tag: rs.tag,
    })),
  }
}

export const useGameStore = create<Store>((set) => {
  // Sync React state whenever runner emits state changes
  runner.on((event) => {
    if (event === 'state-changed') {
      set(stateFromRunner())
    }
  })

  return {
    ...stateFromRunner(),
    lastPonEvent: null,
    lastRiichiEvent: null,

    startGame: () => {
      runner.start()
      set({ ...stateFromRunner(), lastPonEvent: null, lastRiichiEvent: null })
    },

    drawCurrentPlayer: () => {
      try {
        runner.draw()
        set(stateFromRunner())
      } catch {
        // ignore if not in draw phase
      }
    },

    selectTile: (tileId) => {
      set({ selectedTileId: tileId })
    },

    discardTile: (tileId) => {
      try {
        runner.discard(tileId)
        set(stateFromRunner())
      } catch {
        // ignore invalid discards
      }
    },

    aiTurn: () => {
      try {
        runner.aiTurn()
        set(stateFromRunner())
      } catch {
        // ignore if not AI's turn
      }
    },

    callPon: (playerId: PlayerId) => {
      try {
        const rs = runner.getState()
        const pon = rs.ponAvailable
        if (!pon) return
        const playerName = rs.players[playerId].name
        const emoji = pon.tile.emoji
        const tag = pon.matchingTag
        runner.callPon(playerId)
        set({ ...stateFromRunner(), lastPonEvent: { playerName, emoji, tag } })
      } catch {
        // ignore invalid pon calls
      }
    },

    declinePon: () => {
      try {
        runner.declinePon()
        set(stateFromRunner())
      } catch {
        // ignore
      }
    },

    declareRiichi: (playerId: PlayerId) => {
      try {
        const playerName = runner.getState().players[playerId].name
        runner.declareRiichi(playerId)
        set({ ...stateFromRunner(), lastRiichiEvent: { playerName } })
      } catch {
        // ignore invalid riichi declarations
      }
    },

    resetGame: () => {
      runner.reset()
      set({ ...stateFromRunner(), lastPonEvent: null, lastRiichiEvent: null })
    },

    syncFromRunner: () => {
      set(stateFromRunner())
    },

    clearPonEvent: () => {
      set({ lastPonEvent: null })
    },

    clearRiichiEvent: () => {
      set({ lastRiichiEvent: null })
    },
  }
})

export { runner as gameRunner }
