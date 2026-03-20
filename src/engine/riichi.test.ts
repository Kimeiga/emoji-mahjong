/**
 * Test script for riichi (declare ready) mechanics.
 * Run with: npx tsx src/engine/riichi.test.ts
 */

import { GameRunner } from './game-runner'
import { isTenpai, getWaitingTags, canDeclareRiichi, getRiichiDiscards } from './sets'
import type { Tile, PlayerId } from '../types'

let passed = 0
let failed = 0

function assert(condition: boolean, msg: string) {
  if (condition) {
    passed++
    console.log(`  ✅ ${msg}`)
  } else {
    failed++
    console.error(`  ❌ ${msg}`)
  }
}

function assertThrows(fn: () => void, msg: string) {
  try {
    fn()
    failed++
    console.error(`  ❌ ${msg} (did not throw)`)
  } catch {
    passed++
    console.log(`  ✅ ${msg}`)
  }
}

function t(id: string, tags: string[], emoji = '🔲'): Tile {
  return { id, emoji, name: emoji, tags }
}

function injectState(runner: GameRunner, overrides: Record<string, any>) {
  const state = (runner as any).state
  Object.assign(state, overrides)
}

// ────────────────────────────────────────────────
console.log('\n1. isTenpai — detects tenpai hand (3 triplets + pair sharing a tag)')
{
  // 3 complete triplets (9 tiles) + 2 tiles sharing "alpha" tag
  const hand = [
    t('a1', ['beta']), t('a2', ['beta']), t('a3', ['beta']),
    t('b1', ['gamma']), t('b2', ['gamma']), t('b3', ['gamma']),
    t('c1', ['delta']), t('c2', ['delta']), t('c3', ['delta']),
    t('d1', ['alpha', 'extra1']), t('d2', ['alpha', 'extra2']),
  ]
  assert(isTenpai(hand), '3 triplets + pair with shared tag is tenpai')
  assert(hand.length === 11, 'hand has 11 tiles')
}

// ────────────────────────────────────────────────
console.log('\n2. isTenpai — not tenpai when pair has no shared tag')
{
  const hand = [
    t('a1', ['beta']), t('a2', ['beta']), t('a3', ['beta']),
    t('b1', ['gamma']), t('b2', ['gamma']), t('b3', ['gamma']),
    t('c1', ['delta']), t('c2', ['delta']), t('c3', ['delta']),
    t('d1', ['alpha']), t('d2', ['omega']), // no shared tag
  ]
  assert(!isTenpai(hand), 'pair with no shared tag is not tenpai')
}

// ────────────────────────────────────────────────
console.log('\n3. isTenpai — not tenpai with wrong tile count')
{
  const hand10 = Array.from({ length: 10 }, (_, i) => t(`x${i}`, ['tag']))
  const hand12 = Array.from({ length: 12 }, (_, i) => t(`x${i}`, ['tag']))
  assert(!isTenpai(hand10), '10 tiles is not tenpai')
  assert(!isTenpai(hand12), '12 tiles is not tenpai')
}

// ────────────────────────────────────────────────
console.log('\n4. getWaitingTags — returns shared tags of waiting pair')
{
  const hand = [
    t('a1', ['beta']), t('a2', ['beta']), t('a3', ['beta']),
    t('b1', ['gamma']), t('b2', ['gamma']), t('b3', ['gamma']),
    t('c1', ['delta']), t('c2', ['delta']), t('c3', ['delta']),
    t('d1', ['alpha', 'zeta']), t('d2', ['alpha', 'zeta']),
  ]
  const tags = getWaitingTags(hand)
  assert(tags.includes('alpha'), 'waiting tags include alpha')
  assert(tags.includes('zeta'), 'waiting tags include zeta')
}

// ────────────────────────────────────────────────
console.log('\n5. canDeclareRiichi — true when some discard leaves tenpai')
{
  // 12 tiles: 3 triplets + pair + 1 extra tile
  const hand = [
    t('a1', ['beta']), t('a2', ['beta']), t('a3', ['beta']),
    t('b1', ['gamma']), t('b2', ['gamma']), t('b3', ['gamma']),
    t('c1', ['delta']), t('c2', ['delta']), t('c3', ['delta']),
    t('d1', ['alpha']), t('d2', ['alpha']),
    t('e1', ['junk']), // discarding this leaves tenpai
  ]
  assert(canDeclareRiichi(hand), 'can declare riichi with 12 tiles and valid discard')
}

// ────────────────────────────────────────────────
console.log('\n6. canDeclareRiichi — false when no discard leaves tenpai')
{
  // 12 tiles with all unique tags — no triplets possible
  const hand = Array.from({ length: 12 }, (_, i) => t(`u${i}`, [`unique-${i}`]))
  assert(!canDeclareRiichi(hand), 'cannot declare riichi when no discard leaves tenpai')
}

