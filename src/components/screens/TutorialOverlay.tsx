import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TutorialOverlayProps {
  onDone: () => void;
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
          <span className="px-3 py-1 rounded-full bg-indigo-600 text-sm font-medium text-white">
            animal
          </span>
          <div className="h-px w-8 bg-slate-500" />
        </div>
        <p className="text-slate-400 text-sm mt-2 text-center max-w-xs">
          Emoji that share a common tag can form a set. Find the connections!
        </p>
      </div>
    ),
  },
  {
    title: "Form 4 sets to win",
    content: (
      <div className="flex flex-col items-center gap-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            ["🐱", "🐕", "🐰"],
            ["🍎", "🍊", "🍋"],
            ["⚽", "🏀", "🎾"],
            ["🚗", "🚌", "🏎️"],
          ].map((group, i) => (
            <div
              key={i}
              className="flex gap-1 bg-slate-700 rounded-lg px-3 py-2 justify-center"
            >
              {group.map((e, j) => (
                <span key={j} className="text-2xl">
                  {e}
                </span>
              ))}
            </div>
          ))}
        </div>
        <div className="w-full max-w-xs mt-2">
          <div className="flex justify-between text-xs text-slate-400 mb-1">
            <span>Sets</span>
            <span>4 / 4</span>
          </div>
          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div className="h-full w-full rounded-full bg-green-500" />
          </div>
        </div>
        <p className="text-slate-400 text-sm mt-1 text-center max-w-xs">
          Complete 4 sets of 3 matching emoji to win the round.
        </p>
      </div>
    ),
  },
  {
    title: "Claim discards with PON!",
    content: (
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-end gap-4">
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-slate-400">Your hand</span>
            <div className="flex gap-1">
              <span className="text-4xl bg-slate-700 rounded-lg px-2 py-1">
                🐱
              </span>
              <span className="text-4xl bg-slate-700 rounded-lg px-2 py-1">
                🐕
              </span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl text-slate-500">+</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-slate-400">Opponent discards</span>
            <span className="text-4xl bg-amber-700/50 rounded-lg px-2 py-1 ring-2 ring-amber-400">
              🐰
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <div className="h-px w-6 bg-slate-500" />
          <span className="px-4 py-1.5 rounded-full bg-amber-500 text-sm font-bold text-slate-900">
            PON!
          </span>
          <div className="h-px w-6 bg-slate-500" />
        </div>
        <p className="text-slate-400 text-sm mt-1 text-center max-w-xs">
          When an opponent discards a tile that completes your set, claim it with
          PON!
        </p>
      </div>
    ),
  },
];

export default function TutorialOverlay({ onDone }: TutorialOverlayProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(1);

  const isLast = currentSlide === slides.length - 1;

  function handleNext() {
    if (isLast) {
      localStorage.setItem("emoji-mahjong-tutorial-seen", "1");
      onDone();
    } else {
      setDirection(1);
      setCurrentSlide((s) => s + 1);
    }
  }

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 200 : -200, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -200 : 200, opacity: 0 }),
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/70"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={handleNext}
      />

      {/* Card */}
      <motion.div
        className="relative z-10 bg-slate-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", duration: 0.4 }}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentSlide}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
          >
            <h2 className="text-xl font-bold text-white text-center mb-6">
              {slides[currentSlide].title}
            </h2>
            <div className="min-h-[200px] flex items-center justify-center">
              {slides[currentSlide].content}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Dot indicators */}
        <div className="flex justify-center gap-2 mt-6">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors duration-200 ${
                i === currentSlide ? "bg-white" : "bg-slate-600"
              }`}
            />
          ))}
        </div>

        {/* Button */}
        <button
          onClick={handleNext}
          className="mt-6 w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-colors"
        >
          {isLast ? "Got it!" : "Next"}
        </button>
      </motion.div>
    </div>
  );
}
