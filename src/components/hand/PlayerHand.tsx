import { useMemo } from 'react'
import { useGame } from '../../contexts/GameContext'
import { TileView, TagPill } from '../shared/Tile'
import { findDisplayTriplets } from '../../engine/triplet-display'
import { canDeclareRiichi } from '../../engine/sets'
import { scoreSet } from '../../engine/scoring'
import type { Tile } from '../../types'
import type { TripletGroup } from '../../engine/triplet-display'

function TripletGroupView({
  group, selectedTileId, relatedTileIds, hasSelection, onTap, lastDrawnTileId, tagCounts,
}: {
  group: TripletGroup
  selectedTileId: string | null
  relatedTileIds: Set<string>
  hasSelection: boolean
  onTap: (id: string) => void
  lastDrawnTileId: string | null
  tagCounts: Record<string, number>
}) {
  const pts = scoreSet(group.tag, tagCounts)
  return (
    <div className="flex flex-col items-center">
      <div className="mb-0.5 flex items-center gap-1">
        <TagPill tag={group.tag} />
        <span className="text-[9px] text-amber-400 font-bold">{pts}pt</span>
      </div>
      <div className="flex gap-0.5 bg-slate-700/30 rounded-xl px-1 py-1 border border-slate-600/50 relative">
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold z-10">✓</div>
        {group.tiles.map((tile) => (
          <TileView
            key={tile.id}
            tile={tile}
            size="lg"
            selected={selectedTileId === tile.id}
            highlighted={hasSelection && relatedTileIds.has(tile.id)}
            dimmed={hasSelection && tile.id !== selectedTileId && !relatedTileIds.has(tile.id)}
            newlyDrawn={tile.id === lastDrawnTileId}
            onClick={() => onTap(tile.id)}
          />
        ))}
      </div>
    </div>
  )
}

function LockedSetView({ tag, tiles, tagCounts }: { tag: string; tiles: Tile[]; tagCounts: Record<string, number> }) {
  const pts = scoreSet(tag, tagCounts)
  return (
    <div className="flex flex-col items-center opacity-90">
      <div className="mb-0.5 flex items-center gap-1">
        <TagPill tag={tag} />
        <span className="text-[9px] text-amber-400 font-bold">{pts}pt</span>
        <span className="text-[8px] text-amber-400">🔒</span>
      </div>
      <div className="flex gap-0 bg-amber-900/20 rounded-xl px-0.5 py-1 border border-amber-500/40 relative">
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold z-10">🔒</div>
        {tiles.map((tile) => (
          <TileView key={tile.id} tile={tile} size="lg" />
        ))}
      </div>
    </div>
  )
}

function ProgressBar({ current, total, score }: { current: number; total: number; score: number }) {
  const pct = (current / total) * 100
  return (
    <div className="flex items-center gap-2 mt-1.5 px-4">
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            current >= total ? 'bg-green-500' : current >= 3 ? 'bg-amber-400' : 'bg-sky-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[10px] font-bold ${current >= total ? 'text-green-400' : 'text-slate-400'}`}>
        {current}/{total}
      </span>
      {score > 0 && (
        <span className="text-[10px] text-amber-400 font-bold">
          {score} pts
        </span>
      )}
    </div>
  )
}

