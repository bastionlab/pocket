import { ANSWERS, BEE, GUESSES } from './wordlists'
import { ANAGRAM_6, ANAGRAM_7, ANAGRAM_8, HANGMAN, LADDER_COMMON, LADDER_MORE, LADDER_WORDS } from './wordbank'
import { CONN_CATEGORIES } from './connectionsData'
import { rngFor } from './rng'

/** Pure logic of the word games. Everything is a function of the day string. */

// ---- Wordle ----
export const wordleAnswer = (day: string) => rngFor('wordle', day).pick(ANSWERS)
export const isWordleGuess = (w: string) => GUESSES.has(w)

/** g = right place, y = elsewhere in the word, x = not in it (repeated letters handled like the original) */
export function wordleEval(guess: string, answer: string): string {
  const out = Array.from({ length: guess.length }, () => 'x')
  const left: Record<string, number> = {}
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) out[i] = 'g'
    else left[answer[i]] = (left[answer[i]] || 0) + 1
  }
  for (let i = 0; i < guess.length; i++) {
    if (out[i] === 'g') continue
    if (left[guess[i]] > 0) { out[i] = 'y'; left[guess[i]]-- }
  }
  return out.join('')
}

/** a letter of the answer in its right place that no guess has hit yet and no hint has shown (null = nothing left) */
export function wordleHint(answer: string, guesses: string[], taken: number[], seed: string): { pos: number, l: string } | null {
  const open = [...answer].map((_, i) => i).filter(i => !taken.includes(i) && !guesses.some(g => g[i] === answer[i]))
  if (!open.length) return null
  const pos = rngFor('wordle-hint', seed).pick(open)
  return { pos, l: answer[pos] }
}

// ---- Quordle: four boards, the same guesses ----
export const QUORDLE_TRIES = 9
export function quordleAnswers(day: string): string[] {
  const rng = rngFor('quordle', day)
  const out: string[] = []
  while (out.length < 4) { const w = rng.pick(ANSWERS); if (!out.includes(w)) out.push(w) }
  return out
}
/** the rows one board shows: guesses up to and including the one that solved it (a solved board takes no more rows) */
export function quordleBoard(guesses: string[], answer: string): { rows: { word: string, ev: string }[], solved: boolean } {
  const rows: { word: string, ev: string }[] = []
  for (const g of guesses) {
    rows.push({ word: g, ev: wordleEval(g, answer) })
    if (g === answer) return { rows, solved: true }
  }
  return { rows, solved: false }
}
const RANK: Record<string, number> = { x: 1, y: 2, g: 3 }
/** per letter, the best known state on each of the four boards ('' = not tried there); `skip` = rows still flipping */
export function quordleKeys(guesses: string[], answers: string[], skip = -1): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  answers.forEach((a, b) => {
    quordleBoard(guesses, a).rows.forEach((r, gi) => {
      if (gi === skip) return
      r.ev.split('').forEach((e, i) => {
        const l = r.word[i]
        const cur = (out[l] ||= ['', '', '', ''])
        if ((RANK[cur[b]] || 0) < RANK[e]) cur[b] = e
      })
    })
  })
  return out
}

// ---- Anagram: three words of 6, 7 and 8 letters ----
export interface AnagramWord { word: string, alts: string[], scrambled: string }
export function anagramSet(day: string): AnagramWord[] {
  const rng = rngFor('anagram', day)
  return [ANAGRAM_6, ANAGRAM_7, ANAGRAM_8].map((list) => {
    const [word, ...alts] = rng.pick(list).split('/')
    const all = [word, ...alts]
    let s = word
    for (let i = 0; i < 40 && all.includes(s); i++) s = rng.shuffle([...word]).join('')
    return { word, alts, scrambled: s }
  })
}
/** any real word made of the same letters counts, not only the one the puzzle was built from */
export const isAnagramAnswer = (a: AnagramWord, g: string) => g === a.word || a.alts.includes(g)
/** the next position (left to right) a hint can lock: not locked yet */
export function anagramHintPos(word: string, locked: number[], seed: string): number {
  const open = [...word].map((_, i) => i).filter(i => !locked.includes(i))
  return open.length ? rngFor('anagram-hint', seed).pick(open) : -1
}

// ---- Hangman ----
const HANG = [...new Set(HANGMAN)].filter(w => w.length >= 7 && w.length <= 10)
export const hangmanWord = (day: string) => rngFor('hangman', day).pick(HANG)
export const HANGMAN_LIVES = 6
/** a letter of the word that is not shown yet (seeded by the number of letters already tried) */
export function hangmanHint(word: string, tried: string[], seed: string): string {
  const open = [...new Set(word)].filter(c => !tried.includes(c))
  return open.length ? rngFor('hangman-hint', seed).pick(open) : ''
}

