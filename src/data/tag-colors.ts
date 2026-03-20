/**
 * Generates consistent, semantically-tinted colors for tags.
 * Includes contrast detection for readable text.
 */

const cache = new Map<string, { bg: string; text: 'white' | 'black' }>()

// Semantic color hints — tags matching these get tinted toward the right hue
const SEMANTIC_HUES: [RegExp, number][] = [
  [/red|fire|hot|warm|anger|danger/, 0],
  [/orange|autumn|fall|sunset/, 25],
  [/yellow|gold|sun|bright|light|electric/, 50],
  [/green|nature|plant|garden|leaf|forest|eco/, 120],
  [/teal|ocean|aqua/, 170],
  [/blue|water|sky|ice|cold|cool|sea/, 210],
  [/purple|magic|fantasy|royal|mystic/, 270],
  [/pink|love|romantic|heart|valentine/, 330],
  [/brown|wood|earth|dirt|rustic/, 30],
  [/white|snow|clean|pure/, 0],
  [/black|dark|night|shadow|death/, 0],
  [/gray|grey|metal|steel|silver/, 0],
]

function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function getSemanticHue(tag: string): number | null {
  for (const [pattern, hue] of SEMANTIC_HUES) {
    if (pattern.test(tag)) return hue
  }
  return null
}

/** Get relative luminance for contrast calculation */
function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/** Convert HSL to RGB */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100; l /= 100
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
  }
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

export function getTagColor(tag: string): { bg: string; text: 'white' | 'black' } {
  if (cache.has(tag)) return cache.get(tag)!

  const semantic = getSemanticHue(tag)
  const h = semantic ?? (hashCode(tag) % 360)
  const s = tag.match(/white|snow|clean/) ? 10 :
            tag.match(/black|dark|shadow/) ? 10 :
            tag.match(/gray|grey|metal/) ? 15 :
            50 + (hashCode(tag + 'sat') % 30)
  const l = tag.match(/black|dark|shadow|death/) ? 25 :
            tag.match(/white|snow|clean|bright/) ? 85 :
            45 + (hashCode(tag + 'lit') % 20)

  const bg = `hsl(${h}, ${s}%, ${l}%)`
  const [r, g, b] = hslToRgb(h, s, l)
  const lum = luminance(r, g, b)
  const text = lum > 0.35 ? 'black' as const : 'white' as const

  const result = { bg, text }
  cache.set(tag, result)
  return result
}