export function PlayerHand() {
  const {
    players, myPlayerId, selectedTileId, selectTile, discardTile,
    phase, currentPlayer, revealedSets, declareRiichi, lastDrawnTileId, tagCounts,
  } = useGame()

  const hand = players[myPlayerId].hand
  const isRiichi = players[myPlayerId].riichi
  const isMyTurn = currentPlayer === myPlayerId && phase === 'discard'
  const selectedTile = hand.find(t => t.id === selectedTileId)

  const myLockedSets = useMemo(() =>
    revealedSets.filter(rs => rs.playerId === myPlayerId),
    [revealedSets, myPlayerId]
  )
  const lockedTileIds = useMemo(() => {
    const ids = new Set<string>()
    for (const rs of myLockedSets) {
      for (const t of rs.tiles) ids.add(t.id)
    }
    return ids
  }, [myLockedSets])

  const unlockedHand = useMemo(() =>
    hand.filter(t => !lockedTileIds.has(t.id)),
    [hand, lockedTileIds]
  )

  const triplets = useMemo(() => findDisplayTriplets(unlockedHand), [unlockedHand])
  const tripletTileIds = useMemo(() => {
    const ids = new Set<string>()
    for (const group of triplets) {
      for (const tile of group.tiles) ids.add(tile.id)
    }
    return ids
  }, [triplets])

  const tagRelations = useMemo(() => {
    if (!selectedTile) return []
    const relations: { tag: string; relatedTiles: Tile[] }[] = []
    for (const tag of selectedTile.tags) {
      const related = hand.filter(t => t.id !== selectedTile.id && t.tags.includes(tag) && !lockedTileIds.has(t.id))
      if (related.length > 0) relations.push({ tag, relatedTiles: related })
    }
    relations.sort((a, b) => b.relatedTiles.length - a.relatedTiles.length)
    return relations
  }, [selectedTile, hand, lockedTileIds])

  const relatedTileIds = useMemo(() => {
    const ids = new Set<string>()
    for (const { relatedTiles } of tagRelations) {
      for (const t of relatedTiles) ids.add(t.id)
    }
    return ids
  }, [tagRelations])

  const ungrouped = useMemo(() => {
    return hand.filter(t => !tripletTileIds.has(t.id) && !lockedTileIds.has(t.id))
  }, [hand, tripletTileIds, lockedTileIds])


  const canRiichi = useMemo(() => {
    if (isRiichi || !isMyTurn) return false
    return canDeclareRiichi(hand)
  }, [hand, isMyTurn, isRiichi])

  const handleTap = (tileId: string) => {
    if (!isMyTurn) return
    if (isRiichi) return
    if (lockedTileIds.has(tileId)) return
    if (selectedTileId === tileId) {
      discardTile(tileId)
    } else {
      selectTile(tileId)
    }
  }

  const totalSets = myLockedSets.length + triplets.length
  const hasSelection = !!selectedTile

  return (
    <div className="px-2 pb-3 pt-1">
      {isRiichi && (
        <div className="text-center text-xs text-red-400 font-bold mb-1 tracking-widest">
          RIICHI — hand locked
        </div>
      )}

      {canRiichi && !selectedTile && (
        <div className="flex justify-center mb-1.5">
          <button
            onClick={() => declareRiichi(myPlayerId)}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-sm tracking-wider shadow-lg shadow-red-500/30 active:shadow-inner animate-pulse"
          >
            RIICHI!
          </button>
        </div>
      )}

      {isMyTurn && !selectedTile && !isRiichi && (
        <div className="text-center text-xs text-yellow-400 mb-1 animate-pulse">
          Tap to inspect, tap again to discard
        </div>
      )}
      {!isMyTurn && currentPlayer === myPlayerId && phase === 'draw' && (
        <div className="text-center text-xs text-sky-400 mb-1">Drawing...</div>
      )}

      {/* Tag inspector modal — fixed overlay */}
      {selectedTile && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/40" onClick={() => selectTile(null)} />
          <div className="fixed bottom-48 left-4 right-4 z-[101] bg-slate-800/95 rounded-xl p-3 mx-auto max-w-sm border border-slate-700 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedTile.emoji}</span>
                <div>
                  <div className="text-sm text-white font-medium">{selectedTile.name}</div>
                  <div className="text-[10px] text-slate-400">Tags & related tiles</div>
                </div>
              </div>
              <button
                onClick={() => selectTile(null)}
                className="w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white text-xs transition-colors"
              >✕</button>
            </div>

            {isMyTurn && (
              <button
                onClick={() => discardTile(selectedTile.id)}
                className="w-full mt-1 mb-2 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 font-bold text-sm hover:bg-red-500/30 active:bg-red-500/40 transition-colors"
              >
                Discard {selectedTile.emoji}
              </button>
            )}

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
              {selectedTile.tags.filter(t => !tagRelations.find(r => r.tag === t)).length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-700">
                  {selectedTile.tags
                    .filter(t => !tagRelations.find(r => r.tag === t))
                    .slice(0, 6)
                    .map(tag => (<TagPill key={tag} tag={tag} count={tagCounts[tag] || 0} />))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Hand */}
      <div className="flex flex-wrap gap-1.5 justify-center max-w-md mx-auto items-end relative z-[102]">
        {myLockedSets.map((rs) => (
          <LockedSetView key={rs.tag} tag={rs.tag} tiles={rs.tiles} tagCounts={tagCounts} />
        ))}

        {triplets.map((group) => (
          <TripletGroupView
            key={group.tag}
            group={group}
            selectedTileId={selectedTileId}
            relatedTileIds={relatedTileIds}
            hasSelection={hasSelection}
            onTap={handleTap}
            lastDrawnTileId={lastDrawnTileId}
            tagCounts={tagCounts}
          />
        ))}

        {ungrouped.length > 0 && (
          <div className="flex flex-col items-center w-full">
            {triplets.length > 0 && (
              <div className="text-[9px] text-slate-500 mb-0.5">loose</div>
            )}
            <div className="flex flex-wrap gap-1 justify-center w-full">
              {ungrouped.map((tile) => (
                <TileView
                  key={tile.id}
                  tile={tile}
                  size="lg"
                  selected={selectedTileId === tile.id}
                  highlighted={hasSelection && relatedTileIds.has(tile.id)}
                  dimmed={hasSelection && tile.id !== selectedTileId && !relatedTileIds.has(tile.id)}
                  newlyDrawn={tile.id === lastDrawnTileId}
                  onClick={() => handleTap(tile.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Progress bar with score */}
      <ProgressBar current={totalSets} total={4} score={
        Math.round((
          myLockedSets.reduce((s, rs) => s + scoreSet(rs.tag, tagCounts), 0) +
          triplets.reduce((s, g) => s + scoreSet(g.tag, tagCounts), 0)
        ) * 10) / 10
      } />
    </div>
  )
}
