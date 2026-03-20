import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGame } from '../../contexts/GameContext'
import { DiscardPool } from '../board/DiscardPool'
import { DrawIndicator } from '../board/DrawIndicator'
import { PlayerHand } from '../hand/PlayerHand'
import { PonButton } from '../hand/PonButton'
import type { PlayerId } from '../../types'

function OpponentCompact({ playerId }: { playerId: PlayerId }) {
  const { players, currentPlayer, myPlayerId } = useGame()
  const player = players[playerId]
  const isActive = currentPlayer === playerId

  // Don't render self as opponent
  if (playerId === myPlayerId) return null

  return (
    <div className={`
      flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg text-center transition-all
      ${isActive ? 'bg-yellow-400/15 ring-2 ring-yellow-400/50 scale-110' : ''}
      ${player.riichi ? 'ring-2 ring-red-500/60' : ''}
    `}>
      <span className="text-lg">{player.isHuman ? '👤' : '🤖'}</span>
      <span className={`text-[10px] font-bold ${isActive ? 'text-yellow-300' : 'text-slate-400'}`}>
        {player.name.replace(' Bot', '')}
      </span>
      <div className="flex items-center gap-0.5">
        <span className="text-[10px] text-slate-500">{player.hand.length}</span>
        {player.riichi && <span className="text-[9px] text-red-400 font-bold">R</span>}
        {isActive && <span className="text-[9px] text-yellow-400">💭</span>}
      </div>
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

  // Determine opponent positions relative to myPlayerId
  const north = ((myPlayerId + 2) % 4) as PlayerId
  const east = ((myPlayerId + 1) % 4) as PlayerId
  const west = ((myPlayerId + 3) % 4) as PlayerId

  return (
    <div className="h-full flex flex-col max-w-md mx-auto w-full">
      {/* Toast notifications */}
      <PonToast />
      <RiichiToast />

      {/* Status bar */}
      <DrawIndicator />

      {/* Compass table */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* North opponent */}
        <div className="flex flex-col items-center py-1">
          <OpponentCompact playerId={north} />
          <DiscardPool playerId={north} maxVisible={6} />
        </div>

        {/* Middle row: West - center - East */}
        <div className="flex-1 flex items-center justify-between px-1 min-h-0">
          {/* West */}
          <div className="flex items-center gap-1">
            <OpponentCompact playerId={west} />
            <DiscardPool playerId={west} maxVisible={4} />
          </div>

          {/* Center spacer */}
          <div className="flex-1" />

          {/* East */}
          <div className="flex items-center gap-1">
            <DiscardPool playerId={east} maxVisible={4} />
            <OpponentCompact playerId={east} />
          </div>
        </div>
      </div>

      {/* Your discards */}
      <div className="flex flex-col items-center py-1 px-2">
        <div className="text-[10px] text-slate-500 mb-1">Your discards</div>
        <DiscardPool playerId={myPlayerId} maxVisible={8} />
      </div>

      {/* Divider */}
      <div className="h-px bg-slate-700/50 mx-4" />

      {/* Bottom: player hand */}
      <PlayerHand />

      {/* Pon button overlay */}
      <PonButton />
    </div>
  )
}
