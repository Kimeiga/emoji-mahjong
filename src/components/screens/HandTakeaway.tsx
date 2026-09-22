import { useMemo } from 'react'
import { analyzeConnections, winningConnectionTags } from '../../engine/connections'
import type { RevealedSet, Tile } from '../../types'

export function HandTakeaway({ hand, melds, tagCounts }: { hand: Tile[]; melds: RevealedSet[]; tagCounts: Record<string, number> }) {
  const analysis = useMemo(() => analyzeConnections(hand, melds), [hand, melds])
  const waiting = useMemo(() => winningConnectionTags(hand, melds).filter(tag => (tagCounts[tag] ?? 0) >= 3), [hand, melds, tagCounts])
  const pair = analysis.pairs.find(pair => (tagCounts[pair.tag] ?? 0) >= 3)
  return <section aria-label="Your final hand" className="takeaway-card text-left">
    <h2 className="text-sm font-semibold text-white">Your final hand: {analysis.complete}/4 sets</h2>
    {waiting.length > 0 ? <p className="text-sm text-slate-300 mt-2">One more tile sharing <strong className="text-sky-300">{waiting.slice(0, 3).join(' or ')}</strong> could complete your hand. Its availability is unknown.</p> : pair ?
      <p className="text-sm text-slate-300 mt-2"><span className="text-xl">{pair.tiles.map(tile => tile.emoji).join(' ')}</span> share <strong className="text-sky-300">{pair.tag}</strong>. In this arrangement, they need a third matching tile.</p> :
      <p className="text-sm text-slate-300 mt-2">Try comparing a tile’s different tags before committing to a plan. One tile cannot fill two sets.</p>}
    <details className="mt-2"><summary className="connection-link">See your connections</summary>
      <p className="text-xs text-slate-400 my-2">A possible arrangement of your final tiles, not a claim that you missed an available move.</p>
      {analysis.groups.map(group => <div key={group.tag} className="flex justify-between gap-2 text-sm py-1"><span>{group.tag}{group.locked ? ' (PON locked)' : ''}</span><span>{group.tiles.map(tile => tile.emoji).join(' ')}</span></div>)}
      {analysis.remaining.length > 0 && <p className="text-xs text-slate-400 mt-2">Ungrouped: <span className="text-lg">{analysis.remaining.map(tile => tile.emoji).join(' ')}</span></p>}
    </details>
  </section>
}
