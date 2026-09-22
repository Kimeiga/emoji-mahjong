import type { RevealedSet, Tile } from '../types'
import { canFormTriplets } from './sets'
import { findDisplayTriplets } from './triplet-display'

export interface Connection {
  tag: string
  tiles: Tile[]
  locked: boolean
}

/** Advisory only: never changes tile order, the hand, melds, or game rules. */
export function analyzeConnections(hand: Tile[], melds: RevealedSet[]) {
  const lockedTags = new Set(melds.map(set => set.tag))
  // Count sets, not bonus points. Sorting a copy keeps this stable after manual reordering.
  const tiles = [...hand].sort((a, b) => a.id.localeCompare(b.id))
  const flexible = findDisplayTriplets(tiles, 4 - melds.length, undefined, lockedTags)
  const groups: Connection[] = [
    ...melds.map(set => ({ tag: set.tag, tiles: set.tiles, locked: true })),
    ...flexible.map(set => ({ tag: set.tag, tiles: set.tiles, locked: false })),
  ]
  const byTag = new Map<string, Tile[]>()
  for (const tile of tiles) for (const tag of new Set(tile.tags)) {
    const group = byTag.get(tag) ?? []
    group.push(tile)
    byTag.set(tag, group)
  }
  const options = [...byTag].filter(([, members]) => members.length >= 2)
    .map(([tag, members]) => ({
      tag, tiles: members, lockedTag: lockedTags.has(tag),
      overlaps: flexible.filter(group => group.tag !== tag && group.tiles.some(tile => members.some(t => t.id === tile.id))).map(group => group.tag),
    }))
    .sort((a, b) => Number(a.lockedTag) - Number(b.lockedTag) || Math.min(3, b.tiles.length) - Math.min(3, a.tiles.length) || a.tag.localeCompare(b.tag))
  const used = new Set(groups.flatMap(group => group.tiles.map(tile => tile.id)))
  const remaining = tiles.filter(tile => !used.has(tile.id))
  const usedTags = new Set(groups.map(group => group.tag))
  const pairs = options.filter(option => !usedTags.has(option.tag) && option.tiles.filter(tile => !used.has(tile.id)).length >= 2)
    .map(option => ({ tag: option.tag, tiles: option.tiles.filter(tile => !used.has(tile.id)).slice(0, 2) }))
  return { groups, options, remaining, pairs, complete: groups.length }
}

/** Tags that complete this actual hand, with every exposed PON held fixed.
 * This deliberately says nothing about whether another such tile is available. */
export function winningConnectionTags(hand: Tile[], melds: RevealedSet[]): string[] {
  if (hand.length + melds.length * 3 !== 11 || melds.length > 3) return []
  const lockedTags = new Set(melds.map(set => set.tag))
  const waiting = new Set<string>()
  for (let i = 0; i < hand.length; i++) for (let j = i + 1; j < hand.length; j++) {
    for (const tag of hand[i].tags) {
      if (lockedTags.has(tag) || !hand[j].tags.includes(tag) || waiting.has(tag)) continue
      const rest = hand.filter((_, index) => index !== i && index !== j)
      if (canFormTriplets(rest, 3 - melds.length, new Set([...lockedTags, tag]))) waiting.add(tag)
    }
  }
  return [...waiting].sort()
}
