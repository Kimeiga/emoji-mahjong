import { useEffect } from 'react'
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

  const selectTile = useGameStore((s) => s.selectTile)
  const discardTile = useGameStore((s) => s.discardTile)
  const callPon = useGameStore((s) => s.callPon)
  const declinePon = useGameStore((s) => s.declinePon)
  const declareRiichi = useGameStore((s) => s.declareRiichi)
  const clearPonEvent = useGameStore((s) => s.clearPonEvent)
  const clearRiichiEvent = useGameStore((s) => s.clearRiichiEvent)
  const startGame = useGameStore((s) => s.startGame)
  const drawCurrentPlayer = useGameStore((s) => s.drawCurrentPlayer)

  useAutoPlay('local')

  // Always start a fresh game when entering single player
  useEffect(() => {
    startGame()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-draw for human player
  useEffect(() => {
    if (currentPlayer === 0 && phase === 'draw') {
      const timer = setTimeout(() => {
        drawCurrentPlayer()
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [currentPlayer, phase, drawCurrentPlayer])

  const ctx: GameContextValue = {
    mode: 'local',
    phase,
    players,
    wallCount: wall.length,
    currentPlayer,
    turnCount,
    selectedTileId,
    winner,
    ponAvailable,
    revealedSets,
    myPlayerId: 0 as PlayerId,
    selectTile,
    discardTile,
    callPon,
    declinePon,
    declareRiichi,
    lastPonEvent,
    lastRiichiEvent,
    clearPonEvent,
    clearRiichiEvent,
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

  const selectTile = useMultiplayerStore((s) => s.selectTile)
  const clearPonEvent = useMultiplayerStore((s) => s.clearPonEvent)
  const clearRiichiEvent = useMultiplayerStore((s) => s.clearRiichiEvent)

  const ctx: GameContextValue = {
    mode: 'multiplayer',
    phase,
    players,
    wallCount,
    currentPlayer,
    turnCount,
    selectedTileId,
    winner,
    ponAvailable,
    revealedSets,
    myPlayerId,
    selectTile,
    discardTile: (id: string) => {
      if (ws) sendMessage(ws, { type: 'discard', tileId: id })
    },
    callPon: (_playerId: PlayerId) => {
      if (ws) sendMessage(ws, { type: 'call-pon' })
    },
    declinePon: () => {
      if (ws) sendMessage(ws, { type: 'decline-pon' })
    },
    declareRiichi: (_playerId: PlayerId) => {
      if (ws) sendMessage(ws, { type: 'declare-riichi' })
    },
    lastPonEvent,
    lastRiichiEvent,
    clearPonEvent,
    clearRiichiEvent,
  }

  return (
    <GameProvider value={ctx}>
      {(phase === 'win' || phase === 'draw-game') ? <ResultScreen /> : <GameScreen />}
    </GameProvider>
  )
}

function App() {
  const screen = useAppStore((s) => s.screen)

  switch (screen) {
    case 'menu':
      return <MenuScreen />
    case 'single-player':
      return <SinglePlayerGame />
    case 'lobby':
      return <LobbyScreen />
    case 'multiplayer-game':
      return <MultiplayerGame />
    default:
      return <MenuScreen />
  }
}

export default App
