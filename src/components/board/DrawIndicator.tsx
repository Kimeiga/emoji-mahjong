import { useGame } from '../../contexts/GameContext'

export function DrawIndicator() {
  const { wallCount, currentPlayer, turnCount, phase, myPlayerId, players } = useGame()

  if (phase !== 'draw' && phase !== 'discard') return null

  const isMyTurn = currentPlayer === myPlayerId
  const currentName = isMyTurn ? 'Your turn' : `${players[currentPlayer].name} thinking...`

  return (
    <div className="flex justify-between items-center px-4 py-1">
      <span className="text-xs text-slate-500">
        Wall: {wallCount}
      </span>
      <span className={`text-xs font-medium ${isMyTurn ? 'text-yellow-400' : 'text-slate-400'}`}>
        {currentName}
      </span>
      <span className="text-xs text-slate-500">
        Round {turnCount}
      </span>
    </div>
  )
}
