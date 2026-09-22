import { useEffect, useRef, useState } from 'react'
import { chooseLesson, initialLesson, lesson, nextLesson } from '../../engine/lesson'
import type { Tile } from '../../types'

function LessonTiles({ tiles, onChoose }: { tiles: Tile[]; onChoose?: (id: string) => void }) {
  return <div className="flex flex-wrap justify-center gap-2">
    {tiles.map(tile => onChoose ? <button type="button" key={tile.id} className="lesson-tile" aria-label={`Choose ${tile.name}`} onClick={() => onChoose(tile.id)}>
      <span aria-hidden="true">{tile.emoji}</span><span className="text-[11px] text-slate-300">{tile.name}</span>
    </button> : <span key={tile.id} className="text-3xl p-1" role="img" aria-label={tile.name}>{tile.emoji}</span>)}
  </div>
}
export default function TutorialOverlay({ onDone }: { onDone: (play?: boolean) => void }) {
  const [state, setState] = useState(initialLesson)
  const heading = useRef<HTMLHeadingElement>(null)
  const nextButton = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (state.solved) nextButton.current?.focus(); else heading.current?.focus() }, [state.step, state.solved])
  const titles = ['Find the connection', 'Same tiles. Another meaning.', 'Keep a plan. Discard one.', 'Make the winning connection']
  function finish(play = false) {
    try { localStorage.setItem('emoji-mahjong-tutorial-seen', '1') } catch { /* Optional preference. */ }
    onDone(play)
  }
  const choose = (id: string) => setState(previous => chooseLesson(previous, id))
  return <main className="lesson-page">
    <div className="lesson-shell">
      <header className="flex justify-between items-center gap-3 mb-6">
        <span className="text-xs font-semibold tracking-widest text-sky-300 uppercase">Learn by playing</span>
        <button type="button" className="connection-link" onClick={() => finish()}>Skip</button>
      </header>
      <p className="text-xs text-slate-400 mb-2">{state.step + 1} of 4 · Practice, no timer</p>
      <h1 ref={heading} tabIndex={-1} className="text-2xl font-bold text-white mb-3">{titles[state.step]}</h1>
      <div className="flex gap-1 mb-6" aria-label={`Step ${state.step + 1} of 4`}>
        {titles.map((title, i) => <span key={title} className={`h-1 flex-1 rounded-full ${i <= state.step ? 'bg-sky-400' : 'bg-slate-700'}`} />)}
      </div>
      {state.step === 0 && <>
        <p className="lesson-copy">Three different emoji sharing one tag make a set. Pick a fruit from the market to join your pair.</p>
        <div className="lesson-group"><span className="connection-tag">fruit · {state.solved ? '3' : '2'}/3</span><LessonTiles tiles={state.solved ? lesson.fruit : lesson.fruit.slice(0, 2)} /></div>
        {!state.solved && <><p className="lesson-label">Practice market · pick one</p><LessonTiles tiles={lesson.firstMarket} onChoose={choose} /></>}
      </>}
      {state.step === 1 && <>
        <p className="lesson-copy">Each set must use a different tag. Your first set uses <strong>fruit</strong>. Which other connection lets these three count too?</p>
        <div className="lesson-group"><span className="connection-tag">First set: fruit</span><LessonTiles tiles={lesson.fruit} /></div>
        <div className="lesson-group"><span className="lesson-label">Your next set</span><LessonTiles tiles={lesson.sweet} /></div>
        <div className="grid grid-cols-2 gap-3">
          {['fruit', 'sweet'].map(tag => <button type="button" key={tag} className="lesson-choice" disabled={state.solved} onClick={() => choose(tag)}>{tag}</button>)}
        </div>
      </>}
      {state.step === 2 && <>
        <p className="lesson-copy">After picking a tile, discard one unless you have won. Keep these three sets and the vehicle pair. For this practice turn, discard the cactus.</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {(['fruit', 'sweet', 'sport', 'vehicle'] as const).map(tag => <div key={tag} className="lesson-group !m-0"><span className="connection-tag">{tag}</span><LessonTiles tiles={tag === 'vehicle' ? lesson.vehicle.slice(0, 2) : lesson[tag]} /></div>)}
        </div>
        {!state.solved && <LessonTiles tiles={[lesson.fruit[0], lesson.spare, lesson.vehicle[0]]} onChoose={choose} />}
      </>}
      {state.step === 3 && <>
        <p className="lesson-copy">You have three sets and a vehicle pair. Pick the tile that completes all four sets.</p>
        <div className="lesson-group"><span className="connection-tag">vehicle · {state.solved ? '3' : '2'}/3</span><LessonTiles tiles={state.solved ? lesson.vehicle : lesson.vehicle.slice(0, 2)} /></div>
        {!state.solved && <><p className="lesson-label">Practice market · pick one</p><LessonTiles tiles={lesson.finalMarket} onChoose={choose} /></>}
        {state.solved && <div className="grid grid-cols-2 gap-2 mt-3">
          {(['fruit', 'sweet', 'sport', 'vehicle'] as const).map(tag => <div key={tag} className="lesson-group !m-0"><span className="connection-tag">{tag}</span><LessonTiles tiles={lesson[tag]} /></div>)}
        </div>}
      </>}
      <p role="status" className={`lesson-feedback ${state.solved ? 'text-emerald-300' : 'text-slate-300'}`}>{state.feedback}</p>
      {state.step < 3 ? <button ref={nextButton} type="button" className="lesson-primary" disabled={!state.solved} onClick={() => setState(nextLesson)}>Next</button> :
        <button ref={nextButton} type="button" className="lesson-primary" disabled={!state.solved} onClick={() => finish(true)}>Play!</button>}
      <p className="text-xs text-slate-400 mt-3">First to four different-tag sets wins. Each tile counts once. Bonus hand value never changes the winner.</p>
      <details className="mt-4 text-sm text-slate-300"><summary className="connection-link">What are PON and Riichi?</summary>
        <p className="lesson-copy mt-2">PON claims another player’s discard with two of your tiles. That set and its tag become locked. Other sets in your hand stay flexible.</p>
        <p className="lesson-copy mt-2">Riichi locks a closed hand one tile from winning. Choose a highlighted legal discard first; later non-winning draws are discarded automatically. It is optional.</p>
      </details>
    </div>
  </main>
}
