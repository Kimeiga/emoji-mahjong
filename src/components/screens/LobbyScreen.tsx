import { motion } from 'framer-motion'
import { useAppStore } from '../../store/app-store'
import { useMultiplayerStore } from '../../store/multiplayer-store'
import { sendMessage } from '../../multiplayer/client'
import type { AIDifficulty } from '../../multiplayer/protocol'

const SLOT_COUNT = 4
const difficulties: { value: AIDifficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

export function LobbyScreen() {
  const ws = useAppStore((s) => s.ws)
  const myPlayerId = useAppStore((s) => s.myPlayerId)
  const disconnect = useAppStore((s) => s.disconnect)

  const lobbyPlayers = useMultiplayerStore((s) => s.lobbyPlayers)
  const aiDifficulty = useMultiplayerStore((s) => s.aiDifficulty)

  const isHost = myPlayerId === 0

  function handleChangeDifficulty(d: AIDifficulty) {
    if (ws) {
      sendMessage(ws, { type: 'set-ai-difficulty', difficulty: d })
    }
  }

  function handleStart() {
    if (ws) {
      sendMessage(ws, { type: 'start' })
    }
  }

  function handleLeave() {
    disconnect()
  }

  // Build 4 slots
  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => {
    const player = lobbyPlayers.find((p) => p.id === i)
    return player ?? null
  })

  return (
    <div className="h-full flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 20 }}
        className="w-full max-w-sm"
      >
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🀄</div>
          <h2 className="text-xl font-bold text-white">Game Lobby</h2>
        </div>

        {/* Player slots */}
        <div className="space-y-2 mb-6">
          <div className="text-xs text-slate-500 text-center mb-2">Players</div>
          {slots.map((player, i) => (
            <motion.div
              key={i}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              className={`
                flex items-center gap-3 px-4 py-3 rounded-xl border
                ${player?.connected
                  ? 'bg-slate-800 border-slate-600'
                  : player && !player.isHuman
                    ? 'bg-slate-800/50 border-slate-700 opacity-70'
                    : 'bg-slate-800/30 border-slate-700/50 opacity-50'
                }
              `}
            >
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-lg">
                {player?.connected && player.isHuman
                  ? '👤'
                  : player && !player.isHuman
                    ? '🤖'
                    : '?'
                }
              </div>
              <div className="flex-1">
                <div className={`text-sm font-medium ${player?.connected ? 'text-white' : 'text-slate-500'}`}>
                  {player
                    ? player.isHuman
                      ? player.connected
                        ? player.name + (i === myPlayerId ? ' (you)' : '')
                        : 'Waiting...'
                      : 'AI'
                    : 'Waiting...'
                  }
                </div>
                {player?.connected && player.isHuman && (
                  <div className="text-[10px] text-green-400">Connected</div>
                )}
              </div>
              {i === 0 && player && (
                <span className="text-[10px] text-amber-400 font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                  HOST
                </span>
              )}
            </motion.div>
          ))}
        </div>

        {/* AI Difficulty */}
        {isHost && (
          <div className="mb-6">
            <div className="text-xs text-slate-500 text-center mb-2">AI Difficulty</div>
            <div className="flex gap-2 justify-center">
              {difficulties.map((d) => (
                <button
                  key={d.value}
                  onClick={() => handleChangeDifficulty(d.value)}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                    ${aiDifficulty === d.value
                      ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                    }
                  `}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3">
          {isHost && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleStart}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg tracking-wide shadow-lg shadow-orange-500/30 active:shadow-inner transition-all"
            >
              Start Game
            </motion.button>
          )}

          <button
            onClick={handleLeave}
            className="w-full py-2.5 rounded-xl bg-slate-800 text-slate-400 font-medium hover:bg-slate-700 hover:text-slate-300 transition-colors"
          >
            Leave
          </button>
        </div>
      </motion.div>
    </div>
  )
}
