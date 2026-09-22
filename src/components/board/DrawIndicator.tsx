import { useGame } from '../../contexts/GameContext'

export function DrawIndicator() {
  const { wallCount, currentPlayer, turnCount, phase, myPlayerId, players, ponAvailable } = useGame()
  if (phase !== 'draw' && phase !== 'discard' && phase !== 'pon-available') return null
  const mine = currentPlayer === myPlayerId && phase !== 'pon-available'
  const status = phase === 'pon-available'
    ? ponAvailable?.playerId === myPlayerId ? 'Claim the discard or pass' : 'Waiting for a discard claim'
    : mine ? phase === 'draw' ? 'Pick one tile' : 'Discard one tile' : `${players[currentPlayer].name} is taking a turn`
  return <header className="turn-header">
    <div className="flex justify-between items-center gap-3">
      <span className="text-xs text-slate-400">Round {turnCount}</span>
      <span role="status" className={`text-sm font-semibold ${mine ? 'text-amber-300' : 'text-slate-300'}`}>{status}</span>
      <span className="text-xs text-slate-400">{wallCount} blind</span>
    </div>
    <details className="game-rules"><summary>Rules</summary>
      <p>First to four sets wins. Three different tiles share one tag; each tile and each tag count once. Pick one, then discard one unless you win.</p>
      <p>PON claims a discard and locks that set. Your other connections stay flexible. Bonus hand value does not decide the winner.</p>
    </details>
  </header>
}
