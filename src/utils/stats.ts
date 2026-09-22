const STORAGE_KEY = 'emoji-mahjong-stats'

interface GameStats {
  wins: number
  losses: number
  draws: number
  gamesPlayed: number
}
const emptyStats: GameStats = { wins: 0, losses: 0, draws: 0, gamesPlayed: 0 }
let memorySnapshot = JSON.stringify(emptyStats)
let storageUnavailable = false
const listeners = new Set<() => void>()

/** A stable primitive snapshot lets React observe same-tab result updates. */
export function getStatsSnapshot(): string {
  if (!storageUnavailable) {
    try { return localStorage.getItem(STORAGE_KEY) ?? memorySnapshot }
    catch { storageUnavailable = true }
  }
  return memorySnapshot
}

function parse(raw: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw)
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown> : {}
  } catch { return {} }
}

export function getStats(raw = getStatsSnapshot()): GameStats {
  const value = parse(raw)
  const count = (key: keyof GameStats) => {
    const n = value[key]
    return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : 0
  }
  return { wins: count('wins'), losses: count('losses'), draws: count('draws'), gamesPlayed: count('gamesPlayed') }
}

export function subscribeStats(listener: () => void): () => void {
  listeners.add(listener)
  if (typeof window !== 'undefined') window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    if (typeof window !== 'undefined') window.removeEventListener('storage', listener)
  }
}

/** Persist counters and recent result IDs together so reloads cannot double-count. */
export function recordResult(result: 'win' | 'loss' | 'draw', gameId: string): void {
  const raw = getStatsSnapshot()
  const previous = parse(raw)
  const ids = Array.isArray(previous.recordedGames)
    ? previous.recordedGames.filter((id): id is string => typeof id === 'string') : []
  if (ids.includes(gameId)) return
  const stats = getStats(raw)
  stats.gamesPlayed++
  if (result === 'win') stats.wins++
  else if (result === 'loss') stats.losses++
  else stats.draws++
  memorySnapshot = JSON.stringify({ ...stats, recordedGames: [...ids.slice(-511), gameId] })
  if (!storageUnavailable) {
    try { localStorage.setItem(STORAGE_KEY, memorySnapshot) }
    catch { storageUnavailable = true }
  }
  for (const listener of listeners) listener()
}
