import { useMemo, useState, useEffect } from 'react'
import { Reorder } from 'framer-motion'
import { useGame } from '../../contexts/GameContext'
import { TileView, TagPill } from '../shared/Tile'
import { findDisplayTriplets } from '../../engine/triplet-display'
import { canDeclareRiichi } from '../../engine/sets'
import type { Tile } from '../../types'
import type { TripletGroup } from '../../engine/triplet-display'

/** Single triplet group rendered as a visual unit */
function TripletGroupView({
  group,
  selectedTileId,
  relatedTileIds,
  hasSelection,
  onTap,
}: {
  group: TripletGroup
  selectedTileId: string | null
  relatedTileIds: Set<string>
  hasSelection: boolean
  onTap: (id: string) => void
}) {
  return (
    <div className="flex flex-col items-center">
      {/* Tag label spanning the group */}
      <div className="mb-0.5">
        <TagPill tag={group.tag} />
      </div>
      {/* Tiles in a connected container */}
      <div className="flex gap-0.5 bg-slate-700/30 rounded-xl px-1 py-1 border border-slate-600/50 relative">
        {/* Completion indicator */}
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold z-10">
          ✓
        </div>
        {group.tiles.map((tile) => (
          <TileView
            key={tile.id}
            tile={tile}
            size="lg"
            selected={selectedTileId === tile.id}
            highlighted={hasSelection && relatedTileIds.has(tile.id)}
            dimmed={hasSelection && tile.id !== selectedTileId && !relatedTileIds.has(tile.id)}
            onClick={() => onTap(tile.id)}
          />
        ))}
      </div>
    </div>
  )
}

/** Locked set from pon — can't be broken */
function LockedSetView({ tag, tiles }: { tag: string; tiles: Tile[] }) {
  return (
    <div className="flex flex-col items-center opacity-90">
      <div className="mb-0.5 flex items-center gap-1">
        <TagPill tag={tag} />
        <span className="text-[8px] text-amber-400">🔒</span>
      </div>
      <div className="flex gap-0 bg-amber-900/20 rounded-xl px-0.5 py-1 border border-amber-500/40 relative">
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-[8px] text-white font-bold z-10">
          🔒
        </div>
        {tiles.map((tile) => (
          <TileView key={tile.id} tile={tile} size="lg" />
        ))}
      </div>
    </div>
  )
}

