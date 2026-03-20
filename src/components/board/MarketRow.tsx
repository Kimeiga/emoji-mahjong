import { motion } from 'framer-motion'
import { useGame } from '../../contexts/GameContext'
import { TileView } from '../shared/Tile'

export function MarketRow() {
  const { market, phase, currentPlayer, myPlayerId, pickMarket, drawBlind } = useGame()

  const isMyDraw = currentPlayer === myPlayerId && phase === 'draw'

  if (market.length === 0) return null

  return (
    <div className="flex flex-col items-center py-2 px-2">
      <div className="text-[10px] text-slate-500 mb-1">
        {isMyDraw ? 'Pick a tile or draw blind' : 'Market'}
      </div>
      <div className="flex gap-1.5 items-center">
        {market.map((tile) => (
          <motion.div
            key={tile.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className={isMyDraw ? 'cursor-pointer' : 'opacity-60'}
          >
            <TileView
              tile={tile}
              size="md"
              onClick={isMyDraw ? () => pickMarket(tile.id) : undefined}
            />
          </motion.div>
        ))}
        {isMyDraw && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileTap={{ scale: 0.9 }}
            onClick={drawBlind}
            className="w-10 h-10 rounded-lg bg-slate-700 border-2 border-dashed border-slate-500 flex items-center justify-center text-slate-400 hover:border-sky-400 hover:text-sky-400 transition-colors"
            title="Draw blind from wall"
          >
            <span className="text-lg">?</span>
          </motion.button>
        )}
      </div>
    </div>
  )
}
