import { test, expect, devices, type Page } from '@playwright/test'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { GameRunner } from '../src/engine/game-runner'
import type { GameStateView } from '../src/multiplayer/protocol'

async function skipTutorial(page: Page) {
  await page.goto('/')
  const skip = page.getByRole('button', { name: 'Skip', exact: true })
  if (await skip.isVisible()) await skip.click()
  await expect(page.getByRole('button', { name: 'Single Player', exact: true })).toBeVisible()
}
const localState = (page: Page) => page.evaluate(() => (window as Window & { __game: GameRunner }).__game.exportState())
const multiplayerState = (page: Page) => page.evaluate(() => (window as Window & { __gameState: () => GameStateView & { gameStartedAt: number } }).__gameState())

test('playable introduction teaches valid connections, conflict, discard and a winning pick', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await expect(page.getByRole('heading', {name:'Find the connection'})).toBeVisible()
  await expect(page.getByRole('button', {name:'Next', exact:true})).toBeDisabled()
  await page.getByRole('button', {name:'Choose soccer ball', exact:true}).click()
  await expect(page.getByRole('status')).toContainText('Try another tile')
  await expect(page.getByRole('button', {name:'Next', exact:true})).toBeDisabled()
  await page.getByRole('button', {name:'Choose lemon', exact:true}).click()
  await page.getByRole('button', {name:'Next', exact:true}).click()
  await page.getByRole('button', {name:'fruit', exact:true}).click()
  await expect(page.getByRole('status')).toContainText('already used')
  await expect(page.getByRole('button', {name:'Next', exact:true})).toBeDisabled()
  await page.getByRole('button', {name:'sweet', exact:true}).click()
  await page.screenshot({path:testInfo.outputPath('lesson-connections.png'),fullPage:true})
  await page.getByRole('button', {name:'Next', exact:true}).click()
  await page.getByRole('button', {name:'Choose red apple', exact:true}).click()
  await expect(page.getByRole('status')).toContainText('allowed in a match')
  await page.getByRole('button', {name:'Choose cactus', exact:true}).click()
  await page.getByRole('button', {name:'Next', exact:true}).click()
  await page.getByRole('button', {name:'Choose cactus', exact:true}).click()
  await expect(page.getByRole('button', {name:'Play!', exact:true})).toBeDisabled()
  await page.getByRole('button', {name:'Choose bus', exact:true}).click()
  await expect(page.getByRole('status')).toContainText('no discard needed')
  expect(await page.evaluate(() => localStorage.getItem('emoji-mahjong-stats'))).toBeNull()
  await page.getByRole('button', {name:'Play!', exact:true}).click()
  await expect(page.locator('.market-anchor')).toBeVisible()
  expect(errors).toEqual([])
})


