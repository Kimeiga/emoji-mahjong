import type { Tile } from '../types'
import { POOL_SIZE } from '../data/emojis'

export interface TripletGroup {
  tag: string
  tiles: Tile[]
  score: number
}

/**
 * Find the highest-scoring decomposition of 4 non-overlapping triplets.
 * Each triplet is 3 tiles sharing at least one common tag.
 * For each triplet, picks the rarest shared tag (highest score).
 * Uses backtracking to find the decomposition with maximum total score.
 */
export function findDisplayTriplets(
  hand: Tile[],
  maxTriplets = 4,
  tagCounts?: Record<string, number>
): TripletGroup[] {
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
    .sort((a, b) => {
      // Sort by score descending (rarest first) to find high-value sets early
      const scoreA = tagCounts ? Math.round(POOL_SIZE / (tagCounts[a[0]] || POOL_SIZE)) : 0
      const scoreB = tagCounts ? Math.round(POOL_SIZE / (tagCounts[b[0]] || POOL_SIZE)) : 0
      return scoreB - scoreA
    })

  let bestResult: TripletGroup[] = []
  let bestScore = -1

  function getTagScore(tag: string): number {
    if (!tagCounts) return 1
    return Math.round(POOL_SIZE / (tagCounts[tag] || POOL_SIZE))
  }

  function totalScore(groups: TripletGroup[]): number {
    return groups.reduce((sum, g) => sum + g.score, 0)
  }

  function search(usedIds: Set<string>, found: TripletGroup[], startIdx: number) {
    if (found.length >= maxTriplets) {
      const score = totalScore(found)
      if (score > bestScore) {
        bestScore = score
        bestResult = [...found]
      }
      return
    }

    // Prune: even if remaining groups are max score, can we beat best?
    if (found.length > bestResult.length || (found.length === bestResult.length && totalScore(found) > bestScore)) {
      bestScore = totalScore(found)
      bestResult = [...found]
    }

    for (let ci = startIdx; ci < candidates.length; ci++) {
      const [tag, tiles] = candidates[ci]
      const available = tiles.filter(t => !usedIds.has(t.id))
      if (available.length < 3) continue

      const score = getTagScore(tag)
      const chosen = available.slice(0, 3)
      const newUsed = new Set(usedIds)
      for (const t of chosen) newUsed.add(t.id)

      search(newUsed, [...found, { tag, tiles: chosen, score }], ci + 1)
    }
  }

  search(new Set(), [], 0)
  return bestResult
}
