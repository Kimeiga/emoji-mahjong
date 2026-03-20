import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGame } from '../../contexts/GameContext'
import { DiscardPool } from '../board/DiscardPool'
import { DrawIndicator } from '../board/DrawIndicator'
import { PlayerHand } from '../hand/PlayerHand'
import { MarketRow } from '../board/MarketRow'
import { PonButton } from '../hand/PonButton'
import type { PlayerId } from '../../types'

function TileBacks({ count }: { count: number }) {
  const shown = Math.min(count, 11)
  return (
    <div className="flex flex-wrap gap-px max-w-[52px] justify-center">
      {Array.from({ length: shown }, (_, i) => (
        <div key={i} className="w-2 h-3 bg-slate-600/80 rounded-[2px] border border-slate-500/50" />
      ))}
    </div>
  )
}

function OpponentCompact({ playerId }: { playerId: PlayerId }) {
  const { players, currentPlayer, myPlayerId } = useGame()
  const player = players[playerId]
  const isActive = currentPlayer === playerId

  if (playerId === myPlayerId) return null

  return (
    <div className={`
      flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-center transition-all min-w-[56px]
      ${isActive ? 'bg-yellow-400/15 ring-2 ring-yellow-400/50 scale-105' : ''}
      ${player.riichi ? 'ring-2 ring-red-500/60' : ''}
    `}>
      <span className="text-base">{player.isHuman ? '👤' : '🤖'}</span>
      <span className={`text-[10px] font-bold ${isActive ? 'text-yellow-300' : 'text-slate-400'}`}>
        {player.name.replace(' Bot', '')}
      </span>
      <TileBacks count={player.hand.length} />
      {player.riichi && <span className="text-[8px] text-red-400 font-bold">RIICHI</span>}
      {isActive && <span className="text-[8px] text-yellow-400">thinking...</span>}
    </div>
  )
}

function CompassRose() {
  return (
    <div className="flex items-center justify-center opacity-[0.07] pointer-events-none select-none">
      <svg width="80" height="80" viewBox="0 0 100 100" fill="none">
        {/* 4-pointed star */}
        <polygon points="50,5 55,45 95,50 55,55 50,95 45,55 5,50 45,45" fill="currentColor" className="text-slate-300" />
        <circle cx="50" cy="50" r="6" fill="currentColor" className="text-slate-400" />
        {/* N/S/E/W labels */}
        <text x="50" y="4" textAnchor="middle" fill="currentColor" className="text-slate-300" fontSize="8" fontWeight="bold">N</text>
        <text x="50" y="99" textAnchor="middle" fill="currentColor" className="text-slate-300" fontSize="8" fontWeight="bold">S</text>
        <text x="99" y="53" textAnchor="end" fill="currentColor" className="text-slate-300" fontSize="8" fontWeight="bold">E</text>
        <text x="3" y="53" textAnchor="start" fill="currentColor" className="text-slate-300" fontSize="8" fontWeight="bold">W</text>
      </svg>
    </div>
  )
}

function PonToast() {
  const { lastPonEvent, clearPonEvent } = useGame()

  useEffect(() => {
    if (lastPonEvent) {
      const timer = setTimeout(clearPonEvent, 2000)
      return () => clearTimeout(timer)
    }
  }, [lastPonEvent, clearPonEvent])

  return (
    <AnimatePresence>
      {lastPonEvent && (
        <motion.div
          initial={{ y: -60, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -40, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', damping: 18, stiffness: 300 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-5 py-2.5 rounded-xl shadow-xl shadow-orange-500/30 flex items-center gap-2 font-bold text-sm border border-amber-400/40">
            <span className="text-xl">{lastPonEvent.emoji}</span>
            <span>{lastPonEvent.playerName} calls PON!</span>
            <span className="text-[10px] text-amber-200 font-normal">#{lastPonEvent.tag}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function RiichiToast() {
  const { lastRiichiEvent, clearRiichiEvent } = useGame()

  useEffect(() => {
    if (lastRiichiEvent) {
      const timer = setTimeout(clearRiichiEvent, 2000)
      return () => clearTimeout(timer)
    }
  }, [lastRiichiEvent, clearRiichiEvent])

  return (
    <AnimatePresence>
      {lastRiichiEvent && (
        <motion.div
          initial={{ y: -60, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -40, opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', damping: 18, stiffness: 300 }}
          className="fixed top-12 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="bg-gradient-to-r from-red-600 to-red-500 text-white px-5 py-2.5 rounded-xl shadow-xl shadow-red-500/30 flex items-center gap-2 font-bold text-sm border border-red-400/40">
            <span className="text-xl">🔴</span>
            <span>{lastRiichiEvent.playerName} declares RIICHI!</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function GameScreen() {
  const { myPlayerId } = useGame()

  const north = ((myPlayerId + 2) % 4) as PlayerId
  const east = ((myPlayerId + 1) % 4) as PlayerId
  const west = ((myPlayerId + 3) % 4) as PlayerId

  return (
    <div className="h-full flex flex-col max-w-md mx-auto w-full">
      <PonToast />
      <RiichiToast />

      <DrawIndicator />

      <div className="flex-1 flex flex-col min-h-0">
        {/* North */}
        <div className="flex flex-col items-center py-1">
          <OpponentCompact playerId={north} />
          <DiscardPool playerId={north} maxVisible={6} />
        </div>

        {/* Middle: West - compass - East */}
        <div className="flex-1 flex items-center justify-between px-1 min-h-0 relative">
          <div className="flex items-center gap-1">
            <OpponentCompact playerId={west} />
            <DiscardPool playerId={west} maxVisible={4} />
          </div>

          {/* Compass centered absolutely so discards don't shift it */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <CompassRose />
          </div>

          <div className="flex items-center gap-1">
            <DiscardPool playerId={east} maxVisible={4} />
            <OpponentCompact playerId={east} />
          </div>
        </div>
      </div>

      {/* Market row */}
      <MarketRow />

      {/* Your discards */}
      <div className="flex flex-col items-center py-1 px-2">
        <div className="text-[10px] text-slate-500 mb-1">Your discards</div>
        <DiscardPool playerId={myPlayerId} maxVisible={8} />
      </div>

      <div className="h-px bg-slate-700/50 mx-4" />

      <PlayerHand />
      <PonButton />
    </div>
  )
}
