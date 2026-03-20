import { motion } from 'framer-motion'
import type { Tile as TileType } from '../../types'
import { getTagColor } from '../../data/tag-colors'

interface TileProps {
  tile: TileType
  size?: 'sm' | 'md' | 'lg'
  selected?: boolean
  dimmed?: boolean
  highlighted?: boolean
  newlyDrawn?: boolean
  onClick?: () => void
  layoutId?: string
}

const sizes = {
  sm: 'w-8 h-8 text-xl',
  md: 'w-10 h-10 text-2xl',
  lg: 'w-14 h-14 text-4xl',
}

export function TileView({ tile, size = 'md', selected, dimmed, highlighted, newlyDrawn, onClick, layoutId }: TileProps) {
  const primaryColor = getTagColor(tile.tags[0] || 'default')

  return (
    <motion.button
      layoutId={layoutId}
      onClick={onClick}
      className={`
        ${sizes[size]}
        rounded-lg flex items-center justify-center
        border-2 transition-all duration-150 relative
        ${selected
          ? 'border-yellow-400 bg-yellow-400/20 -translate-y-2 shadow-lg shadow-yellow-400/30 z-10'
          : highlighted
            ? 'border-sky-400 bg-sky-400/10 ring-1 ring-sky-400/30'
            : dimmed
              ? 'border-slate-700 bg-slate-900 opacity-40'
              : newlyDrawn
                ? 'border-sky-400 bg-sky-400/10 ring-2 ring-sky-400/50'
                : 'border-slate-600 bg-slate-800 hover:border-slate-400'
        }
      `}
      style={!selected ? {
        borderBottomColor: primaryColor.bg,
        borderBottomWidth: '3px',
      } : undefined}
      whileTap={{ scale: 0.92 }}
      animate={newlyDrawn ? {
        boxShadow: ['0 0 0px rgba(56,189,248,0)', '0 0 12px rgba(56,189,248,0.5)', '0 0 0px rgba(56,189,248,0)'],
      } : undefined}
      transition={newlyDrawn ? { duration: 1, repeat: 1 } : undefined}
      layout
    >
      <span className="leading-none">{tile.emoji}</span>
    </motion.button>
  )
}

export function TagPill({ tag, count }: { tag: string; count?: number }) {
  const { bg, text } = getTagColor(tag)
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{ backgroundColor: bg, color: text }}
    >
      {tag}
      {count !== undefined && count > 0 && (
        <span className="opacity-70">({count})</span>
      )}
    </span>
  )
}