// ---- Word ladder (four-letter words) ----
const LADDER = new Set([...LADDER_WORDS, ...LADDER_MORE])
const ABC = 'abcdefghijklmnopqrstuvwxyz'
const nbCache = new Map<string, string[]>()
export function ladderNeighbors(w: string): string[] {
  let out = nbCache.get(w)
  if (out) return out
  out = []
  for (let i = 0; i < w.length; i++) {
    for (const c of ABC) {
      if (c === w[i]) continue
      const x = w.slice(0, i) + c + w.slice(i + 1)
      if (LADDER.has(x)) out.push(x)
    }
  }
  nbCache.set(w, out)
  return out
}
export const isLadderWord = (w: string) => LADDER.has(w)

/** steps from `from` to every word it can reach */
export function ladderDistances(from: string): Map<string, number> {
  const d = new Map<string, number>([[from, 0]])
  const q = [from]
  for (let i = 0; i < q.length; i++) {
    for (const n of ladderNeighbors(q[i])) if (!d.has(n)) { d.set(n, d.get(q[i])! + 1); q.push(n) }
  }
  return d
}
/** fewest steps from a to b (BFS), or -1 */
export const ladderDistance = (a: string, b: string) => ladderDistances(a).get(b) ?? -1

const common = new Set(LADDER_COMMON)
/** steps from `from` through everyday words only */
function commonDistances(from: string): Map<string, number> {
  const d = new Map<string, number>([[from, 0]])
  const q = [from]
  for (let i = 0; i < q.length; i++) {
    for (const n of ladderNeighbors(q[i]!)) if (common.has(n) && !d.has(n)) { d.set(n, d.get(q[i]!)! + 1); q.push(n) }
  }
  return d
}
/** one shortest path from a to b (start and target included), everyday words when a shortest path exists with them, or [] */
export function ladderPath(a: string, b: string): string[] {
  const full = ladderDistances(b)
  if (!full.has(a)) return []
  const easy = commonDistances(b)
  const d = easy.get(a) === full.get(a) ? easy : full
  const out = [a]
  while (out[out.length - 1] !== b) {
    const here = out[out.length - 1]!
    const opts = ladderNeighbors(here).filter(n => d.get(n) === d.get(here)! - 1).sort()
    out.push(opts[0]!)
  }
  return out
}
function nextOnPath(w: string, toTarget: Map<string, number>): string | null {
  const dd = toTarget.get(w)
  if (dd === undefined || dd === 0) return null
  const opts = ladderNeighbors(w).filter(n => toTarget.get(n) === dd - 1).sort()
  return opts.find(n => common.has(n)) ?? opts[0] ?? null
}
/** the next word of a shortest path from `cur` to `target`, or '' */
export const ladderNext = (cur: string, target: string) => nextOnPath(cur, ladderDistances(target)) ?? ''

/** why `w` is no valid next rung after `prev`: '' = fine, else same | multi | unknown */
export function ladderReason(prev: string, w: string): '' | 'same' | 'multi' | 'unknown' {
  if (w === prev) return 'same'
  if ([...w].filter((c, i) => c !== prev[i]).length > 1) return 'multi'
  return LADDER.has(w) ? '' : 'unknown'
}

export const LADDER_SLACK = 8
export function ladderPuzzle(day: string): { start: string, target: string, par: number, max: number } {
  const rng = rngFor('word-ladder', day)
  const want = rng.pick([4, 5, 5, 6])
  // first choice: a pair whose shortest path only uses everyday words (so par is findable), then any pair
  for (const strict of [true, false]) {
    for (let k = 0; k < 60; k++) {
      const start = rng.pick(LADDER_COMMON)
      const d = ladderDistances(start)
      const c = LADDER_COMMON.filter(w => d.get(w) === want)
      if (c.length < 3) continue
      const target = rng.pick(c)
      if (strict && commonDistances(target).get(start) !== want) continue
      return { start, target, par: want, max: want + LADDER_SLACK }
    }
  }
  return { start: 'cold', target: 'warm', par: 4, max: 4 + LADDER_SLACK }
}

// ---- Connections ----
export interface ConnGroup { name: string, words: string[] }
const catsOf = new Map<string, number[]>()
CONN_CATEGORIES.forEach((c, i) => c.words.forEach(w => catsOf.set(w, [...(catsOf.get(w) ?? []), i])))
const sharesGroup = (ws: string[]) => ws.every(w => catsOf.has(w)) && catsOf.get(ws[0])!.some(c => ws.every(w => catsOf.get(w)!.includes(c)))

