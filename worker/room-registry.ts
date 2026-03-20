/**
 * RoomRegistry Durable Object — tracks active game rooms.
 * A single global instance maintains the list of all rooms.
 */

export interface RoomInfo {
  code: string
  players: string[] // human player names
  playerCount: number
  gameStarted: boolean
  createdAt: number
}

export class RoomRegistry implements DurableObject {
  private rooms: Map<string, RoomInfo> = new Map()
  private ctx: DurableObjectState

  constructor(ctx: DurableObjectState, _env: unknown) {
    this.ctx = ctx
    // Load from storage on init
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<Record<string, RoomInfo>>('rooms')
      if (stored) {
        this.rooms = new Map(Object.entries(stored))
      }
      // Clean up rooms older than 1 hour
      const now = Date.now()
      for (const [code, room] of this.rooms) {
        if (now - room.createdAt > 3600_000) {
          this.rooms.delete(code)
        }
      }
    })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/list') {
      // Return all joinable rooms (not started, not full)
      const rooms = [...this.rooms.values()]
        .filter(r => !r.gameStarted && r.playerCount < 4)
        .sort((a, b) => b.createdAt - a.createdAt)
      return Response.json(rooms)
    }

    if (request.method === 'POST' && url.pathname === '/register') {
      const info = await request.json() as RoomInfo
      this.rooms.set(info.code, info)
      await this.persist()
      return new Response('OK')
    }

    if (request.method === 'POST' && url.pathname === '/update') {
      const info = await request.json() as RoomInfo
      if (this.rooms.has(info.code)) {
        this.rooms.set(info.code, info)
        await this.persist()
      }
      return new Response('OK')
    }

    if (request.method === 'POST' && url.pathname === '/remove') {
      const { code } = await request.json() as { code: string }
      this.rooms.delete(code)
      await this.persist()
      return new Response('OK')
    }

    return new Response('Not Found', { status: 404 })
  }

  private async persist() {
    await this.ctx.storage.put('rooms', Object.fromEntries(this.rooms))
  }
}