test('single player: hard difficulty, inspection, legal actions, result and replay', async ({ page }, testInfo) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message))
  await skipTutorial(page)
  await page.getByRole('button', {name:'Hard', exact:true}).click()
  await page.getByRole('button', {name:'Single Player', exact:true}).click()
  expect(await page.evaluate(() => (window as Window & {__game: GameRunner}).__game.aiDifficulty)).toBe('hard')
  await page.locator('.hand-anchor [data-tile-id]').first().click()
  await expect(page.locator('.modal-above-hand')).toBeVisible()
  await expect(page.locator('.modal-above-hand').getByRole('button', {name:'Close tile details', exact:true})).toBeInViewport()
  await page.locator('.modal-above-hand').getByRole('button', {name:'Close tile details', exact:true}).click()
  await expect(page.getByRole('region', {name:'Your connections'})).toBeVisible()
  await expect(page.getByRole('region', {name:'Your connections'})).toContainText('Only PON locks a set.')
  await page.getByRole('button', {name:'Explore other connections',exact:true}).click()
  await expect(page.locator('#connection-options')).toBeVisible()
  const options = page.locator('#connection-options button')
  if (await options.count()) {
    const before = await localState(page)
    await options.first().click()
    await expect(options.first()).toHaveAttribute('aria-pressed','true')
    expect((await localState(page)).players[0].hand).toEqual(before.players[0].hand)
    await page.getByRole('button', {name:'Clear highlight',exact:true}).click()
  }
  await page.getByRole('button', {name:'Hide other connections',exact:true}).click()
  await page.screenshot({path: testInfo.outputPath('game-start.png'), fullPage:true})
  for (let actions = 0; actions < 150; actions++) {
    const s = await localState(page)
    if (s.phase === 'win' || s.phase === 'draw-game') break
    if (s.phase === 'pon-available' && s.ponAvailable?.playerId === 0) {
      await page.getByRole('button', {name:/PON!/}).click()
    } else if (s.currentPlayer === 0 && s.phase === 'draw') {
      const frequency = (tag: string) => s.players[0].hand.filter(t=>t.tags.includes(tag)).length
      const pick = [...s.market].sort((a,b)=>b.tags.reduce((n,t)=>n+frequency(t),0)-a.tags.reduce((n,t)=>n+frequency(t),0))[0]
      if (pick) {
        await page.locator(`.market-anchor [data-tile-id="${pick.id}"]`).click()
        await expect(page.locator('.modal-above-market').getByRole('button', {name:/^Pick /})).toBeInViewport()
        await expect(page.locator('.modal-above-market').getByRole('button', {name:'Close tile details'})).toBeInViewport()
        await expect(page.locator('.modal-above-hand')).toHaveCount(0)
        await page.locator('.modal-above-market').getByRole('button', {name:/^Pick /}).click()
      } else await page.getByRole('button', {name:'Draw blind from wall', exact:true}).click()
    } else if (s.currentPlayer === 0 && s.phase === 'discard') {
      const hand = s.players[0].hand
      const score = (tags: string[]) => tags.reduce((n,t)=>n+hand.filter(x=>x.tags.includes(t)).length,0)
      const discard = [...hand].sort((a,b)=>score(a.tags)-score(b.tags))[0]
      await page.locator(`.hand-anchor [data-tile-id="${discard.id}"]`).click()
      await page.locator('.modal-above-hand').getByRole('button', {name:/^Discard /}).click()
    } else {
      await expect.poll(async()=>{
        const next = await localState(page)
        return next.phase === 'win' || next.phase === 'draw-game' || (next.phase === 'pon-available' ? next.ponAvailable?.playerId === 0 : next.currentPlayer === 0)
      }, {timeout:30_000}).toBeTruthy()
    }
  }
  await expect(page.getByRole('button', {name:'Play Again', exact:true})).toBeVisible()
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('emoji-mahjong-stats') ?? '{}').gamesPlayed)).toBe(1)
  const recorded = await page.evaluate(() => JSON.parse(localStorage.getItem('emoji-mahjong-stats') ?? '{}'))
  expect(recorded.gamesPlayed).toBe(1)
  await expect(page.locator('body')).toContainText(`Record: ${recorded.wins}W / ${recorded.losses}L / ${recorded.draws}D`)
  await page.screenshot({path:testInfo.outputPath('result.png'),fullPage:true})
  const ended = await localState(page)
  expect(['win','draw-game']).toContain(ended.phase)
  if (ended.winner !== 0) {
    await expect(page.getByRole('region', {name:'Your final hand'})).toBeVisible()
    await page.getByText('See your connections', {exact:true}).click()
    await expect(page.getByRole('region', {name:'Your final hand'})).toContainText('not a claim that you missed an available move')
  }
  await page.getByRole('button', {name:'Play Again', exact:true}).click()
  await expect(page.locator('.market-anchor')).toBeVisible()
  expect((await localState(page)).gameStartTime).toBeGreaterThan(ended.gameStartTime)
  expect(errors).toEqual([])
})

test('two players: private hands, full disconnect, reload and original seats', async ({ browser }, testInfo) => {
  const device = devices[testInfo.project.name === 'iphone-webkit' ? 'iPhone 13' : testInfo.project.name === 'phone-chromium' ? 'Pixel 7' : 'Desktop Chrome']
  const oneContext = await browser.newContext({...device, baseURL:'http://127.0.0.1:8787'})
  const twoContext = await browser.newContext({...device, baseURL:'http://127.0.0.1:8787'})
  const one = await oneContext.newPage(); const two = await twoContext.newPage()
  const errors: string[] = []
  one.on('pageerror', e=>errors.push(e.message)); two.on('pageerror', e=>errors.push(e.message))
  try {
    for (const context of [oneContext, twoContext]) {
      await context.addInitScript(() => {
        const sockets: WebSocket[] = []
        const Native = window.WebSocket
        window.WebSocket = new Proxy(Native, {construct(Target, args: [string, string[]?]) {
          const socket = new Target(...args); sockets.push(socket); return socket
        }})
        ;(window as Window & {__closeTestSockets?:()=>void}).__closeTestSockets = () => sockets.forEach(s=>s.close())
        localStorage.setItem('emoji-mahjong-tutorial-seen','1')
      })
    }
    const host = `Host${testInfo.workerIndex}${Date.now().toString().slice(-6)}`
    await skipTutorial(one)
    await one.getByRole('textbox', {name:'Your name'}).fill(host)
    await one.getByRole('button', {name:'Multiplayer',exact:true}).click()
    await one.getByRole('button', {name:'Create New Room',exact:true}).click()
    await expect(one.getByRole('heading', {name:'Game Lobby'})).toBeVisible()
    await skipTutorial(two)
    await two.getByRole('textbox', {name:'Your name'}).fill('Partner')
    await two.getByRole('button', {name:'Multiplayer',exact:true}).click()
    await two.getByRole('button').filter({hasText:host}).click()
    await expect(two.getByRole('heading', {name:'Game Lobby'})).toBeVisible()
    await one.getByRole('button', {name:'Start Game',exact:true}).click()
    await expect(one.locator('.market-anchor')).toBeVisible()
    await expect(two.locator('.hand-anchor')).toBeVisible()
    const before = await multiplayerState(one)
    expect(before.myPlayerId).toBe(0)
    expect((await multiplayerState(two)).myPlayerId).toBe(1)
    expect(before.players[1].hand.every(t=>t.emoji==='?')).toBeTruthy()
    for (const [context, page] of [[oneContext,one],[twoContext,two]] as const) {
      await context.setOffline(true)
      await page.evaluate(()=>(window as Window & {__closeTestSockets?:()=>void}).__closeTestSockets?.())
    }
    await expect(one.getByRole('status').filter({hasText:'Reconnecting'})).toBeVisible()
    await oneContext.setOffline(false); await twoContext.setOffline(false)
    await one.reload(); await two.reload()
    await expect(one.locator('.hand-anchor')).toBeVisible()
    await expect(two.locator('.hand-anchor')).toBeVisible()
    const after = await multiplayerState(one)
    expect(after.myPlayerId).toBe(0)
    expect((await multiplayerState(two)).myPlayerId).toBe(1)
    expect(after.gameStartedAt).toBe(before.gameStartedAt)
    expect(after.players[0].hand.map(t=>t.id)).toEqual(before.players[0].hand.map(t=>t.id))
    await one.screenshot({path:testInfo.outputPath('reconnected.png'),fullPage:true})
    expect(errors).toEqual([])
  } finally { await oneContext.close(); await twoContext.close() }
})

