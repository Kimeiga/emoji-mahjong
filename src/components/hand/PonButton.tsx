import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGame } from '../../contexts/GameContext'
import { TagPill } from '../shared/Tile'

const PON_TIMEOUT_MS = 5000

export function PonButton() {
  const { phase, ponAvailable, callPon, declinePon, myPlayerId } = useGame()

  const [countdown, setCountdown] = useState(PON_TIMEOUT_MS)

  const isVisible = phase === 'pon-available' && ponAvailable?.playerId === myPlayerId

  const handlePon = useCallback(() => {
    if (ponAvailable) callPon(myPlayerId)
  }, [ponAvailable, callPon, myPlayerId])

  const handleSkip = useCallback(() => {
    declinePon()
  }, [declinePon])

  // Countdown timer
  useEffect(() => {
    if (!isVisible) {
      setCountdown(PON_TIMEOUT_MS)
      return
    }

    setCountdown(PON_TIMEOUT_MS)

    const interval = setInterval(() => {
      setCountdown((prev) => {
        const next = prev - 50
        if (next <= 0) {
          clearInterval(interval)
          return 0
        }
        return next
      })
    }, 50)

    return () => clearInterval(interval)
  }, [isVisible])

  // Auto-decline on timeout
  useEffect(() => {
    if (isVisible && countdown <= 0) {
      declinePon()
    }
  }, [isVisible, countdown, declinePon])

  const progress = countdown / PON_TIMEOUT_MS

  return (
    <AnimatePresence>
      {isVisible && ponAvailable && (
        <motion.div
          initial={{ y: 200, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 200, opacity: 0, scale: 0.8, pointerEvents: 'none' as const }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-[200] flex flex-col items-center pb-6 px-4"
        >
          {/* Backdrop overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' as const }}
            className="fixed inset-0 bg-black/40 -z-10"
            onClick={handleSkip}
          />

          {/* Main card */}
          <motion.div
            className="w-full max-w-sm bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl border-2 border-amber-400/60 shadow-2xl shadow-amber-500/20 overflow-hidden"
            initial={{ rotateX: -10 }}
            animate={{ rotateX: 0 }}
            transition={{ type: 'spring', damping: 15 }}
          >
            {/* Timer bar */}
            <div className="h-1.5 bg-slate-700 w-full">
              <motion.div
                className="h-full rounded-r-full"
                style={{
                  width: `${progress * 100}%`,
                  backgroundColor: progress > 0.3 ? '#facc15' : '#ef4444',
                }}
                transition={{ duration: 0.05 }}
              />
            </div>

            <div className="p-4">
              {/* Header */}
              <div className="text-center mb-3">
                <div className="text-xs text-slate-400 mb-1">Claim this tile to complete a set!</div>
                <TagPill tag={ponAvailable.matchingTag} />
              </div>

              {/* Tile preview: matching pair + claimed tile */}
              <div className="flex items-center justify-center gap-2 mb-4">
                {/* Player's matching tiles */}
                {ponAvailable.matchingTiles.map((t) => (
                  <div
                    key={t.id}
                    className="w-14 h-14 rounded-xl bg-slate-700 border-2 border-sky-400/50 flex items-center justify-center text-3xl"
                  >
                    {t.emoji}
                  </div>
                ))}

                {/* Plus sign */}
                <div className="text-slate-500 text-xl font-bold">+</div>

                {/* The discarded tile being claimed */}
                <motion.div
                  className="w-14 h-14 rounded-xl bg-amber-400/20 border-2 border-amber-400 flex items-center justify-center text-3xl shadow-lg shadow-amber-400/30"
                  animate={{
                    scale: [1, 1.08, 1],
                    boxShadow: [
                      '0 0 10px rgba(251,191,36,0.3)',
                      '0 0 25px rgba(251,191,36,0.5)',
                      '0 0 10px rgba(251,191,36,0.3)',
                    ],
                  }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                >
                  {ponAvailable.tile.emoji}
                </motion.div>
              </div>

              {/* PON button */}
              <motion.button
                onClick={handlePon}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-black text-2xl tracking-wider shadow-lg shadow-orange-500/40 active:shadow-inner"
                whileTap={{ scale: 0.95 }}
                whileHover={{ scale: 1.02 }}
                animate={{
                  boxShadow: [
                    '0 10px 15px -3px rgba(249,115,22,0.4)',
                    '0 10px 25px -3px rgba(249,115,22,0.6)',
                    '0 10px 15px -3px rgba(249,115,22,0.4)',
                  ],
                }}
                transition={{ duration: 1, repeat: Infinity }}
              >
                PON!
              </motion.button>

              {/* Skip button */}
              <button
                onClick={handleSkip}
                className="w-full mt-2 py-2 rounded-lg text-slate-500 text-sm font-medium hover:text-slate-300 transition-colors"
              >
                Skip ({Math.ceil(countdown / 1000)}s)
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
