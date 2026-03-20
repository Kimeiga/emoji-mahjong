import { TileView } from '../shared/Tile'
import { useGame } from '../../contexts/GameContext'
import type { PlayerId } from '../../types'

interface DiscardPoolProps {
  playerId: PlayerId
  maxVisible?: number
  vertical?: boolean
}

export function DiscardPool({ playerId, maxVisible = 8, vertical = false }: DiscardPoolProps) {
  const { players } = useGame()
  const discards = players[playerId].discards
  const visible = discards.slice(-maxVisible)

  if (visible.length === 0) {
    return <div className="min-h-[32px]" />
  }

  return (
    <div className={`
      ${vertical
        ? 'flex flex-col gap-0.5 items-center'
        : 'flex flex-wrap gap-0.5 justify-center'
      }
    `}>
      {visible.map((tile) => (
        <TileView key={tile.id} tile={tile} size="sm" />
      ))}
    </div>
  )
}
