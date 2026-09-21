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
  ClientMessage,
  ServerMessage,
  LobbyPlayer,
  GameStateView,
} from '../src/multiplayer/protocol'
import type { PlayerId } from '../src/types'

interface PlayerInfo {
  playerId: PlayerId
  name: string
}

interface Env {
  ROOM_REGISTRY: DurableObjectNamespace
}

const ROOM_STATE_KEY = 'game-room-state'

interface PersistedRoomState {
  roomCode: string
  aiDifficulty: AIDifficulty
  lobbyPlayers: LobbyPlayer[]
  gameStarted: boolean
  rematchVotes: PlayerId[]
  runnerState: GameRunnerState | null
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export class GameRoom implements DurableObject {
  private players: Map<WebSocket, PlayerInfo> = new Map()
  private runner: GameRunner | null = null
  private roomCode = ''
  private aiDifficulty: AIDifficulty = 'medium'
  private lobbyPlayers: LobbyPlayer[] = []
  private gameStarted = false
  private rematchVotes: Set<PlayerId> = new Set()
  private aiTimer: ReturnType<typeof setTimeout> | null = null
  private ctx: DurableObjectState
  private env: Env

  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx
    this.env = env

    this.ctx.blockConcurrencyWhile(async () => {
      const persisted = await this.ctx.storage.get<PersistedRoomState>(ROOM_STATE_KEY)
      if (!persisted) return

      this.roomCode = persisted.roomCode
      this.aiDifficulty = persisted.aiDifficulty
      this.lobbyPlayers = persisted.lobbyPlayers
      this.gameStarted = persisted.gameStarted
      this.rematchVotes = new Set(persisted.rematchVotes)

      if (persisted.runnerState) {
        this.runner = new GameRunner({ aiDifficulty: this.aiDifficulty })
        this.runner.restoreState(persisted.runnerState)
      }
    })
  }

  private persistState() {
    const persisted: PersistedRoomState = {
      roomCode: this.roomCode,
      aiDifficulty: this.aiDifficulty,
      lobbyPlayers: this.lobbyPlayers,
      gameStarted: this.gameStarted,
      rematchVotes: [...this.rematchVotes],
      runnerState: this.runner?.exportState() ?? null,
    }
    void this.ctx.storage.put(ROOM_STATE_KEY, persisted).catch((error) => {
      console.error('[game-room] Failed to persist state', error)
    })
  }

  private clearPersistedState() {
    void this.ctx.storage.delete(ROOM_STATE_KEY).catch((error) => {
      console.error('[game-room] Failed to clear persisted state', error)
    })
  }

  private async updateRegistry() {
    try {
      const registry = this.env.ROOM_REGISTRY.get(
        this.env.ROOM_REGISTRY.idFromName('global')
      )
      const humanPlayers = this.lobbyPlayers.filter(p => p.isHuman && p.connected)
      await registry.fetch(new Request('http://internal/update', {
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
      this.handleMessage(server, event.data as string)
    })

    server.addEventListener('close', () => {
      this.handleDisconnect(server)
    })

    server.addEventListener('error', () => {
      this.handleDisconnect(server)
    })

    return new Response(null, { status: 101, webSocket: client })
  }

  private handleMessage(ws: WebSocket, raw: string) {
    let msg: ClientMessage
    try {
      msg = JSON.parse(raw)
    } catch {
      this.send(ws, { type: 'error', message: 'Invalid JSON' })
      return
    }

    switch (msg.type) {
      case 'join':
        this.handleJoin(ws, msg.playerName)
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
        this.handleDeclinePon(ws)
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
      default:
        this.send(ws, { type: 'error', message: `Unknown message type` })
    }
  }

  private handleJoin(ws: WebSocket, playerName: string) {
    if (this.gameStarted) {
      // Allow reconnection if a player with this name exists
      const existing = this.lobbyPlayers.find((p) => p.name === playerName && p.isHuman)
      if (existing) {
        // Reconnect: replace the old WebSocket
        for (const [oldWs, info] of this.players) {
          if (info.playerId === existing.id) {
            this.players.delete(oldWs)
            break
          }
        }
        this.players.set(ws, { playerId: existing.id, name: playerName })
        existing.connected = true
        this.send(ws, { type: 'assigned', playerId: existing.id })
        this.broadcastRoomState()
        this.sendGameStateToPlayer(ws, existing.id)
        this.persistState()
        this.scheduleAITurns()
        return
      }
      this.send(ws, { type: 'error', message: 'Game already started' })
      return
    }

    // Count current human seats
    const humanCount = this.lobbyPlayers.filter((p) => p.isHuman).length
    if (humanCount >= 4) {
      this.send(ws, { type: 'error', message: 'Room is full' })
      return
    }

    // Assign the next available seat
    const seatId = humanCount as PlayerId
    const info: PlayerInfo = { playerId: seatId, name: playerName }
    this.players.set(ws, info)

    // Update lobby
    // Remove any placeholder at this seat index if it exists
    this.lobbyPlayers = this.lobbyPlayers.filter((p) => p.id !== seatId)
    this.lobbyPlayers.push({
      id: seatId,
      name: playerName,
      isHuman: true,
      connected: true,
    })
    // Sort by id so lobby order is consistent
    this.lobbyPlayers.sort((a, b) => a.id - b.id)

    this.send(ws, { type: 'assigned', playerId: seatId })
    this.broadcastRoomState()
    this.updateRegistry()
    this.persistState()
  }

  private handleSetAIDifficulty(difficulty: AIDifficulty) {
    if (this.gameStarted) return
    this.aiDifficulty = difficulty
    this.broadcastRoomState()
    this.persistState()
  }

  private handleStart() {
    if (this.gameStarted) return

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
    this.updateRegistry()

    this.broadcastRoomState()
    this.broadcastGameState()

    // If player 0 is AI, kick off AI turns
    this.persistState()
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
      this.send(ws, { type: 'error', message: errorMessage(error) })
      return
    }

    this.broadcastGameState()
    this.checkPonToasts()
    this.persistState()
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
      this.send(ws, { type: 'error', message: errorMessage(error) })
      return
    }

    this.broadcastGameState()
    this.persistState()
    this.scheduleAITurns()
  }

