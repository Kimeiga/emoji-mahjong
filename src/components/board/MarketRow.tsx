import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useGame } from '../../contexts/GameContext'
import { TileView, TagPill } from '../shared/Tile'
import { scoreSet } from '../../engine/scoring'
import type { Tile } from '../../types'

function MarketInspector({
  tile, hand, tagCounts, onClose,
}: {
  tile: Tile
  hand: Tile[]
  tagCounts: Record<string, number>
  onClose: () => void
}) {
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
      <div className="modal-above-market fixed left-4 right-4 z-[101] bg-slate-800/95 rounded-xl p-3 mx-auto max-w-sm border border-slate-700 shadow-xl">
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
            className="w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white text-xs transition-colors"
          >✕</button>
        </div>


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
              {relatedTiles.length >= 2 ? (
                <span className="text-[9px] text-green-400 font-bold bg-green-500/10 px-1.5 py-0.5 rounded-full">✓ SET! ({scoreSet(tag, tagCounts)}pt)</span>
              ) : (
                <span className="text-[9px] text-slate-500">need {2 - relatedTiles.length} more → {scoreSet(tag, tagCounts)}pt</span>
              )}
            </div>
          ))}
          {tile.tags.filter(t => !tagRelations.find(r => r.tag === t)).length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-700">
              {tile.tags
                .filter(t => !tagRelations.find(r => r.tag === t))
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
  const { market, phase, currentPlayer, myPlayerId, pickMarket, drawBlind, players, tagCounts } = useGame()
  const [inspecting, setInspecting] = useState<string | null>(null)

  const isMyDraw = currentPlayer === myPlayerId && phase === 'draw'
  const inspectedTile = inspecting ? market.find(t => t.id === inspecting) : null
  const hand = players[myPlayerId].hand

  if (market.length === 0) return null

  return (
    <>
      {/* Market inspector modal */}
      {inspectedTile && isMyDraw && (
        <MarketInspector
          tile={inspectedTile}
          hand={hand}
          tagCounts={tagCounts}
          onClose={() => setInspecting(null)}
        />
      )}

      <div className="market-anchor flex flex-col items-center py-2 px-2 relative z-[102]">
        <div className="text-[10px] text-slate-500 mb-1">
          {isMyDraw ? 'Tap a tile to inspect, then pick' : 'Market'}
        </div>
        <div className="flex gap-1.5 items-center">
          {market.map((tile) => (
            <motion.div
              key={tile.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`relative ${isMyDraw ? 'cursor-pointer' : 'opacity-60'}`}
            >
              <TileView
                tile={tile}
                size="md"
                selected={inspecting === tile.id}
                onClick={isMyDraw ? () => setInspecting(inspecting === tile.id ? null : tile.id) : undefined}
              />
              {isMyDraw && inspecting === tile.id && (
                <button
                  onClick={(e) => { e.stopPropagation(); setInspecting(null); pickMarket(tile.id) }}
                  className="absolute -bottom-5 left-1/2 -translate-x-1/2 z-[106] text-[9px] font-bold text-sky-400 bg-sky-500/20 border border-sky-500/40 rounded-full px-2 py-0.5 whitespace-nowrap hover:bg-sky-500/30 active:bg-sky-500/40 transition-colors"
                >
                  Pick
                </button>
              )}
            </motion.div>
          ))}
          {isMyDraw && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileTap={{ scale: 0.9 }}
              onClick={drawBlind}
              className="w-10 h-10 rounded-lg bg-slate-700 border-2 border-dashed border-slate-500 flex items-center justify-center text-slate-400 hover:border-sky-400 hover:text-sky-400 transition-colors"
              title="Draw blind from wall"
            >
              <span className="text-lg">?</span>
            </motion.button>
          )}
        </div>
      </div>
    </>
  )
}
