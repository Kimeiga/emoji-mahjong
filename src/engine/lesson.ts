import { ALL_EMOJI_DEFS } from '../data/emojis'
import type { Tile } from '../types'
import { findSharedTags, isWinningHand } from './sets'

function tile(emoji: string): Tile {
  const definition = ALL_EMOJI_DEFS.find(def => def.emoji === emoji)
  if (!definition) throw new Error(`Missing lesson emoji: ${emoji}`)
  return { id: `lesson-${emoji}`, emoji, name: definition.name ?? emoji, tags: [...definition.tags] }
}
export const lesson = {
  fruit: ['🍎', '🍊', '🍋'].map(tile),
  sweet: ['🍇', '🍓', '🍌'].map(tile),
  sport: ['⚽', '🏀', '🎾'].map(tile),
  vehicle: ['🚗', '🚕', '🚌'].map(tile),
  spare: tile('🌵'),
  firstMarket: ['🍋', '⚽', '🚗'].map(tile),
  finalMarket: ['🚌', '🌵', '🔑'].map(tile),
}
export interface LessonState { step: number; solved: boolean; feedback: string }
export const initialLesson: LessonState = { step: 0, solved: false, feedback: '' }
export function chooseLesson(state: LessonState, choice: string): LessonState {
  if (state.solved) return state
  let solved = false
  let feedback = ''
  if (state.step === 0) {
    const pick = lesson.firstMarket.find(t => t.id === choice)
    solved = !!pick && findSharedTags([...lesson.fruit.slice(0, 2), pick]).includes('fruit')
    feedback = solved ? 'Apple, tangerine and lemon all share fruit. That is one set.' : 'Look for a fruit to join the apple and tangerine. Try another tile.'
  } else if (state.step === 1) {
    solved = choice === 'sweet' && findSharedTags(lesson.sweet).includes(choice)
    feedback = solved ? 'These three are also sweet. A different tag lets both sets count.' : 'Fruit is already used by your first set. Try the other connection.'
  } else if (state.step === 2) {
    solved = choice === lesson.spare.id
    feedback = solved ? 'You kept three sets and the vehicle pair. Now you have 11 tiles again.' : 'That discard is allowed in a match, but breaks this plan. Keep the sets and vehicle pair for this lesson.'
  } else if (state.step === 3) {
    const pick = lesson.finalMarket.find(t => t.id === choice)
    solved = !!pick && isWinningHand([...lesson.fruit, ...lesson.sweet, ...lesson.sport, ...lesson.vehicle.slice(0, 2), pick])
    feedback = solved ? 'Four sets, four different tags. A winning pick ends the match immediately: no discard needed.' : 'Look for a vehicle to join the car and taxi. Try another tile.'
  }
  return { ...state, solved, feedback }
}
export function nextLesson(state: LessonState): LessonState {
  return state.solved && state.step < 3 ? { step: state.step + 1, solved: false, feedback: '' } : state
}
