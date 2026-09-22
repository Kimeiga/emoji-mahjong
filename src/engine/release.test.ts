import assert from 'node:assert/strict'
import { GameRunner } from './game-runner'
import { isWinningWithRevealedSets } from './sets'
import { findDisplayTriplets } from './triplet-display'
import { parseClientMessage } from '../multiplayer/validation'
import type { PlayerId, Tile } from '../types'
import type { AIDifficulty } from '../multiplayer/protocol'

const t = (id: string, tags: string[]): Tile => ({ id, emoji: id, name: id, tags })
const triple = (tag: string) => [0, 1, 2].map(i => t(`${tag}${i}`, [tag]))
const bots = [0, 1, 2, 3].map(i => ({ name: `Bot ${i}`, isHuman: false }))
let cases = 0
function check(name: string, test: () => void) { test(); cases++; console.log(`PASS ${name}`) }

check('all human opponent hands and PON candidates stay private', () => {
  const runner = new GameRunner()
  runner.start(bots.map(p => ({ ...p, isHuman: true })))
  const state = runner.exportState()
  state.ponAvailable = { playerId: 1, matchingTag: 'test', matchingTiles: [state.players[1].hand[0], state.players[1].hand[1]], tile: state.players[0].hand[0] }
  runner.restoreState(state)
  const snapshot = runner.snapshot({ forPlayer: 0, revealAll: true })
  assert.equal(snapshot.players[0].hand.length, 11)
  assert.ok(snapshot.players.slice(1).every(p => p.hand.length === 0 && p.handSize === 11))
  assert.equal(snapshot.ponAvailable, null)
  assert.equal(runner.snapshot({ forPlayer: 1 }).ponAvailable?.matchingTiles.length, 2)
})
check('winning draw finishes immediately, without a misleading discard', () => {
  const runner = new GameRunner(); runner.start()
  const s = runner.exportState()
  s.players[0].hand = [...triple('a'), ...triple('b'), ...triple('c'), ...triple('d').slice(0, 2)]
  s.market = [t('d2', ['d'])]
  runner.restoreState(s)
  assert.equal(runner.pickMarket('d2').phase, 'win')
  assert.equal(runner.getState().winner, 0)
  assert.ok(runner.getState().gameEndTime >= s.gameStartTime)
})
check('last market pick and discard cannot strand a human on an empty board', () => {
  const runner = new GameRunner(); runner.start()
  const s = runner.exportState(); s.wall = []; s.market = [t('last', ['last'])]
  s.players.forEach(p => { p.hand = Array.from({length: 11}, (_, i) => t(`p${p.id}t${i}`, [`p${p.id}t${i}`])) })
  runner.restoreState(s); runner.pickMarket('last'); runner.discard('last')
  assert.equal(runner.getState().phase, 'draw-game')
})
check('every eligible seat gets a PON chance after the first seat declines', () => {
  const runner = new GameRunner(); runner.start()
  const s = runner.exportState(); s.phase = 'discard'
  s.players[0].hand = [t('discard', ['shared'])]
  s.players[1].hand = [t('1a',['shared']), t('1b',['shared'])]
  s.players[2].hand = [t('2a',['shared']), t('2b',['shared'])]
  s.players[3].hand = []
  runner.restoreState(s); runner.discard('discard')
  assert.equal(runner.getState().ponAvailable?.playerId, 1)
  runner.declinePon()
  assert.equal(runner.getState().ponAvailable?.playerId, 2)
  runner.declinePon(); assert.equal(runner.getState().phase, 'draw')
})
check('riichi declaration requires a legal first discard, then locks the hand', () => {
  const runner = new GameRunner(); runner.start()
  const s = runner.exportState(); s.phase = 'discard'
  s.players[0].hand = [...triple('a'), ...triple('b'), ...triple('c'), ...triple('d').slice(0,2), t('junk',['junk'])]
  s.lastDrawnTileId = 'a0'; runner.restoreState(s); runner.declareRiichi(0)
  assert.equal(runner.riichiAutoDiscard(0), null)
  assert.throws(() => runner.discard('a0'), /Riichi/)
  runner.discard('junk')
  const next = runner.exportState(); next.phase = 'discard'; next.currentPlayer = 0
  next.players[0].hand.push(t('new',['nothing'])); next.lastDrawnTileId = 'new'
  runner.restoreState(next)
  assert.throws(() => runner.discard('a0'), /Riichi/)
  assert.deepEqual(runner.getLegalDiscards(0), ['new'])
  runner.discard('new')
})
check('result decomposition explores combinations rather than taking the first three tiles', () => {
  const hand = [0,1,2].map(i => t(`ab${i}`, ['a','b'])).concat(triple('a'), triple('c'), triple('d'))
  const groups = findDisplayTriplets(hand)
  assert.equal(groups.length, 4)
  assert.equal(new Set(groups.map(g => g.tag)).size, 4)
  assert.equal(new Set(groups.flatMap(g => g.tiles.map(t => t.id))).size, 12)
  assert.equal(findDisplayTriplets(hand, 4, undefined, new Set(['b'])).length, 3)
})
check('untrusted message shapes never become commands', () => {
  for (const raw of ['null','[]','{}','{"type":"join","playerName":3}','{"type":"set-ai-difficulty","difficulty":"impossible"}', '{"type":"discard","tileId":null}', 'x'.repeat(9000)]) assert.equal(parseClientMessage(raw), null)
  assert.deepEqual(parseClientMessage('{"type":"join","playerName":" Haki "}'), {type:'join',playerName:'Haki',resumeToken:undefined})
})
check('invalid numeric discard indices are rejected', () => {
  const runner = new GameRunner(); runner.start(); runner.drawBlind()
  if (runner.getState().phase !== 'discard') return
  assert.throws(() => runner.discard(0.5))
  assert.throws(() => runner.discard(Number.NaN))
})