  private handleDeclinePon(ws: WebSocket) {
    if (!this.runner || !this.gameStarted) return
    const info = this.players.get(ws)
    if (!info) return

    const state = this.runner.getState()
    if (state.phase !== 'pon-available' || !state.ponAvailable) return
    if (state.ponAvailable.playerId !== info.playerId) {
      this.send(ws, { type: 'error', message: 'This PON decision belongs to another player' })
      return
    }

    try {
      this.runner.declinePon()
    } catch {
      return
    }

    this.broadcastGameState()
    this.persistState()
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
      this.send(ws, { type: 'error', message: errorMessage(error) })
      return
    }

    this.broadcastGameState()
    this.persistState()
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
      this.send(ws, { type: 'error', message: errorMessage(error) })
      return
    }
    this.broadcastGameState()
    this.persistState()
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
      this.send(ws, { type: 'error', message: errorMessage(error) })
      return
    }
    this.broadcastGameState()
    this.persistState()
    this.scheduleAITurns()
  }

  private handleRematch(ws: WebSocket) {
    const info = this.players.get(ws)
    if (!info) return

    this.rematchVotes.add(info.playerId)
    this.persistState()

    const humanCount = this.lobbyPlayers.filter(p => p.isHuman && p.connected).length
    this.broadcast({ type: 'rematch-votes', count: this.rematchVotes.size, total: humanCount })

    if (this.rematchVotes.size >= humanCount) {
      this.rematchVotes.clear()

      // Create a new GameRunner with the same config
      this.runner = new GameRunner({ aiDifficulty: this.aiDifficulty })
      const sortedPlayers = [...this.lobbyPlayers].sort((a, b) => a.id - b.id)
      const playerConfig = sortedPlayers.map(lp => ({ name: lp.name, isHuman: lp.isHuman }))
      this.runner.start(playerConfig)
      this.gameStarted = true

      this.broadcast({ type: 'rematch-starting' })
      this.broadcastRoomState()
      this.broadcastGameState()
      this.persistState()
      this.scheduleAITurns()
    }
  }

  private handleDisconnect(ws: WebSocket) {
    const info = this.players.get(ws)
    if (info) {
      const lp = this.lobbyPlayers.find((p) => p.id === info.playerId)
      if (lp) lp.connected = false
      this.players.delete(ws)
      this.broadcastRoomState()
    }

    // Preserve started games so a deployment, reload, or temporary network loss
    // cannot erase the match before clients reconnect.
    const anyConnected = this.lobbyPlayers.some((p) => p.isHuman && p.connected)
    if (!anyConnected && this.players.size === 0 && !this.gameStarted) {
      this.runner = null
      this.lobbyPlayers = []
      this.clearPersistedState()
      this.removeFromRegistry()
    } else {
      this.persistState()
      this.updateRegistry()
    }
  }

  // ── Broadcasting ──

  private send(ws: WebSocket, msg: ServerMessage) {
    try {
      ws.send(JSON.stringify(msg))
    } catch {
      // WebSocket may be closed
    }
  }

  private broadcast(msg: ServerMessage) {
    const data = JSON.stringify(msg)
    for (const ws of this.players.keys()) {
      try {
        ws.send(data)
      } catch {
        // ignore closed sockets
      }
    }
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
      gameStartTime: snapshot.gameStartTime,
      wallSize: snapshot.wallSize,
      winner: snapshot.winner,
      myPlayerId: playerId,
      ponAvailable: snapshot.ponAvailable,
      revealedSets: snapshot.revealedSets,
      market: snapshot.market,
      tagCounts: snapshot.tagCounts,
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

    if (!this.runner) return
    const state = this.runner.getState()

    // Game over — nothing to do
    if (state.phase === 'win' || state.phase === 'draw-game') return

    // Handle AI pon decision
    if (state.phase === 'pon-available' && state.ponAvailable) {
      const ponPlayer = state.ponAvailable.playerId
      if (!this.isHumanPlayer(ponPlayer)) {
        this.aiTimer = setTimeout(() => { this.aiTimer = null; this.handleAIPon() }, 600)
        return
      }
      // Human pon — wait for their decision
      return
    }

    // If current player is AI and it's their turn to act
    const isHuman = this.isHumanPlayer(state.currentPlayer)
    if (!isHuman) {
      if (state.phase === 'draw') {
        this.aiTimer = setTimeout(() => { this.aiTimer = null; this.handleAIDraw() }, 600)
      } else if (state.phase === 'discard') {
        this.aiTimer = setTimeout(() => { this.aiTimer = null; this.handleAIDiscard() }, 800)
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
    this.persistState()
    this.scheduleAITurns()
  }

  private handleAIDraw() {
    if (!this.runner) return
    const state = this.runner.getState()
    if (state.phase !== 'draw') return
    if (this.isHumanPlayer(state.currentPlayer)) return

    try {
      this.runner.aiDraw()
    } catch {
      return
    }

    this.broadcastGameState()
    this.persistState()

    // After drawing, the AI needs to discard
    const newState = this.runner.getState()
    if (newState.phase === 'discard' && !this.isHumanPlayer(newState.currentPlayer)) {
      this.aiTimer = setTimeout(() => { this.aiTimer = null; this.handleAIDiscard() }, 800)
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
    this.persistState()
    this.scheduleAITurns()
  }
}
