# Emoji Mahjong

A four-seat semantic tile game: collect four non-overlapping triplets of emoji. Each triplet shares one tag, and all four tags must differ. Play locally against bots or online with friends and bots in the remaining seats.

## Rules

Each game selects 80 unique emoji, deals 11 per player, and exposes five market tiles. On your turn, choose a market tile or draw blind, then discard one tile unless the draw completes your winning hand. A PON claims an opponent's discard using two matching tiles. The three tiles and their chosen tag stay locked. PON priority proceeds in seat order; a declined opportunity passes to the next eligible player.

The first player to complete four sets wins. Rare-tag points describe the winning hand; they do not select a different winner. Riichi is available for a closed hand with a discard that leaves it one tile from winning. The first discard must preserve that waiting hand; subsequent non-winning draws must be discarded.

## Run and verify

Use Node 22 and the committed npm lockfile.

```sh
npm ci
npm run check
npx playwright install --with-deps chromium webkit
npm run test:browser
```

`check` includes ESLint, the production frontend build, the Worker typecheck, engine tests with 300 seeded full-game simulations, and real Miniflare/workerd WebSocket and persistence tests. Browser tests exercise tutorial, gameplay through results/replay, multiplayer reconnect, and offline single-player loading in desktop Chromium, phone-sized Chromium, and iPhone-sized WebKit. Browser emulation is not a physical-device test.

For development with multiplayer:

```sh
npm run build
npm run dev:worker
```

Open `http://127.0.0.1:8787`. `npm run dev` alone is frontend-only. The build generates a content-versioned offline shell; offline play requires an initial successful online load and service-worker installation.

## Sessions and recovery

The server owns game state and validates every action. A player's concealed hand and unclaimed PON pair are excluded from other players' network snapshots. New seats receive a private resume token stored in the browser; a display name alone cannot reclaim those seats.

A network interruption retains the hand and seat, including when everyone disconnects. Rejoining resumes the saved game and AI scheduling. Completely disconnected rooms expire after 30 minutes. A deliberate lobby exit frees the seat; a deliberate in-game exit hands that seat to a bot. Rematches replace absent humans with bots.

v62 persisted rooms had no resume tokens. For compatibility, a disconnected legacy seat can be adopted once using its matching name, then receives a token. This migration path is weaker than token authentication; deployments cannot retroactively authenticate legacy clients. The persisted `gameStartedAt` field is retained.

## Releases

Pull requests run the full quality suite. Every push to `main` repeats those checks, including browser tests, before deploying the Worker and Pages frontend. Failures prevent deployment; no test step is allowed to fail silently. Browser reports, failure traces, and screenshots are retained as workflow artifacts. Repository branch-protection settings are separate from these workflow files.
