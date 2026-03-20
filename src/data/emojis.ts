import type { TileDef } from '../types'
import unicodeData from './unicode-emoji-data.json'
import enrichedTags from './enriched-tags-merged.json'

const GENERIC_KEYWORDS = new Set([
  'face', 'eyes', 'mouth', 'open', 'not', 'no', 'button', 'smiling',
  'grin', 'grinning', 'teeth', 'geometric', 'square', 'circle',
  'diamond', 'triangle', 'alphanum', 'word', 'symbol', 'ornithology',
  'sign', 'punctuation', 'mark', '143', 'ily',
])

function cleanKeywords(keywords: string[]): string[] {
  return keywords
    .map((k) => k.toLowerCase().trim())
    .filter((k) => k.length > 1 && !GENERIC_KEYWORDS.has(k))
}

const enrichedMap = enrichedTags as Record<string, string[]>

/** All game-eligible emojis with enriched LLM tags merged with CLDR tags */
export const ALL_EMOJI_DEFS: TileDef[] = (unicodeData as any[])
  .map((entry) => {
    const cldrTags = cleanKeywords(entry.keywords ?? [])
    const llmTags = (enrichedMap[entry.emoji] ?? []).map((t: string) => t.toLowerCase().trim())
    // Merge and dedupe
    const allTags = [...new Set([...llmTags, ...cldrTags])]
    return {
      emoji: entry.emoji as string,
      category: entry.group as TileDef['category'],
      tags: allTags,
      name: entry.name as string,
      group: entry.group as string,
      subgroup: entry.subgroup as string,
    }
  })
  .filter((def) => def.tags.length >= 2)

/** One copy of each emoji — every tile is unique */
export const COPIES_PER_TILE = 1

/** Hand size: deal 11, draw to 12, win at 12 (4 triplets) */
export const HAND_SIZE = 11
export const WIN_SIZE = 12
export const TRIPLETS_TO_WIN = 4
export const POOL_SIZE = 80
export const MARKET_SIZE = 5
