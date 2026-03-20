/**
 * Manual test script for all pon (discard-claiming) paths.
 * Run with: npx tsx src/engine/pon.test.ts
 */

import { GameRunner } from './game-runner'
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

/** Helper: make a tile with given tags */
function t(id: string, tags: string[], emoji = '🔲'): Tile {
  return { id, emoji, name: emoji, tags }
}

/**
 * Inject a controlled state into a GameRunner.
 * This lets us set up precise pon scenarios without randomness.
 */
function injectState(runner: GameRunner, overrides: Record<string, any>) {
  const state = (runner as any).state
  Object.assign(state, overrides)
}

// ────────────────────────────────────────────────
console.log('\n1. checkPon — detects pon opportunities')
{
  const runner = new GameRunner()
  runner.start()

  // Give player 1 two tiles tagged "fruit"
  const discarded = t('d1', ['fruit', 'red'])
  injectState(runner, {
    players: [
      { id: 0, name: 'P0', hand: [], discards: [], isHuman: true },
      { id: 1, name: 'P1', hand: [t('a', ['fruit']), t('b', ['fruit', 'sweet'])], discards: [], isHuman: false },
      { id: 2, name: 'P2', hand: [t('c', ['vehicle']), t('d', ['animal'])], discards: [], isHuman: false },
      { id: 3, name: 'P3', hand: [t('e', ['red']), t('f', ['red', 'color'])], discards: [], isHuman: false },
    ],
  })

  const candidates = runner.checkPon(discarded, 0 as PlayerId)
  assert(candidates.length === 2, 'finds 2 pon candidates (P1=fruit, P3=red)')
  assert(candidates[0].playerId === 1, 'P1 is first (seat order after discarder)')
  assert(candidates[0].tag === 'fruit', 'P1 matches on "fruit" tag')
  assert(candidates[1].playerId === 3, 'P3 is second')
  assert(candidates[1].tag === 'red', 'P3 matches on "red" tag')
}

// ────────────────────────────────────────────────
console.log('\n2. checkPon — no pon when nobody has a matching pair')
{
  const runner = new GameRunner()
  runner.start()

  const discarded = t('d1', ['fruit'])
  injectState(runner, {
    players: [
      { id: 0, name: 'P0', hand: [], discards: [], isHuman: true },
      { id: 1, name: 'P1', hand: [t('a', ['fruit']), t('b', ['animal'])], discards: [], isHuman: false },
      { id: 2, name: 'P2', hand: [t('c', ['vehicle'])], discards: [], isHuman: false },
      { id: 3, name: 'P3', hand: [t('e', ['color'])], discards: [], isHuman: false },
    ],
  })

  const candidates = runner.checkPon(discarded, 0 as PlayerId)
  assert(candidates.length === 0, 'no pon candidates when nobody has 2+ matching tiles')
}

// ────────────────────────────────────────────────
console.log('\n3. Discard triggers pon-available phase')
{
  const runner = new GameRunner()
  runner.start()

  // Set up: P0 is about to discard, P1 has a pair matching the discarded tile
  const tileToDiscard = t('discard-me', ['fruit', 'red'])
  injectState(runner, {
    phase: 'discard',
    currentPlayer: 0,
    players: [
      { id: 0, name: 'P0', hand: [tileToDiscard, ...Array.from({ length: 11 }, (_, i) => t(`p0-${i}`, ['unrelated']))], discards: [], isHuman: true },
      { id: 1, name: 'P1', hand: [t('p1-a', ['fruit', 'sweet']), t('p1-b', ['fruit']), ...Array.from({ length: 9 }, (_, i) => t(`p1-${i}`, ['other']))], discards: [], isHuman: false },
      { id: 2, name: 'P2', hand: Array.from({ length: 11 }, (_, i) => t(`p2-${i}`, ['vehicle'])), discards: [], isHuman: false },
      { id: 3, name: 'P3', hand: Array.from({ length: 11 }, (_, i) => t(`p3-${i}`, ['animal'])), discards: [], isHuman: false },
    ],
  })

  const snap = runner.discard('discard-me')
  assert(snap.phase === 'pon-available', 'phase transitions to pon-available')
  assert(snap.ponAvailable !== null, 'ponAvailable is set')
  assert(snap.ponAvailable!.playerId === 1, 'pon opportunity is for P1')
  assert(snap.ponAvailable!.matchingTag === 'fruit', 'matching tag is fruit')
  assert(snap.ponAvailable!.tile.id === 'discard-me', 'claimed tile is the discarded one')
}

