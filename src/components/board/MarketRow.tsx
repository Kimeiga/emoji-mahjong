import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useGame } from '../../contexts/GameContext'
import { TileView, TagPill } from '../shared/Tile'
import { analyzeConnections } from '../../engine/connections'
import type { RevealedSet } from '../../types'
import type { Tile } from '../../types'

function MarketInspector({
  tile, hand, tagCounts, melds, onPick, onClose,
}: {
  tile: Tile
  hand: Tile[]
  melds: RevealedSet[]
  tagCounts: Record<string, number>
  onPick: () => void
  onClose: () => void
}) {
  const preview = useMemo(() => analyzeConnections([...hand, tile], melds), [hand, tile, melds])
  // Find which tags this tile shares with tiles in the player's hand
  const tagRelations = useMemo(() => {
    const relations: { tag: string; relatedTiles: Tile[] }[] = []
    for (const tag of tile.tags) {
      const related = hand.filter(t => t.tags.includes(tag))
      if (related.length > 0) relations.push({ tag, relatedTiles: related })
    }
    relations.sort((a, b) => b.relatedTiles.length - a.relatedTiles.length)
    return relations
  }, [tile, hand])

  return (
    <>
      <div className="modal-above-market fixed left-4 right-4 z-[105] bg-slate-800/95 rounded-xl p-3 mx-auto max-w-sm border border-slate-700 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{tile.emoji}</span>
            <div>
              <div className="text-sm text-white font-medium">{tile.name}</div>
              <div className="text-[10px] text-slate-400">Market tile</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close tile details"
              className="w-11 h-11 shrink-0 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white text-xs transition-colors"
          >✕</button>
        </div>

        <button
          onClick={onPick}
          className="w-full mt-1 mb-2 py-2 rounded-lg bg-sky-500/20 border border-sky-500/40 text-sky-400 font-bold text-sm hover:bg-sky-500/30 active:bg-sky-500/40 transition-colors"
        >
          Pick {tile.emoji}
        </button>

        <p className="text-xs text-slate-300 mb-2">After this pick: {preview.complete}/4 non-overlapping sets. {preview.complete === 4 ? 'This completes your hand.' : 'Connections may need rearranging.'}</p>
        {/* Tag relations with player's hand */}
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {tagRelations.slice(0, 8).map(({ tag, relatedTiles }) => (
            <div key={tag} className="flex items-center gap-1.5 flex-wrap">
              <TagPill tag={tag} count={tagCounts[tag] || 0} />
              <div className="flex gap-0.5">
                {relatedTiles.slice(0, 5).map(t => (
                  <span key={t.id} className="text-sm">{t.emoji}</span>
                ))}
                {relatedTiles.length > 5 && (
                  <span className="text-[10px] text-slate-500">+{relatedTiles.length - 5}</span>
                )}
              </div>
              {melds.some(set => set.tag === tag) ? (
                <span className="text-xs text-amber-300">Tag already locked by PON</span>
              ) : relatedTiles.length >= 2 ? (
                <span className="text-[9px] text-green-400 font-bold bg-green-500/10 px-1.5 py-0.5 rounded-full">Possible set</span>
              ) : (tagCounts[tag] || 0) < 3 ? (
                <span className="text-[9px] text-slate-600">not enough in pool</span>
              ) : (
                <span className="text-[9px] text-slate-500">need {2 - relatedTiles.length} more</span>
              )}
            </div>
          ))}
          {tile.tags.filter(t => !tagRelations.find(r => r.tag === t) && (tagCounts[t] || 0) >= 3).length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-700">
              {tile.tags
                .filter(t => !tagRelations.find(r => r.tag === t) && (tagCounts[t] || 0) >= 3)
                .slice(0, 6)
                .map(tag => (<TagPill key={tag} tag={tag} count={tagCounts[tag] || 0} />))}
            </div>
          )}
          {tagRelations.length === 0 && (
            <div className="text-[10px] text-slate-500">No matching tags in your hand</div>
          )}
        </div>
      </div>
    </>
  )
}

export function MarketRow() {
  const { market, phase, currentPlayer, myPlayerId, pickMarket, drawBlind, players, tagCounts, wallCount, revealedSets } = useGame()
  const [inspecting, setInspecting] = useState<string | null>(null)

  const isMyDraw = currentPlayer === myPlayerId && phase === 'draw'
  const inspectedTile = inspecting ? market.find(t => t.id === inspecting) : null
  const hand = players[myPlayerId].hand

  const melds = useMemo(() => revealedSets.filter(set => set.playerId === myPlayerId), [revealedSets, myPlayerId])

  if (market.length === 0) return null

  return (
    <>
      {/* Market inspector modal */}
      {inspectedTile && isMyDraw && (
        <MarketInspector
          tile={inspectedTile}
          hand={hand}
          melds={melds}
          tagCounts={tagCounts}
          onPick={() => { setInspecting(null); pickMarket(inspectedTile.id) }}
          onClose={() => setInspecting(null)}
        />
      )}

      <div className="market-anchor flex flex-col items-center py-2 px-2 relative z-[102]">
        <div className="text-[10px] text-slate-500 mb-1">
          {isMyDraw ? 'Market · inspect a tile, then pick it' : 'Market'}
        </div>
        <div className="flex gap-1.5 items-center">
          {market.map((tile) => (
            <div
              key={tile.id}
              className={`relative ${isMyDraw ? 'cursor-pointer' : 'opacity-60'}`}
            >
              <TileView
                tile={tile}
                size="md"
                selected={inspecting === tile.id}
                onClick={isMyDraw ? () => setInspecting(inspecting === tile.id ? null : tile.id) : undefined}
              />
            </div>
          ))}
          {isMyDraw && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileTap={{ scale: 0.9 }}
              disabled={wallCount === 0}
              aria-label="Draw blind from wall"
              onClick={drawBlind}
              className="w-10 h-10 rounded-lg bg-slate-700 border-2 border-dashed border-slate-500 flex items-center justify-center text-slate-400 hover:border-sky-400 hover:text-sky-400 transition-colors"
              title={wallCount ? "Draw blind from wall" : "Wall empty: choose a market tile"}
            >
              <span className="text-lg">?</span>
            </motion.button>
          )}
        </div>
      </div>
    </>
  )
}
