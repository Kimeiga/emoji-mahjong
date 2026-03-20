import type { Tile } from '../types'
import { ALL_EMOJI_DEFS, POOL_SIZE } from '../data/emojis'

let counter = 0

/**
 * Select POOL_SIZE tiles from ALL_EMOJI_DEFS with tag-overlap bias.
 * Greedy: start with a random tile, keep adding tiles that share the most
 * tags with the existing pool.
 */
export function selectTilePool(): { tiles: Tile[]; tagCounts: Record<string, number> } {
  counter = 0
  const defs = shuffle([...ALL_EMOJI_DEFS])
  const pool: typeof defs = [defs[0]]
  const remaining = defs.slice(1)

  // Track tag frequency in the pool
  const poolTagFreq = new Map<string, number>()
  for (const tag of pool[0].tags) {
    poolTagFreq.set(tag, 1)
  }

  while (pool.length < POOL_SIZE && remaining.length > 0) {
    // Score a random sample of candidates
    const sampleSize = Math.min(50, remaining.length)
    const sample = remaining.slice(0, sampleSize)

    let bestIdx = 0
    let bestScore = -1
    for (let i = 0; i < sample.length; i++) {
      let score = 0
      for (const tag of sample[i].tags) {
        const freq = poolTagFreq.get(tag) || 0
        if (freq >= 1) score += freq  // more overlap = higher score
      }
      if (score > bestScore) {
        bestScore = score
        bestIdx = i
      }
    }

    const chosen = remaining.splice(bestIdx, 1)[0]
    pool.push(chosen)
    for (const tag of chosen.tags) {
      poolTagFreq.set(tag, (poolTagFreq.get(tag) || 0) + 1)
    }
  }

  const tiles: Tile[] = shuffle(pool).map((def) => ({
    id: `tile-${counter++}`,
    emoji: def.emoji,
    name: def.name ?? def.emoji,
    tags: [...def.tags],
  }))

  // Compute tag counts for the entire pool
  const tagCounts: Record<string, number> = {}
  for (const tile of tiles) {
    for (const tag of tile.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1
    }
  }

  return { tiles, tagCounts }
}

// Keep createDeck for backward compat but use the new pool
export function createDeck(): Tile[] {
  return selectTilePool().tiles
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function drawTile(wall: Tile[]): { tile: Tile; remaining: Tile[] } | null {
  if (wall.length === 0) return null
  const remaining = [...wall]
  const tile = remaining.pop()!
  return { tile, remaining }
}