// ────────────────────────────────────────────────
console.log('\n4. callPon — successful claim')
{
  const runner = new GameRunner()
  runner.start()

  const tileToDiscard = t('discard-me', ['fruit'])
  const matchA = t('p1-a', ['fruit', 'sweet'])
  const matchB = t('p1-b', ['fruit'])

  // Give each of P1's 9 filler tiles a unique tag so they can't accidentally form triplets
  injectState(runner, {
    phase: 'discard',
    currentPlayer: 0,
    players: [
      { id: 0, name: 'P0', hand: [tileToDiscard, ...Array.from({ length: 11 }, (_, i) => t(`p0-${i}`, [`unique-p0-${i}`]))], discards: [], isHuman: true },
      { id: 1, name: 'P1', hand: [matchA, matchB, ...Array.from({ length: 9 }, (_, i) => t(`p1-${i}`, [`unique-p1-${i}`]))], discards: [], isHuman: false },
      { id: 2, name: 'P2', hand: Array.from({ length: 11 }, (_, i) => t(`p2-${i}`, [`unique-p2-${i}`])), discards: [], isHuman: false },
      { id: 3, name: 'P3', hand: Array.from({ length: 11 }, (_, i) => t(`p3-${i}`, [`unique-p3-${i}`])), discards: [], isHuman: false },
    ],
  })

  runner.discard('discard-me')
  assert(runner.getState().phase === 'pon-available', 'in pon-available phase before callPon')

  const snap = runner.callPon(1 as PlayerId)
  assert(snap.phase === 'discard', 'after callPon, phase is discard (caller must discard)')
  assert(snap.currentPlayer === 1, 'current player is the pon caller (P1)')
  assert(snap.ponAvailable === null, 'ponAvailable is cleared')
  assert(snap.revealedSets.length === 1, 'one revealed set recorded')
  assert(snap.revealedSets[0].tag === 'fruit', 'revealed set tag is fruit')
  assert(snap.revealedSets[0].playerId === 1, 'revealed set belongs to P1')
  assert(snap.revealedSets[0].tiles.length === 3, 'revealed set has 3 tiles')

  // P1 should now have 9 tiles in hand (11 - 2 matching that went to meld)
  const p1 = runner.getState().players[1]
  assert(p1.hand.length === 9, 'P1 has 9 tiles in hand after pon (2 moved to meld)')

  // The discarded tile should have been removed from P0's discards
  const p0 = runner.getState().players[0]
  assert(!p0.discards.find(d => d.id === 'discard-me'), 'claimed tile removed from discarder discards')
}

// ────────────────────────────────────────────────
console.log('\n5. declinePon — game continues normally')
{
  const runner = new GameRunner()
  runner.start()

  const tileToDiscard = t('discard-me', ['fruit'])
  injectState(runner, {
    phase: 'discard',
    currentPlayer: 0,
    turnCount: 1,
    players: [
      { id: 0, name: 'P0', hand: [tileToDiscard, ...Array.from({ length: 11 }, (_, i) => t(`p0-${i}`, ['unrelated']))], discards: [], isHuman: true },
      { id: 1, name: 'P1', hand: [t('p1-a', ['fruit']), t('p1-b', ['fruit']), ...Array.from({ length: 9 }, (_, i) => t(`p1-${i}`, ['other']))], discards: [], isHuman: false },
      { id: 2, name: 'P2', hand: Array.from({ length: 11 }, (_, i) => t(`p2-${i}`, ['vehicle'])), discards: [], isHuman: false },
      { id: 3, name: 'P3', hand: Array.from({ length: 11 }, (_, i) => t(`p3-${i}`, ['animal'])), discards: [], isHuman: false },
    ],
  })

  runner.discard('discard-me')
  assert(runner.getState().phase === 'pon-available', 'in pon-available')

  const snap = runner.declinePon()
  assert(snap.phase === 'draw', 'after decline, phase is draw')
  assert(snap.currentPlayer === 1, 'turn advances to next player after discarder (P1)')
  assert(snap.ponAvailable === null, 'ponAvailable cleared')
}

