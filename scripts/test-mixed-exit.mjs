import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { Miniflare } from 'miniflare'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// Exercise the production Worker over real WebSockets, with isolated durable storage.
const directory = await mkdtemp(join(tmpdir(), 'mahjong-mixed-exit-'))
const scriptPath = join(directory, 'worker.mjs')
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
let passed = 0
let failed = 0

async function scenario({ started, exit, restart }) {
  const storage = await mkdtemp(join(directory, 'storage-'))
  const options = {
    modules: true, modulesRoot: directory, scriptPath, compatibilityDate: '2025-01-01',
    durableObjects: {
      GAME_ROOM: { className: 'GameRoom', useSQLite: true },
      ROOM_REGISTRY: { className: 'RoomRegistry', useSQLite: true },
    },
    durableObjectsPersist: storage,
  }
  let mf = new Miniflare(options)
  const sockets = []

  async function client(code) {
    const response = await mf.dispatchFetch(`http://localhost/api/rooms/${code}/ws`, {
      headers: { Upgrade: 'websocket' },
    })
    assert.equal(response.status, 101)
    const ws = response.webSocket
    ws.accept()
    sockets.push(ws)
    const messages = []
    ws.addEventListener('message', event => messages.push(JSON.parse(event.data)))
    const closed = new Promise(resolve => ws.addEventListener('close', resolve, { once: true }))
    return {
      ws, messages,
      send(message) { ws.send(JSON.stringify(message)) },
      async next(predicate) {
        const deadline = Date.now() + 10_000
        while (Date.now() < deadline) {
          const index = messages.findIndex(predicate)
          if (index >= 0) return messages.splice(index, 1)[0]
          await delay(10)
        }
        throw new Error(`Timed out waiting for ${predicate.toString()}`)
      },
      async leave() {
        this.send({ type: 'leave' })
        let timeout
        try {
          const event = await Promise.race([
            closed,
            new Promise((_, reject) => {
              timeout = setTimeout(() => reject(new Error('Leave was not acknowledged')), 10_000)
            }),
          ])
          assert.equal(event.code, 1000)
          assert.equal(event.reason, 'Left room')
        } finally { clearTimeout(timeout) }
      },
    }
  }

  async function joinClient(code, name, resumeToken) {
    const connection = await client(code)
    connection.send({ type: 'join', playerName: name, ...(resumeToken ? { resumeToken } : {}) })
    const response = await connection.next(m => m.type === 'assigned' || m.type === 'error')
    assert.equal(response.type, 'assigned', `${name} could not resume: ${JSON.stringify(response)}`)
    return { connection, seat: response }
  }

  try {
    const response = await mf.dispatchFetch('http://localhost/api/rooms', { method: 'POST' })
    assert.equal(response.status, 201)
    const { code } = await response.json()
    // The departing player is seat zero, so a preserved active match must pause a bot turn.
    const departing = await joinClient(code, 'Departing')
    const retained = await joinClient(code, 'Retained')
    assert.equal(departing.seat.playerId, 0)
    assert.equal(retained.seat.playerId, 1)
    await departing.connection.next(m => m.type === 'room-state' && m.players.length === 2)
    let before
    if (started) {
      departing.connection.send({ type: 'start' })
      before = (await retained.connection.next(m => m.type === 'game-state')).state
      assert.equal(before.phase, 'draw')
      assert.equal(before.currentPlayer, 0)
    }
    departing.connection.messages.length = 0
    if (exit === 'both-leave') await retained.connection.leave()
    else retained.connection.ws.close()
    // Wait for the server to observe the first departure; no fixed sleep orders the events.
    await departing.connection.next(m => m.type === 'room-state' && (
      exit === 'both-leave'
        ? !m.players.some(p => p.id === 1 && p.isHuman)
        : m.players.some(p => p.id === 1 && p.isHuman && !p.connected)
    ))
    if (exit === 'both-disconnect') departing.connection.ws.close()
    else await departing.connection.leave()

    // A response is sent only after the room's serialized durable-state queue completes.
    const barrier = await client(code)
    barrier.send({ type: 'start' })
    assert.match((await barrier.next(m => m.type === 'error')).message, /Join/)
    if (exit !== 'both-disconnect') {
      barrier.send({ type: 'join', playerName: 'Departing', resumeToken: departing.seat.resumeToken })
      assert.equal((await barrier.next(m => m.type === 'error')).code, 'SESSION_INVALID')
    }
    // Longer than the AI draw delay: no connected humans means the bot must stay paused.
    await delay(900)
    if (restart) {
      await mf.dispose()
      mf = new Miniflare(options)
    }

    if (exit === 'both-leave') {
      const rejected = await client(code)
      for (const player of [departing, retained]) {
        rejected.send({ type: 'join', playerName: 'Old seat', resumeToken: player.seat.resumeToken })
        assert.equal((await rejected.next(m => m.type === 'error')).code, 'SESSION_INVALID')
      }
      const fresh = await joinClient(code, 'Fresh')
      assert.equal(fresh.seat.playerId, 0)
      const lobby = await fresh.connection.next(m => m.type === 'room-state')
      assert.equal(lobby.gameStarted, false)
      assert.equal(lobby.players.length, 1)
      return
    }

    const resumed = await joinClient(code, 'Retained', retained.seat.resumeToken)
    assert.equal(resumed.seat.playerId, retained.seat.playerId)
    assert.equal(resumed.seat.resumeToken, retained.seat.resumeToken)
    const lobby = await resumed.connection.next(m => m.type === 'room-state')
    assert.equal(lobby.gameStarted, started)
    assert.ok(lobby.players.some(p => p.id === 1 && p.isHuman && p.connected))
    if (started) {
      const state = (await resumed.connection.next(m => m.type === 'game-state')).state
      assert.deepEqual(state.players[1].hand, before.players[1].hand)
      assert.equal(state.gameStartedAt, before.gameStartedAt)
      assert.equal(state.phase, before.phase)
      assert.equal(state.currentPlayer, before.currentPlayer)
      assert.equal(state.turnCount, before.turnCount)
      assert.equal(state.wallSize, before.wallSize)
      assert.deepEqual(state.market, before.market)
      assert.deepEqual(state.revealedSets, before.revealedSets)
      assert.equal(state.players[0].isHuman, exit === 'both-disconnect')
      if (exit === 'mixed') {
        // Rejoining restarts the departed player's bot, rather than stranding the saved game.
        const advanced = (await resumed.connection.next(m => m.type === 'game-state' && m.state.phase !== 'draw')).state
        assert.equal(advanced.players[0].handSize, 12)
        assert.deepEqual(advanced.players[1].hand, before.players[1].hand)
      }
    } else if (exit === 'mixed') {
      assert.equal(lobby.players.length, 1)
      const replacement = await joinClient(code, 'Replacement')
      assert.equal(replacement.seat.playerId, departing.seat.playerId)
      const updated = await resumed.connection.next(m => m.type === 'room-state' && m.players.length === 2)
      assert.deepEqual(updated.players.map(p => p.id), [0, 1])
    }
    if (exit === 'both-disconnect') {
      const second = await joinClient(code, 'Departing', departing.seat.resumeToken)
      assert.equal(second.seat.playerId, 0)
      assert.equal(second.seat.resumeToken, departing.seat.resumeToken)
    }
  } finally {
    for (const ws of sockets) { try { ws.close() } catch {} }
    await mf.dispose()
    await rm(storage, { recursive: true, force: true })
  }
}

try {
  await build({ entryPoints: ['worker/index.ts'], outfile: scriptPath, bundle: true,
    format: 'esm', platform: 'browser', target: 'es2023' })
  for (const started of [false, true]) {
    for (const exit of ['mixed', 'both-disconnect', 'both-leave']) {
      for (const restart of [false, true]) {
        const label = `${started ? 'game' : 'lobby'}: ${exit}, ${restart ? 'process restart' : 'same process'}`
        try {
          await scenario({ started, exit, restart })
          passed++
          console.log(`PASS ${label}`)
        } catch (error) {
          failed++
          console.error(`FAIL ${label}`, error)
        }
      }
    }
  }
  console.log(JSON.stringify({ mixedExitIntegrationChecks: passed + failed, passed, failed }))
  if (failed) process.exitCode = 1
} finally {
  await rm(directory, { recursive: true, force: true })
}
