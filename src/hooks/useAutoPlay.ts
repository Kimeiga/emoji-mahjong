import { useEffect, useRef } from 'react'
import { useGameStore, gameRunner } from '../store/game-store'
import { isWinningHand } from '../engine/sets'
import { calculateAIMarketPick } from '../engine/ai'

/** Drives AI turns automatically with visible delays. Only runs in local (single-player) mode. */
export function useAutoPlay(mode: 'local' | 'multiplayer' = 'local') {
  const phase = useGameStore((s) => s.phase)
  const currentPlayer = useGameStore((s) => s.currentPlayer)
  const ponAvailable = useGameStore((s) => s.ponAvailable)
  const drawCurrentPlayer = useGameStore((s) => s.drawCurrentPlayer)
  const pickMarket = useGameStore((s) => s.pickMarket)
  const discardTile = useGameStore((s) => s.discardTile)
  const aiTurn = useGameStore((s) => s.aiTurn)
  const callPon = useGameStore((s) => s.callPon)
  const declinePon = useGameStore((s) => s.declinePon)
  const humanRiichi = useGameStore((s) => s.players[0].riichi)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    // Skip all auto-play logic in multiplayer mode — server drives the game
    if (mode === 'multiplayer') return

    clearTimeout(timerRef.current)

    // Handle pon-available phase for AI players
    if (phase === 'pon-available' && ponAvailable) {
      // If the pon opportunity is for an AI player, auto-decide
      if (ponAvailable.playerId !== 0) {
        timerRef.current = setTimeout(() => {
          // AI calls pon ~60% of the time
          if (Math.random() < 0.6) {
            callPon(ponAvailable.playerId)
          } else {
            declinePon()
          }
        }, 1000)
      }
      // If it's for the human player, the UI handles it (PonButton)
      return () => clearTimeout(timerRef.current)
    }

    // Human player in riichi: auto-discard drawn tile if it doesn't win
    if (currentPlayer === 0 && phase === 'discard' && humanRiichi) {
      const rs = gameRunner.getState()
      const hand = rs.players[0].hand
      // If the hand is a winner, let the normal discard flow handle the win
      if (isWinningHand(hand)) return
      const lastDrawn = rs.lastDrawnTileId
      if (lastDrawn) {
        timerRef.current = setTimeout(() => {
          discardTile(lastDrawn)
        }, 600)
      }
      return () => clearTimeout(timerRef.current)
    }

    // Only act on AI turns for normal phases
    if (currentPlayer === 0) return
    if (phase !== 'draw' && phase !== 'discard') return

    if (phase === 'draw') {
      // AI uses the same market-vs-blind decision as multiplayer.
      timerRef.current = setTimeout(() => {
        const state = gameRunner.getState()
        const hand = state.players[state.currentPlayer].hand
        const pick = calculateAIMarketPick(
          hand,
          state.market,
          gameRunner.aiDifficulty,
          state.tagCounts,
        )
        if (pick) pickMarket(pick.id)
        else drawCurrentPlayer()
      }, 600)
    } else if (phase === 'discard') {
      // AI discards after thinking
      timerRef.current = setTimeout(() => {
        aiTurn()
      }, 800)
    }

    return () => clearTimeout(timerRef.current)
  }, [mode, phase, currentPlayer, ponAvailable, drawCurrentPlayer, pickMarket, discardTile, aiTurn, callPon, declinePon, humanRiichi])
}
