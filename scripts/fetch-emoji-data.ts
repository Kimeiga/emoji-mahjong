/**
 * Fetches emoji data from Unicode CLDR and emoji-test.txt,
 * merges categories + keywords, and writes a processed JSON file.
 *
 * Sources:
 * 1. emoji-test.txt → group/subgroup per emoji
 * 2. CLDR annotations → keywords (tags) per emoji
 * 3. CLDR annotationsDerived → additional derived annotations
 */

import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const EMOJI_TEST_URL = 'https://unicode.org/Public/emoji/15.1/emoji-test.txt'
const CLDR_ANNOTATIONS_URL = 'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-annotations-full/annotations/en/annotations.json'
const CLDR_DERIVED_URL = 'https://raw.githubusercontent.com/unicode-org/cldr-json/main/cldr-json/cldr-annotations-derived-full/annotationsDerived/en/annotations.json'

interface EmojiEntry {
  emoji: string
  name: string
  group: string
  subgroup: string
  keywords: string[]
  status: string
}

// ---- Step 1: Parse emoji-test.txt for groups/subgroups ----
async function parseEmojiTest(): Promise<Map<string, { name: string; group: string; subgroup: string }>> {
  console.log('Fetching emoji-test.txt...')
  const resp = await fetch(EMOJI_TEST_URL)
  const text = await resp.text()

  const map = new Map<string, { name: string; group: string; subgroup: string }>()
  let currentGroup = ''
  let currentSubgroup = ''

  for (const line of text.split('\n')) {
    if (line.startsWith('# group:')) {
      currentGroup = line.replace('# group:', '').trim()
      continue
    }
    if (line.startsWith('# subgroup:')) {
      currentSubgroup = line.replace('# subgroup:', '').trim()
      continue
    }
    if (line.startsWith('#') || line.trim() === '') continue

    // Format: codepoints ; status # emoji E version name
    const match = line.match(/^(.+?)\s*;\s*([\w-]+)\s*#\s*(\S+)\s+E[\d.]+\s+(.+)$/)
    if (!match) continue

    const [, , status, emoji, name] = match
    if (status !== 'fully-qualified') continue

    map.set(emoji, { name: name.trim(), group: currentGroup, subgroup: currentSubgroup })
  }

  console.log(`  Parsed ${map.size} fully-qualified emojis`)
  return map
}

// ---- Step 2: Fetch CLDR annotations for keywords ----
async function fetchAnnotations(): Promise<Map<string, string[]>> {
  console.log('Fetching CLDR annotations...')
  const map = new Map<string, string[]>()

  for (const url of [CLDR_ANNOTATIONS_URL, CLDR_DERIVED_URL]) {
    try {
      const resp = await fetch(url)
      const json = await resp.json() as any
      const annotations = json?.annotations?.annotations ?? {}

      for (const [emoji, data] of Object.entries(annotations) as [string, any][]) {
        if (data.default) {
          const existing = map.get(emoji) || []
          const newKeywords = data.default.filter((k: string) => !existing.includes(k))
          map.set(emoji, [...existing, ...newKeywords])
        }
      }
    } catch (e) {
      console.warn(`  Warning: failed to fetch ${url}:`, e)
    }
  }

  console.log(`  Got annotations for ${map.size} emojis`)
  return map
}

// ---- Step 3: Merge and filter ----
async function main() {
  const emojiTest = await parseEmojiTest()
  const annotations = await fetchAnnotations()

  // Groups we want for the game (skip people, flags, skin-tone variants)
  const WANTED_GROUPS = new Set([
    'Smileys & Emotion',
    'Animals & Nature',
    'Food & Drink',
    'Travel & Places',
    'Activities',
    'Objects',
    'Symbols',
  ])

  const entries: EmojiEntry[] = []

  for (const [emoji, info] of emojiTest) {
    if (!WANTED_GROUPS.has(info.group)) continue

    // Skip skin tone variants and ZWJ sequences (keep simple emojis)
    if (emoji.includes('\u200D')) continue // ZWJ
    if (/[\u{1F3FB}-\u{1F3FF}]/u.test(emoji)) continue // skin tones

    const keywords = annotations.get(emoji) || []

    entries.push({
      emoji,
      name: info.name,
      group: info.group,
      subgroup: info.subgroup,
      keywords,
      status: 'fully-qualified',
    })
  }

  console.log(`\nFiltered to ${entries.length} game-eligible emojis`)

  // Print group distribution
  const groupCounts = new Map<string, number>()
  for (const e of entries) {
    groupCounts.set(e.group, (groupCounts.get(e.group) || 0) + 1)
  }
  for (const [group, count] of groupCounts) {
    console.log(`  ${group}: ${count}`)
  }

  // Print subgroup distribution
  const subgroupCounts = new Map<string, number>()
  for (const e of entries) {
    subgroupCounts.set(e.subgroup, (subgroupCounts.get(e.subgroup) || 0) + 1)
  }
  console.log(`\nSubgroups (${subgroupCounts.size} total):`)
  for (const [sg, count] of [...subgroupCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) {
    console.log(`  ${sg}: ${count}`)
  }

  // Collect all keywords
  const allKeywords = new Map<string, number>()
  for (const e of entries) {
    for (const kw of e.keywords) {
      allKeywords.set(kw, (allKeywords.get(kw) || 0) + 1)
    }
  }
  console.log(`\nTop 50 keywords:`)
  const topKeywords = [...allKeywords.entries()].sort((a, b) => b[1] - a[1]).slice(0, 50)
  for (const [kw, count] of topKeywords) {
    console.log(`  "${kw}": ${count} emojis`)
  }

  // Write full dataset
  const outPath = resolve(__dirname, '..', 'src', 'data', 'unicode-emoji-data.json')
  writeFileSync(outPath, JSON.stringify(entries, null, 2))
  console.log(`\nWrote ${entries.length} entries to ${outPath}`)
}

main().catch(console.error)