// ────────────────────────────────────────────────
console.log('\n7. getRiichiDiscards — returns valid discard tiles')
{
  const hand = [
    t('a1', ['beta']), t('a2', ['beta']), t('a3', ['beta']),
    t('b1', ['gamma']), t('b2', ['gamma']), t('b3', ['gamma']),
    t('c1', ['delta']), t('c2', ['delta']), t('c3', ['delta']),
    t('d1', ['alpha']), t('d2', ['alpha']),
    t('e1', ['junk']),
  ]
  const discards = getRiichiDiscards(hand)
  assert(discards.length > 0, 'at least one valid riichi discard')
  assert(discards.some(d => d.id === 'e1'), 'junk tile is a valid riichi discard')
}

// ────────────────────────────────────────────────
console.log('\n8. declareRiichi — sets riichi flag on player')
{
  const runner = new GameRunner()
  runner.start()

  const hand12 = [
    t('a1', ['beta']), t('a2', ['beta']), t('a3', ['beta']),
    t('b1', ['gamma']), t('b2', ['gamma']), t('b3', ['gamma']),
    t('c1', ['delta']), t('c2', ['delta']), t('c3', ['delta']),
    t('d1', ['alpha']), t('d2', ['alpha']),
    t('e1', ['junk']),
  ]

  injectState(runner, {
    phase: 'discard',
    currentPlayer: 0,
    players: [
      { id: 0, name: 'P0', hand: hand12, discards: [], isHuman: true, riichi: false },
      { id: 1, name: 'P1', hand: Array.from({ length: 11 }, (_, i) => t(`p1-${i}`, [`u1-${i}`])), discards: [], isHuman: false, riichi: false },
      { id: 2, name: 'P2', hand: Array.from({ length: 11 }, (_, i) => t(`p2-${i}`, [`u2-${i}`])), discards: [], isHuman: false, riichi: false },
      { id: 3, name: 'P3', hand: Array.from({ length: 11 }, (_, i) => t(`p3-${i}`, [`u3-${i}`])), discards: [], isHuman: false, riichi: false },
    ],
  })

  const snap = runner.declareRiichi(0 as PlayerId)
  assert(runner.getState().players[0].riichi === true, 'player 0 riichi flag is set')
  assert(snap.phase === 'discard', 'still in discard phase after declaring')
}

// ────────────────────────────────────────────────
console.log('\n9. declareRiichi errors')
{
  const runner = new GameRunner()
  runner.start()

  // Wrong phase
  injectState(runner, { phase: 'draw' })
  assertThrows(() => runner.declareRiichi(0 as PlayerId), 'throws in draw phase')

  // Already in riichi
  injectState(runner, {
    phase: 'discard',
    currentPlayer: 0,
    players: [
      { id: 0, name: 'P0', hand: Array.from({ length: 12 }, (_, i) => t(`x${i}`, ['tag'])), discards: [], isHuman: true, riichi: true },
      { id: 1, name: 'P1', hand: [], discards: [], isHuman: false, riichi: false },
      { id: 2, name: 'P2', hand: [], discards: [], isHuman: false, riichi: false },
      { id: 3, name: 'P3', hand: [], discards: [], isHuman: false, riichi: false },
    ],
  })
  assertThrows(() => runner.declareRiichi(0 as PlayerId), 'throws when already in riichi')

  // Wrong player
  injectState(runner, {
    phase: 'discard',
    currentPlayer: 1,
    players: [
      { id: 0, name: 'P0', hand: [], discards: [], isHuman: true, riichi: false },
      { id: 1, name: 'P1', hand: Array.from({ length: 12 }, (_, i) => t(`x${i}`, ['tag'])), discards: [], isHuman: false, riichi: false },
      { id: 2, name: 'P2', hand: [], discards: [], isHuman: false, riichi: false },
      { id: 3, name: 'P3', hand: [], discards: [], isHuman: false, riichi: false },
    ],
  })
  assertThrows(() => runner.declareRiichi(0 as PlayerId), 'throws when not your turn')
}

// ────────────────────────────────────────────────
console.log('\n10. Riichi auto-discard — discards drawn tile when not winning')
{
  const runner = new GameRunner()
  runner.start()

  const hand11 = [
    t('a1', ['beta']), t('a2', ['beta']), t('a3', ['beta']),
    t('b1', ['gamma']), t('b2', ['gamma']), t('b3', ['gamma']),
    t('c1', ['delta']), t('c2', ['delta']), t('c3', ['delta']),
    t('d1', ['alpha']), t('d2', ['alpha']),
  ]
  const drawnTile = t('drawn-junk', ['junk'])

  injectState(runner, {
    phase: 'discard',
    currentPlayer: 0,
    lastDrawnTileId: 'drawn-junk',
    wall: Array.from({ length: 10 }, (_, i) => t(`w-${i}`, ['wall'])),
    players: [
      { id: 0, name: 'P0', hand: [...hand11, drawnTile], discards: [], isHuman: true, riichi: true },
      { id: 1, name: 'P1', hand: Array.from({ length: 11 }, (_, i) => t(`p1-${i}`, [`u1-${i}`])), discards: [], isHuman: false, riichi: false },
      { id: 2, name: 'P2', hand: Array.from({ length: 11 }, (_, i) => t(`p2-${i}`, [`u2-${i}`])), discards: [], isHuman: false, riichi: false },
      { id: 3, name: 'P3', hand: Array.from({ length: 11 }, (_, i) => t(`p3-${i}`, [`u3-${i}`])), discards: [], isHuman: false, riichi: false },
    ],
  })

  const snap = runner.riichiAutoDiscard(0 as PlayerId)
  assert(snap !== null, 'auto-discard returns a snapshot')
  assert(runner.getState().players[0].hand.length === 11, 'P0 back to 11 tiles')
  assert(runner.getState().players[0].discards.some(d => d.id === 'drawn-junk'), 'drawn tile was discarded')
}

