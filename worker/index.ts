/**
 * Cloudflare Worker entry point for emoji-mahjong.
 *
 * Routes:
 *   POST /api/rooms         → create a room, return { code }
 *   GET  /api/rooms/:code/ws → WebSocket upgrade → GameRoom DO
 *   Everything else          → static assets (handled by wrangler [assets])
 */

export { GameRoom } from './game-room'

interface Env {
  GAME_ROOM: DurableObjectNamespace
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I,O,0,1
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // POST /api/rooms — create a new room
    if (request.method === 'POST' && url.pathname === '/api/rooms') {
      const code = generateRoomCode()
      return Response.json({ code }, { status: 201 })
    }

    // GET /api/rooms/:code/ws — WebSocket upgrade to GameRoom DO
    const wsMatch = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{6})\/ws$/)
    if (wsMatch) {
      const roomCode = wsMatch[1]
      const upgradeHeader = request.headers.get('Upgrade')
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
        return new Response('Expected WebSocket upgrade', { status: 426 })
      }

      const id = env.GAME_ROOM.idFromName(roomCode)
      const stub = env.GAME_ROOM.get(id)
      return stub.fetch(request)
    }

    // Everything else falls through to static asset serving via wrangler [assets]
    return new Response('Not Found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