// ────────────────────────────────────────────────
console.log('\n6. callPon errors — wrong player, wrong phase')
{
  const runner = new GameRunner()
  runner.start()

  // Not in pon-available phase
  assertThrows(() => runner.callPon(0 as PlayerId), 'callPon throws when not in pon-available phase')

  // Set up a pon opportunity for P1
  const tileToDiscard = t('discard-me', ['fruit'])
  injectState(runner, {
    phase: 'discard',
    currentPlayer: 0,
    players: [
      { id: 0, name: 'P0', hand: [tileToDiscard, ...Array.from({ length: 11 }, (_, i) => t(`p0-${i}`, ['unrelated']))], discards: [], isHuman: true },
      { id: 1, name: 'P1', hand: [t('p1-a', ['fruit']), t('p1-b', ['fruit']), ...Array.from({ length: 9 }, (_, i) => t(`p1-${i}`, ['other']))], discards: [], isHuman: false },
      { id: 2, name: 'P2', hand: Array.from({ length: 11 }, (_, i) => t(`p2-${i}`, ['vehicle'])), discards: [], isHuman: false },
      { id: 3, name: 'P3', hand: Array.from({ length: 11 }, (_, i) => t(`p3-${i}`, ['animal'])), discards: [], isHuman: false },
    ],
  })

  runner.discard('discard-me')
  assertThrows(() => runner.callPon(2 as PlayerId), 'callPon throws when wrong player calls')
}

// ────────────────────────────────────────────────
console.log('\n7. declinePon error — wrong phase')
{
  const runner = new GameRunner()
  runner.start()
  assertThrows(() => runner.declinePon(), 'declinePon throws when not in pon-available phase')
}

// ────────────────────────────────────────────────
console.log('\n8. Pon with seat-order priority (discarder is P2)')
{
  const runner = new GameRunner()
  runner.start()

  const discarded = t('d1', ['shared-tag'])
  injectState(runner, {
    phase: 'discard',
    currentPlayer: 2,
    players: [
      { id: 0, name: 'P0', hand: [t('p0-a', ['shared-tag']), t('p0-b', ['shared-tag']), ...Array.from({ length: 9 }, (_, i) => t(`p0-${i}`, ['xyz']))], discards: [], isHuman: true },
      { id: 1, name: 'P1', hand: [t('p1-a', ['shared-tag']), t('p1-b', ['shared-tag']), ...Array.from({ length: 9 }, (_, i) => t(`p1-${i}`, ['xyz']))], discards: [], isHuman: false },
      { id: 2, name: 'P2', hand: [discarded, ...Array.from({ length: 11 }, (_, i) => t(`p2-${i}`, ['other']))], discards: [], isHuman: false },
      { id: 3, name: 'P3', hand: [t('p3-a', ['shared-tag']), t('p3-b', ['shared-tag']), ...Array.from({ length: 9 }, (_, i) => t(`p3-${i}`, ['xyz']))], discards: [], isHuman: false },
    ],
  })

  // P2 discards → seat order check: P3, P0, P1 (all have pairs)
  // First candidate should be P3 (next after P2)
  const snap = runner.discard('d1')
  assert(snap.ponAvailable!.playerId === 3, 'P3 gets priority (first after discarder P2)')
}

