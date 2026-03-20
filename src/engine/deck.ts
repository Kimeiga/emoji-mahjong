import type { Tile } from '../types'
import { ALL_EMOJI_DEFS } from '../data/emojis'

let counter = 0

/**
 * Create a deck using ALL emojis — one unique copy of each.
 * With enriched tags, no subset selection needed.
 */
export function createDeck(): Tile[] {
  counter = 0
  const tiles: Tile[] = ALL_EMOJI_DEFS.map((def) => ({
    id: `tile-${counter++}`,
    emoji: def.emoji,
    name: def.name ?? def.emoji,
    tags: [...def.tags],
  }))
  return shuffle(tiles)
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
