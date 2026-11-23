import type { QuizQ } from './quizTypes'
import { makeRng, fnv1a, rngFor } from './rng'
import { daySeedNumber, isRandomDay } from './registry'

/** the daily quiz: 8 questions, 3 easy, 3 medium, 2 hard, in that order */
export const QUIZ_PLAN: readonly (1 | 2 | 3)[] = [1, 1, 1, 2, 2, 2, 3, 3]
export const QUIZ_POINTS = { 1: 1, 2: 2, 3: 3 } as const
export const QUIZ_MAX = QUIZ_PLAN.reduce((s, l) => s + QUIZ_POINTS[l], 0)
/** solved from this many points on (60 % of the maximum) */
export const QUIZ_PASS = Math.ceil(QUIZ_MAX * 0.6)

/** whole days since 1970 of a YYYY-MM-DD string */
export function dayIndex(day: string): number {
  if (isRandomDay(day)) return daySeedNumber(day) // a random puzzle walks the pools from its own spot
  const [y, m, d] = day.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

/** days from this one on (2026-11-24) never repeat a question within QUIZ_GAP_DAYS days; earlier days keep their old questions (saves, archive) */
export const SPACED_FROM = Math.floor(Date.UTC(2026, 10, 24) / 86400000)
export const QUIZ_GAP_DAYS = 8

/** per game + level: the questions handed out so far in order (slot P = (day - SPACED_FROM) * per + n), built lazily and cached */
type Seq = { items: QuizQ[], last: Map<QuizQ, number>, left: QuizQ[], cycle: number, pool: QuizQ[], key: string }
const seqs = new Map<string, Seq>()

/**
 * From SPACED_FROM on every level is a pool walked cycle by cycle (a seeded permutation per pass). A slot takes the first
 * question of the pass that was not used in the last `QUIZ_GAP_DAYS * per` slots (the old days count too), so the same question never
 * shows up twice within a week, also not where one pass ends and the next begins. A pass of n > gap questions always has such a question.
 */
function seqAt(game: string, l: number, pool: QuizQ[], per: number, P: number, bank: readonly QuizQ[]): QuizQ {
  const key = `${game}:${l}:${pool.length}`
  let s = seqs.get(key)
  if (!s) {
    s = { items: [], last: new Map(), left: [], cycle: -1, pool, key }
    for (let d = SPACED_FROM - QUIZ_GAP_DAYS; d < SPACED_FROM; d++) { // what the old way showed in the days before: those must not come back at once
      const old = pickLegacy(game, bank, new Date(d * 86400000).toISOString().slice(0, 10)).filter((_, k) => QUIZ_PLAN[k] === l)
      old.forEach((q, j) => s!.last.set(q, (d - SPACED_FROM) * per + j))
    }
    seqs.set(key, s)
  }
  const gap = QUIZ_GAP_DAYS * per
  while (s.items.length <= P) {
    const slot = s.items.length
    if (!s.left.length) {
      s.cycle++
      s.left = makeRng(fnv1a(`${game}:quiz2:${l}:${s.cycle}`)).shuffle([...pool])
    }
    let at = s.left.findIndex(q => slot - (s!.last.get(q) ?? -1e9) >= gap)
    if (at < 0) at = 0
    const q = s.left.splice(at, 1)[0]!
    s.last.set(q, slot)
    s.items.push(q)
  }
  return s.items[P]!
}

function pickSpaced(game: string, bank: readonly QuizQ[], d: number): QuizQ[] {
  const pools: Record<number, QuizQ[]> = { 1: [], 2: [], 3: [] }
  for (const q of bank) pools[q.level].push(q)
  const per: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
  for (const l of QUIZ_PLAN) per[l]++
  const used: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
  return QUIZ_PLAN.map((l) => {
    const pool = pools[l].length > QUIZ_GAP_DAYS * per[l]! ? pools[l] : [...bank]
    return seqAt(game, l, pool, per[l]!, (d - SPACED_FROM) * per[l]! + used[l]++, bank)
  })
}

/**
 * The questions of a day (before SPACED_FROM). Every level is a pool walked through in a seeded permutation (one new permutation per
 * full pass), so a bank cycles through all its questions before any comes back. Same (game, day) = same quiz.
 */
export function pickQuiz(game: string, bank: readonly QuizQ[], day: string): QuizQ[] {
  if (!isRandomDay(day) && dayIndex(day) >= SPACED_FROM) return pickSpaced(game, bank, dayIndex(day))
  return pickLegacy(game, bank, day)
}

function pickLegacy(game: string, bank: readonly QuizQ[], day: string): QuizQ[] {
  const pools: Record<number, QuizQ[]> = { 1: [], 2: [], 3: [] }
  for (const q of bank) pools[q.level].push(q)
  const per: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
  for (const l of QUIZ_PLAN) per[l]++
  if (isRandomDay(day)) { // random mode: its own seeded draw per level, never the same question twice
    const rng = rngFor(game, day, ':quiz')
    const draw: Record<number, QuizQ[]> = {}
    for (const l of [1, 2, 3]) draw[l] = rng.shuffle(pools[l]!.length >= per[l]! ? pools[l]! : [...bank])
    const at: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
    return QUIZ_PLAN.map(l => draw[l]![at[l]!++]!)
  }
  const d = dayIndex(day)
  const used: Record<number, number> = { 1: 0, 2: 0, 3: 0 }
  const got: QuizQ[] = []
  return QUIZ_PLAN.map((l) => {
    const pool = pools[l].length ? pools[l] : bank
    const n = pool.length
    let q: QuizQ
    do { // a pass boundary inside one day could hand out the same question twice: skip to the next one
      const pos = d * per[l] + used[l]++
      const cycle = Math.floor(pos / n)
      const perm = makeRng(fnv1a(`${game}:quiz:${l}:${cycle}`)).shuffle(pool.map((_, i) => i))
      q = pool[perm[((pos % n) + n) % n]]!
    } while (got.includes(q) && used[l] < per[l] + n)
    got.push(q)
    return q
  })
}

/** the four answers of question `i` in display order; `right` is the index of the correct one */
export function quizOptions(game: string, day: string, i: number, q: QuizQ): { opts: string[], right: number } {
  const opts = rngFor(game, day, `:opts${i}`).shuffle([q.a, ...q.wrong])
  return { opts, right: opts.indexOf(q.a) }
}

/** two wrong options (indexes into the display order) a hint takes away */
export function quizHintDrop(game: string, day: string, i: number, right: number): number[] {
  const wrong = [0, 1, 2, 3].filter(k => k !== right)
  return rngFor(game, day, `:hint${i}`).shuffle(wrong).slice(0, 2)
}

/** seconds per question in timed mode */
export const QUIZ_TIME = 20

/** milliseconds left of a question shown at `t0` (ms epoch); 0 once the time is up */
export function quizRemaining(t0: number, now: number, limitSec = QUIZ_TIME): number {
  return Math.max(0, Math.min(limitSec * 1000, t0 + limitSec * 1000 - now))
}

/** the pick value of a question that ran out of time (counts wrong, nothing is marked as yours) */
export const QUIZ_TIMEOUT = -1

/** indexes of the questions answered wrong or not at all */
export function quizMissed(picks: readonly number[], rights: readonly number[]): number[] {
  return rights.map((r, k) => (picks[k] === r ? -1 : k)).filter(k => k >= 0)
}

/** the share text's row: green right, red wrong, yellow out of time (the squares are passed in so this file stays free of emoji) */
export function quizRow(picks: readonly number[], rights: readonly number[], sq: { ok: string, bad: string, late: string }): string {
  return rights.map((r, k) => (picks[k] === r ? sq.ok : picks[k] === QUIZ_TIMEOUT ? sq.late : sq.bad)).join('')
}
