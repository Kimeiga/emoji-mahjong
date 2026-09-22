import { useState } from 'react'
import type { analyzeConnections } from '../../engine/connections'

type Analysis = ReturnType<typeof analyzeConnections>
interface Props {
  analysis: Analysis
  tagCounts: Record<string, number>
  focusedTag: string | null
  onFocus: (tag: string | null) => void
}

export function ConnectionMap({ analysis, tagCounts, focusedTag, onFocus }: Props) {
  const [exploring, setExploring] = useState(false)
  return (
    <section className="connections-panel" aria-label="Your connections">
      <div className="flex justify-between items-baseline gap-2">
        <h2 className="text-sm font-semibold text-slate-100">Your connections</h2>
        <span className="text-xs text-sky-300" role="status">{analysis.complete}/4 sets</span>
      </div>
      <p className="text-xs text-slate-400 mt-1 mb-2">One possible arrangement. Only PON locks a set.</p>
      <div className="connection-grid">
        {analysis.groups.map(group => (
          <button key={group.tag} type="button" className={`connection-card ${group.locked ? 'connection-locked' : ''}`}
            aria-pressed={focusedTag === group.tag} aria-label={`Highlight ${group.tag} ${group.locked ? 'locked' : 'flexible'} set`}
            onClick={() => onFocus(focusedTag === group.tag ? null : group.tag)}>
            <span className="flex items-center justify-between gap-1 w-full">
              <span className="connection-tag">{group.tag}</span>
              <span className="text-[10px] text-slate-400">{group.locked ? 'PON locked' : 'flexible'}</span>
            </span>
            <span className="flex gap-1 text-xl" aria-label={group.tiles.map(tile => tile.name).join(', ')}>
              {group.tiles.map(tile => <span key={tile.id} aria-hidden="true">{tile.emoji}</span>)}
            </span>
          </button>
        ))}
        {Array.from({ length: Math.max(0, 4 - analysis.complete) }, (_, i) => (
          <div key={`empty-${i}`} className="connection-card connection-empty">
            <span className="text-xs">Set {analysis.complete + i + 1}</span>
            <span className="text-xs text-slate-400">Find a different tag</span>
          </div>
        ))}
      </div>
      <div className="flex justify-between gap-2 mt-1">
        <button type="button" className="connection-link" aria-expanded={exploring} aria-controls="connection-options" onClick={() => setExploring(!exploring)}>
          {exploring ? 'Hide other connections' : 'Explore other connections'}
        </button>
        {focusedTag && <button type="button" className="connection-link" onClick={() => onFocus(null)}>Clear highlight</button>}
      </div>
      {exploring && <div id="connection-options" className="connection-options">
        <p className="text-xs text-slate-400 mb-2">Alternatives can share tiles. Each tile and each tag can count only once.</p>
        {analysis.options.length === 0 && <p className="text-sm text-slate-300">No pairs yet. Inspect a market tile to find a connection.</p>}
        {analysis.options.map(option => (
          <button type="button" key={option.tag} className="connection-option" aria-pressed={focusedTag === option.tag}
            onClick={() => onFocus(focusedTag === option.tag ? null : option.tag)}>
            <span className="flex justify-between gap-2"><strong>{option.tag}</strong><span>{option.tiles.slice(0, 5).map(tile => tile.emoji).join(' ')}{option.tiles.length > 5 ? ' …' : ''}</span></span>
            <span className="block text-xs text-slate-400 mt-0.5">
              {option.lockedTag ? 'Unavailable: this tag is already locked by PON.' : (tagCounts[option.tag] ?? 0) < 3 ? 'Fewer than three tiles in this game use this tag.' : option.overlaps.length
                ? `Also connects to ${option.overlaps.join(', ')}. Each tile can count only once.`
                : option.tiles.length === 2 ? 'A pair. Needs a third tile with this tag.' : 'Three matching tiles can form a set.'}
            </span>
          </button>
        ))}
      </div>}
    </section>
  )
}
