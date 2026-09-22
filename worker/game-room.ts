/**
 * GameRoom Durable Object — manages a single multiplayer game room.
 *
 * Each room supports up to 4 human players. Empty slots are filled with AI
 * when the game starts. The GameRunner engine runs inside the DO.
 */

import { GameRunner } from '../src/engine/game-runner'
import type { GameRunnerState } from '../src/engine/game-runner'
import { shouldAICallPon } from '../src/engine/ai'
import type {
  AIDifficulty,
  ServerMessage,
  LobbyPlayer,
  GameStateView,
} from '../src/multiplayer/protocol'
import { parseClientMessage } from '../src/multiplayer/validation'
import type { PlayerId } from '../src/types'

interface PlayerInfo {
  playerId: PlayerId
  name: string
}

interface Env {
  ROOM_REGISTRY: DurableObjectNamespace
}

export class GameRoom implements DurableObject {
  private players: Map<WebSocket, PlayerInfo> = new Map()
  private runner: GameRunner | null = null
  private roomCode = ''
  private aiDifficulty: AIDifficulty = 'medium'
  private lobbyPlayers: LobbyPlayer[] = []
  private gameStarted = false
  private gameStartedAt = 0
  private expiresAt = 0
  private seatTokens: Record<number, string> = {}
  private queue: Promise<void> = Promise.resolve()
  private outbox: { ws: WebSocket; msg: ServerMessage }[] | null = null
  private rematchVotes: Set<PlayerId> = new Set()
  private aiTimer: ReturnType<typeof setTimeout> | null = null
  private ctx: DurableObjectState
  private env: Env

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx
    this.env = env

