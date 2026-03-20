import type { Tile } from '../types'

export interface TripletGroup {
  tag: string
  tiles: Tile[]
}

/**
 * Find the maximum non-overlapping triplets using backtracking.
 * Each triplet is 3 tiles sharing at least one common tag.
 * Returns the tag label + tiles for display.
 */
export function findDisplayTriplets(hand: Tile[], maxTriplets = 4): TripletGroup[] {
  // Build tag → tiles map
  const tagGroups = new Map<string, Tile[]>()
  for (const tile of hand) {
    for (const tag of tile.tags) {
      if (!tagGroups.has(tag)) tagGroups.set(tag, [])
      tagGroups.get(tag)!.push(tile)
    }
  }

  // Get candidate tag groups (3+ tiles sharing a tag)
  const candidates = [...tagGroups.entries()]
    .filter(([, tiles]) => tiles.length >= 3)
    .sort((a, b) => a[1].length - b[1].length) // try smaller groups first (more constrained)

  // Backtracking search for maximum triplets
  let bestResult: TripletGroup[] = []

  function search(usedIds: Set<string>, found: TripletGroup[], startIdx: number) {
    if (found.length > bestResult.length) {
      bestResult = [...found]
    }
    if (found.length >= maxTriplets) return // found max
    if (bestResult.length >= maxTriplets) return // already have max

    for (let ci = startIdx; ci < candidates.length; ci++) {
      const [tag, tiles] = candidates[ci]
      const available = tiles.filter(t => !usedIds.has(t.id))
      if (available.length < 3) continue

      // Try picking 3 from available (just use first 3 for speed)
      const chosen = available.slice(0, 3)
      const newUsed = new Set(usedIds)
      for (const t of chosen) newUsed.add(t.id)

      search(newUsed, [...found, { tag, tiles: chosen }], ci + 1)

      if (bestResult.length >= maxTriplets) return // prune
    }
  }

  search(new Set(), [], 0)
  return bestResult
}
