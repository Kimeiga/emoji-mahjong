import { useEffect, useState } from 'react'
import { useGame } from '../../contexts/GameContext'
import { TagPill } from '../shared/Tile'

const PON_TIMEOUT_MS = 5000

function PonPrompt() {
  const { ponAvailable, callPon, declinePon, myPlayerId } = useGame()
  const [countdown, setCountdown] = useState(PON_TIMEOUT_MS)

  // Remount for each opportunity; the deadline and gameplay rules stay unchanged.
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(previous => {
        const next = Math.max(0, previous - 50)
        if (!next) clearInterval(interval)
        return next
      })
    }, 50)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (countdown <= 0) declinePon()
  }, [countdown, declinePon])

  if (!ponAvailable) return null

  return (
    <section aria-label="Discard claim" className="pon-prompt fixed bottom-0 left-0 right-0 z-[200] flex flex-col items-center pb-6 px-4">
      <div className="fixed inset-0 bg-black/40 -z-10" aria-hidden="true" onClick={declinePon} />
      <div className="w-full max-w-sm bg-slate-900 rounded-2xl border-2 border-amber-400/60 shadow-2xl overflow-hidden">
        <div className="h-1.5 bg-slate-700" aria-hidden="true">
          <div className="h-full bg-amber-400" style={{ width: `${countdown / PON_TIMEOUT_MS * 100}%` }} />
        </div>
        <div className="p-4">
          <div className="text-center mb-3">
            <p className="text-sm text-slate-300 mb-2">Claim this discard. These tiles and this tag will lock.</p>
            <TagPill tag={ponAvailable.matchingTag} />
          </div>
          <div className="flex items-center justify-center gap-2 mb-4">
            {ponAvailable.matchingTiles.map(tile => (
              <span key={tile.id} role="img" aria-label={tile.name} className="w-14 h-14 rounded-xl bg-slate-700 border-2 border-sky-400/50 flex items-center justify-center text-3xl">{tile.emoji}</span>
            ))}
            <span className="text-slate-400 text-xl" aria-hidden="true">+</span>
            <span role="img" aria-label={ponAvailable.tile.name} className="w-14 h-14 rounded-xl bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-3xl">{ponAvailable.tile.emoji}</span>
          </div>
          {/* Keep timed action targets stationary, including on hover and press. */}
          <button type="button" onClick={() => callPon(myPlayerId)} className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold text-lg">Claim set (PON!)</button>
          <button type="button" onClick={declinePon} className="w-full mt-2 min-h-11 rounded-lg text-slate-300 text-sm hover:bg-slate-800">Skip ({Math.ceil(countdown / 1000)}s)</button>
        </div>
      </div>
    </section>
  )
}

export function PonButton() {
  const { phase, ponAvailable, myPlayerId } = useGame()
  if (phase !== 'pon-available' || ponAvailable?.playerId !== myPlayerId) return null
  return <PonPrompt key={`${ponAvailable.playerId}-${ponAvailable.tile.id}`} />
}