/** how many ways the 16 words split into four groups that each fit one known category (the puzzle needs exactly one) */
function splits(words: string[]): number {
  const n = words.length
  const ok = new Map<number, boolean>()
  const can = (m: number[]) => { const k = m.reduce((a, b) => a * 16 + b, 0); let v = ok.get(k); if (v === undefined) { v = sharesGroup(m.map(i => words[i])); ok.set(k, v) } return v }
  let count = 0
  const go = (used: number, left: number) => {
    if (count > 1) return
    if (!left) { count++; return }
    let a = 0
    while (used & (1 << a)) a++
    const rest = []
    for (let i = a + 1; i < n; i++) if (!(used & (1 << i))) rest.push(i)
    for (let x = 0; x < rest.length; x++) for (let y = x + 1; y < rest.length; y++) for (let z = y + 1; z < rest.length; z++) {
      const m = [a, rest[x], rest[y], rest[z]]
      if (can(m)) go(used | (1 << a) | (1 << rest[x]) | (1 << rest[y]) | (1 << rest[z]), left - 1)
    }
  }
  go(0, n / 4)
  return count
}

/** four categories whose words overlap on purpose: every puzzle has red herrings, and still exactly one solution */
export function connectionsPuzzle(day: string): { groups: ConnGroup[], order: string[] } {
  const rng = rngFor('connections', day)
  const cats = CONN_CATEGORIES
  let best: { groups: ConnGroup[], herrings: number } | null = null
  for (let k = 0; k < 500; k++) {
    const pick = [rng.int(cats.length)]
    while (pick.length < 4) {
      const near = rng.next() < 0.75 ? cats.map((_, i) => i).filter(i => !pick.includes(i) && pick.some(p => cats[p].words.some(w => cats[i].words.includes(w)))) : []
      const pool = near.length ? near : cats.map((_, i) => i).filter(i => !pick.includes(i))
      pick.push(rng.pick(pool))
    }
    const chosen: string[][] = []
    const used = new Set<string>()
    for (const ci of pick) {
      const others = pick.filter(p => p !== ci)
      const shared = (w: string) => others.some(o => cats[o].words.includes(w))
      const ws = rng.shuffle(cats[ci].words.filter(w => !used.has(w)))
      const want = rng.int(3) // how many words that also fit another group of this puzzle
      const take = [...ws.filter(shared).slice(0, want), ...ws.filter(w => !shared(w))]
      const row = [...take, ...ws.filter(w => !take.includes(w))].slice(0, 4)
      row.forEach(w => used.add(w))
      chosen.push(row)
    }
    if (chosen.some(r => r.length < 4)) continue
    const all = chosen.flat()
    const herrings = all.filter(w => pick.filter(p => cats[p].words.includes(w)).length > 1).length
    if (herrings < 2 || (best && herrings <= best.herrings)) continue
    if (splits(all) !== 1) continue
    best = { herrings, groups: pick.map((p, i) => ({ name: cats[p].name, words: chosen[i] })) }
    if (herrings >= 4) break
  }
  if (!best) throw new Error('connections: no puzzle')
  const order = rng.shuffle(best.groups.flatMap(g => g.words))
  return { groups: best.groups, order }
}
/** three tiles of one group still to find (the hint selects them); `skip` = groups already hinted */
export function connectionsHint(groups: ConnGroup[], found: number[], seed: string, skip: number[] = []): { g: number, words: string[] } | null {
  const open = groups.map((_, i) => i).filter(i => !found.includes(i))
  const g = rngFor('connections-hint', seed).pick(open.filter(i => !skip.includes(i)).length ? open.filter(i => !skip.includes(i)) : open)
  if (g === undefined) return null
  return { g, words: rngFor('connections-hint', seed, 'w').shuffle(groups[g].words).slice(0, 3) }
}

// ---- Spelling bee ----
export interface Bee { letters: string, centre: string, outer: string[], words: string[], pangrams: string[] }
export function beePuzzle(day: string): Bee {
  const rng = rngFor('spelling-bee', day)
  const e = rng.pick(BEE)
  const centre = rng.pick([...e.l].filter(c => 'aeiourstnl'.includes(c)).concat([...e.l]))
  const words = e.w.filter(w => w.includes(centre))
  return { letters: e.l, centre, outer: rng.shuffle([...e.l].filter(c => c !== centre)), words, pangrams: e.p.filter(w => words.includes(w)) }
}
export const beePoints = (w: string, letters: string) => (w.length === 4 ? 1 : w.length) + (new Set(w).size === letters.length ? 7 : 0)
/** an unfound word the hint shows the first two letters of (pangram last), '' = none left */
export function beeHint(p: Bee, found: string[], hinted: string[], seed: string): string {
  const open = p.words.filter(w => !found.includes(w) && !hinted.includes(w) && w.length >= 4)
  const plain = open.filter(w => !p.pangrams.includes(w))
  return open.length ? rngFor('bee-hint', seed).pick(plain.length ? plain : open) : ''
}
