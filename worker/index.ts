/**
 * Cloudflare Worker entry point for emoji-mahjong.
 *
 * Routes:
 *   GET  /api/rooms           → list joinable rooms
 *   POST /api/rooms           → create a room, return { code }
 *   GET  /api/rooms/:code/ws  → WebSocket upgrade → GameRoom DO
 *   Everything else           → static assets (handled by wrangler [assets])
 */

export { GameRoom } from './game-room'
export { RoomRegistry } from './room-registry'

interface Env {
  GAME_ROOM: DurableObjectNamespace
  ROOM_REGISTRY: DurableObjectNamespace
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no I,O,0,1
  let code = ''
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

function getRegistry(env: Env) {
  const id = env.ROOM_REGISTRY.idFromName('global')
  return env.ROOM_REGISTRY.get(id)
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // GET /api/rooms — list joinable rooms
    if (request.method === 'GET' && url.pathname === '/api/rooms') {
      const registry = getRegistry(env)
      const res = await registry.fetch(new Request('http://internal/list'))
      const rooms = await res.json()
      return Response.json(rooms, { headers: corsHeaders })
    }

    // POST /api/rooms — create a new room
    if (request.method === 'POST' && url.pathname === '/api/rooms') {
      const code = generateRoomCode()

      // Register in the room registry
      const registry = getRegistry(env)
      await registry.fetch(new Request('http://internal/register', {
        method: 'POST',
        body: JSON.stringify({
          code,
          players: [],
          playerCount: 0,
          gameStarted: false,
          createdAt: Date.now(),
        }),
      }))

      return Response.json({ code }, { status: 201, headers: corsHeaders })
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
