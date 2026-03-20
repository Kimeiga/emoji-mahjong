/**
 * Quick smoke test: play a complete game using GameRunner from Node.
 * This verifies the engine works without any browser/React dependency.
 */
import { GameRunner } from '../src/engine/game-runner'

const game = new GameRunner()

console.log(game.help())
console.log('\n' + '='.repeat(50))

// Start game
game.start()
console.log('\n' + game.print())

// Show hand analysis
console.log('\n' + game.analyzeHand(0))

// Play a few rounds
let rounds = 0
const MAX_ROUNDS = 5

while (rounds < MAX_ROUNDS) {
  const snap = game.snapshot()
  if (snap.phase === 'win' || snap.phase === 'draw-game') break

  if (snap.currentPlayer === 0 && snap.phase === 'discard') {
    // Human: discard first tile (simple strategy)
    console.log(`\n--- Round ${rounds + 1}: Discarding index 0 ---`)
    console.log(`  Discarding: ${snap.players[0].hand[0].emoji} (${snap.players[0].hand[0].tags.join(', ')})`)
    game.play(0)
    rounds++
    console.log(game.status())
  } else if (snap.currentPlayer === 0 && snap.phase === 'draw') {
    game.draw()
  } else {
    game.playUntilHuman()
  }
}

console.log('\n' + game.print())
console.log('\nFinal hand analysis:')
console.log(game.analyzeHand(0))

// Show full snapshot
const finalSnap = game.snapshot({ revealAll: true })
console.log('\nAll players hands:')
for (const p of finalSnap.players) {
  console.log(`  ${p.name}: ${p.hand.map(t => t.emoji).join(' ')} (${p.handSize} tiles)`)
}

console.log('\n✅ GameRunner works standalone!')