// ────────────────────────────────────────────────
console.log('\n9. Multiple pon calls across a game — revealedSets accumulate')
{
  const runner = new GameRunner()
  runner.start()

  // First pon
  const tile1 = t('d1', ['fruit'])
  injectState(runner, {
    phase: 'discard',
    currentPlayer: 0,
    revealedSets: [],
    players: [
      { id: 0, name: 'P0', hand: [tile1, ...Array.from({ length: 11 }, (_, i) => t(`p0-${i}`, ['unrelated']))], discards: [], isHuman: true },
      { id: 1, name: 'P1', hand: [t('p1-a', ['fruit']), t('p1-b', ['fruit']), ...Array.from({ length: 9 }, (_, i) => t(`p1-${i}`, ['other']))], discards: [], isHuman: false },
      { id: 2, name: 'P2', hand: Array.from({ length: 11 }, (_, i) => t(`p2-${i}`, ['vehicle'])), discards: [], isHuman: false },
      { id: 3, name: 'P3', hand: Array.from({ length: 11 }, (_, i) => t(`p3-${i}`, ['animal'])), discards: [], isHuman: false },
    ],
  })
  runner.discard('d1')
  runner.callPon(1 as PlayerId)
  assert(runner.getState().revealedSets.length === 1, 'one revealed set after first pon')

  // P1 must discard — set up another pon opportunity for P2
  const tile2 = t('p1-discard', ['vehicle', 'car'])
  const p1hand = runner.getState().players[1].hand
  // Replace first tile in P1's hand with one that P2 can pon
  p1hand[0] = tile2
  injectState(runner, {
    phase: 'discard',
    currentPlayer: 1,
    players: [
      runner.getState().players[0],
      { ...runner.getState().players[1], hand: p1hand },
      { id: 2, name: 'P2', hand: [t('p2-a', ['vehicle']), t('p2-b', ['vehicle', 'land']), ...Array.from({ length: 9 }, (_, i) => t(`p2x-${i}`, ['zzz']))], discards: [], isHuman: false },
      runner.getState().players[3],
    ],
  })

  runner.discard('p1-discard')
  assert(runner.getState().phase === 'pon-available', 'second pon opportunity arises')
  runner.callPon(2 as PlayerId)
  assert(runner.getState().revealedSets.length === 2, 'two revealed sets after second pon')
  assert(runner.getState().revealedSets[0].playerId === 1, 'first set belongs to P1')
  assert(runner.getState().revealedSets[1].playerId === 2, 'second set belongs to P2')
}

// ────────────────────────────────────────────────
console.log('\n10. Pon leading to win')
{
  const runner = new GameRunner()
  runner.start()

  // P1 has 11 tiles that form 3 triplets (9 tiles) + 2 tiles that share a tag with the discard
  // After claiming, P1 has 12 tiles forming 4 triplets → win
  const tileToDiscard = t('win-tile', ['alpha'])

  // 3 complete triplets (9 tiles)
  const triplet1 = [t('t1a', ['beta']), t('t1b', ['beta']), t('t1c', ['beta'])]
  const triplet2 = [t('t2a', ['gamma']), t('t2b', ['gamma']), t('t2c', ['gamma'])]
  const triplet3 = [t('t3a', ['delta']), t('t3b', ['delta']), t('t3c', ['delta'])]
  // 2 tiles that will form the 4th triplet with the claimed tile
  const pair = [t('p1-x', ['alpha']), t('p1-y', ['alpha'])]

  injectState(runner, {
    phase: 'discard',
    currentPlayer: 0,
    wall: Array.from({ length: 10 }, (_, i) => t(`w-${i}`, ['wall'])),
    players: [
      { id: 0, name: 'P0', hand: [tileToDiscard, ...Array.from({ length: 11 }, (_, i) => t(`p0-${i}`, ['unrelated']))], discards: [], isHuman: true },
      { id: 1, name: 'P1', hand: [...triplet1, ...triplet2, ...triplet3, ...pair], discards: [], isHuman: false },
      { id: 2, name: 'P2', hand: Array.from({ length: 11 }, (_, i) => t(`p2-${i}`, ['vehicle'])), discards: [], isHuman: false },
      { id: 3, name: 'P3', hand: Array.from({ length: 11 }, (_, i) => t(`p3-${i}`, ['animal'])), discards: [], isHuman: false },
    ],
  })

  runner.discard('win-tile')
  assert(runner.getState().phase === 'pon-available', 'pon available before win')

  const snap = runner.callPon(1 as PlayerId)
  assert(snap.phase === 'win', 'calling pon with a winning hand triggers win')
  assert(snap.winner === 1, 'P1 is the winner')
}

