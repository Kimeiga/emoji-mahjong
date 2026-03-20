import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/app-store'
import { useMultiplayerStore } from '../../store/multiplayer-store'
import { connectToRoom, sendMessage, parseServerMessage, getApiUrl } from '../../multiplayer/client'
import { getSession, saveSession, clearSession } from '../../utils/session'
import { getStats } from '../../utils/stats'
import type { AIDifficulty, RoomListEntry } from '../../multiplayer/protocol'

const difficulties: { value: AIDifficulty; label: string }[] = [
  { value: 'easy', label: 'Easy' },
  { value: 'medium', label: 'Medium' },
  { value: 'hard', label: 'Hard' },
]

const ADJECTIVES = [
  'Swift', 'Bold', 'Lucky', 'Chill', 'Witty', 'Keen', 'Brave', 'Sly',
  'Zappy', 'Deft', 'Plucky', 'Spry', 'Nifty', 'Peppy', 'Zippy', 'Jazzy',
]
const NOUNS = [
  'Panda', 'Fox', 'Otter', 'Owl', 'Cat', 'Wolf', 'Hawk', 'Bear',
  'Frog', 'Lynx', 'Crane', 'Hare', 'Moth', 'Newt', 'Crow', 'Seal',
]

function randomName(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]
  return `${adj}${noun}`
}

