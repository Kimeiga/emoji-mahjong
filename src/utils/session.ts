const STORAGE_KEY = 'emoji-mahjong-session'
export interface Session {
  roomCode: string
  playerName: string
  myPlayerId: number
  resumeToken?: string
}
let memorySession: Session | null = null

export function saveSession(s: Session): void {
  memorySession = s
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)) } catch { /* private/storage-disabled browser */ }
}
export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return memorySession
    const p: unknown = JSON.parse(raw)
    if (!p || typeof p !== 'object') return null
    const s = p as Partial<Session>
    if (typeof s.roomCode === 'string' && /^[A-Z0-9]{6}$/.test(s.roomCode)
      && typeof s.playerName === 'string' && typeof s.myPlayerId === 'number'
      && Number.isInteger(s.myPlayerId) && s.myPlayerId >= 0 && s.myPlayerId <= 3
      && (s.resumeToken === undefined || typeof s.resumeToken === 'string')) return s as Session
    return null
  } catch { return memorySession }
}
export function clearSession(): void {
  memorySession = null
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* memory fallback */ }
}