// ────────────────────────────────────────────────
console.log('\n11. Event emissions for pon lifecycle')
{
  const runner = new GameRunner()
  runner.start()

  const events: string[] = []
  runner.on((event) => events.push(event))

  const tileToDiscard = t('d-evt', ['fruit'])
  injectState(runner, {
    phase: 'discard',
    currentPlayer: 0,
    players: [
      { id: 0, name: 'P0', hand: [tileToDiscard, ...Array.from({ length: 11 }, (_, i) => t(`p0e-${i}`, ['unrelated']))], discards: [], isHuman: true },
      { id: 1, name: 'P1', hand: [t('p1e-a', ['fruit']), t('p1e-b', ['fruit']), ...Array.from({ length: 9 }, (_, i) => t(`p1e-${i}`, ['other']))], discards: [], isHuman: false },
      { id: 2, name: 'P2', hand: Array.from({ length: 11 }, (_, i) => t(`p2e-${i}`, ['vehicle'])), discards: [], isHuman: false },
      { id: 3, name: 'P3', hand: Array.from({ length: 11 }, (_, i) => t(`p3e-${i}`, ['animal'])), discards: [], isHuman: false },
    ],
  })

  events.length = 0
  runner.discard('d-evt')
  assert(events.includes('tile-discarded'), 'tile-discarded event emitted')
  assert(events.includes('pon-available'), 'pon-available event emitted')
  assert(events.includes('state-changed'), 'state-changed event emitted on discard')

  events.length = 0
  runner.callPon(1 as PlayerId)
  assert(events.includes('pon-called'), 'pon-called event emitted')
  assert(events.includes('state-changed'), 'state-changed event emitted on callPon')
}

// ────────────────────────────────────────────────
console.log('\n12. Event emissions for declined pon')
{
  const runner = new GameRunner()
  runner.start()

  const events: string[] = []
  runner.on((event) => events.push(event))

  const tileToDiscard = t('d-dec', ['fruit'])
  injectState(runner, {
    phase: 'discard',
    currentPlayer: 0,
    players: [
      { id: 0, name: 'P0', hand: [tileToDiscard, ...Array.from({ length: 11 }, (_, i) => t(`p0d-${i}`, ['unrelated']))], discards: [], isHuman: true },
      { id: 1, name: 'P1', hand: [t('p1d-a', ['fruit']), t('p1d-b', ['fruit']), ...Array.from({ length: 9 }, (_, i) => t(`p1d-${i}`, ['other']))], discards: [], isHuman: false },
      { id: 2, name: 'P2', hand: Array.from({ length: 11 }, (_, i) => t(`p2d-${i}`, ['vehicle'])), discards: [], isHuman: false },
      { id: 3, name: 'P3', hand: Array.from({ length: 11 }, (_, i) => t(`p3d-${i}`, ['animal'])), discards: [], isHuman: false },
    ],
  })

  runner.discard('d-dec')
  events.length = 0
  runner.declinePon()
  assert(events.includes('pon-declined'), 'pon-declined event emitted')
  assert(events.includes('turn-changed'), 'turn-changed event emitted after decline')
}

// ────────────────────────────────────────────────
console.log('\n13. Discard with no pon — turn advances normally')
{
  const runner = new GameRunner()
  runner.start()

  const tileToDiscard = t('no-pon', ['unique-tag-nobody-has'])
  injectState(runner, {
    phase: 'discard',
    currentPlayer: 0,
    turnCount: 1,
    players: [
      { id: 0, name: 'P0', hand: [tileToDiscard, ...Array.from({ length: 11 }, (_, i) => t(`p0n-${i}`, ['unrelated']))], discards: [], isHuman: true },
      { id: 1, name: 'P1', hand: Array.from({ length: 11 }, (_, i) => t(`p1n-${i}`, ['abc'])), discards: [], isHuman: false },
      { id: 2, name: 'P2', hand: Array.from({ length: 11 }, (_, i) => t(`p2n-${i}`, ['def'])), discards: [], isHuman: false },
      { id: 3, name: 'P3', hand: Array.from({ length: 11 }, (_, i) => t(`p3n-${i}`, ['ghi'])), discards: [], isHuman: false },
    ],
  })

  const snap = runner.discard('no-pon')
  assert(snap.phase === 'draw', 'no pon → phase is draw')
  assert(snap.currentPlayer === 1, 'turn advances to P1')
  assert(snap.ponAvailable === null, 'no pon opportunity')
}

// ────────────────────────────────────────────────
console.log('\n\n' + '='.repeat(40))
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) {
  process.exit(1)
} else {
  console.log('All pon tests passed! ✨')
}
