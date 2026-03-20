/**
 * Selects ~36 emojis optimized for Semantic Mahjong gameplay.
 *
 * Key constraint: every tag used by a selected emoji must appear on
 * at least 3 selected emojis (otherwise you can't form a triplet with it).
 *
 * Strategy:
 * 1. Find tags that appear on many emojis globally (high connectivity)
 * 2. Select emojis that share these high-connectivity tags
 * 3. Ensure group diversity for visual variety
 * 4. Prune tags that ended up on <3 selected tiles
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataPath = resolve(__dirname, '..', 'src', 'data', 'unicode-emoji-data.json')

interface RawEmoji {
  emoji: string
  name: string
  group: string
  subgroup: string
  keywords: string[]
}

interface GameTile {
  emoji: string
  name: string
  group: string
  subgroup: string
  tags: string[]
}

const raw: RawEmoji[] = JSON.parse(readFileSync(dataPath, 'utf-8'))

// Skip overly generic or meta keywords
const SKIP_KEYWORDS = new Set([
  'face', 'eyes', 'eye', 'mouth', 'open', 'not', 'no', 'button',
  'smiling', 'grin', 'grinning', 'teeth', 'geometric', 'square',
  'circle', 'diamond', 'triangle', 'alphanum', 'word', 'symbol',
  'ornithology', 'sign', 'punctuation', 'mark', '143', 'ily',
])

// Skip groups that don't work well as game tiles
const SKIP_GROUPS = new Set(['Component'])

// Subgroups to skip (clocks, arrows, keycaps — too similar visually)
const SKIP_SUBGROUPS = new Set([
  'time', 'arrow', 'alphanum', 'keycap', 'av-symbol',
  'zodiac', 'geometric', 'math',
])

const cleaned = raw
  .filter(e => !SKIP_GROUPS.has(e.group))
  .filter(e => !SKIP_SUBGROUPS.has(e.subgroup))
  .map(e => ({
    ...e,
    tags: e.keywords
      .filter(k => !SKIP_KEYWORDS.has(k) && k.length > 1)
      .map(k => k.toLowerCase()),
  }))
  .filter(e => e.tags.length >= 2)

// Global tag frequency
const globalTagFreq = new Map<string, number>()
for (const e of cleaned) {
  for (const t of e.tags) {
    globalTagFreq.set(t, (globalTagFreq.get(t) || 0) + 1)
  }
}

// Good tags: appear on 4-40 emojis (enough for triplets, not too diluted)
const goodTags = new Set(
  [...globalTagFreq.entries()]
    .filter(([, c]) => c >= 4 && c <= 40)
    .map(([t]) => t)
)

console.log(`Good tags (4-40 frequency): ${goodTags.size}`)

// Score each emoji by good-tag count
const candidates = cleaned
  .map(e => ({
    ...e,
    goodTags: e.tags.filter(t => goodTags.has(t)),
  }))
  .filter(e => e.goodTags.length >= 2)
  .sort((a, b) => b.goodTags.length - a.goodTags.length)

console.log(`Candidates with 2+ good tags: ${candidates.length}`)

// ---- Iterative selection ----
const TARGET = 36
const selected: typeof candidates = []
const usedEmojis = new Set<string>() // prevent duplicate emoji chars
const tagCount = new Map<string, number>() // tag → count in selected

function addEmoji(e: typeof candidates[0]) {
  selected.push(e)
  usedEmojis.add(e.emoji)
  for (const t of e.goodTags) {
    tagCount.set(t, (tagCount.get(t) || 0) + 1)
  }
}

// Seed: one high-connectivity emoji from each group
const groups = [...new Set(candidates.map(c => c.group))]
for (const group of groups) {
  const best = candidates.find(c => c.group === group && !usedEmojis.has(c.emoji))
  if (best) addEmoji(best)
}

// Fill: pick emoji that maximizes "tags reaching count 3"
while (selected.length < TARGET) {
  const remaining = candidates.filter(c => !usedEmojis.has(c.emoji))
  if (remaining.length === 0) break

  let bestScore = -Infinity
  let bestCandidate = remaining[0]

  for (const c of remaining) {
    let score = 0
    for (const t of c.goodTags) {
      const current = tagCount.get(t) || 0
      if (current === 2) score += 10      // would complete a triplet tag!
      else if (current === 1) score += 3   // building toward triplet
      else if (current === 0) score += 1   // new tag
      else score += 0.5                    // already viable, adds depth
    }
    // Group diversity bonus
    const groupSize = selected.filter(s => s.group === c.group).length
    score -= groupSize * 1.5
    // Subgroup diversity bonus
    const subgroupSize = selected.filter(s => s.subgroup === c.subgroup).length
    score -= subgroupSize * 3

    if (score > bestScore) {
      bestScore = score
      bestCandidate = c
    }
  }

  addEmoji(bestCandidate)
}

// Prune tags that appear on <3 selected tiles (not useful for gameplay)
const finalTiles: GameTile[] = selected.map(e => ({
  emoji: e.emoji,
  name: e.name,
  group: e.group,
  subgroup: e.subgroup,
  tags: e.goodTags.filter(t => (tagCount.get(t) || 0) >= 3).slice(0, 5),
}))

// Remove any tile that ended up with 0 viable tags (shouldn't happen but safety)
const viableTiles = finalTiles.filter(t => t.tags.length >= 1)

console.log(`\n=== Selected ${viableTiles.length} game tiles ===\n`)

for (const group of groups) {
  const gt = viableTiles.filter(t => t.group === group)
  if (gt.length === 0) continue
  console.log(`${group} (${gt.length}):`)
  for (const t of gt) {
    console.log(`  ${t.emoji}  ${t.name.padEnd(30)} [${t.tags.join(', ')}]`)
  }
}

// Tag viability report
const finalTagFreq = new Map<string, number>()
for (const t of viableTiles) {
  for (const tag of t.tags) {
    finalTagFreq.set(tag, (finalTagFreq.get(tag) || 0) + 1)
  }
}
const viableTagCount = [...finalTagFreq.values()].filter(c => c >= 3).length
const totalTags = finalTagFreq.size
console.log(`\nTag stats: ${viableTagCount}/${totalTags} tags appear on 3+ tiles`)
console.log(`\nAll tags:`)
for (const [tag, count] of [...finalTagFreq.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count >= 3 ? '✓' : '⚠'} ${tag}: ${count}`)
}

const outPath = resolve(__dirname, '..', 'src', 'data', 'game-tiles.json')
writeFileSync(outPath, JSON.stringify(viableTiles, null, 2))
console.log(`\nWrote ${viableTiles.length} tiles to ${outPath}`)
