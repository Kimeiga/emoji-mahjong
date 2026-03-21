import { useMemo, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useGame } from '../../contexts/GameContext'
import { useGameStore } from '../../store/game-store'
import { useAppStore } from '../../store/app-store'
import { useMultiplayerStore } from '../../store/multiplayer-store'
import { sendMessage } from '../../multiplayer/client'
import { TagPill } from '../shared/Tile'
import { findDisplayTriplets } from '../../engine/triplet-display'
import { getStats, recordResult } from '../../utils/stats'

export function ResultScreen() {
  const { phase, winner, players, myPlayerId, mode, turnCount, gameStartTime, tagCounts, revealedSets } = useGame()
  const startGame = useGameStore((s) => s.startGame)
  const setScreen = useAppStore((s) => s.setScreen)
  const disconnect = useAppStore((s) => s.disconnect)
  const ws = useAppStore((s) => s.ws)
  const rematchVotes = useMultiplayerStore((s) => s.rematchVotes)

  const isDraw = phase === 'draw-game'
  const winnerPlayer = winner !== null ? players[winner] : null
  const isHumanWin = winner === myPlayerId

  // Combine pon melds + hand triplets for the winner
  const allSets = useMemo(() => {
    if (!winnerPlayer || winner === null) return []
    // Pon melds (already locked)
    const ponSets = revealedSets
      .filter(rs => rs.playerId === winner)
      .map(rs => ({
        tag: rs.tag,
        tiles: rs.tiles,
        score: Math.round(80 / (tagCounts[rs.tag] || 80)),
      }))
    // Find remaining triplets from hand tiles (excluding pon'd tiles)
    const ponTileIds = new Set(ponSets.flatMap(s => s.tiles.map(t => t.id)))
    const handOnly = winnerPlayer.hand.filter(t => !ponTileIds.has(t.id))
    const remaining = 4 - ponSets.length
    const handTriplets = remaining > 0 ? findDisplayTriplets(handOnly, remaining, tagCounts) : []
    return [...ponSets, ...handTriplets]
  }, [winnerPlayer, winner, tagCounts, revealedSets])

  const elapsedSecs = Math.floor((Date.now() - gameStartTime) / 1000)
  const mins = Math.floor(elapsedSecs / 60)
  const secs = elapsedSecs % 60

  // Record stats once
  const recorded = useRef(false)
  useEffect(() => {
    if (recorded.current) return
    recorded.current = true
    if (isDraw) recordResult('draw')
    else if (isHumanWin) recordResult('win')
    else recordResult('loss')
  }, [isDraw, isHumanWin])

  const stats = getStats()

  function handlePlayAgain() {
    if (mode === 'local') {
      startGame()
    }
  }

  function handleRematch() {
    if (ws) sendMessage(ws, { type: 'rematch' })
  }

  function handleBackToMenu() {
    if (mode === 'multiplayer') disconnect()
    setScreen('menu')
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-5 px-6">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.6 }}
        className="text-center"
      >
        <div className="text-7xl mb-3">
          {isDraw ? '🤝' : isHumanWin ? '🎉' : '😔'}
        </div>
        <h1 className="text-3xl font-bold text-white">
          {isDraw ? 'Draw Game!' : isHumanWin ? 'You Win!' : `${winnerPlayer?.name} Wins!`}
        </h1>

        {/* Game stats */}
        <div className="flex justify-center gap-4 mt-3 text-xs text-slate-400">
          <span>{turnCount} turns</span>
          <span>{mins}m {secs}s</span>
        </div>

        {/* Winner's sets with scores */}
        {!isDraw && winnerPlayer && allSets.length > 0 && (() => {
          const total = allSets.reduce((sum, g) => sum + g.score, 0)
          return (
            <>
              <div className="mt-3 text-2xl font-black text-amber-400">
                {total} points
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 max-w-sm mx-auto">
                {allSets.map((group, gi) => (
                  <motion.div
                    key={group.tag}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 + gi * 0.12 }}
                    className="flex flex-col items-center"
                  >
                    <div className="mb-1 flex items-center gap-1">
                      <TagPill tag={group.tag} />
                      <span className="text-[10px] text-amber-400 font-bold">{group.score}pt</span>
                    </div>
                    <div className="flex gap-0.5 bg-slate-700/40 rounded-xl px-1.5 py-1.5 border border-slate-600/50">
                      {group.tiles.map((tile) => (
                        <span key={tile.id} className="text-2xl">{tile.emoji}</span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          )
        })()}

        {isDraw && (
          <p className="text-slate-400 mt-3 text-sm">Wall exhausted — no one completed 4 sets.</p>
        )}

        {/* Cumulative record */}
        <div className="mt-4 text-[11px] text-slate-500">
          Record: {stats.wins}W / {stats.losses}L / {stats.draws}D
        </div>
      </motion.div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {mode === 'local' && (
          <button
            onClick={handlePlayAgain}
            className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold py-3 px-8 rounded-2xl text-lg transition-colors active:scale-95 transform"
          >
            Play Again
          </button>
        )}
        {mode === 'multiplayer' && (
          <button
            onClick={handleRematch}
            className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold py-3 px-8 rounded-2xl text-lg transition-colors active:scale-95 transform"
          >
            {rematchVotes ? `Rematch (${rematchVotes.count}/${rematchVotes.total})` : 'Rematch'}
          </button>
        )}
        <button
          onClick={handleBackToMenu}
          className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-8 rounded-2xl text-base transition-colors active:scale-95 transform"
        >
          Back to Menu
        </button>
      </div>
    </div>
  )
}