// WebKit's offline flag rejects even literal SW navigation responses upstream:
// https://github.com/microsoft/playwright/issues/42775
// A dedicated origin that is actually stopped tests the real built cache fallback,
// without mocking a response or claiming that it reproduces airplane mode.
async function startShellOrigin() {
  const root = resolve('dist')
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? '/', 'http://local').pathname
    const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
    if (!path.startsWith(root + sep)) { response.writeHead(403).end(); return }
    try {
      const body = await readFile(path)
      const types: Record<string, string> = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml'}
      response.writeHead(200, {'Content-Type':types[extname(path)] ?? 'application/octet-stream', 'Cache-Control':'no-store'})
      response.end(body)
    } catch { response.writeHead(404).end() }
  })
  await new Promise<void>((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done) })
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    stop: () => new Promise<void>((done, reject) => {
      if (!server.listening) { done(); return }
      server.close(error => error ? reject(error) : done())
      server.closeAllConnections()
    }),
  }
}

test('single-player shell reloads from its cache without an available origin', async ({ page, context, browserName }, testInfo) => {
  const server = browserName === 'webkit' ? await startShellOrigin() : null
  try {
    if (server) {
      testInfo.annotations.push({type:'coverage', description:'WebKit: actual origin shutdown, not Playwright offline emulation (upstream #42775).'})
      await page.goto(server.origin)
      await page.getByRole('button', {name:'Skip',exact:true}).click()
    } else await skipTutorial(page)
    await page.evaluate(async()=>{await navigator.serviceWorker.ready})
    await expect.poll(()=>page.evaluate(()=>!!navigator.serviceWorker.controller)).toBeTruthy()
    expect(await page.evaluate(async()=>!!await caches.match('/'))).toBeTruthy()
    if (server) {
      await server.stop()
      await expect(fetch(server.origin)).rejects.toThrow()
    } else await context.setOffline(true)
    const response = await page.reload()
    expect(response?.status()).toBe(200)
    expect(response?.fromServiceWorker()).toBeTruthy()
    await page.getByRole('button', {name:'Single Player',exact:true}).click()
    await expect(page.locator('.hand-anchor [data-tile-id]')).toHaveCount(11)
  } finally { await context.setOffline(false); await server?.stop() }
})


test('learn replay and connection controls are keyboard accessible on a short screen', async ({ page }, testInfo) => {
  await page.setViewportSize({width:320,height:568})
  await skipTutorial(page)
  await page.getByRole('heading', {name:'Emoji Mahjong',exact:true}).scrollIntoViewIfNeeded()
  await expect(page.getByRole('heading', {name:'Emoji Mahjong',exact:true})).toBeInViewport()
  const learn = page.getByRole('button', {name:'Learn by playing',exact:true})
  await learn.focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('heading', {name:'Find the connection'})).toBeFocused()
  await page.getByRole('button', {name:'Skip',exact:true}).click()
  await page.getByRole('button', {name:'Single Player',exact:true}).click()
  const explore = page.getByRole('button', {name:'Explore other connections',exact:true})
  await explore.focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('button', {name:'Hide other connections',exact:true})).toHaveAttribute('aria-expanded','true')
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', {name:'Explore other connections',exact:true})).toHaveAttribute('aria-expanded','false')
  await page.locator('.hand-anchor').scrollIntoViewIfNeeded()
  await expect(page.locator('.hand-anchor')).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await page.locator('.market-anchor [data-tile-id]').first().click()
  await expect(page.locator('.modal-above-market').getByRole('button', {name:/^Pick /})).toBeInViewport()
  await expect(page.locator('.modal-above-market').getByRole('button', {name:'Close tile details'})).toBeInViewport()
  await page.screenshot({path:testInfo.outputPath('short-screen-inspector.png'),fullPage:true})
  await page.locator('.modal-above-market').getByRole('button', {name:'Close tile details'}).click()
  await page.locator('#root').evaluate(element => element.scrollTop = 0)
  await page.screenshot({path:testInfo.outputPath('short-screen.png'),fullPage:true})
})