    this.ctx.blockConcurrencyWhile(async () => {
      const saved = await this.ctx.storage.get<{
        roomCode: string
        aiDifficulty: AIDifficulty
        lobbyPlayers: LobbyPlayer[]
        gameStarted: boolean
        gameStartedAt: number
        runnerState: GameRunnerState | null
        rematchVotes?: PlayerId[]
        seatTokens?: Record<number, string>
        expiresAt?: number
      }>('game-room-state')

      if (!saved) return
      this.roomCode = saved.roomCode
      this.aiDifficulty = saved.aiDifficulty
      this.lobbyPlayers = saved.lobbyPlayers.map(player => ({
        ...player,
        connected: false,
      }))
      this.gameStarted = saved.gameStarted
      this.gameStartedAt = saved.gameStartedAt
      this.expiresAt = saved.expiresAt || Date.now() + 30 * 60_000
      this.seatTokens = saved.seatTokens ?? {}
      this.rematchVotes = new Set(saved.rematchVotes ?? [])

      if (saved.gameStarted && saved.runnerState) {
        this.runner = new GameRunner({ aiDifficulty: saved.aiDifficulty })
        this.runner.restoreState({ ...saved.runnerState, gameStartTime: saved.gameStartedAt })
      }
      await this.persistState()
    })
  }

  // Serialize commands and acknowledge them only after their state is durable.
  private enqueue(work: () => void): void {
    this.queue = this.queue.then(async () => {
      this.outbox = []
      work()
      await this.persistState()
      const messages = this.outbox
      this.outbox = null
      for (const { ws, msg } of messages) this.send(ws, msg)
    }).catch((error: unknown) => {
      this.outbox = null
      console.error('[game-room] State transition failed', error)
      for (const ws of this.players.keys()) ws.close(1011, 'Please reconnect')
    })
    this.ctx.waitUntil(this.queue)
  }

  private async persistState(): Promise<void> {
    await this.ctx.storage.put('game-room-state', {
      version: 2,
      roomCode: this.roomCode,
      aiDifficulty: this.aiDifficulty,
      lobbyPlayers: structuredClone(this.lobbyPlayers),
      gameStarted: this.gameStarted,
      gameStartedAt: this.gameStartedAt,
      expiresAt: this.expiresAt,
      rematchVotes: [...this.rematchVotes],
      seatTokens: { ...this.seatTokens },
      runnerState: this.runner?.exportState() ?? null,
    })
    if (this.expiresAt) await this.ctx.storage.setAlarm(this.expiresAt)
    else await this.ctx.storage.deleteAlarm()
  }

  async alarm(): Promise<void> {
    this.enqueue(() => {
      if (!this.expiresAt || this.expiresAt > Date.now() || this.players.size) return
      this.runner = null
      this.gameStarted = false
      this.gameStartedAt = 0
      this.lobbyPlayers = []
      this.seatTokens = {}
      this.rematchVotes.clear()
      this.expiresAt = 0
      this.removeFromRegistry()
    })
    await this.queue
  }

  private async updateRegistry() {
    try {
      const registry = this.env.ROOM_REGISTRY.get(
        this.env.ROOM_REGISTRY.idFromName('global')
      )
      const humanPlayers = this.lobbyPlayers.filter(p => p.isHuman && p.connected)
      await registry.fetch(new Request('http://internal/register', {
        method: 'POST',
        body: JSON.stringify({
          code: this.roomCode,
          players: humanPlayers.map(p => p.name),
          playerCount: humanPlayers.length,
          gameStarted: this.gameStarted,
          createdAt: Date.now(),
        }),
      }))
    } catch {
      // Non-critical, ignore
    }
  }

  private async removeFromRegistry() {
    try {
      const registry = this.env.ROOM_REGISTRY.get(
        this.env.ROOM_REGISTRY.idFromName('global')
      )
      await registry.fetch(new Request('http://internal/remove', {
        method: 'POST',
        body: JSON.stringify({ code: this.roomCode }),
      }))
    } catch {
      // Non-critical
    }
  }

  async fetch(request: Request): Promise<Response> {
    // Extract room code from the URL
    const url = new URL(request.url)
    const match = url.pathname.match(/\/api\/rooms\/([A-Z0-9]{6})\/ws/)
    if (match) {
      this.roomCode = match[1]
    }

    const pair = new WebSocketPair()
    const [client, server] = [pair[0], pair[1]]

    server.accept()

    server.addEventListener('message', (event) => {
      this.enqueue(() => this.handleMessage(server, event.data))
    })

    server.addEventListener('close', () => {
      this.enqueue(() => this.handleDisconnect(server))
    })

    server.addEventListener('error', () => {
      this.enqueue(() => this.handleDisconnect(server))
    })

    return new Response(null, { status: 101, webSocket: client })
  }

  private handleMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const msg = parseClientMessage(raw)
    if (!msg) {
      this.send(ws, { type: 'error', message: 'Invalid message' })
      return
    }
    if (msg.type !== 'join' && !this.players.has(ws)) {
      this.send(ws, { type: 'error', message: 'Join the room before playing' })
      return
    }
    switch (msg.type) {
      case 'join':
        this.handleJoin(ws, msg.playerName, msg.resumeToken)
        break
      case 'set-ai-difficulty':
        this.handleSetAIDifficulty(msg.difficulty)
        break
      case 'start':
        this.handleStart()
        break
      case 'discard':
        this.handleDiscard(ws, msg.tileId)
        break
      case 'call-pon':
        this.handleCallPon(ws)
        break
      case 'decline-pon':
        this.handleDeclinePon(ws, msg.tileId)
        break
      case 'declare-riichi':
        this.handleDeclareRiichi(ws)
        break
      case 'pick-market':
        this.handlePickMarket(ws, msg.tileId)
        break
      case 'draw-blind':
        this.handleDrawBlind(ws)
        break
      case 'rematch':
        this.handleRematch(ws)
        break
      case 'leave':
        this.handleLeave(ws)
        break
      default:
        this.send(ws, { type: 'error', message: `Unknown message type` })
    }
  }

  private handleJoin(ws: WebSocket, playerName: string, resumeToken?: string) {
    const assigned = this.players.get(ws)
    if (assigned) {
      this.send(ws, { type: 'assigned', playerId: assigned.playerId, resumeToken: this.seatTokens[assigned.playerId] })
      return
    }
    const existing = resumeToken
      ? this.lobbyPlayers.find(p => this.seatTokens[p.id] === resumeToken && p.isHuman)
      : this.lobbyPlayers.find(p => p.name === playerName && p.isHuman)
    if (existing) {
      const token = this.seatTokens[existing.id]
      // v62 had no tokens. Permit one migration only for a disconnected legacy seat.
      if ((token && token !== resumeToken) || (!token && existing.connected)) {
        this.send(ws, { type: 'error', message: 'This name is already in use. Rejoin with the saved session.', code: 'SESSION_INVALID' })
        return
      }
      for (const [oldWs, info] of this.players) {
        if (info.playerId === existing.id) {
          this.players.delete(oldWs)
          oldWs.close(4001, 'Session resumed elsewhere')
        }
      }
      this.players.set(ws, { playerId: existing.id, name: existing.name })
      this.seatTokens[existing.id] = token ?? crypto.randomUUID()
      existing.connected = true
      this.expiresAt = 0
      this.send(ws, { type: 'assigned', playerId: existing.id, resumeToken: this.seatTokens[existing.id] })
      this.broadcastRoomState()
      this.sendGameStateToPlayer(ws, existing.id)
      this.updateRegistry()
      this.scheduleAITurns()
      return
    }
    if (resumeToken || this.gameStarted) {
      this.send(ws, { type: 'error', message: 'This saved session is no longer available. Create a new room.', code: 'SESSION_INVALID' })
      return
    }
    const seatId = ([0, 1, 2, 3] as PlayerId[]).find(id => !this.lobbyPlayers.some(p => p.id === id && p.isHuman))
    if (seatId === undefined) {
      this.send(ws, { type: 'error', message: 'Room is full', code: 'ROOM_FULL' })
      return
    }
    this.players.set(ws, { playerId: seatId, name: playerName })
    this.seatTokens[seatId] = crypto.randomUUID()
    this.lobbyPlayers = this.lobbyPlayers.filter(p => p.id !== seatId)
    this.lobbyPlayers.push({ id: seatId, name: playerName, isHuman: true, connected: true })
    this.lobbyPlayers.sort((a, b) => a.id - b.id)
    this.expiresAt = 0
    this.send(ws, { type: 'assigned', playerId: seatId, resumeToken: this.seatTokens[seatId] })
    this.broadcastRoomState()
    this.updateRegistry()
  }

  private handleSetAIDifficulty(difficulty: AIDifficulty) {
    if (this.gameStarted) return
    this.aiDifficulty = difficulty
    this.broadcastRoomState()
  }

  private handleStart() {
    if (this.gameStarted) return

    // A new match includes connected humans; absent seats become bots.
    this.lobbyPlayers = this.lobbyPlayers.filter(player => !player.isHuman || player.connected)
    for (const id of Object.keys(this.seatTokens).map(Number)) {
      if (!this.lobbyPlayers.some(player => player.id === id && player.isHuman)) delete this.seatTokens[id]
    }
    // Fill empty seats with AI
    const aiNames = ['East Bot', 'North Bot', 'West Bot']
    let aiNameIdx = 0
    for (let i = 0; i < 4; i++) {
      const existing = this.lobbyPlayers.find((p) => p.id === i)
      if (!existing) {
        this.lobbyPlayers.push({
          id: i as PlayerId,
          name: aiNames[aiNameIdx++] || `Bot ${i}`,
          isHuman: false,
          connected: false,
        })
      }
    }
    this.lobbyPlayers.sort((a, b) => a.id - b.id)

    // Create and start the GameRunner with player config
    this.runner = new GameRunner({ aiDifficulty: this.aiDifficulty })
    const sortedPlayers = [...this.lobbyPlayers].sort((a, b) => a.id - b.id)
    const playerConfig = sortedPlayers.map(lp => ({ name: lp.name, isHuman: lp.isHuman }))
    this.runner.start(playerConfig)
    this.gameStarted = true
    this.gameStartedAt = Date.now()
    this.updateRegistry()

    this.broadcastRoomState()
    this.broadcastGameState()

    // If player 0 is AI, kick off AI turns
    this.scheduleAITurns()
  }

  private handleDiscard(ws: WebSocket, tileId: string) {
    if (!this.runner || !this.gameStarted) return
    const info = this.players.get(ws)
    if (!info) return

    const state = this.runner.getState()
    if (state.currentPlayer !== info.playerId) {
      this.send(ws, { type: 'error', message: 'Not your turn' })
      return
    }
    if (state.phase !== 'discard') {
      this.send(ws, { type: 'error', message: 'Cannot discard now' })
      return
    }

    try {
      this.runner.discard(tileId)
    } catch (error) {
      this.send(ws, { type: 'error', message: error instanceof Error ? error.message : String(error) })
      return
    }

    this.broadcastGameState()
    this.checkPonToasts()
    this.scheduleAITurns()
  }

  private handleCallPon(ws: WebSocket) {
    if (!this.runner || !this.gameStarted) return
    const info = this.players.get(ws)
    if (!info) return

    const state = this.runner.getState()
    if (state.phase !== 'pon-available' || !state.ponAvailable) return
    if (state.ponAvailable.playerId !== info.playerId) return

    // Capture pon info BEFORE callPon clears it (getState returns a reference)
    const ponTileEmoji = state.ponAvailable!.tile.emoji
    const ponTag = state.ponAvailable!.matchingTag
    const ponPlayerName = this.lobbyPlayers.find(p => p.id === info.playerId)?.name ?? `Player ${info.playerId}`

    try {
      this.runner.callPon(info.playerId)
      this.broadcast({
        type: 'toast',
        kind: 'pon',
        playerName: ponPlayerName,
        emoji: ponTileEmoji,
        tag: ponTag,
      })
    } catch (error) {
      this.send(ws, { type: 'error', message: error instanceof Error ? error.message : String(error) })
      return
    }

    this.broadcastGameState()
    this.scheduleAITurns()
  }

  private handleDeclinePon(ws: WebSocket, tileId?: string) {
    if (!this.runner || !this.gameStarted) return
    const info = this.players.get(ws)
    if (!info) return
    const state = this.runner.getState()
    if (state.phase !== 'pon-available' || !state.ponAvailable) return
    if (tileId && tileId !== state.ponAvailable.tile.id) return
    if (state.ponAvailable.playerId !== info.playerId) {
      this.send(ws, { type: 'error', message: 'This pon decision belongs to another player' })
      return
    }

    try {
      this.runner.declinePon()
    } catch {
      return
    }

    this.broadcastGameState()
    this.scheduleAITurns()
  }

  private handleDeclareRiichi(ws: WebSocket) {
    if (!this.runner || !this.gameStarted) return
    const info = this.players.get(ws)
    if (!info) return

    try {
      this.runner.declareRiichi(info.playerId)
      this.broadcast({
        type: 'toast',
        kind: 'riichi',
        playerName: this.lobbyPlayers[info.playerId]?.name ?? `Player ${info.playerId}`,
      })
    } catch (error) {
      this.send(ws, { type: 'error', message: error instanceof Error ? error.message : String(error) })
      return
    }

    this.broadcastGameState()
  }

  private handlePickMarket(ws: WebSocket, tileId: string) {
    if (!this.runner || !this.gameStarted) return
    const info = this.players.get(ws)
    if (!info) return
    const state = this.runner.getState()
    if (state.currentPlayer !== info.playerId || state.phase !== 'draw') return
    try {
      this.runner.pickMarket(tileId)
    } catch (error) {
      this.send(ws, { type: 'error', message: error instanceof Error ? error.message : String(error) })
      return
    }
    this.broadcastGameState()
    this.scheduleAITurns()
  }

  private handleDrawBlind(ws: WebSocket) {
    if (!this.runner || !this.gameStarted) return
    const info = this.players.get(ws)
    if (!info) return
    const state = this.runner.getState()
    if (state.currentPlayer !== info.playerId || state.phase !== 'draw') return
    try {
      this.runner.drawBlind()
    } catch (error) {
      this.send(ws, { type: 'error', message: error instanceof Error ? error.message : String(error) })
      return
    }
    this.broadcastGameState()
    this.scheduleAITurns()
  }

  private handleRematch(ws: WebSocket) {
    const info = this.players.get(ws)
    if (!info) return

    const phase = this.runner?.getState().phase
    if (!this.gameStarted || (phase !== 'win' && phase !== 'draw-game')) {
      this.send(ws, { type: 'error', message: 'Finish this game before requesting a rematch' })
      return
    }
    this.rematchVotes.add(info.playerId)

    const humanCount = this.lobbyPlayers.filter(p => p.isHuman && p.connected).length
    this.broadcast({ type: 'rematch-votes', count: this.rematchVotes.size, total: humanCount })

    if (this.rematchVotes.size >= humanCount) {
      this.rematchVotes.clear()

      // Do not reserve a human turn for someone absent from the rematch.
      this.lobbyPlayers = this.lobbyPlayers.map(player => {
        if (!player.isHuman || player.connected) return player
        delete this.seatTokens[player.id]
        return { ...player, name: `Bot ${player.id + 1}`, isHuman: false }
      })
      // Create a new GameRunner with the same config
      this.runner = new GameRunner({ aiDifficulty: this.aiDifficulty })
      const sortedPlayers = [...this.lobbyPlayers].sort((a, b) => a.id - b.id)
      const playerConfig = sortedPlayers.map(lp => ({ name: lp.name, isHuman: lp.isHuman }))
      this.runner.start(playerConfig)
      this.gameStarted = true
      this.gameStartedAt = Date.now()

      this.broadcast({ type: 'rematch-starting' })
      this.broadcastRoomState()
      this.broadcastGameState()
      this.scheduleAITurns()
    }
  }

  private handleLeave(ws: WebSocket) {
    const info = this.players.get(ws)
    if (!info) return
    this.players.delete(ws)
    delete this.seatTokens[info.playerId]
    this.rematchVotes.delete(info.playerId)
    if (this.gameStarted && this.runner) {
      const state = this.runner.exportState()
      const player = state.players[info.playerId]
      player.isHuman = false
      player.name = `Bot ${info.playerId + 1}`
      this.runner.restoreState(state)
      this.lobbyPlayers = this.lobbyPlayers.map(p => p.id === info.playerId
        ? { ...p, name: player.name, connected: false, isHuman: false } : p)
    } else {
      this.lobbyPlayers = this.lobbyPlayers.filter(p => p.id !== info.playerId)
    }
    if (!this.lobbyPlayers.some(player => player.isHuman)) {
      // Only deliberate exits remove human seats; disconnected humans can still resume.
      this.runner = null
      this.gameStarted = false
      this.gameStartedAt = 0
      this.lobbyPlayers = []
      this.seatTokens = {}
      this.expiresAt = 0
      this.rematchVotes.clear()
      this.removeFromRegistry()
    } else if (this.players.size === 0) {
      // Preserve absent humans using the same expiry policy as a full network loss.
      // scheduleAITurns below cancels pending timers while no clients are connected.
      this.expiresAt = Date.now() + 30 * 60_000
      this.removeFromRegistry()
    } else this.updateRegistry()
    this.broadcastRoomState()
    this.broadcastGameState()
    this.scheduleAITurns()
    ws.close(1000, 'Left room')
  }

  private handleDisconnect(ws: WebSocket) {
    const info = this.players.get(ws)
    if (info) {
      const lp = this.lobbyPlayers.find((p) => p.id === info.playerId)
      if (lp) lp.connected = false
      this.players.delete(ws)
      this.broadcastRoomState()
    }

    if (!info) return // An old, replaced socket must not affect the new session.
    this.rematchVotes.delete(info.playerId)
    // Keep the same hand and turn through a whole-room network interruption.
    if (this.players.size === 0) {
      if (this.aiTimer) clearTimeout(this.aiTimer)
      this.aiTimer = null
      this.expiresAt = Date.now() + 30 * 60_000
      this.removeFromRegistry()
    } else {
      this.updateRegistry()
    }
    this.broadcastRoomState()
  }

  // ── Broadcasting ──

  private send(ws: WebSocket, msg: ServerMessage) {
    if (this.outbox) {
      this.outbox.push({ ws, msg: structuredClone(msg) })
      return
    }
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      // WebSocket may be closed
    }
  }

  private broadcast(msg: ServerMessage) {
    for (const ws of this.players.keys()) this.send(ws, msg)
  }

  private broadcastRoomState() {
    const msg: ServerMessage = {
      type: 'room-state',
      players: this.lobbyPlayers,
      gameStarted: this.gameStarted,
      roomCode: this.roomCode,
      aiDifficulty: this.aiDifficulty,
    }
    this.broadcast(msg)
  }

  private broadcastGameState() {
    if (!this.runner) return

    for (const [ws, info] of this.players) {
      this.sendGameStateToPlayer(ws, info.playerId)
    }
  }

  private sendGameStateToPlayer(ws: WebSocket, playerId: PlayerId) {
    if (!this.runner) return

    const snapshot = this.runner.snapshot({ forPlayer: playerId })
    const view: GameStateView = {
      phase: snapshot.phase,
      currentPlayer: snapshot.currentPlayer,
      turnCount: snapshot.turnCount,
      wallSize: snapshot.wallSize,
      winner: snapshot.winner,
      myPlayerId: playerId,
      ponAvailable: snapshot.ponAvailable,
      revealedSets: snapshot.revealedSets,
      market: snapshot.market,
      tagCounts: snapshot.tagCounts,
      gameStartedAt: this.gameStartedAt,
      gameEndedAt: snapshot.gameEndTime,
      legalDiscardIds: this.runner.getLegalDiscards(playerId),
      players: snapshot.players.map((p) => {
        // Use lobby player names/isHuman (runner names may not persist)
        const lp = this.lobbyPlayers.find(l => l.id === p.id)
        return {
          id: p.id,
          name: lp?.name ?? p.name,
          isHuman: lp?.isHuman ?? p.isHuman,
          riichi: p.riichi,
          handSize: p.handSize,
          hand: p.hand,
          discards: p.discards,
        }
      }),
    }

    this.send(ws, { type: 'game-state', state: view })
  }

  private checkPonToasts() {
    if (!this.runner) return
    const state = this.runner.getState()
    if (state.phase === 'pon-available' && state.ponAvailable) {
      // Toast is sent when pon is called, not when it becomes available
    }
  }

  // ── AI Turn Scheduling ──

  private isHumanPlayer(id: PlayerId): boolean {
    return this.lobbyPlayers.find(p => p.id === id)?.isHuman ?? false
  }

  private scheduleAITurns() {
    // Clear any pending AI timer to prevent overlapping turns
    if (this.aiTimer) {
      clearTimeout(this.aiTimer)
      this.aiTimer = null
    }

    if (!this.runner || this.players.size === 0) return
    const state = this.runner.getState()

    // Game over — nothing to do
    if (state.phase === 'win' || state.phase === 'draw-game') return

    // Handle AI pon decision
    if (state.phase === 'pon-available' && state.ponAvailable) {
      const ponPlayer = state.ponAvailable.playerId
      if (!this.isHumanPlayer(ponPlayer)) {
        this.aiTimer = setTimeout(() => { this.aiTimer = null; this.enqueue(() => this.handleAIPon()) }, 600)
        return
      }
      // The server resolves abandoned PON prompts, not only a foreground tab.
      const tileId = state.ponAvailable.tile.id
      const playerId = state.ponAvailable.playerId
      this.aiTimer = setTimeout(() => this.enqueue(() => {
        if (this.runner?.getState().ponAvailable?.tile.id !== tileId || this.runner.getState().ponAvailable?.playerId !== playerId) return
        this.runner.declinePon()
        this.broadcastGameState()
        this.scheduleAITurns()
      }), 6000)
      return
    }

    // If current player is AI and it's their turn to act
    const isHuman = this.isHumanPlayer(state.currentPlayer)
    if (!isHuman) {
      if (state.phase === 'draw') {
        this.aiTimer = setTimeout(() => { this.aiTimer = null; this.enqueue(() => this.handleAIDraw()) }, 600)
      } else if (state.phase === 'discard') {
        this.aiTimer = setTimeout(() => { this.aiTimer = null; this.enqueue(() => this.handleAIDiscard()) }, 800)
      }
    }
  }

  private handleAIPon() {
    if (!this.runner) return
    const state = this.runner.getState()
    if (state.phase !== 'pon-available' || !state.ponAvailable) return

    const ponPlayerId = state.ponAvailable.playerId
    if (this.isHumanPlayer(ponPlayerId)) return

    if (shouldAICallPon(this.aiDifficulty)) {
      // Capture before callPon clears it
      const ponEmoji = state.ponAvailable.tile.emoji
      const ponTag = state.ponAvailable.matchingTag
      const ponName = this.lobbyPlayers.find(p => p.id === ponPlayerId)?.name ?? `Player ${ponPlayerId}`
      try {
        this.runner.callPon(ponPlayerId)
        this.broadcast({
          type: 'toast',
          kind: 'pon',
          playerName: ponName,
          emoji: ponEmoji,
          tag: ponTag,
        })
      } catch {
        return
      }
    } else {
      try {
        this.runner.declinePon()
      } catch {
        return
      }
    }

    this.broadcastGameState()
    this.scheduleAITurns()
  }

  private handleAIDraw() {
    if (!this.runner) return
    const state = this.runner.getState()
    if (state.phase !== 'draw') return
    if (this.isHumanPlayer(state.currentPlayer)) return

    try {
      this.runner.aiDraw()
    } catch (error) {
      console.error('[game-room] AI draw failed', error)
      return
    }

    this.broadcastGameState()

    // After drawing, the AI needs to discard
    const newState = this.runner.getState()
    if (newState.phase === 'discard' && !this.isHumanPlayer(newState.currentPlayer)) {
      this.aiTimer = setTimeout(() => { this.aiTimer = null; this.enqueue(() => this.handleAIDiscard()) }, 800)
    }
  }

  private handleAIDiscard() {
    if (!this.runner) return
    const state = this.runner.getState()
    if (state.phase !== 'discard') return

    const pid = state.currentPlayer
    if (this.isHumanPlayer(pid)) return

    try {
      this.runner.aiTurn()
    } catch {
      return
    }

    this.broadcastGameState()
    this.scheduleAITurns()
  }
}