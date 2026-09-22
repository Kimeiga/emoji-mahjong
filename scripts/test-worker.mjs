import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { Miniflare } from 'miniflare'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const directory = await mkdtemp(join(tmpdir(), 'mahjong-worker-'))
const scriptPath = join(directory, 'worker.mjs')
await build({ entryPoints: ['worker/index.ts'], outfile: scriptPath, bundle: true, format: 'esm', platform: 'browser', target: 'es2023' })
const options = {
  modules: true, modulesRoot: directory, scriptPath, compatibilityDate: '2025-01-01',
  durableObjects: {
    GAME_ROOM: { className: 'GameRoom', useSQLite: true },
    ROOM_REGISTRY: { className: 'RoomRegistry', useSQLite: true },
  },
  durableObjectsPersist: join(directory, 'storage'),
}
let mf = new Miniflare(options)
const clients = []
let checks = 0
function pass(name) { checks++; console.log(`PASS ${name}`) }
async function client(code) {
  const response = await mf.dispatchFetch(`http://localhost/api/rooms/${code}/ws`, { headers: { Upgrade: 'websocket' } })
  assert.equal(response.status, 101)
  const ws = response.webSocket; ws.accept(); clients.push(ws)
  const messages = []
  ws.addEventListener('message', event => messages.push(JSON.parse(event.data)))
  return {
    ws, messages,
    send: message => ws.send(JSON.stringify(message)),
    async next(predicate) {
      const end = Date.now() + 10_000
      while (Date.now() < end) {
        const index = messages.findIndex(predicate)
        if (index >= 0) return messages.splice(index, 1)[0]
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      throw new Error(`Timed out waiting for ${predicate.toString()}: ${JSON.stringify(messages).slice(0, 300)}`)
    },
  }
}
try {
  const response = await mf.dispatchFetch('http://localhost/api/rooms', { method: 'POST' })
  assert.equal(response.status, 201)
  const { code } = await response.json()
  let one = await client(code); const two = await client(code)
  const stranger = await client(code)
  stranger.send({type:'start'})
  assert.match((await stranger.next(m => m.type === 'error')).message, /Join/)
  pass('unjoined sockets cannot start a room')
  stranger.ws.send('null')
  assert.match((await stranger.next(m => m.type === 'error')).message, /Invalid/)
  pass('malformed WebSocket input is rejected without crashing the room')
  one.send({ type: 'join', playerName: 'Haki' })
  const assignedOne = await one.next(m => m.type === 'assigned')
  assert.ok(assignedOne.resumeToken)
  two.send({ type: 'join', playerName: 'Angi' })
  const assignedTwo = await two.next(m => m.type === 'assigned')
  assert.equal(assignedTwo.playerId, 1)
  one.send({ type: 'join', playerName: 'Haki' })
  assert.equal((await one.next(m => m.type === 'assigned')).playerId, 0)
  pass('duplicate join is idempotent and does not consume another seat')
  one.ws.close()
  await new Promise(resolve => setTimeout(resolve, 100))
  one = await client(code)
  one.send({type:'join',playerName:'Haki',resumeToken:assignedOne.resumeToken})
  assert.equal((await one.next(m=>m.type==='assigned')).playerId, 0)
  pass('lobby reload recovers the original token-protected seat')
  one.send({ type: 'start' })
  const first = (await one.next(m => m.type === 'game-state')).state
  await two.next(m => m.type === 'game-state')
  assert.equal(first.players[0].hand.length, 11)
  assert.equal(first.players[1].hand.length, 0)
  assert.equal(first.players[1].handSize, 11)
  pass('real Worker sends only the receiving player their concealed tiles')
  stranger.send({ type: 'join', playerName: 'Haki' })
  assert.equal((await stranger.next(m => m.type === 'error')).code, 'SESSION_INVALID')
  pass('knowing another player name cannot take over a token-protected seat')
  one.send({ type: 'rematch' })
  assert.match((await one.next(m => m.type === 'error')).message, /Finish/)
  pass('rematch cannot reset an active match')
  one.send({ type: 'pick-market', tileId: first.market[0].id })
  const picked = (await one.next(m => m.type === 'game-state')).state
  assert.equal(picked.phase, 'discard')
  assert.equal(picked.players[0].hand.length, 12)
  pass('market pick moves exactly one tile to the active hand')
  one.ws.close(); two.ws.close(); stranger.ws.close()
  await new Promise(resolve => setTimeout(resolve, 150))
  const again = await client(code)
  again.send({ type: 'join', playerName: 'Haki', resumeToken: assignedOne.resumeToken })
  await again.next(m => m.type === 'assigned')
  const resumed = (await again.next(m => m.type === 'game-state')).state
  assert.equal(resumed.phase, picked.phase)
  assert.deepEqual(resumed.players[0].hand, picked.players[0].hand)
  assert.equal(resumed.gameStartedAt, picked.gameStartedAt)
  pass('all players can disconnect and resume the same hand, phase and start time')
  again.ws.close()
  await new Promise(resolve => setTimeout(resolve, 100))
  await mf.dispose(); mf = new Miniflare(options)
  const restored = await client(code)
  restored.send({ type: 'join', playerName: 'Haki', resumeToken: assignedOne.resumeToken })
  await restored.next(m => m.type === 'assigned')
  const state = (await restored.next(m => m.type === 'game-state')).state
  assert.deepEqual(state.players[0].hand, picked.players[0].hand)
  assert.equal(state.gameStartedAt, picked.gameStartedAt)
  assert.equal(state.phase, picked.phase)
  pass('a new workerd process restores persisted room state and resume tokens')
  const partner = await client(code)
  partner.send({type:'join', playerName:'Angi', resumeToken:assignedTwo.resumeToken})
  assert.equal((await partner.next(m=>m.type==='assigned')).playerId, 1)
  const partnerState = (await partner.next(m=>m.type==='game-state')).state
  assert.equal(partnerState.players[0].hand.length, 0)
  assert.equal(partnerState.players[1].hand.length, 11)
  pass('the second player also recovers their original seat with private snapshots')
  const fourCode = (await (await mf.dispatchFetch('http://localhost/api/rooms', {method:'POST'})).json()).code
  const group = []
  for (let i=0;i<4;i++) {
    const c=await client(fourCode); c.send({type:'join',playerName:`Player${i}`})
    await c.next(m=>m.type==='assigned'); group.push(c)
  }
  group[3].send({type:'leave'})
  await group[0].next(m=>m.type==='room-state' && m.players.length===3)
  const replacement = await client(fourCode)
  replacement.send({type:'join',playerName:'Replacement'})
  assert.equal((await replacement.next(m=>m.type==='assigned')).playerId,3)
  group[3]=replacement
  pass('intentional lobby exit frees the seat without duplicate seat IDs')
  for(const c of group) c.messages.length=0
  group[0].send({type:'start'})
  let views=await Promise.all(group.map(c=>c.next(m=>m.type==='game-state').then(m=>m.state)))
  for(let step=0;step<500;step++) {
    const state=views[0]
    if(state.phase==='win'||state.phase==='draw-game') break
    const pid=state.phase==='pon-available' ? views.findIndex(v=>v.ponAvailable) : state.currentPlayer
    assert.ok(pid>=0)
    const view=views[pid]
    for(const c of group) c.messages.length=0
    if(view.phase==='pon-available') group[pid].send({type:'decline-pon',tileId:view.ponAvailable.tile.id})
    else if(view.phase==='draw') group[pid].send(view.wallSize ? {type:'draw-blind'} : {type:'pick-market',tileId:view.market[0].id})
    else group[pid].send({type:'discard',tileId:view.legalDiscardIds[0]})
    views=await Promise.all(group.map(c=>c.next(m=>m.type==='game-state').then(m=>m.state)))
  }
  assert.ok(['win','draw-game'].includes(views[0].phase))
  pass('four human clients complete a real Worker match through legal network actions')
  group[3].ws.close(); await new Promise(resolve=>setTimeout(resolve,100))
  for(let i=0;i<3;i++) group[i].send({type:'rematch'})
  await group[0].next(m=>m.type==='rematch-starting')
  const rematched=(await group[0].next(m=>m.type==='game-state')).state
  assert.equal(rematched.players[3].isHuman,false)
  assert.equal(rematched.phase,'draw')
  pass('rematch substitutes a bot for disconnected humans instead of reserving a stuck turn')
  group[0].send({type:'leave'})
  const afterLeave=(await group[1].next(m=>m.type==='game-state' && !m.state.players[0].isHuman)).state
  assert.equal(afterLeave.players[0].handSize,11)
  pass('intentional mid-game exit gives the same hand to a bot')
  console.log(JSON.stringify({ workerIntegrationChecks: checks }))
} finally {
  for (const ws of clients) { try { ws.close() } catch {} }
  await mf.dispose()
  await rm(directory, {recursive: true, force: true})
}
