import type { Tile } from '../types'
import type { AIDifficulty } from '../multiplayer/protocol'
import { canDeclareRiichi, getRiichiDiscards, getWaitingTags } from './sets'

/**
 * AI discard strategy by difficulty:
 * - easy: random discard
 * - medium: discard least connected tile
 * - hard: medium + considers pairs and near-triplets
 */
export function calculateAIDiscard(hand: Tile[], difficulty: AIDifficulty = 'medium'): Tile {
  if (difficulty === 'easy') {
    return hand[Math.floor(Math.random() * hand.length)]
  }

  // Count tag frequency across entire hand
  const tagFreq = new Map<string, number>()
  for (const tile of hand) {
    for (const tag of tile.tags) {
      tagFreq.set(tag, (tagFreq.get(tag) || 0) + 1)
    }
  }

  // Score each tile = sum of frequencies of its tags
  let worstTile = hand[0]
  let worstScore = Infinity

  for (const tile of hand) {
    let score = tile.tags.reduce((sum, tag) => sum + (tagFreq.get(tag) || 0), 0)

    // Hard: bonus for tiles in pairs/near-triplets
    if (difficulty === 'hard') {
      const maxTagCount = Math.max(...tile.tags.map(tag => tagFreq.get(tag) || 0))
      if (maxTagCount >= 3) score += 10  // part of a triplet
      else if (maxTagCount >= 2) score += 3 // part of a pair
    }

    if (score < worstScore) {
      worstScore = score
      worstTile = tile
    }
  }

  return worstTile
}

/**
 * AI pon decision by difficulty:
 * - easy: 30% chance
 * - medium: 60% chance
 * - hard: 90% chance
 */
export function shouldAICallPon(difficulty: AIDifficulty = 'medium'): boolean {
  const rates = { easy: 0.3, medium: 0.6, hard: 0.9 }
  return Math.random() < rates[difficulty]
}

/**
 * AI riichi decision by difficulty:
 * - easy: 30% chance
 * - medium: 60% chance
 * - hard: 90% chance
 */
export function shouldAIDeclareRiichi(hand: Tile[], difficulty: AIDifficulty = 'medium'): boolean {
  const rates = { easy: 0.3, medium: 0.6, hard: 0.9 }
  return canDeclareRiichi(hand) && Math.random() < rates[difficulty]
}

/**
 * AI decides whether to pick from the market or draw blind.
 * Returns the market tile to pick, or null for blind draw.
 */
export function calculateAIMarketPick(
  hand: Tile[],
  market: Tile[],
  difficulty: AIDifficulty = 'medium',
  tagCounts?: Record<string, number>
): Tile | null {
  if (market.length === 0) return null

  // Score each market tile by tag overlap with hand
  const handTagFreq = new Map<string, number>()
  for (const tile of hand) {
    for (const tag of tile.tags) {
      handTagFreq.set(tag, (handTagFreq.get(tag) || 0) + 1)
    }
  }

  let bestTile: Tile | null = null
  let bestScore = 0

  for (const tile of market) {
    let score = 0
    for (const tag of tile.tags) {
      const freq = handTagFreq.get(tag) || 0
      score += freq
      // Bonus for completing a triplet (tag already has 2+ in hand)
      if (freq >= 2) score += 5
      // Hard difficulty: bonus for rare tags (higher scoring potential)
      if (difficulty === 'hard' && tagCounts && freq >= 1) {
        const rarity = 80 / (tagCounts[tag] || 80)
        score += rarity * 0.5
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestTile = tile
    }
  }

  const thresholds = { easy: 999, medium: 3, hard: 1 }

  if (bestScore >= thresholds[difficulty] && bestTile) {
    return bestTile
  }

  return null
}

/**
 * Pick the best riichi discard: the one that maximizes waiting tags.
 */
export function calculateRiichiDiscard(hand: Tile[]): Tile {
  const discards = getRiichiDiscards(hand)
  if (discards.length === 0) return hand[0]

  let best = discards[0]
  let bestWaits = 0
  for (const tile of discards) {
    const remaining = hand.filter(t => t !== tile)
    const waits = getWaitingTags(remaining).length
    if (waits > bestWaits) {
      bestWaits = waits
      best = tile
    }
  }
  return best
}
