import { useGame } from '../../contexts/GameContext'

export function DrawIndicator() {
  const { wallCount, currentPlayer, turnCount, phase, myPlayerId, players } = useGame()

  if (phase !== 'draw' && phase !== 'discard' && phase !== 'pon-available') return null

  const isMyTurn = currentPlayer === myPlayerId && (phase === 'discard' || phase === 'draw')
  const currentName = players[currentPlayer].name

  return (
    <div className="flex justify-between items-center px-4 py-1.5">
      <span className="text-xs text-slate-500">
        Wall: {wallCount}
      </span>
      <span className={`
        text-xs font-bold px-3 py-0.5 rounded-full transition-all
        ${isMyTurn
          ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/40 animate-pulse'
          : 'text-slate-400'
        }
      `}>
        {isMyTurn ? '\u2193 Your turn!' : `${currentName} thinking...`}
      </span>
      <span className="text-xs text-slate-500">
        Round {turnCount}
      </span>
    </div>
  )
}
