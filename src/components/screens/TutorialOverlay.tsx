import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface TutorialOverlayProps {
  onDone: () => void
}

const slides = [
  {
    title: "Match 3 emoji sharing a tag",
    content: (
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-5xl">🐱</span>
          <span className="text-5xl">🐕</span>
          <span className="text-5xl">🐰</span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="h-px w-8 bg-slate-500" />
          <span className="px-3 py-1 rounded-full bg-amber-500 text-sm font-bold text-slate-900">
            animal (12)
          </span>
          <div className="h-px w-8 bg-slate-500" />
        </div>
        <p className="text-slate-400 text-sm mt-2 text-center max-w-xs">
          Tap any tile to see its tags. Find 3 tiles that share a tag to form a set!
        </p>
      </div>
    ),
  },
  {
    title: "Pick from the market",
    content: (
      <div className="flex flex-col items-center gap-4">
        <div className="flex gap-2">
          {["🌸", "🎲", "🐉", "🏯", "🦊"].map((e, i) => (
            <div key={i} className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center text-xl border border-slate-600">
              {e}
            </div>
          ))}
          <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center text-lg border-2 border-dashed border-slate-500 text-slate-400">
            ?
          </div>
        </div>
        <p className="text-slate-400 text-sm mt-2 text-center max-w-xs">
          Each turn, pick a face-up tile from the market (you can inspect first!) or draw blind from the wall.
        </p>
      </div>
    ),
  },
  {
    title: "Claim discards with PON!",
    content: (
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-end gap-3">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-slate-400">Your hand</span>
            <div className="flex gap-1">
              <span className="text-3xl bg-slate-700 rounded-lg px-1.5 py-1">🐱</span>
              <span className="text-3xl bg-slate-700 rounded-lg px-1.5 py-1">🐕</span>
            </div>
          </div>
          <span className="text-xl text-slate-500 pb-1">+</span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] text-slate-400">Discarded</span>
            <span className="text-3xl bg-amber-700/50 rounded-lg px-1.5 py-1 ring-2 ring-amber-400">🐰</span>
          </div>
        </div>
        <span className="px-4 py-1.5 rounded-full bg-amber-500 text-sm font-bold text-slate-900 mt-1">
          PON!
        </span>
        <p className="text-slate-400 text-sm text-center max-w-xs">
          When an opponent discards a tile that completes your set, claim it!
        </p>
      </div>
    ),
  },
  {
    title: "Rare tags = more points",
    content: (
      <div className="flex flex-col items-center gap-4">
        <div className="space-y-2 w-full max-w-xs">
          <div className="flex items-center justify-between px-3 py-2 bg-slate-700 rounded-lg">
            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-xs font-bold text-slate-900">red (14)</span>
            <span className="text-sm text-slate-400">6 pts</span>
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-slate-700 rounded-lg">
            <span className="px-2 py-0.5 rounded-full bg-sky-500 text-xs font-bold text-white">sky (3)</span>
            <span className="text-sm text-amber-400 font-bold">27 pts</span>
          </div>
        </div>
        <p className="text-slate-400 text-sm mt-1 text-center max-w-xs">
          Tags with fewer tiles in the pool score more. The number on each tag tells you how rare it is!
        </p>
      </div>
    ),
  },
  {
    title: "Form 4 sets to win!",
    content: (
      <div className="flex flex-col items-center gap-4">
        <div className="grid grid-cols-2 gap-2">
          {[
            { tag: "animal", emoji: ["🐱", "🐕", "🐰"], pts: "7" },
            { tag: "fruit", emoji: ["🍎", "🍊", "🍋"], pts: "10" },
            { tag: "sport", emoji: ["⚽", "🏀", "🎾"], pts: "13" },
            { tag: "rare", emoji: ["🦄", "🐉", "🦅"], pts: "27" },
          ].map((g, i) => (
            <div key={i} className="flex flex-col items-center">
              <span className="text-[10px] text-amber-400 font-bold mb-0.5">{g.pts}pt</span>
              <div className="flex gap-0.5 bg-slate-700 rounded-lg px-2 py-1.5">
                {g.emoji.map((e, j) => <span key={j} className="text-xl">{e}</span>)}
              </div>
            </div>
          ))}
        </div>
        <p className="text-slate-400 text-sm mt-1 text-center max-w-xs font-medium">
          First to 4 sets wins. Highest score takes the crown!
        </p>
      </div>
    ),
  },
]

export default function TutorialOverlay({ onDone }: TutorialOverlayProps) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [direction, setDirection] = useState(1)

  const isLast = currentSlide === slides.length - 1

  function handleNext() {
    if (isLast) {
      localStorage.setItem("emoji-mahjong-tutorial-seen", "1")
      onDone()
    } else {
      setDirection(1)
      setCurrentSlide((s) => s + 1)
    }
  }

  function handleSkip() {
    localStorage.setItem("emoji-mahjong-tutorial-seen", "1")
    onDone()
  }

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95">
      <motion.div
        className="relative z-10 bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 border border-slate-700"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", duration: 0.4 }}
      >
        {/* Slide content */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.2 }}
          >
            <h2 className="text-lg font-bold text-white text-center mb-5">
              {slides[currentSlide].title}
            </h2>
            <div className="min-h-[180px] flex items-center justify-center">
              {slides[currentSlide].content}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mt-5">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === currentSlide ? "bg-amber-400" : "bg-slate-600"
              }`}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={handleSkip}
            className="flex-1 py-2.5 rounded-lg bg-slate-700 text-slate-400 font-medium text-sm hover:bg-slate-600 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleNext}
            className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-sm transition-colors"
          >
            {isLast ? "Play!" : "Next"}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