// Exercise real tile pools, all difficulties, repeated PON chains and serialization.
const originalRandom = Math.random
const outcomes = { wins: 0, draws: 0, actions: 0 }
const started = performance.now()
try {
  for (let seed = 1; seed <= 300; seed++) {
    let x = seed
    Math.random = () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296 }
    const difficulty: AIDifficulty = (['easy', 'medium', 'hard'] as const)[seed % 3]
    const runner = new GameRunner({ aiDifficulty: difficulty }); runner.start(bots)
    let steps = 0
    for (; steps < 500; steps++) {
      const s = runner.getState()
      const tiles = [...s.wall, ...s.market, ...s.players.flatMap(p => [...p.hand, ...p.discards]), ...s.revealedSets.flatMap(m => m.tiles)]
      assert.equal(tiles.length, 80, `conservation seed ${seed} step ${steps}`)
      assert.equal(new Set(tiles.map(t => t.id)).size, 80, `duplicates seed ${seed}`)
      for (const p of s.players) {
        const melds = s.revealedSets.filter(m => m.playerId === p.id)
        const total = p.hand.length + melds.length * 3
        const expected = (s.phase === 'discard' && s.currentPlayer === p.id) || (s.phase === 'win' && s.winner === p.id) ? 12 : 11
        assert.equal(total, expected, `hand count seed ${seed}, player ${p.id}`)
        assert.equal(new Set(melds.map(m => m.tag)).size, melds.length)
      }
      if (s.phase === 'win') {
        const melds = s.revealedSets.filter(m => m.playerId === s.winner)
        const hand = s.players[s.winner!].hand
        assert.ok(isWinningWithRevealedSets(hand, melds), `legal win seed ${seed}`)
        assert.equal(findDisplayTriplets(hand, 4 - melds.length, s.tagCounts, new Set(melds.map(m => m.tag))).length + melds.length, 4)
        outcomes.wins++; break
      }
      if (s.phase === 'draw-game') { outcomes.draws++; break }
      if (steps % 13 === 0) {
        const saved = runner.exportState()
        runner.restoreState(JSON.parse(JSON.stringify(saved)))
        assert.deepEqual(runner.exportState(), saved)
      }
      if (s.phase === 'pon-available') {
        if (Math.random() < 0.6) runner.callPon(s.ponAvailable!.playerId as PlayerId)
        else runner.declinePon()
      } else runner.aiTurn()
      outcomes.actions++
    }
    assert.ok(steps < 500, `game must terminate: seed ${seed}`)
  }
} finally { Math.random = originalRandom }
console.log(JSON.stringify({ releaseCases: cases, simulatedGames: 300, ...outcomes, milliseconds: Math.round(performance.now() - started) }))
