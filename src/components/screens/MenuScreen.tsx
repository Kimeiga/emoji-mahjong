import { useState } from 'react'
import { motion } from 'framer-motion'
import { useAppStore } from '../../store/app-store'
import { useMultiplayerStore } from '../../store/multiplayer-store'
import { connectToRoom, sendMessage, parseServerMessage } from '../../multiplayer/client'
import type { AIDifficulty } from '../../multiplayer/protocol'

const difficulties: { value: AIDifficulty; label: string; desc: string }[] = [
  { value: 'easy', label: 'Easy', desc: 'Relaxed pace' },
  { value: 'medium', label: 'Medium', desc: 'Balanced' },
  { value: 'hard', label: 'Hard', desc: 'Competitive' },
]

export function MenuScreen() {
  const setScreen = useAppStore((s) => s.setScreen)
  const setRoomCode = useAppStore((s) => s.setRoomCode)
  const setWs = useAppStore((s) => s.setWs)
  const setMyPlayerId = useAppStore((s) => s.setMyPlayerId)
  const aiDifficulty = useAppStore((s) => s.aiDifficulty)
  const setAiDifficulty = useAppStore((s) => s.setAiDifficulty)
  const applyServerMessage = useMultiplayerStore((s) => s.applyServerMessage)

  const [joinCode, setJoinCode] = useState('')
  const [showJoin, setShowJoin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function connectAndNavigate(roomCode: string) {
    const ws = connectToRoom(roomCode)

    ws.onopen = () => {
      sendMessage(ws, { type: 'join', playerName: 'Player' })
      setWs(ws)
      setRoomCode(roomCode)
      setScreen('lobby')
      setLoading(false)
    }

    ws.onmessage = (event) => {
      const msg = parseServerMessage(event.data)
      if (!msg) return
      if (msg.type === 'assigned') {
        setMyPlayerId(msg.playerId)
      }
      applyServerMessage(msg)
      if (msg.type === 'game-state') {
        setScreen('multiplayer-game')
      }
    }

    ws.onerror = () => {
      setLoading(false)
      setError('Connection failed. Please try again.')
    }

    ws.onclose = () => {
      setWs(null)
    }
  }

  async function handleCreateRoom() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/rooms', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to create room')
      const { code } = await res.json()
      connectAndNavigate(code)
    } catch {
      setLoading(false)
      setError('Could not create room. Is the server running?')
    }
  }

  function handleJoinRoom() {
    const code = joinCode.trim().toUpperCase()
    if (!code) return
    setLoading(true)
    setError(null)
    connectAndNavigate(code)
  }

  function handleSinglePlayer() {
    setScreen('single-player')
  }

  return (
    <div className="h-full flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="w-full max-w-sm"
      >
        {/* Title */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.1, damping: 10 }}
            className="text-7xl mb-3"
          >
            🀄
          </motion.div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Emoji Mahjong
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Match emoji by semantic tags
          </p>
        </div>

        {/* AI Difficulty selector */}
        <div className="mb-6">
          <div className="text-xs text-slate-500 text-center mb-2">AI Difficulty</div>
          <div className="flex gap-2 justify-center">
            {difficulties.map((d) => (
              <button
                key={d.value}
                onClick={() => setAiDifficulty(d.value)}
                className={`
                  px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                  ${aiDifficulty === d.value
                    ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                  }
                `}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSinglePlayer}
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg tracking-wide shadow-lg shadow-orange-500/30 active:shadow-inner disabled:opacity-50 transition-all"
          >
            Single Player
          </motion.button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-xs text-slate-500">or play online</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleCreateRoom}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 text-white font-bold text-base tracking-wide shadow-lg shadow-blue-500/30 active:shadow-inner disabled:opacity-50 transition-all"
          >
            {loading ? 'Connecting...' : 'Create Room'}
          </motion.button>

          {!showJoin ? (
            <button
              onClick={() => setShowJoin(true)}
              className="w-full py-3 rounded-xl bg-slate-800 text-slate-300 font-medium text-base hover:bg-slate-700 transition-colors"
            >
              Join Room
            </button>
          ) : (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="flex gap-2"
            >
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ROOM CODE"
                maxLength={6}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 text-white text-center font-mono text-lg tracking-widest placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
                autoFocus
              />
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleJoinRoom}
                disabled={loading || !joinCode.trim()}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold shadow-lg shadow-green-500/30 disabled:opacity-50 transition-all"
              >
                Go
              </motion.button>
            </motion.div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-center text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20"
          >
            {error}
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}
