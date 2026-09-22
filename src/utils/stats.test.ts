import assert from 'node:assert/strict'
import { getStats, getStatsSnapshot, recordResult, subscribeStats } from './stats'
const values = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value) },
} })
let notified = 0
const unsubscribe = subscribeStats(() => { notified++ })
recordResult('loss', 'match-1')
assert.deepEqual(getStats(), {wins:0, losses:1, draws:0, gamesPlayed:1})
assert.equal(notified, 1)
console.log('PASS result counters notify the UI immediately')
recordResult('loss', 'match-1')
assert.equal(getStats().gamesPlayed, 1)
assert.equal(notified, 1)
console.log('PASS reopening the same result cannot double-count')
recordResult('win', 'match-2')
recordResult('draw', 'match-3')
assert.deepEqual(getStats(), {wins:1, losses:1, draws:1, gamesPlayed:3})
console.log('PASS rematches receive independent result records')
assert.deepEqual(getStats('{"wins":-1,"losses":1.5,"draws":"bad","gamesPlayed":null}'), {wins:0, losses:0, draws:0, gamesPlayed:0})
console.log('PASS corrupt or invalid saved counters are safe')
const saved = getStatsSnapshot()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('Storage blocked') } })
assert.equal(getStatsSnapshot(), saved)
recordResult('win', 'match-4')
assert.equal(getStats().wins, 2)
unsubscribe()
console.log('PASS disabled storage retains in-memory counters without crashing')