function ServerBrowser({ playerName, onBack }: { playerName: string; onBack: () => void }) {
  const setScreen = useAppStore((s) => s.setScreen)
  const setRoomCode = useAppStore((s) => s.setRoomCode)
  const setWs = useAppStore((s) => s.setWs)
  const setMyPlayerId = useAppStore((s) => s.setMyPlayerId)
  const applyServerMessage = useMultiplayerStore((s) => s.applyServerMessage)

  const [rooms, setRooms] = useState<RoomListEntry[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [joining, setJoining] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl('/api/rooms'))
      if (res.ok) {
        const data = await res.json() as RoomListEntry[]
        setRooms(data)
      }
    } catch {
      // ignore
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    fetchRooms()
    const interval = setInterval(fetchRooms, 3000)
    return () => clearInterval(interval)
  }, [fetchRooms])

  function joinRoom(code: string) {
    setJoining(code)
    setError(null)
    const ws = connectToRoom(code)

    ws.onopen = () => {
      sendMessage(ws, { type: 'join', playerName: playerName.trim() || randomName() })
      setWs(ws)
      setRoomCode(code)
      setScreen('lobby')
    }

    ws.onmessage = (event) => {
      const msg = parseServerMessage(event.data)
      if (!msg) return
      if (msg.type === 'assigned') {
        setMyPlayerId(msg.playerId)
        saveSession({ roomCode: code, playerName: playerName.trim() || 'Player', myPlayerId: msg.playerId })
      }
      applyServerMessage(msg)
      if (msg.type === 'game-state') setScreen('multiplayer-game')
    }

    ws.onerror = () => {
      setJoining(null)
      setError('Could not connect to room')
    }

    ws.onclose = () => setWs(null)
  }

  async function createRoom() {
    setJoining('new')
    setError(null)
    try {
      const res = await fetch(getApiUrl('/api/rooms'), { method: 'POST' })
      if (!res.ok) throw new Error()
      const { code } = await res.json()
      joinRoom(code)
    } catch {
      setJoining(null)
      setError('Could not create room')
    }
  }

  return (
    <div className="h-full flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ x: 50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 20 }}
        className="w-full max-w-sm"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={onBack}
            className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-600 flex items-center justify-center text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
          >
            ←
          </button>
          <h2 className="text-xl font-bold text-white flex-1">Join a Room</h2>
          <button
            onClick={fetchRooms}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Refresh
          </button>
        </div>

        {/* Room list */}
        <div className="space-y-2 mb-4 min-h-[200px] max-h-[320px] overflow-y-auto">
          {loadingList && (
            <div className="text-center text-sm text-slate-500 py-8">
              Loading rooms...
            </div>
          )}

          {!loadingList && rooms.length === 0 && (
            <div className="text-center py-8">
              <div className="text-3xl mb-2">🏜️</div>
              <div className="text-sm text-slate-500">No rooms yet</div>
              <div className="text-xs text-slate-600 mt-1">Create one and invite friends!</div>
            </div>
          )}

          <AnimatePresence>
            {rooms.map((room) => (
              <motion.button
                key={room.code}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                onClick={() => joinRoom(room.code)}
                disabled={joining !== null}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800 border border-slate-600 hover:border-sky-500 hover:bg-slate-800/80 transition-all text-left disabled:opacity-50 group"
              >
                <div className="w-10 h-10 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-lg group-hover:border-sky-500/60 transition-colors">
                  🀄
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {room.players.length > 0 ? room.players.join(', ') : 'Empty room'}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {room.playerCount}/4 players
                  </div>
                </div>
                <div className="text-xs text-slate-500 group-hover:text-sky-400 transition-colors">
                  {joining === room.code ? 'Joining...' : 'Join →'}
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </div>

        {/* Create room button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={createRoom}
          disabled={joining !== null}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 text-white font-bold text-base tracking-wide shadow-lg shadow-blue-500/30 active:shadow-inner disabled:opacity-50 transition-all"
        >
          {joining === 'new' ? 'Creating...' : 'Create New Room'}
        </motion.button>

        {error && (
          <div className="mt-3 text-center text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
            {error}
          </div>
        )}
      </motion.div>
    </div>
  )
}

const FLOATING_EMOJI = ['🀄','🎴','🐱','🌸','🎲','🍜','🏯','🎋','🐉','🎎','🌙','🎏','🍵','🦊','🌺','🎑']

function FloatingBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {FLOATING_EMOJI.map((emoji, i) => (
        <motion.div
          key={i}
          className="absolute text-2xl opacity-[0.06]"
          style={{
            left: `${(i * 17 + 5) % 90}%`,
            top: `${(i * 23 + 10) % 85}%`,
          }}
          animate={{
            y: [0, -30, 0],
            rotate: [0, 10, -10, 0],
          }}
          transition={{
            duration: 6 + (i % 4) * 2,
            repeat: Infinity,
            delay: i * 0.4,
            ease: 'easeInOut',
          }}
        >
          {emoji}
        </motion.div>
      ))}
    </div>
  )
}

export function MenuScreen() {
  const setScreen = useAppStore((s) => s.setScreen)
  const setWs = useAppStore((s) => s.setWs)
  const setRoomCode = useAppStore((s) => s.setRoomCode)
  const setMyPlayerId = useAppStore((s) => s.setMyPlayerId)
  const aiDifficulty = useAppStore((s) => s.aiDifficulty)
  const setAiDifficulty = useAppStore((s) => s.setAiDifficulty)
  const applyServerMessage = useMultiplayerStore((s) => s.applyServerMessage)

  const [playerName, setPlayerName] = useState(randomName)
  const [showBrowser, setShowBrowser] = useState(false)
  const [reconnecting, setReconnecting] = useState(false)
  const stats = getStats()

  // Check for saved session to reconnect
  useEffect(() => {
    const session = getSession()
    if (session) {
      setReconnecting(true)
      const ws = connectToRoom(session.roomCode)
      ws.onopen = () => {
        sendMessage(ws, { type: 'join', playerName: session.playerName })
        setWs(ws)
        setRoomCode(session.roomCode)
        setMyPlayerId(session.myPlayerId)
      }
      ws.onmessage = (event) => {
        const msg = parseServerMessage(event.data)
        if (!msg) return
        if (msg.type === 'assigned') setMyPlayerId(msg.playerId)
        applyServerMessage(msg)
        if (msg.type === 'game-state') {
          setScreen('multiplayer-game')
          setReconnecting(false)
        }
        if (msg.type === 'room-state') {
          setScreen('lobby')
          setReconnecting(false)
        }
      }
      ws.onerror = () => {
        clearSession()
        setReconnecting(false)
      }
      ws.onclose = () => {
        setWs(null)
        setReconnecting(false)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (reconnecting) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">🀄</div>
          <div className="text-sm text-slate-400">Reconnecting to game...</div>
        </div>
      </div>
    )
  }

  if (showBrowser) {
    return <ServerBrowser playerName={playerName} onBack={() => setShowBrowser(false)} />
  }

  return (
    <div className="h-full flex flex-col items-center justify-center px-6 relative">
      <FloatingBackground />
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
        className="w-full max-w-sm relative z-10"
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
          {stats.gamesPlayed > 0 && (
            <p className="text-[11px] text-slate-500 mt-2">
              {stats.wins}W / {stats.losses}L / {stats.draws}D
            </p>
          )}
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
            onClick={() => setScreen('single-player')}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg tracking-wide shadow-lg shadow-orange-500/30 active:shadow-inner transition-all"
          >
            Single Player
          </motion.button>

          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-xs text-slate-500">or play online</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          {/* Player name */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your name"
              maxLength={16}
              className="flex-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm placeholder:text-slate-600 focus:outline-none focus:border-sky-500 transition-colors"
            />
            <button
              onClick={() => setPlayerName(randomName())}
              className="px-2.5 py-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-400 hover:text-white hover:border-slate-500 transition-colors text-sm"
              title="Random name"
            >
              🎲
            </button>
          </div>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowBrowser(true)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 text-white font-bold text-base tracking-wide shadow-lg shadow-blue-500/30 active:shadow-inner transition-all"
          >
            Multiplayer
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}
