import { useGame } from '../../contexts/GameContext'

export function DrawIndicator() {
  const { wallCount, currentPlayer, turnCount, phase, myPlayerId, players } = useGame()

  if (phase !== 'draw' && phase !== 'discard' && phase !== 'pon-available') return null

  const isMyTurn = currentPlayer === myPlayerId && (phase === 'discard' || phase === 'draw')
  const isMyDraw = currentPlayer === myPlayerId && phase === 'draw'
  const currentName = players[currentPlayer].name

  return (
    <div className="relative flex items-center justify-center px-2 py-1.5">
      {/* Left: Wall count */}
      <div className="absolute left-2 flex flex-col items-center leading-none">
        <span className="text-[9px] text-slate-500">Wall</span>
        <span className="text-[11px] text-slate-400 font-bold">{wallCount}</span>
      </div>

      {/* Center: Status (visually centered) */}
      <span className={`
        text-xs font-bold px-3 py-0.5 rounded-full transition-all
        ${isMyTurn
          ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/40 animate-pulse'
          : 'text-slate-400'
        }
      `}>
        {isMyDraw ? 'Pick from market or draw blind' : isMyTurn ? '↓ Your turn!' : `${currentName} thinking...`}
      </span>

      {/* Right: Round */}
      <div className="absolute right-2 flex flex-col items-center leading-none">
        <span className="text-[9px] text-slate-500">Round</span>
        <span className="text-[11px] text-slate-400 font-bold">{turnCount}</span>
      </div>
    </div>
  )
}