export function PlayerHand() {
  const {
    players, myPlayerId, selectedTileId, selectTile, discardTile,
    phase, currentPlayer, revealedSets, declareRiichi, mode,
  } = useGame()

  const hand = players[myPlayerId].hand
  const isRiichi = players[myPlayerId].riichi

  const isMyTurn = currentPlayer === myPlayerId && phase === 'discard'
  const selectedTile = hand.find(t => t.id === selectedTileId)

  // Locked tile IDs from pon-claimed sets (for my player)
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

  // Only find display triplets from unlocked tiles
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
      const related = hand.filter(t => t.id !== selectedTile.id && t.tags.includes(tag))
      if (related.length > 0) {
        relations.push({ tag, relatedTiles: related })
      }
    }
    relations.sort((a, b) => b.relatedTiles.length - a.relatedTiles.length)
    return relations
  }, [selectedTile, hand])

  const relatedTileIds = useMemo(() => {
    const ids = new Set<string>()
    for (const { relatedTiles } of tagRelations) {
      for (const t of relatedTiles) ids.add(t.id)
    }
    return ids
  }, [tagRelations])

  // Ungrouped tiles (not in any triplet and not locked)
  const ungrouped = useMemo(() => {
    return hand.filter(t => !tripletTileIds.has(t.id) && !lockedTileIds.has(t.id))
  }, [hand, tripletTileIds, lockedTileIds])

  // Ordered ungrouped tiles for drag-to-reorder
  const [orderedUngrouped, setOrderedUngrouped] = useState(ungrouped)
  useEffect(() => { setOrderedUngrouped(ungrouped) }, [ungrouped])

  // Check if player can declare riichi (has 12 tiles, some discard leaves tenpai)
  // Only in local mode — in multiplayer the server tells us
  const canRiichi = useMemo(() => {
    if (isRiichi || !isMyTurn) return false
    if (mode === 'multiplayer') return canDeclareRiichi(hand)
    return canDeclareRiichi(hand)
  }, [hand, isMyTurn, isRiichi, mode])

  const handleTap = (tileId: string) => {
    if (!isMyTurn) return
    // Can't interact with tiles while in riichi (auto-discard handles it)
    if (isRiichi) return
    // Can't discard locked tiles
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
      {/* Riichi indicator */}
      {isRiichi && (
        <div className="text-center text-xs text-red-400 font-bold mb-1 tracking-widest">
          RIICHI — hand locked, waiting for winning tile
        </div>
      )}

      {/* Riichi button */}
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

      {/* Status */}
      {isMyTurn && !selectedTile && !isRiichi && (
        <div className="text-center text-xs text-yellow-400 mb-1 animate-pulse">
          Tap to inspect, tap again to discard
        </div>
      )}
      {!isMyTurn && currentPlayer === myPlayerId && phase === 'draw' && (
        <div className="text-center text-xs text-sky-400 mb-1">
          Drawing...
        </div>
      )}

      {/* Tag inspector modal */}
      {selectedTile && (
        <>
          {/* Backdrop — tap to close */}
          <div
            className="fixed inset-0 z-[100] bg-black/40"
            onClick={() => selectTile(null)}
          />
          <div className="fixed bottom-48 left-4 right-4 z-[101] bg-slate-800/95 rounded-xl p-3 mx-auto max-w-sm border border-slate-700 shadow-xl">
            {/* Header with emoji name and close button */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{selectedTile.emoji}</span>
                <div>
                  <div className="text-sm text-white font-medium">
                    {selectedTile.name}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Tags & related tiles
                  </div>
                </div>
              </div>
              <button
                onClick={() => selectTile(null)}
                className="w-6 h-6 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-400 hover:text-white text-xs transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Discard button */}
            {isMyTurn && (
              <button
                onClick={() => discardTile(selectedTile.id)}
                className="w-full mt-2 mb-1 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 font-bold text-sm hover:bg-red-500/30 active:bg-red-500/40 transition-colors"
              >
                Discard {selectedTile.emoji}
              </button>
            )}

            <div className="space-y-1 max-h-36 overflow-y-auto">
              {tagRelations.slice(0, 8).map(({ tag, relatedTiles }) => (
                <div key={tag} className="flex items-center gap-1.5 flex-wrap">
                  <TagPill tag={tag} count={relatedTiles.length} />
                  <div className="flex gap-0.5">
                    {relatedTiles.slice(0, 5).map(t => (
                      <span key={t.id} className="text-sm">{t.emoji}</span>
                    ))}
                    {relatedTiles.length > 5 && (
                      <span className="text-[10px] text-slate-500">+{relatedTiles.length - 5}</span>
                    )}
                  </div>
                  {relatedTiles.length >= 2 && (
                    <span className="text-[9px] text-green-400 font-bold">✓ SET</span>
                  )}
                </div>
              ))}
              {selectedTile.tags.filter(t => !tagRelations.find(r => r.tag === t)).length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-700">
                  {selectedTile.tags
                    .filter(t => !tagRelations.find(r => r.tag === t))
                    .slice(0, 6)
                    .map(tag => (
                      <TagPill key={tag} tag={tag} />
                    ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Hand: locked sets, then formed triplets, then loose tiles */}
      <div className="flex flex-wrap gap-1.5 justify-center max-w-md mx-auto items-end relative z-[102]">
        {/* Locked sets from pon */}
        {myLockedSets.map((rs) => (
          <LockedSetView key={rs.tag} tag={rs.tag} tiles={rs.tiles} />
        ))}

        {/* Formed triplets (unlocked) */}
        {triplets.map((group) => (
          <TripletGroupView
            key={group.tag}
            group={group}
            selectedTileId={selectedTileId}
            relatedTileIds={relatedTileIds}
            hasSelection={hasSelection}
            onTap={handleTap}
          />
        ))}

        {/* Ungrouped tiles (drag to reorder) */}
        {orderedUngrouped.length > 0 && (
          <div className="flex flex-col items-center">
            {triplets.length > 0 && (
              <div className="text-[9px] text-slate-500 mb-0.5">loose</div>
            )}
            <Reorder.Group
              axis="x"
              values={orderedUngrouped}
              onReorder={setOrderedUngrouped}
              className="flex gap-1 justify-center"
              style={{ listStyle: 'none' }}
            >
              {orderedUngrouped.map((tile) => (
                <Reorder.Item key={tile.id} value={tile} style={{ cursor: 'grab' }}>
                  <TileView
                    tile={tile}
                    size="lg"
                    selected={selectedTileId === tile.id}
                    highlighted={hasSelection && relatedTileIds.has(tile.id)}
                    dimmed={hasSelection && tile.id !== selectedTileId && !relatedTileIds.has(tile.id)}
                    onClick={() => handleTap(tile.id)}
                  />
                </Reorder.Item>
              ))}
            </Reorder.Group>
          </div>
        )}
      </div>

      {/* Progress indicator */}
      {totalSets > 0 && (
        <div className="text-center mt-1.5 text-xs text-slate-500">
          {totalSets}/4 sets formed
          {myLockedSets.length > 0 && <span className="text-amber-400 ml-1">({myLockedSets.length} locked)</span>}
          {totalSets >= 4 && <span className="text-green-400 ml-2 font-bold">WIN!</span>}
        </div>
      )}

    </div>
  )
}
