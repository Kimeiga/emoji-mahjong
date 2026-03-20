import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useGame } from '../../contexts/GameContext'
import { useGameStore } from '../../store/game-store'
import { useAppStore } from '../../store/app-store'
import { TagPill } from '../shared/Tile'
import { findDisplayTriplets } from '../../engine/triplet-display'

export function ResultScreen() {
  const { phase, winner, players, myPlayerId, mode } = useGame()
  const startGame = useGameStore((s) => s.startGame)
  const setScreen = useAppStore((s) => s.setScreen)
  const disconnect = useAppStore((s) => s.disconnect)

  const isDraw = phase === 'draw-game'
  const winnerPlayer = winner !== null ? players[winner] : null
  const isHumanWin = winner === myPlayerId

  const triplets = useMemo(() => {
    if (!winnerPlayer) return []
    return findDisplayTriplets(winnerPlayer.hand)
  }, [winnerPlayer])

  function handlePlayAgain() {
    if (mode === 'local') {
      startGame()
    }
    // In multiplayer, we'd need the server to restart
  }

  function handleBackToMenu() {
    if (mode === 'multiplayer') {
      disconnect()
    }
    setScreen('menu')
  }

  return (
    <div className="h-full flex flex-col items-center justify-center gap-6 px-6">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', duration: 0.6 }}
        className="text-center"
      >
        <div className="text-7xl mb-4">
          {isDraw ? '🤝' : isHumanWin ? '🎉' : '😔'}
        </div>
        <h1 className="text-3xl font-bold text-white">
          {isDraw ? 'Draw Game!' : isHumanWin ? 'You Win!' : `${winnerPlayer?.name} Wins!`}
        </h1>

        {!isDraw && winnerPlayer && triplets.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 max-w-sm mx-auto">
            {triplets.map((group, gi) => (
              <motion.div
                key={group.tag}
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 + gi * 0.15 }}
                className="flex flex-col items-center"
              >
                <div className="mb-1">
                  <TagPill tag={group.tag} />
                </div>
                <div className="flex gap-1 bg-slate-700/40 rounded-xl px-2 py-2 border border-slate-600/50 relative">
                  <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-[10px] text-white font-bold z-10">
                    ✓
                  </div>
                  {group.tiles.map((tile) => (
                    <span key={tile.id} className="text-3xl">{tile.emoji}</span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {isDraw && (
          <p className="text-slate-400 mt-3 text-sm">Wall exhausted — no one completed 4 sets.</p>
        )}
      </motion.div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {mode === 'local' && (
          <button
            onClick={handlePlayAgain}
            className="bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold
                       py-3 px-8 rounded-2xl text-lg transition-colors
                       active:scale-95 transform"
          >
            Play Again
          </button>
        )}
        <button
          onClick={handleBackToMenu}
          className="bg-slate-700 hover:bg-slate-600 text-white font-medium
                     py-3 px-8 rounded-2xl text-base transition-colors
                     active:scale-95 transform"
        >
          Back to Menu
        </button>
      </div>
    </div>
  )
}
