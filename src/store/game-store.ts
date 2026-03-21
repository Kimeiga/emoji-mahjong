import { create } from 'zustand'
import type { GameState, Player, PlayerId, Tile } from '../types'
import { GameRunner } from '../engine/game-runner'
import { playGameStart, playDraw, playDiscard, playPon, playRiichi, playWin } from '../audio/sounds'

const runner = new GameRunner()

if (typeof window !== 'undefined') {
  ;(window as any).__game = runner
}

interface GameActions {
  startGame: () => void
  drawCurrentPlayer: () => void
  pickMarket: (tileId: string) => void
  drawBlind: () => void
  selectTile: (tileId: string | null) => void
  discardTile: (tileId: string) => void
  aiTurn: () => void
  callPon: (playerId: PlayerId) => void
  declinePon: () => void
  declareRiichi: (playerId: PlayerId) => void
  resetGame: () => void
  syncFromRunner: () => void
  lastPonEvent: { playerName: string; emoji: string; tag: string } | null
  clearPonEvent: () => void
  lastRiichiEvent: { playerName: string } | null
  clearRiichiEvent: () => void
  lastDrawnTileId: string | null
  gameStartTime: number
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
    market: [...rs.market],
    tagCounts: { ...rs.tagCounts },
  }
}

export const useGameStore = create<Store>((set) => {
  runner.on((event) => {
    if (event === 'state-changed') {
      set(stateFromRunner())
    }
  })

  return {
    ...stateFromRunner(),
    lastPonEvent: null,
    lastRiichiEvent: null,
    lastDrawnTileId: null,
    gameStartTime: Date.now(),

    startGame: () => {
      runner.start()
      playGameStart()
      set({ ...stateFromRunner(), lastPonEvent: null, lastRiichiEvent: null, gameStartTime: Date.now() })
    },

    drawCurrentPlayer: () => {
      try {
        runner.draw()
        const drawnId = runner.getState().lastDrawnTileId
        set({ ...stateFromRunner(), lastDrawnTileId: drawnId })
        playDraw()
        // Clear drawn highlight after 1.5s
        if (drawnId) {
          setTimeout(() => set({ lastDrawnTileId: null }), 1500)
        }
      } catch {
        // ignore
      }
    },

    pickMarket: (tileId: string) => {
      try {
        runner.pickMarket(tileId)
        const drawnId = runner.getState().lastDrawnTileId
        set({ ...stateFromRunner(), lastDrawnTileId: drawnId })
        playDraw()
        if (drawnId) {
          setTimeout(() => set({ lastDrawnTileId: null }), 1500)
        }
      } catch {
        // ignore
      }
    },

    drawBlind: () => {
      try {
        runner.drawBlind()
        const drawnId = runner.getState().lastDrawnTileId
        set({ ...stateFromRunner(), lastDrawnTileId: drawnId })
        playDraw()
        if (drawnId) {
          setTimeout(() => set({ lastDrawnTileId: null }), 1500)
        }
      } catch {
        // ignore
      }
    },

    selectTile: (tileId) => set({ selectedTileId: tileId }),

    discardTile: (tileId) => {
      try {
        runner.discard(tileId)
        set({ ...stateFromRunner(), lastDrawnTileId: null })
        playDiscard()
        if (runner.getState().phase === 'win') playWin()
      } catch {
        // ignore
      }
    },

    aiTurn: () => {
      try {
        runner.aiTurn()
        set(stateFromRunner())
      } catch {
        // ignore
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
        playPon()
        if (runner.getState().phase === 'win') playWin()
      } catch {
        // ignore
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
        playRiichi()
      } catch {
        // ignore
      }
    },

    resetGame: () => {
      runner.reset()
      set({ ...stateFromRunner(), lastPonEvent: null, lastRiichiEvent: null })
    },

    syncFromRunner: () => set(stateFromRunner()),
    clearPonEvent: () => set({ lastPonEvent: null }),
    clearRiichiEvent: () => set({ lastRiichiEvent: null }),
  }
})

export { runner as gameRunner }
