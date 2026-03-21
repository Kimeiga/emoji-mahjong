import type { Tile } from '../types'
import { HAND_SIZE, WIN_SIZE, TRIPLETS_TO_WIN } from '../data/emojis'

/**
 * Check if 3 tiles form a valid triplet: they must share at least one common tag.
 * All three must be DIFFERENT emojis (no duplicates in a unique-tile game).
 */
export function isValidTriplet(a: Tile, b: Tile, c: Tile): boolean {
  return a.tags.some(tag => b.tags.includes(tag) && c.tags.includes(tag))
}

/**
 * Check if hand is a winning hand: 4 triplets of 3 semantically related tiles = 12 tiles.
 * Each triplet must use a UNIQUE tag (no two sets can share the same tag).
 * Uses backtracking. With 12 tiles this is very fast.
 */
export function isWinningHand(hand: Tile[]): boolean {
  if (hand.length !== WIN_SIZE) return false
  return canFormTriplets(hand, TRIPLETS_TO_WIN)
}

/** Check if tiles can be fully decomposed into N valid triplets with unique tags */
export function canFormTriplets(tiles: Tile[], needed: number, usedTags: Set<string> = new Set()): boolean {
  if (needed === 0) return tiles.length === 0
  if (tiles.length < 3) return false

  const first = tiles[0]
  const rest = tiles.slice(1)

  // Try pairing first tile with every combination of 2 from rest
  for (let i = 0; i < rest.length; i++) {
    for (let j = i + 1; j < rest.length; j++) {
      // Find shared tags that haven't been used yet
      const sharedTags = first.tags.filter(tag =>
        rest[i].tags.includes(tag) && rest[j].tags.includes(tag) && !usedTags.has(tag)
      )
      if (sharedTags.length > 0) {
        const remaining = rest.filter((_, idx) => idx !== i && idx !== j)
        // Try each available shared tag
        for (const tag of sharedTags) {
          const newUsed = new Set(usedTags)
          newUsed.add(tag)
          if (canFormTriplets(remaining, needed - 1, newUsed)) return true
        }
      }
    }
  }
  return false
}

/** Sort tiles by primary tag for visual grouping */
export function sortByTag(tiles: Tile[]): Tile[] {
  return [...tiles].sort((a, b) => {
    const tagA = a.tags[0] || ''
    const tagB = b.tags[0] || ''
    if (tagA !== tagB) return tagA.localeCompare(tagB)
    return a.emoji.localeCompare(b.emoji)
  })
}

/** Find all shared tags between tiles */
export function findSharedTags(tiles: Tile[]): string[] {
  if (tiles.length === 0) return []
  let shared = [...tiles[0].tags]
  for (let i = 1; i < tiles.length; i++) {
    shared = shared.filter(tag => tiles[i].tags.includes(tag))
  }
  return shared
}

/**
 * Check if an 11-tile hand is tenpai (one tile from winning).
 * Tenpai = 3 triplets can be formed, remaining 2 tiles share a tag.
 */
export function isTenpai(hand: Tile[]): boolean {
  if (hand.length !== HAND_SIZE) return false
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      // The pair needs a shared tag that's not used by any of the 3 triplets
      const pairSharedTags = hand[i].tags.filter(tag => hand[j].tags.includes(tag))
      if (pairSharedTags.length === 0) continue
      const remaining = hand.filter((_, idx) => idx !== i && idx !== j)
      // Try forming 3 triplets, then check if pair's tag is still available
      for (const pairTag of pairSharedTags) {
        const usedTags = new Set([pairTag])
        if (canFormTriplets(remaining, TRIPLETS_TO_WIN - 1, usedTags)) return true
      }
    }
  }
  return false
}

/**
 * Get all tags that would complete the win for a tenpai hand.
 * These are the shared tags between the "waiting pair" tiles.
 */
export function getWaitingTags(hand: Tile[]): string[] {
  if (hand.length !== HAND_SIZE) return []
  const tags = new Set<string>()
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const shared = hand[i].tags.filter(tag => hand[j].tags.includes(tag))
      for (const pairTag of shared) {
        const remaining = hand.filter((_, idx) => idx !== i && idx !== j)
        const usedTags = new Set([pairTag])
        if (canFormTriplets(remaining, TRIPLETS_TO_WIN - 1, usedTags)) {
          tags.add(pairTag)
        }
      }
    }
  }
  return [...tags]
}

/**
 * Check if a player with 12 tiles can declare riichi:
 * at least one discard must leave a tenpai hand.
 */
export function canDeclareRiichi(hand: Tile[]): boolean {
  if (hand.length !== WIN_SIZE) return false
  for (const tile of hand) {
    const remaining = hand.filter(t => t !== tile)
    if (isTenpai(remaining)) return true
  }
  return false
}

/**
 * Find which discards leave the hand tenpai.
 * Returns tiles that are valid riichi discards.
 */
export function getRiichiDiscards(hand: Tile[]): Tile[] {
  if (hand.length !== WIN_SIZE) return []
  const result: Tile[] = []
  for (const tile of hand) {
    const remaining = hand.filter(t => t !== tile)
    if (isTenpai(remaining)) result.push(tile)
  }
  return result
}
