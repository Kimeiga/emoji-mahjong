import type { ClientMessage } from './protocol'

/** TypeScript types do not validate untrusted WebSocket payloads. */
export function parseClientMessage(raw: string | ArrayBuffer): ClientMessage | null {
  if (typeof raw !== 'string' || raw.length > 8192) return null
  let v: Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    v = parsed as Record<string, unknown>
  } catch { return null }
  switch (v.type) {
    case 'join': {
      if (typeof v.playerName !== 'string') return null
      const playerName = v.playerName.trim()
      if (!playerName || playerName.length > 16 || [...playerName].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) return null
      if (v.resumeToken !== undefined && (typeof v.resumeToken !== 'string' || v.resumeToken.length > 128)) return null
      return { type: 'join', playerName, resumeToken: v.resumeToken as string | undefined }
    }
    case 'set-ai-difficulty':
      return v.difficulty === 'easy' || v.difficulty === 'medium' || v.difficulty === 'hard'
        ? { type: v.type, difficulty: v.difficulty } : null
    case 'discard':
    case 'pick-market':
      return typeof v.tileId === 'string' && v.tileId.length > 0 && v.tileId.length <= 100
        ? { type: v.type, tileId: v.tileId } : null
    case 'decline-pon':
      return v.tileId === undefined || (typeof v.tileId === 'string' && v.tileId.length <= 100)
        ? { type: v.type, tileId: v.tileId as string | undefined } : null
    case 'start':
    case 'call-pon':
    case 'declare-riichi':
    case 'draw-blind':
    case 'rematch':
    case 'leave':
      return { type: v.type }
    default: return null
  }
}
