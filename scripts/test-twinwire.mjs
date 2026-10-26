import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {build} from 'esbuild'
import {Miniflare,Log,LogLevel} from 'miniflare'
import {GameClient} from 'twinwire/client'
const parent=path.resolve('artifacts')
await fs.mkdir(parent,{recursive:true})
const directory=await fs.mkdtemp(path.join(parent,'twinwire-worker-'))
const scriptPath=path.join(directory,'worker.mjs')
await build({entryPoints:['worker/index.ts'],outfile:scriptPath,bundle:true,format:'esm',platform:'browser',target:'es2023'})
const options={modules:true,modulesRoot:directory,scriptPath,compatibilityDate:'2025-01-01',durableObjects:{GAME_ROOM:{className:'GameRoom',useSQLite:true},ROOM_REGISTRY:{className:'RoomRegistry',useSQLite:true}},durableObjectsPersist:path.join(directory,'storage'),log:new Log(LogLevel.ERROR)}
let mf=new Miniflare(options),base=(await mf.ready).href
const clients=[]
const wait=async fn=>{const end=Date.now()+12000;while(!fn()){if(Date.now()>end)throw Error('Timed out waiting for Twinwire game');await new Promise(r=>setTimeout(r,10))}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
function make(code,name,resumeToken,checkpoint){
 const url=base.replace(/^http/,'ws')+'api/rooms/'+code+'/ws?tw=4'
 const net=new GameClient({url,room:'mahjong.'+code,rtc:false,reconnectBaseMs:30,...(checkpoint?{checkpoint}:{})})
 const messages=[];let seatToken=resumeToken,resumes=0
 net.onSession=info=>{if(info.resumed)resumes++;else net.sendEvent({type:'join',playerName:name,resumeToken:seatToken})}
 net.onEvent=message=>{messages.push(message);if(message.type==='assigned')seatToken=message.resumeToken}
 const client={net,messages,get token(){return seatToken},get resumes(){return resumes},async next(fn){
   await wait(()=>messages.some(fn));const i=messages.findIndex(fn);return messages.splice(i,1)[0]
 }}
 clients.push(client);net.connect();return client
}
const ready=client=>client.next(m=>m.type==='$twinwire-ready')
try{
 const created=await fetch(base+'api/rooms',{method:'POST'}).then(r=>r.json()),code=created.code
 const a=make(code,'Twinwire A'),b=make(code,'Twinwire B')
 await Promise.all([ready(a),ready(b)])
 const id=a.net.id,otherId=b.net.id
 a.net.sendEvent({type:'start'})
 const first=(await a.next(m=>m.type==='game-state')).state
 const second=(await b.next(m=>m.type==='game-state')).state
 assert.equal(first.players.filter(p=>p.id!==first.myPlayerId).every(p=>p.hand.length===0),true,'other hands remain private')
 assert.equal(second.players.filter(p=>p.id!==second.myPlayerId).every(p=>p.hand.length===0),true,'privacy applies to both players')
 assert.equal(first.currentPlayer,first.myPlayerId)
 assert.equal(first.phase,'draw')
 a.net.pause();b.net.pause();await sleep(100)
 a.net.sendEvent({type:'draw-blind'})
 a.net.connect();b.net.connect()
 await Promise.all([ready(a),ready(b)])
 assert.equal(a.net.id,id);assert.equal(b.net.id,otherId)
 const after=(await a.next(m=>m.type==='game-state'&&m.state.wallSize===first.wallSize-1)).state
 assert.equal(after.myPlayerId,first.myPlayerId);assert.equal(after.phase,'discard')
 await sleep(120)
 assert.equal(a.messages.filter(m=>m.type==='game-state').every(m=>m.state.wallSize>=first.wallSize-1),true,'queued draw runs once')
 const checkpoint=a.net.checkpoint(),token=a.token
 const takeover=make(code,'Twinwire A',token,checkpoint)
 await ready(takeover);await wait(()=>a.net.status==='lost')
 assert.equal(takeover.net.id,id)
 const recovered=(await takeover.next(m=>m.type==='game-state')).state
 assert.equal(recovered.wallSize,after.wallSize)
 assert.deepEqual(recovered.players[first.myPlayerId].hand,after.players[first.myPlayerId].hand)
 clients.forEach(c=>c.net.close());await sleep(150)
 await mf.dispose()
 mf=new Miniflare(options);base=(await mf.ready).href
 const restarted=make(code,'Twinwire A',token)
 await ready(restarted)
 const persisted=(await restarted.next(m=>m.type==='game-state')).state
 assert.equal(persisted.myPlayerId,first.myPlayerId)
 assert.deepEqual(persisted.players[first.myPlayerId].hand,after.players[first.myPlayerId].hand)
 assert.equal(persisted.wallSize,after.wallSize)
 console.log(JSON.stringify({ok:true,runtime:'workerd',sameSessionResume:true,queuedDraw:'once',takeover:'fenced',privateHands:true,persistedSeatAndHand:true,readyAfterDurableSnapshot:true,resumes:[a.resumes,b.resumes]}))
}finally{
 clients.forEach(c=>c.net.close());await mf.dispose()
 const absolute=await fs.realpath(directory),within=path.relative(await fs.realpath(parent),absolute)
 if(!within||within.startsWith('..')||path.isAbsolute(within))throw Error('Unsafe test cleanup path')
 await fs.rm(absolute,{recursive:true,force:true})
}
