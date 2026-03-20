import { useGame } from '../../contexts/GameContext'

const PLAYER_NAMES = ['Your turn', 'East thinking...', 'North thinking...', 'West thinking...']

export function DrawIndicator() {
  const { wallCount, currentPlayer, turnCount, phase } = useGame()

  if (phase !== 'draw' && phase !== 'discard') return null

  return (
    <div className="flex justify-between items-center px-4 py-1">
      <span className="text-xs text-slate-500">
        Wall: {wallCount}
      </span>
      <span className={`text-xs font-medium ${currentPlayer === 0 ? 'text-yellow-400' : 'text-slate-400'}`}>
        {PLAYER_NAMES[currentPlayer]}
      </span>
      <span className="text-xs text-slate-500">
        Round {turnCount}
      </span>
    </div>
  )
}
