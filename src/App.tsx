import { useEffect, useState } from 'react'
import { useAppStore } from './store/app-store'
import { useGameStore } from './store/game-store'
import { useMultiplayerStore } from './store/multiplayer-store'
import { useAutoPlay } from './hooks/useAutoPlay'
import { sendMessage } from './multiplayer/client'
import { GameProvider, type GameContextValue } from './contexts/GameContext'
import { MenuScreen } from './components/screens/MenuScreen'
import { LobbyScreen } from './components/screens/LobbyScreen'
import { GameScreen } from './components/screens/GameScreen'
import { ResultScreen } from './components/screens/ResultScreen'
import TutorialOverlay from './components/screens/TutorialOverlay'
import type { PlayerId } from './types'

function SinglePlayerGame() {
  const phase = useGameStore((s) => s.phase)
  const players = useGameStore((s) => s.players)
  const wall = useGameStore((s) => s.wall)
  const currentPlayer = useGameStore((s) => s.currentPlayer)
  const turnCount = useGameStore((s) => s.turnCount)
  const selectedTileId = useGameStore((s) => s.selectedTileId)
  const winner = useGameStore((s) => s.winner)
  const ponAvailable = useGameStore((s) => s.ponAvailable)
  const revealedSets = useGameStore((s) => s.revealedSets)
  const lastPonEvent = useGameStore((s) => s.lastPonEvent)
  const lastRiichiEvent = useGameStore((s) => s.lastRiichiEvent)
  const lastDrawnTileId = useGameStore((s) => s.lastDrawnTileId)
  const gameStartTime = useGameStore((s) => s.gameStartTime)

  const selectTile = useGameStore((s) => s.selectTile)
  const discardTile = useGameStore((s) => s.discardTile)
  const callPon = useGameStore((s) => s.callPon)
  const declinePon = useGameStore((s) => s.declinePon)
  const declareRiichi = useGameStore((s) => s.declareRiichi)
  const clearPonEvent = useGameStore((s) => s.clearPonEvent)
  const clearRiichiEvent = useGameStore((s) => s.clearRiichiEvent)
  const market = useGameStore((s) => s.market)
  const tagCounts = useGameStore((s) => s.tagCounts)
  const pickMarket = useGameStore((s) => s.pickMarket)
  const drawBlind = useGameStore((s) => s.drawBlind)
  const startGame = useGameStore((s) => s.startGame)

  useAutoPlay('local')

  useEffect(() => {
    startGame()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Human draw phase is now handled by the MarketRow UI (pick-market or draw-blind)

  const ctx: GameContextValue = {
    mode: 'local',
    phase, players, wallCount: wall.length, currentPlayer, turnCount,
    selectedTileId, winner, ponAvailable, revealedSets,
    market, tagCounts,
    myPlayerId: 0 as PlayerId,
    lastDrawnTileId, gameStartTime,
    selectTile, discardTile, callPon, declinePon, declareRiichi,
    pickMarket, drawBlind,
    lastPonEvent, lastRiichiEvent, clearPonEvent, clearRiichiEvent,
  }

  return (
    <GameProvider value={ctx}>
      {(phase === 'win' || phase === 'draw-game') ? <ResultScreen /> : <GameScreen />}
    </GameProvider>
  )
}

function MultiplayerGame() {
  const ws = useAppStore((s) => s.ws)
  const myPlayerId = useAppStore((s) => s.myPlayerId) as PlayerId

  const phase = useMultiplayerStore((s) => s.phase)
  const players = useMultiplayerStore((s) => s.players)
  const wallCount = useMultiplayerStore((s) => s.wallCount)
  const currentPlayer = useMultiplayerStore((s) => s.currentPlayer)
  const turnCount = useMultiplayerStore((s) => s.turnCount)
  const selectedTileId = useMultiplayerStore((s) => s.selectedTileId)
  const winner = useMultiplayerStore((s) => s.winner)
  const ponAvailable = useMultiplayerStore((s) => s.ponAvailable)
  const revealedSets = useMultiplayerStore((s) => s.revealedSets)
  const lastPonEvent = useMultiplayerStore((s) => s.lastPonEvent)
  const lastRiichiEvent = useMultiplayerStore((s) => s.lastRiichiEvent)
  const market = useMultiplayerStore((s) => s.market)
  const tagCounts = useMultiplayerStore((s) => s.tagCounts)

  const selectTile = useMultiplayerStore((s) => s.selectTile)
  const clearPonEvent = useMultiplayerStore((s) => s.clearPonEvent)
  const clearRiichiEvent = useMultiplayerStore((s) => s.clearRiichiEvent)

  const ctx: GameContextValue = {
    mode: 'multiplayer',
    phase, players, wallCount, currentPlayer, turnCount,
    selectedTileId, winner, ponAvailable, revealedSets, market, tagCounts, myPlayerId,
    lastDrawnTileId: null, gameStartTime: Date.now(),
    selectTile,
    discardTile: (id: string) => { if (ws) sendMessage(ws, { type: 'discard', tileId: id }) },
    callPon: () => { if (ws) sendMessage(ws, { type: 'call-pon' }) },
    declinePon: () => { if (ws) sendMessage(ws, { type: 'decline-pon' }) },
    declareRiichi: () => { if (ws) sendMessage(ws, { type: 'declare-riichi' }) },
    pickMarket: (tileId: string) => { if (ws) sendMessage(ws, { type: 'pick-market', tileId }) },
    drawBlind: () => { if (ws) sendMessage(ws, { type: 'draw-blind' }) },
    lastPonEvent, lastRiichiEvent, clearPonEvent, clearRiichiEvent,
  }

  return (
    <GameProvider value={ctx}>
      {(phase === 'win' || phase === 'draw-game') ? <ResultScreen /> : <GameScreen />}
    </GameProvider>
  )
}

function App() {
  const screen = useAppStore((s) => s.screen)
  const [showTutorial, setShowTutorial] = useState(
    () => !localStorage.getItem('emoji-mahjong-tutorial-seen')
  )

  if (showTutorial) {
    return <TutorialOverlay onDone={() => setShowTutorial(false)} />
  }

  switch (screen) {
    case 'menu': return <MenuScreen />
    case 'single-player': return <SinglePlayerGame />
    case 'lobby': return <LobbyScreen />
    case 'multiplayer-game': return <MultiplayerGame />
    default: return <MenuScreen />
  }
}

export default App
