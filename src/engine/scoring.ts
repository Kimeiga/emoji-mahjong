import type { TripletGroup } from './triplet-display'
import { POOL_SIZE } from '../data/emojis'

/**
 * Score a single set based on tag rarity.
 * Rarer tags score more: score = POOL_SIZE / tagCount
 * A set with tag "red" (14 tiles in pool) scores 80/14 ≈ 5.7
 * A set with tag "bioluminescent" (2 tiles) scores 80/2 = 40
 */
export function scoreSet(tag: string, tagCounts: Record<string, number>): number {
  const count = tagCounts[tag] || POOL_SIZE
  return Math.round(POOL_SIZE / count)
}

/**
 * Score all sets for a player. Returns per-set scores and total.
 */
export function scoreSets(
  sets: TripletGroup[],
  tagCounts: Record<string, number>
): { setScores: { tag: string; score: number }[]; total: number } {
  const setScores = sets.map(s => ({
    tag: s.tag,
    score: scoreSet(s.tag, tagCounts),
  }))
  const total = setScores.reduce((sum, s) => sum + s.score, 0)
  return { setScores, total }
}

/**
 * Score a revealed set (from pon). Uses the same rarity formula.
 */
export function scoreRevealedSet(tag: string, tagCounts: Record<string, number>): number {
  return scoreSet(tag, tagCounts)
}

/**
 * Get a tag's rarity label for display.
 */
export function getTagRarity(tag: string, tagCounts: Record<string, number>): 'common' | 'uncommon' | 'rare' | 'epic' {
  const count = tagCounts[tag] || POOL_SIZE
  if (count >= 10) return 'common'
  if (count >= 5) return 'uncommon'
  if (count >= 3) return 'rare'
  return 'epic'
}