// ────────────────────────────────────────────────
console.log('\n11. Riichi auto-discard — does NOT discard when hand is winning')
{
  const runner = new GameRunner()
  runner.start()

  // 4 complete triplets = winning hand
  const winningHand = [
    t('a1', ['beta']), t('a2', ['beta']), t('a3', ['beta']),
    t('b1', ['gamma']), t('b2', ['gamma']), t('b3', ['gamma']),
    t('c1', ['delta']), t('c2', ['delta']), t('c3', ['delta']),
    t('d1', ['alpha']), t('d2', ['alpha']), t('d3', ['alpha']),
  ]

  injectState(runner, {
    phase: 'discard',
    currentPlayer: 0,
    lastDrawnTileId: 'd3',
    wall: Array.from({ length: 10 }, (_, i) => t(`w-${i}`, ['wall'])),
    players: [
      { id: 0, name: 'P0', hand: winningHand, discards: [], isHuman: true, riichi: true },
      { id: 1, name: 'P1', hand: Array.from({ length: 11 }, (_, i) => t(`p1-${i}`, [`u1-${i}`])), discards: [], isHuman: false, riichi: false },
      { id: 2, name: 'P2', hand: Array.from({ length: 11 }, (_, i) => t(`p2-${i}`, [`u2-${i}`])), discards: [], isHuman: false, riichi: false },
      { id: 3, name: 'P3', hand: Array.from({ length: 11 }, (_, i) => t(`p3-${i}`, [`u3-${i}`])), discards: [], isHuman: false, riichi: false },
    ],
  })

  const result = runner.riichiAutoDiscard(0 as PlayerId)
  assert(result === null, 'auto-discard returns null for winning hand')
  assert(runner.getState().players[0].hand.length === 12, 'hand still has 12 tiles')
}

// ────────────────────────────────────────────────
console.log('\n12. Riichi players cannot call pon')
{
  const runner = new GameRunner()
  runner.start()

  const discarded = t('d1', ['fruit'])
  injectState(runner, {
    players: [
      { id: 0, name: 'P0', hand: [], discards: [], isHuman: true, riichi: false },
      { id: 1, name: 'P1', hand: [t('a', ['fruit']), t('b', ['fruit'])], discards: [], isHuman: false, riichi: true },
      { id: 2, name: 'P2', hand: [t('c', ['fruit']), t('d', ['fruit'])], discards: [], isHuman: false, riichi: false },
      { id: 3, name: 'P3', hand: [], discards: [], isHuman: false, riichi: false },
    ],
  })

  const candidates = runner.checkPon(discarded, 0 as PlayerId)
  assert(!candidates.some(c => c.playerId === 1), 'riichi player P1 cannot pon')
  assert(candidates.some(c => c.playerId === 2), 'non-riichi player P2 can pon')
}

// ────────────────────────────────────────────────
console.log('\n13. Riichi event is emitted')
{
  const runner = new GameRunner()
  runner.start()

  const events: string[] = []
  runner.on((event) => events.push(event))

  const hand12 = [
    t('a1', ['beta']), t('a2', ['beta']), t('a3', ['beta']),
    t('b1', ['gamma']), t('b2', ['gamma']), t('b3', ['gamma']),
    t('c1', ['delta']), t('c2', ['delta']), t('c3', ['delta']),
    t('d1', ['alpha']), t('d2', ['alpha']),
    t('e1', ['junk']),
  ]

  injectState(runner, {
    phase: 'discard',
    currentPlayer: 0,
    players: [
      { id: 0, name: 'P0', hand: hand12, discards: [], isHuman: true, riichi: false },
      { id: 1, name: 'P1', hand: [], discards: [], isHuman: false, riichi: false },
      { id: 2, name: 'P2', hand: [], discards: [], isHuman: false, riichi: false },
      { id: 3, name: 'P3', hand: [], discards: [], isHuman: false, riichi: false },
    ],
  })

  runner.declareRiichi(0 as PlayerId)
  assert(events.includes('riichi-declared'), 'riichi-declared event emitted')
  assert(events.includes('state-changed'), 'state-changed event emitted')
}

// ────────────────────────────────────────────────
console.log('\n\n' + '='.repeat(40))
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  process.exit(1)
} else {
  console.log('All riichi tests passed! ✨')
}
