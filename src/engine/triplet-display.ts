import type { Tile } from '../types'
import { POOL_SIZE } from '../data/emojis'

export interface TripletGroup {
  tag: string
  tiles: Tile[]
  score: number
}

/** Maximize complete, disjoint sets first, then score. Locked tags cannot recur. */
export function findDisplayTriplets(
  hand: Tile[],
  maxTriplets = 4,
  tagCounts?: Record<string, number>,
  excludedTags: Set<string> = new Set(),
): TripletGroup[] {
  if (hand.length > 12 || maxTriplets < 1) return []
  const groups = new Map<string, number[]>()
  hand.forEach((tile, index) => {
    for (const tag of new Set(tile.tags)) {
      if (excludedTags.has(tag)) continue
      const indices = groups.get(tag) ?? []
      indices.push(index)
      groups.set(tag, indices)
    }
  })
  const candidates = [...groups].filter(([, indices]) => indices.length >= 3)
    .map(([tag, indices]) => ({ tag, indices,
      score: tagCounts ? Math.round(POOL_SIZE / (tagCounts[tag] || POOL_SIZE)) : 1,
    }))
    .sort((a, b) => b.score - a.score || a.tag.localeCompare(b.tag))
  // At most maxTriplets tags with identical membership can ever be used.
  const equivalentCounts = new Map<string, number>()
  const choices = candidates.filter(({ indices }) => {
    const key = indices.join(',')
    const count = equivalentCounts.get(key) ?? 0
    equivalentCounts.set(key, count + 1)
    return count < maxTriplets
  }).map(candidate => {
    const masks: number[] = []
    const { indices } = candidate
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        for (let k = j + 1; k < indices.length; k++) {
          masks.push((1 << indices[i]) | (1 << indices[j]) | (1 << indices[k]))
        }
      }
    }
    return { ...candidate, masks }
  })
  type Solution = { count: number; score: number; groups: TripletGroup[] }
  const memo = new Map<string, Solution>()
  function search(ci: number, used: number, needed: number): Solution {
    if (!needed || ci === choices.length) return { count: 0, score: 0, groups: [] }
    const key = `${ci}:${used}:${needed}`
    const known = memo.get(key)
    if (known) return known
    let best = search(ci + 1, used, needed)
    const { tag, score, masks } = choices[ci]
    for (const mask of masks) {
      if (mask & used) continue
      const rest = search(ci + 1, used | mask, needed - 1)
      const count = rest.count + 1
      const total = rest.score + score
      if (count > best.count || (count === best.count && total > best.score)) {
        best = { count, score: total, groups: [
          { tag, score, tiles: hand.filter((_, i) => (1 << i) & mask) }, ...rest.groups,
        ] }
      }
    }
    memo.set(key, best)
    return best
  }
  return search(0, 0, Math.min(maxTriplets, Math.floor(hand.length / 3))).groups
}
