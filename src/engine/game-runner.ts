/**
 * GameRunner: A standalone, framework-free game engine for Semantic Mahjong.
 *
 * Rules (unique-tile variant):
 * - 80 unique emojis per game (one copy each), selected from ~1200 Unicode emojis
 * - Deal 11 tiles to each player (44 total), 36 in wall
 * - Draw to 12, check win (4 triplets of semantically related tiles), discard to 11
 * - A triplet = 3 different emojis sharing at least one CLDR tag
 */

import type { Tile, Player, PlayerId, GamePhase } from '../types'
import { HAND_SIZE, WIN_SIZE, MARKET_SIZE } from '../data/emojis'
import { selectTilePool, drawTile as drawFromWall } from './deck'
import { isWinningHand, sortByTag, canDeclareRiichi } from './sets'
import { calculateAIDiscard, calculateAIMarketPick, shouldAIDeclareRiichi, calculateRiichiDiscard } from './ai'
import type { AIDifficulty } from '../multiplayer/protocol'

export interface GameSnapshot {
  phase: GamePhase
  currentPlayer: PlayerId
  turnCount: number
  wallSize: number
  winner: PlayerId | null
  market: { id: string; emoji: string; name: string; tags: string[] }[]
  tagCounts: Record<string, number>
  ponAvailable: {
    playerId: PlayerId
    tile: { id: string; emoji: string; name: string; tags: string[] }
    matchingTag: string
    matchingTiles: { id: string; emoji: string; name: string; tags: string[] }[]
  } | null
  revealedSets: { playerId: PlayerId; tiles: { id: string; emoji: string; name: string; tags: string[] }[]; tag: string }[]
  players: {
    id: PlayerId
    name: string
    isHuman: boolean
    riichi: boolean
    handSize: number
    hand: { id: string; emoji: string; name: string; tags: string[] }[]
    discards: { id: string; emoji: string; name: string; tags: string[] }[]
  }[]
}

export interface PonOpportunity {
  playerId: PlayerId
  tile: Tile
  matchingTag: string
  matchingTiles: [Tile, Tile]
}

export interface GameRunnerState {
  phase: GamePhase
  players: [Player, Player, Player, Player]
  wall: Tile[]
  market: Tile[]
  tagCounts: Record<string, number>
  currentPlayer: PlayerId
  turnCount: number
  selectedTileId: string | null
  winner: PlayerId | null
  ponAvailable: PonOpportunity | null
  /** Player who discarded the tile triggering pon check */
  ponDiscarderId: PlayerId | null
  /** Tiles claimed via pon, stored as revealed sets */
  revealedSets: { playerId: PlayerId; tiles: Tile[]; tag: string }[]
  /** ID of the last tile drawn (for riichi auto-discard) */
  lastDrawnTileId: string | null
}

export type GameEventType =
  | 'game-started'
  | 'tile-drawn'
  | 'tile-discarded'
  | 'turn-changed'
  | 'win'
  | 'draw-game'
  | 'state-changed'
  | 'pon-available'
  | 'pon-called'
  | 'pon-declined'
  | 'riichi-declared'

export type GameEventListener = (event: GameEventType, data: any) => void

const PLAYER_NAMES = ['You', 'East Bot', 'North Bot', 'West Bot']

export class GameRunner {
  private state: GameRunnerState
  private listeners: GameEventListener[] = []
  private revealAll = false
  aiDifficulty: AIDifficulty = 'medium'

  constructor(options?: { aiDifficulty?: AIDifficulty }) {
    this.aiDifficulty = options?.aiDifficulty ?? 'medium'
    this.state = this.initialState()
  }

  private initialState(): GameRunnerState {
    return {
      phase: 'idle',
      players: [0, 1, 2, 3].map((i) => ({
        id: i as PlayerId,
        name: PLAYER_NAMES[i],
        hand: [] as Tile[],
        discards: [] as Tile[],
        isHuman: i === 0,
        riichi: false,
      })) as unknown as [Player, Player, Player, Player],
      wall: [],
      market: [],
      tagCounts: {},
      currentPlayer: 0,
      turnCount: 0,
      selectedTileId: null,
      winner: null,
      ponAvailable: null,
      ponDiscarderId: null,
      revealedSets: [],
      lastDrawnTileId: null,
    }
  }

