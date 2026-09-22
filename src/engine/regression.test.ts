/**
 * Regression tests for gameplay-correctness bugs that previously reached production.
 * Run through: npm test
 */

import { GameRunner } from './game-runner'
import { isWinningHand, isWinningWithRevealedSets } from './sets'
import type { PlayerId, RevealedSet, Tile } from '../types'

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

function t(id: string, tags: string[], emoji = '🔲'): Tile {
  return { id, emoji, name: emoji, tags }
}

function injectState(runner: GameRunner, overrides: Record<string, unknown>) {
  Object.assign((runner as unknown as { state: Record<string, unknown> }).state, overrides)
}

console.log('\n1. Revealed PON sets stay locked to the tag they were claimed with')
{
  const concealed = [
    t('a1', ['alpha']), t('a2', ['alpha']), t('a3', ['alpha']),
    t('g1', ['gamma']), t('g2', ['gamma']), t('g3', ['gamma']),
    t('d1', ['delta']), t('d2', ['delta']), t('d3', ['delta']),
  ]
  const meldTiles = [
    t('m1', ['alpha', 'beta']),
    t('m2', ['alpha', 'beta']),
    t('m3', ['alpha', 'beta']),
  ]
  const revealed: RevealedSet[] = [{ playerId: 0 as PlayerId, tiles: meldTiles, tag: 'alpha' }]

  assert(isWinningHand([...concealed, ...meldTiles]), 'the old global repartition check would accept this hand')
  assert(!isWinningWithRevealedSets(concealed, revealed), 'locked alpha PON prevents reclassifying that meld as beta')
}

console.log('\n2. Valid locked melds still win')
{
  const concealed = [
    t('b1', ['beta']), t('b2', ['beta']), t('b3', ['beta']),
    t('g1', ['gamma']), t('g2', ['gamma']), t('g3', ['gamma']),
    t('d1', ['delta']), t('d2', ['delta']), t('d3', ['delta']),
  ]
  const revealed: RevealedSet[] = [{
    playerId: 0 as PlayerId,
    tiles: [t('a1', ['alpha']), t('a2', ['alpha']), t('a3', ['alpha'])],
    tag: 'alpha',
  }]
  assert(isWinningWithRevealedSets(concealed, revealed), 'three concealed unique-tag triplets plus one valid PON wins')
}

console.log('\n3. AI market behavior respects difficulty')
{
  const hard = new GameRunner({ aiDifficulty: 'hard' })
  hard.start()
  injectState(hard, {
    phase: 'draw',
    currentPlayer: 1,
    market: [t('market-fruit', ['fruit']), t('market-other', ['vehicle'])],
    wall: [t('wall-junk', ['junk'])],
    tagCounts: { fruit: 4, vehicle: 4, junk: 4 },
    players: [
      { id: 0, name: 'P0', hand: [], discards: [], isHuman: true, riichi: false },
      { id: 1, name: 'P1', hand: [t('f1', ['fruit']), t('f2', ['fruit'])], discards: [], isHuman: false, riichi: false },
      { id: 2, name: 'P2', hand: [], discards: [], isHuman: false, riichi: false },
      { id: 3, name: 'P3', hand: [], discards: [], isHuman: false, riichi: false },
    ],
  })
  hard.aiDraw()
  assert(hard.getState().players[1].hand.some(tile => tile.id === 'market-fruit'), 'hard AI takes a market tile that completes a set')

  const easy = new GameRunner({ aiDifficulty: 'easy' })
  easy.start()
  injectState(easy, {
    phase: 'draw',
    currentPlayer: 1,
    market: [t('market-fruit-2', ['fruit'])],
    wall: [t('wall-junk-2', ['junk'])],
    tagCounts: { fruit: 4, junk: 4 },
    players: [
      { id: 0, name: 'P0', hand: [], discards: [], isHuman: true, riichi: false },
      { id: 1, name: 'P1', hand: [t('ef1', ['fruit']), t('ef2', ['fruit'])], discards: [], isHuman: false, riichi: false },
      { id: 2, name: 'P2', hand: [], discards: [], isHuman: false, riichi: false },
      { id: 3, name: 'P3', hand: [], discards: [], isHuman: false, riichi: false },
    ],
  })
  easy.aiDraw()
  assert(easy.getState().players[1].hand.some(tile => tile.id === 'wall-junk-2'), 'easy AI keeps the intended blind-draw behavior')
}

console.log('\n4. Game state survives serialization and keeps its original start time')
{
  const original = new GameRunner({ aiDifficulty: 'hard' })
  const started = original.start()
  const startTime = started.gameStartTime
  assert(startTime > 0, 'game start timestamp is set once when the match begins')

  const restored = new GameRunner({ aiDifficulty: 'hard' })
  restored.restoreState(original.exportState())

  assert(restored.snapshot({ revealAll: true }).gameStartTime === startTime, 'restored game preserves start timestamp')
  assert(
    JSON.stringify(restored.snapshot({ revealAll: true })) === JSON.stringify(original.snapshot({ revealAll: true })),
    'restored runner matches the persisted game state'
  )
}

console.log('\n' + '='.repeat(40))
console.log(`Results: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
console.log('All regression tests passed! ✨')
