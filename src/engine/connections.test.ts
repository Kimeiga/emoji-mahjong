import assert from 'node:assert/strict'
import { analyzeConnections, winningConnectionTags } from './connections'
import { chooseLesson, initialLesson, lesson, nextLesson } from './lesson'
import { findSharedTags, isWinningHand } from './sets'
import type { RevealedSet, Tile } from '../types'

let checks = 0
function test(name: string, run: () => void) { run(); checks++; console.log(`PASS ${name}`) }
const tile = (id: string, ...tags: string[]): Tile => ({ id, emoji: id, name: id, tags })
const trio = (tag: string) => [tile(`${tag}-1`, tag), tile(`${tag}-2`, tag), tile(`${tag}-3`, tag)]
const group = (tag: string): RevealedSet => ({ playerId: 0, tag, tiles: trio(tag) })

test('overlapping connections never inflate the progress count', () => {
  const hand = [tile('a', 'red'), tile('b', 'red', 'fruit'), tile('c', 'red', 'fruit'), tile('d', 'fruit')]
  const a = analyzeConnections(hand, [])
  assert.equal(a.complete, 1)
  assert.ok(a.options.some(option => option.overlaps.length > 0))
  assert.equal(new Set(a.groups.flatMap(g => g.tiles.map(t => t.id))).size, 3)
})
test('distinct disjoint sets are counted and physically represented', () => {
  const a = analyzeConnections([...trio('fruit'), ...trio('sport')], [])
  assert.equal(a.complete, 2)
  assert.equal(new Set(a.groups.map(g => g.tag)).size, 2)
  assert.ok(a.groups.every(g => !g.locked && g.tiles.length === 3))
})
test('PON tags stay unavailable even when concealed tiles share them', () => {
  const a = analyzeConnections([...trio('fruit'), ...trio('sport')], [group('fruit')])
  assert.equal(a.complete, 2)
  assert.equal(a.groups[0].locked, true)
  assert.equal(a.options.find(o => o.tag === 'fruit')?.lockedTag, true)
  assert.ok(!a.pairs.some(pair => pair.tag === 'fruit'))
})
test('preview is stable under reordering and never mutates inputs', () => {
  const hand = [...trio('fruit'), ...trio('sport')]
  const snapshot = JSON.stringify(hand)
  assert.deepEqual(analyzeConnections(hand, []).groups, analyzeConnections([...hand].reverse(), []).groups)
  assert.equal(JSON.stringify(hand), snapshot)
})
test('leftover pair feedback does not reuse tiles from the displayed groups', () => {
  const a = analyzeConnections([...trio('fruit'), tile('v1', 'vehicle'), tile('v2', 'vehicle')], [])
  assert.equal(a.pairs[0].tag, 'vehicle')
  assert.equal(a.pairs[0].tiles.length, 2)
  const used = new Set(a.groups.flatMap(g => g.tiles.map(t => t.id)))
  assert.ok(a.pairs[0].tiles.every(t => !used.has(t.id)))
})
test('one-away feedback requires an actual winning decomposition', () => {
  const hand = [...trio('a'), ...trio('b'), ...trio('c'), tile('d1', 'd'), tile('d2', 'd')]
  assert.deepEqual(winningConnectionTags(hand, []), ['d'])
  assert.deepEqual(winningConnectionTags(hand.slice(0, -1), []), [])
  assert.deepEqual(winningConnectionTags([...hand, tile('junk', 'nothing')], []), [])
})
test('one-away feedback preserves fixed meld tags', () => {
  const hand = [...trio('b'), ...trio('c'), tile('a1', 'a'), tile('a2', 'a')]
  assert.deepEqual(winningConnectionTags(hand, [group('a')]), [])
  assert.deepEqual(winningConnectionTags([...trio('b'), ...trio('c'), tile('d1', 'd'), tile('d2', 'd')], [group('a')]), ['d'])
})
test('two broadly shared tags may coexist using different trios', () => {
  const hand = Array.from({length:6}, (_, i) => tile(`t${i}`, 'animal', 'furry'))
  const a = analyzeConnections(hand, [])
  assert.equal(a.complete, 2)
  assert.equal(new Set(a.groups.flatMap(g => g.tiles.map(t => t.id))).size, 6)
})
test('empty and concealed-empty views have no invented connections', () => {
  assert.equal(analyzeConnections([], []).complete, 0)
  assert.deepEqual(analyzeConnections([], []).options, [])
  assert.deepEqual(winningConnectionTags([], []), [])
})
test('lesson uses real distinct game tiles and shared tags', () => {
  const hand = [...lesson.fruit, ...lesson.sweet, ...lesson.sport, ...lesson.vehicle]
  assert.equal(new Set(hand.map(t => t.id)).size, 12)
  for (const tag of ['fruit', 'sweet', 'sport', 'vehicle'] as const) assert.ok(findSharedTags(lesson[tag]).includes(tag))
  assert.ok(isWinningHand(hand))
})
test('lesson cannot advance without a successful action', () => {
  assert.deepEqual(nextLesson(initialLesson), initialLesson)
  const wrong = chooseLesson(initialLesson, lesson.firstMarket[1].id)
  assert.equal(wrong.solved, false)
  assert.deepEqual(nextLesson(wrong), wrong)
  const correct = chooseLesson(wrong, lesson.fruit[2].id)
  assert.equal(correct.solved, true)
  assert.deepEqual(chooseLesson(correct, 'bogus'), correct)
  assert.equal(nextLesson(correct).step, 1)
})
test('lesson rejects reuse of fruit and accepts the overlapping sweet tag', () => {
  const state = { step: 1, solved: false, feedback: '' }
  assert.equal(chooseLesson(state, 'fruit').solved, false)
  assert.equal(chooseLesson(state, 'sweet').solved, true)
})
test('guided discard explains a strategic error without calling it illegal', () => {
  const state = { step: 2, solved: false, feedback: '' }
  const wrong = chooseLesson(state, lesson.fruit[0].id)
  assert.equal(wrong.solved, false)
  assert.match(wrong.feedback, /allowed in a match/)
  assert.equal(chooseLesson(state, lesson.spare.id).solved, true)
})
test('final lesson choice wins through the same engine as a real match', () => {
  const state = { step: 3, solved: false, feedback: '' }
  assert.equal(chooseLesson(state, lesson.vehicle[2].id).solved, true)
  for (const t of lesson.finalMarket.slice(1)) assert.equal(chooseLesson(state, t.id).solved, false)
  assert.equal(nextLesson({ ...state, solved: true }).step, 3)
})
console.log(JSON.stringify({ connectionAndLessonChecks: checks }))