  on(listener: GameEventListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private emit(event: GameEventType, data?: any) {
    for (const l of this.listeners) l(event, data)
  }

  // ---- Queries ----

  snapshot(options?: { revealAll?: boolean; forPlayer?: PlayerId }): GameSnapshot {
    const reveal = options?.revealAll ?? this.revealAll ?? false
    const forPlayer = options?.forPlayer
    const s = this.state
    const gameOver = s.phase === 'win' || s.phase === 'draw-game'

    return {
      phase: s.phase,
      currentPlayer: s.currentPlayer,
      turnCount: s.turnCount,
      wallSize: s.wall.length,
      winner: s.winner,
      market: s.market.map(t => ({ id: t.id, emoji: t.emoji, name: t.name, tags: [...t.tags] })),
      tagCounts: { ...s.tagCounts },
      ponAvailable: s.ponAvailable ? {
        playerId: s.ponAvailable.playerId,
        tile: { id: s.ponAvailable.tile.id, emoji: s.ponAvailable.tile.emoji, name: s.ponAvailable.tile.name, tags: [...s.ponAvailable.tile.tags] },
        matchingTag: s.ponAvailable.matchingTag,
        matchingTiles: s.ponAvailable.matchingTiles.map(t => ({ id: t.id, emoji: t.emoji, name: t.name, tags: [...t.tags] })),
      } : null,
      revealedSets: s.revealedSets.map(rs => ({
        playerId: rs.playerId,
        tiles: rs.tiles.map(t => ({ id: t.id, emoji: t.emoji, name: t.name, tags: [...t.tags] })),
        tag: rs.tag,
      })),
      players: s.players.map((p) => ({
        id: p.id,
        name: p.name,
        isHuman: p.isHuman,
        riichi: p.riichi,
        handSize: p.hand.length,
        hand: (p.isHuman || reveal || gameOver || p.id === forPlayer)
          ? p.hand.map((t) => ({ id: t.id, emoji: t.emoji, name: t.name, tags: [...t.tags] }))
          : [],
        discards: p.discards.map((t) => ({ id: t.id, emoji: t.emoji, name: t.name, tags: [...t.tags] })),
      })),
    }
  }

  getState(): Readonly<GameRunnerState> {
    return this.state
  }

  status(): string {
    const s = this.state
    if (s.phase === 'idle') return 'Game not started. Call start() to begin.'
    if (s.phase === 'win') return `${s.players[s.winner!].name} wins!`
    if (s.phase === 'draw-game') return 'Draw game — wall is empty.'

    const player = s.players[s.currentPlayer]
    const action = s.phase === 'draw' ? 'needs to draw' : 'needs to discard'
    return `Turn ${s.turnCount}: ${player.name} ${action}. Wall: ${s.wall.length} tiles.`
  }

  showHand(playerId: PlayerId = 0): string {
    const p = this.state.players[playerId]
    if (p.hand.length === 0) return `${p.name}: (empty hand)`
    return p.hand
      .map((t, i) => `  [${i}] ${t.emoji}  ${t.tags.join(', ')}  (${t.id})`)
      .join('\n')
  }

  analyzeHand(playerId: PlayerId = 0): string {
    const hand = this.state.players[playerId].hand
    const lines: string[] = [`Hand analysis for ${this.state.players[playerId].name}:`]

    // Tag frequency
    const tagFreq = new Map<string, Tile[]>()
    for (const tile of hand) {
      for (const tag of tile.tags) {
        if (!tagFreq.has(tag)) tagFreq.set(tag, [])
        tagFreq.get(tag)!.push(tile)
      }
    }

    lines.push('\nTag groups (potential triplets):')
    for (const [tag, tiles] of [...tagFreq.entries()].sort((a, b) => b[1].length - a[1].length)) {
      if (tiles.length >= 3) {
        lines.push(`  ✓ TRIPLET [${tag}]: ${tiles.map((t) => t.emoji).join(' ')}`)
      } else if (tiles.length === 2) {
        lines.push(`    pair [${tag}]: ${tiles.map((t) => t.emoji).join(' ')}`)
      }
    }

    if (hand.length === WIN_SIZE) {
      lines.push(`\nWin check: ${isWinningHand(hand) ? '*** WINNING HAND! ***' : 'Not a winning hand'}`)
    }

    return lines.join('\n')
  }

  // ---- Actions ----

  start(playerConfig?: { name: string; isHuman: boolean }[]): GameSnapshot {
    const { tiles: allTiles, tagCounts } = selectTilePool()
    let wall = allTiles
    const players = this.initialState().players

    // Apply custom player configuration
    if (playerConfig) {
      for (let i = 0; i < Math.min(playerConfig.length, 4); i++) {
        players[i].name = playerConfig[i].name
        players[i].isHuman = playerConfig[i].isHuman
      }
    }

    // Deal HAND_SIZE (11) tiles to each player
    for (let round = 0; round < HAND_SIZE; round++) {
      for (let p = 0; p < 4; p++) {
        const result = drawFromWall(wall)
        if (result) {
          players[p].hand.push(result.tile)
          wall = result.remaining
        }
      }
    }

    for (const p of players) {
      p.hand = sortByTag(p.hand)
    }

    // Populate market
    const market: Tile[] = []
    for (let i = 0; i < MARKET_SIZE && wall.length > 0; i++) {
      const result = drawFromWall(wall)
      if (result) {
        market.push(result.tile)
        wall = result.remaining
      }
    }

    this.state = {
      phase: 'draw',
      players,
      wall,
      market,
      tagCounts,
      currentPlayer: 0,
      turnCount: 1,
      selectedTileId: null,
      winner: null,
      ponAvailable: null,
      ponDiscarderId: null,
      revealedSets: [],
      lastDrawnTileId: null,
    }

    this.emit('game-started')
    this.emit('state-changed', this.snapshot())
    return this.snapshot()
  }

  drawBlind(): GameSnapshot {
    if (this.state.phase !== 'draw') {
      throw new Error(`Cannot draw in phase "${this.state.phase}"`)
    }

    const result = drawFromWall(this.state.wall)
    if (!result) {
      // Wall empty — check if market is empty too
      if (this.state.market.length === 0) {
        this.state.phase = 'draw-game'
        this.emit('draw-game')
        this.emit('state-changed', this.snapshot())
        return this.snapshot()
      }
      // Wall empty but market has tiles — player must pick from market
      throw new Error('Wall is empty — pick from the market instead')
    }

    const pid = this.state.currentPlayer
    this.state.players[pid].hand.push(result.tile)
    this.state.players[pid].hand = sortByTag(this.state.players[pid].hand)
    this.state.wall = result.remaining
    this.state.lastDrawnTileId = result.tile.id
    this.state.phase = 'discard'

    this.emit('tile-drawn', { player: pid, tile: result.tile, source: 'wall' })
    this.emit('state-changed', this.snapshot())
    return this.snapshot()
  }

  draw(): GameSnapshot {
    return this.drawBlind()
  }

  pickMarket(tileId: string): GameSnapshot {
    if (this.state.phase !== 'draw') {
      throw new Error(`Cannot pick from market in phase "${this.state.phase}"`)
    }

    const tileIdx = this.state.market.findIndex(t => t.id === tileId)
    if (tileIdx === -1) {
      throw new Error(`Tile "${tileId}" not in market`)
    }

    const pid = this.state.currentPlayer
    const tile = this.state.market.splice(tileIdx, 1)[0]
    this.state.players[pid].hand.push(tile)
    this.state.players[pid].hand = sortByTag(this.state.players[pid].hand)
    this.state.lastDrawnTileId = tile.id
    this.state.phase = 'discard'

    this.refillMarket()

    this.emit('tile-drawn', { player: pid, tile, source: 'market' })
    this.emit('state-changed', this.snapshot())
    return this.snapshot()
  }

  private refillMarket() {
    while (this.state.market.length < MARKET_SIZE && this.state.wall.length > 0) {
      const result = drawFromWall(this.state.wall)
      if (result) {
        this.state.market.push(result.tile)
        this.state.wall = result.remaining
      }
    }
  }

  discard(tileIdOrIndex: string | number): GameSnapshot {
    if (this.state.phase !== 'discard') {
      throw new Error(`Cannot discard in phase "${this.state.phase}"`)
    }

    const pid = this.state.currentPlayer
    const hand = this.state.players[pid].hand

    let tileIndex: number
    if (typeof tileIdOrIndex === 'number') {
      tileIndex = tileIdOrIndex
      if (tileIndex < 0 || tileIndex >= hand.length) {
        throw new Error(`Invalid index ${tileIndex}. Hand has ${hand.length} tiles.`)
      }
    } else {
      tileIndex = hand.findIndex((t) => t.id === tileIdOrIndex)
      if (tileIndex === -1) {
        throw new Error(`Tile "${tileIdOrIndex}" not in player ${pid}'s hand.`)
      }
    }

    // Win check: hand + revealed sets = WIN_SIZE (12) tiles
    const myMelds = this.state.revealedSets.filter(rs => rs.playerId === pid)
    const allTiles = [...hand, ...myMelds.flatMap(rs => rs.tiles)]
    if (allTiles.length === WIN_SIZE && isWinningHand(allTiles)) {
      this.state.phase = 'win'
      this.state.winner = pid
      this.emit('win', { player: pid })
      this.emit('state-changed', this.snapshot())
      return this.snapshot()
    }

    const discarded = hand.splice(tileIndex, 1)[0]
    this.state.players[pid].discards.push(discarded)
    this.state.players[pid].hand = sortByTag(this.state.players[pid].hand)
    this.state.selectedTileId = null
    this.state.lastDrawnTileId = null

    this.emit('tile-discarded', { player: pid, tile: discarded })

    // Check for pon opportunities before advancing the turn
    const ponCandidates = this.checkPon(discarded, pid)
    if (ponCandidates.length > 0) {
      // Pick the first candidate (priority by seat order after discarder)
      const candidate = ponCandidates[0]
      const matchingTiles = this.findMatchingPair(candidate.playerId, discarded, candidate.tag)
      this.state.ponAvailable = {
        playerId: candidate.playerId,
        tile: discarded,
        matchingTag: candidate.tag,
        matchingTiles,
      }
      this.state.ponDiscarderId = pid
      this.state.phase = 'pon-available'
      this.emit('pon-available', { playerId: candidate.playerId, tile: discarded, tag: candidate.tag })
      this.emit('state-changed', this.snapshot())
      return this.snapshot()
    }

    // No pon: advance normally
    this.advanceTurn(pid)
    this.emit('state-changed', this.snapshot())
    return this.snapshot()
  }

  private advanceTurn(fromPlayer: PlayerId) {
    const nextPlayer = ((fromPlayer + 1) % 4) as PlayerId
    this.state.currentPlayer = nextPlayer
    this.state.phase = 'draw'
    if (nextPlayer === 0) this.state.turnCount++
    this.emit('turn-changed', { player: nextPlayer })
  }

  /** Get tile IDs locked in revealed sets for a player */
  private getLockedTileIds(playerId: PlayerId): Set<string> {
    const ids = new Set<string>()
    for (const rs of this.state.revealedSets) {
      if (rs.playerId === playerId) {
        for (const t of rs.tiles) ids.add(t.id)
      }
    }
    return ids
  }

  /** Find all players who could call pon on the discarded tile */
  checkPon(discardedTile: Tile, discarderId: PlayerId): { playerId: PlayerId; tag: string }[] {
    const results: { playerId: PlayerId; tag: string }[] = []

    // Check in seat order starting after the discarder
    for (let offset = 1; offset <= 3; offset++) {
      const pid = ((discarderId + offset) % 4) as PlayerId
      // Riichi players can't call pon (hand is locked)
      if (this.state.players[pid].riichi) continue

      // Exclude tiles already in revealed sets
      const lockedIds = this.getLockedTileIds(pid)
      const availableHand = this.state.players[pid].hand.filter(t => !lockedIds.has(t.id))

      // For each tag on the discarded tile, check if this player has 2+ tiles with that tag
      for (const tag of discardedTile.tags) {
        const matching = availableHand.filter(t => t.tags.includes(tag))
        if (matching.length >= 2) {
          results.push({ playerId: pid, tag })
          break // one pon opportunity per player is enough
        }
      }
    }

    return results
  }

  /** Find 2 tiles in a player's hand that share a tag with the discarded tile */
  private findMatchingPair(playerId: PlayerId, _discardedTile: Tile, tag: string): [Tile, Tile] {
    const lockedIds = this.getLockedTileIds(playerId)
    const available = this.state.players[playerId].hand.filter(t => !lockedIds.has(t.id))
    const matching = available.filter(t => t.tags.includes(tag))
    return [matching[0], matching[1]]
  }

  /** Execute a pon call */
  callPon(callerId: PlayerId): GameSnapshot {
    if (this.state.phase !== 'pon-available') {
      throw new Error(`Cannot call pon in phase "${this.state.phase}"`)
    }
    if (!this.state.ponAvailable) {
      throw new Error('No pon opportunity available')
    }
    if (this.state.ponAvailable.playerId !== callerId) {
      throw new Error(`Player ${callerId} cannot call pon (opportunity is for player ${this.state.ponAvailable.playerId})`)
    }

    const pon = this.state.ponAvailable
    const player = this.state.players[callerId]
    const discarderId = this.state.ponDiscarderId!

    // Remove the tile from the discarder's discard pile (last tile)
    const claimedTile = this.state.players[discarderId].discards.pop()!

    // Record the revealed set (the 2 matching tiles + the claimed tile)
    this.state.revealedSets.push({
      playerId: callerId,
      tiles: [pon.matchingTiles[0], pon.matchingTiles[1], claimedTile],
      tag: pon.matchingTag,
    })

    // Remove the 2 matching tiles from the player's hand (claimed tile goes to meld, not hand)
    const removeIds = new Set([pon.matchingTiles[0].id, pon.matchingTiles[1].id])
    player.hand = player.hand.filter(t => !removeIds.has(t.id))
    player.hand = sortByTag(player.hand)

    // Total tiles = hand + revealed set tiles. Check for win.
    const myMelds = this.state.revealedSets.filter(rs => rs.playerId === callerId)
    const meldTileCount = myMelds.reduce((sum, rs) => sum + rs.tiles.length, 0)
    const totalTiles = player.hand.length + meldTileCount
    if (totalTiles >= WIN_SIZE) {
      const allTiles = [...player.hand, ...myMelds.flatMap(rs => rs.tiles)]
      if (isWinningHand(allTiles)) {
        this.state.phase = 'win'
        this.state.winner = callerId
        this.state.ponAvailable = null
        this.state.ponDiscarderId = null
        this.state.currentPlayer = callerId
        this.emit('pon-called', { playerId: callerId, tile: claimedTile, tag: pon.matchingTag })
        this.emit('win', { player: callerId })
        this.emit('state-changed', this.snapshot())
        return this.snapshot()
      }
    }

    // Caller must now discard from their remaining hand
    this.state.currentPlayer = callerId
    this.state.phase = 'discard'
    this.state.ponAvailable = null
    this.state.ponDiscarderId = null

    this.emit('pon-called', { playerId: callerId, tile: claimedTile, tag: pon.matchingTag })
    this.emit('state-changed', this.snapshot())
    return this.snapshot()
  }

  /** Decline pon and continue normal turn flow */
  declinePon(): GameSnapshot {
    if (this.state.phase !== 'pon-available') {
      throw new Error(`Cannot decline pon in phase "${this.state.phase}"`)
    }

    const discarderId = this.state.ponDiscarderId!
    this.state.ponAvailable = null
    this.state.ponDiscarderId = null

    this.advanceTurn(discarderId)
    this.emit('pon-declined')
    this.emit('state-changed', this.snapshot())
    return this.snapshot()
  }

  /** Declare riichi — lock hand, must be tenpai after discard */
  declareRiichi(playerId: PlayerId): GameSnapshot {
    if (this.state.phase !== 'discard') {
      throw new Error(`Cannot declare riichi in phase "${this.state.phase}"`)
    }
    if (this.state.currentPlayer !== playerId) {
      throw new Error(`Not player ${playerId}'s turn`)
    }
    const player = this.state.players[playerId]
    if (player.riichi) {
      throw new Error(`Player ${playerId} is already in riichi`)
    }
    if (!canDeclareRiichi(player.hand)) {
      throw new Error(`Player ${playerId} cannot declare riichi (not tenpai after any discard)`)
    }

    player.riichi = true
    this.emit('riichi-declared', { playerId })
    this.emit('state-changed', this.snapshot())
    return this.snapshot()
  }

  /** For riichi players: auto-discard the drawn tile if it doesn't complete a win */
  riichiAutoDiscard(playerId: PlayerId): GameSnapshot | null {
    const player = this.state.players[playerId]
    if (!player.riichi) return null
    if (this.state.phase !== 'discard') return null
    if (player.hand.length !== WIN_SIZE) return null

    // If the hand is a winner, don't auto-discard
    if (isWinningHand(player.hand)) return null

    // Discard the drawn tile
    const drawnId = this.state.lastDrawnTileId
    if (!drawnId) return null

    return this.discard(drawnId)
  }

  aiTurn(): GameSnapshot {
    const pid = this.state.currentPlayer
    if (this.state.players[pid].isHuman) {
      throw new Error('Cannot autoplay for human player.')
    }

    if (this.state.phase === 'draw') {
      const pick = calculateAIMarketPick(
        this.state.players[pid].hand,
        this.state.market,
        this.aiDifficulty,
        this.state.tagCounts
      )
      if (pick) {
        this.pickMarket(pick.id)
      } else {
        try {
          this.drawBlind()
        } catch {
          // Wall empty, must pick from market
          if (this.state.market.length > 0) {
            this.pickMarket(this.state.market[0].id)
          }
        }
      }
    }

    if (this.state.phase === 'discard') {
      const player = this.state.players[pid]
      const hand = player.hand

      const aiMelds = this.state.revealedSets.filter(rs => rs.playerId === pid)
      const aiAllTiles = [...hand, ...aiMelds.flatMap(rs => rs.tiles)]
      if (aiAllTiles.length === WIN_SIZE && isWinningHand(aiAllTiles)) {
        return this.discard(hand[0].id) // triggers win check
      }

      // Riichi auto-discard
      if (player.riichi) {
        const result = this.riichiAutoDiscard(pid)
        if (result) return result
        // If auto-discard didn't fire (shouldn't happen), fall through
      }

      // Check if AI should declare riichi
      if (!player.riichi && shouldAIDeclareRiichi(hand, this.aiDifficulty)) {
        this.declareRiichi(pid)
        const toDiscard = calculateRiichiDiscard(hand)
        return this.discard(toDiscard.id)
      }

      const toDiscard = calculateAIDiscard(hand, this.aiDifficulty)
      return this.discard(toDiscard.id)
    }

    return this.snapshot()
  }

  playUntilHuman(): GameSnapshot {
    let safety = 100
    while (safety-- > 0) {
      if (this.state.phase === 'win' || this.state.phase === 'draw-game') break
      if (this.state.phase === 'pon-available') break // let pon be handled externally
      if (this.state.currentPlayer === 0) break
      this.aiTurn()
    }

    return this.snapshot()
  }

  play(tileIndex: number): GameSnapshot {
    this.discard(tileIndex)
    return this.playUntilHuman()
  }

  setRevealAll(reveal: boolean) {
    this.revealAll = reveal
  }

  reset() {
    this.state = this.initialState()
    this.emit('state-changed', this.snapshot())
  }

  print(): string {
    const lines = [this.status(), '']
    if (this.state.phase === 'idle') return lines.join('\n')

    const snap = this.snapshot({ revealAll: this.revealAll })
    for (const p of snap.players) {
      const marker = p.id === snap.currentPlayer ? ' ← ' : '   '
      const riichiMark = p.riichi ? ' 🔴RIICHI' : ''
      const handStr = p.hand.length > 0
        ? p.hand.map((t) => t.emoji).join(' ')
        : `(${p.handSize} hidden tiles)`
      lines.push(`${marker}${p.name}${riichiMark}: ${handStr}`)
      if (p.discards.length > 0) {
        lines.push(`      discards: ${p.discards.map((t) => t.emoji).join(' ')}`)
      }
    }
    lines.push(`\n   Wall: ${snap.wallSize} tiles remaining`)
    return lines.join('\n')
  }

  help(): string {
    return `
Semantic Mahjong - Game Commands
================================
Rules: 80 unique emojis, deal 11, draw to 12.
Win = 4 triplets (3 tiles sharing a tag each).

game.start()          Start a new game
game.print()          Show current game state
game.status()         One-line status
game.showHand()       Show your hand with indices and tags
game.showHand(1)      Show a specific player's hand
game.analyzeHand()    Analyze your hand for potential sets
game.drawBlind()      Draw a tile from the wall (blind)
game.draw()           Alias for drawBlind()
game.pickMarket(id)   Pick a tile from the market row
game.discard(3)       Discard tile at index 3
game.discard('id')    Discard tile by ID
game.declareRiichi(0) Declare riichi (must be tenpai)
game.play(3)          Discard index 3, then auto-play AI turns
game.playUntilHuman() Auto-play AI turns until your turn
game.aiTurn()         Execute one AI turn
game.snapshot()       Get JSON snapshot of game state
game.setRevealAll(t)  Toggle showing all hands
game.reset()          Reset
`.trim()
  }
}
