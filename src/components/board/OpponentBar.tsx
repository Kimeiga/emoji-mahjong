import { useGameStore } from '../../store/game-store'
import type { PlayerId } from '../../types'

const AVATARS = ['', '🤖', '🤖', '🤖']
const POSITIONS = ['', 'East', 'North', 'West']

export function OpponentBar() {
  const players = useGameStore((s) => s.players)
  const currentPlayer = useGameStore((s) => s.currentPlayer)

  return (
    <div className="flex justify-around items-center px-3 py-2 gap-2">
      {([1, 2, 3] as PlayerId[]).map((pid) => {
        const player = players[pid]
        const isActive = currentPlayer === pid
        return (
          <div
            key={pid}
            className={`
              flex items-center gap-2 px-3 py-2 rounded-xl flex-1
              transition-all duration-300
              ${isActive
                ? 'bg-yellow-400/15 border border-yellow-400/40 shadow-sm shadow-yellow-400/20'
                : 'bg-slate-800/60 border border-slate-700'
              }
            `}
          >
            <span className="text-xl">{AVATARS[pid]}</span>
            <div className="flex flex-col items-start min-w-0">
              <span className={`text-xs font-semibold truncate ${isActive ? 'text-yellow-300' : 'text-slate-300'}`}>
                {POSITIONS[pid]}
              </span>
              <span className="text-xs text-slate-400">
                {player.hand.length} tiles
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
