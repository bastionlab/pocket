/**
 * Word Wheel (game id `word-trail`): a wheel of 5-7 letters and a crossword-shaped field. Every answer of the field is spelled
 * with wheel letters in any order, each letter at most as often as the wheel has it. The wheel word (a bank word, so the
 * longest answer can be the full anagram) is chosen first, then the field is grown from it by crossing more buildable
 * bank words. Every other valid word that can be built from the wheel is a bonus word. Pure, seeded, bounded.
 */
import { CW_BANK } from './crosswordBank'
import { CW_BANK_X45 } from './crosswordBank6'
import { CW_BANK_X67 } from './crosswordBank7'
import { ANSWERS, GUESSES, LONG_WORDS, WORDS3 } from './wordlists'
import { ANAGRAM_6, ANAGRAM_7, HANGMAN, LADDER_COMMON, LADDER_MORE, LADDER_WORDS } from './wordbank'
import { rngFor, type Rng } from './rng'

export interface TrailSlot {
  dir: 'across' | 'down'
  len: number
  /** cell indexes of the field (row * cols + col) */
  cells: number[]
  answer: string
}

export interface TrailPuzzle {
  rows: number
  cols: number
  /** the wheel letters in wheel order (A-Z, the wheel word scrambled) */
  wheel: string[]
  /** the wheel word: an answer of the field when it fits, always buildable */
  word: string
  /** rows * cols: the solution letter, '' = no square */
  solution: string[]
  /** across slots first, then down, both in reading order */
  slots: TrailSlot[]
  /** every valid word of 3+ letters buildable from the wheel that is not in the field */
  bonus: string[]
}

/** wheel size and field size limits per level (medium is the default); slot counts are a range */
export function trailSpec(level?: string): { letters: number, max: number, slots: [number, number], pool: number } {
  if (level === 'easy') return { letters: 5, max: 6, slots: [5, 8], pool: 8 }
  if (level === 'hard') return { letters: 7, max: 8, slots: [10, 16], pool: 18 }
  return { letters: 6, max: 7, slots: [8, 12], pool: 12 }
}

const MAX_LEN = 7
const A = 65

let BANK: { list: string[], byLen: Map<number, string[]> } | null = null
/** the field bank: A-Z words of 3-7 letters from the three crossword banks (vetted, common) */
function bank() {
  if (BANK) return BANK
  const seen = new Set<string>()
  const list: string[] = []
  const byLen = new Map<number, string[]>()
  for (const e of [...CW_BANK, ...CW_BANK_X45, ...CW_BANK_X67]) {
    const a = e?.a
    if (typeof a !== 'string' || a.length < 3 || a.length > MAX_LEN || !/^[A-Z]+$/.test(a) || seen.has(a)) continue
    seen.add(a)
    list.push(a)
    const l = byLen.get(a.length)
    if (l) l.push(a)
    else byLen.set(a.length, [a])
  }
  return (BANK = { list, byLen })
}

let VALID: string[] | null = null
/** every accepted word of 3-7 letters (bank + the word lists of the other games), upper case, unique */
function valid(): string[] {
  if (VALID) return VALID
  const s = new Set<string>(bank().list)
  for (const l of [ANSWERS, LONG_WORDS, WORDS3, GUESSES, ANAGRAM_6, ANAGRAM_7, HANGMAN, LADDER_COMMON, LADDER_MORE, LADDER_WORDS]) {
    for (const w of l) {
      const u = typeof w === 'string' ? w.toUpperCase() : ''
      if (u.length >= 3 && u.length <= MAX_LEN && /^[A-Z]+$/.test(u)) s.add(u)
    }
  }
  return (VALID = [...s])
}

const counts = (w: string): number[] => {
  const c: number[] = Array(26).fill(0)
  for (let i = 0; i < w.length; i++) c[w.charCodeAt(i) - A]++
  return c
}
/** can `w` be spelled with the letter counts `have` (each letter at most as often as the wheel has it) */
function buildable(w: string, have: readonly number[]): boolean {
  if (w.length > MAX_LEN) return false
  const used: number[] = Array(26).fill(0)
  for (let i = 0; i < w.length; i++) {
    const k = w.charCodeAt(i) - A
    if (++used[k] > have[k]) return false
  }
  return true
}
/** can this word be traced on a wheel of these letters (the public check for typed / traced words) */
export const canSpell = (word: string, wheel: readonly string[]) => word.length > 0 && buildable(word, counts(wheel.join('')))

interface Placed { w: string, r: number, c: number, dir: 0 | 1 }

/** grow a field from `first` with words of `pool`: a crossword with no stray two-letter runs, inside a max x max box */
function grow(first: string, pool: readonly string[], rng: Rng, max: number, want: number): Placed[] {
  const K = max * 2 + 1
  const grid = new Map<number, string>()
  const dirs = new Map<number, number>()
  const placed: Placed[] = []
  const used = new Set<string>()
  let r0 = K, r1 = -1, c0 = K, c1 = -1
  const at = (r: number, c: number) => (r < 0 || c < 0 || r >= K || c >= K ? undefined : grid.get(r * K + c))
  /** crossings of a candidate placement, or -1 when it breaks a rule */
  function check(w: string, r: number, c: number, dir: 0 | 1): number {
    const dr = dir, dc = 1 - dir
    if (at(r - dr, c - dc) !== undefined || at(r + dr * w.length, c + dc * w.length) !== undefined) return -1
    let cross = 0
    let a0 = r0, a1 = r1, b0 = c0, b1 = c1
    for (let i = 0; i < w.length; i++) {
      const rr = r + dr * i, cc = c + dc * i
      if (rr < 0 || cc < 0 || rr >= K || cc >= K) return -1
      const ex = at(rr, cc)
      if (ex !== undefined) {
        if (ex !== w[i] || ((dirs.get(rr * K + cc) || 0) & (1 << dir))) return -1
        cross++
      } else if (at(rr + dc, cc + dr) !== undefined || at(rr - dc, cc - dr) !== undefined) return -1
      a0 = Math.min(a0, rr); a1 = Math.max(a1, rr); b0 = Math.min(b0, cc); b1 = Math.max(b1, cc)
    }
    if (cross < 1 || cross >= w.length || a1 - a0 + 1 > max || b1 - b0 + 1 > max) return -1
    return cross
  }
  function put(w: string, r: number, c: number, dir: 0 | 1) {
    for (let i = 0; i < w.length; i++) {
      const k = (r + dir * i) * K + c + (1 - dir) * i
      grid.set(k, w[i])
      dirs.set(k, (dirs.get(k) || 0) | (1 << dir))
    }
    const rE = r + dir * (w.length - 1), cE = c + (1 - dir) * (w.length - 1)
    r0 = Math.min(r0, r); r1 = Math.max(r1, rE); c0 = Math.min(c0, c); c1 = Math.max(c1, cE)
    placed.push({ w, r, c, dir })
    used.add(w)
  }
  const mid = max
  put(first, mid, mid - (first.length >> 1), 0)
  const order = rng.shuffle(pool.filter(w => w !== first))
  // longer words and several crossings first, a little noise so the fields differ
  for (let guard = 0; placed.length < want && guard < want * 3; guard++) {
    let best: Placed | null = null
    let bestS = -1e9
    for (const w of order) {
      if (used.has(w)) continue
      for (let dir = 0 as 0 | 1; dir < 2; dir++) {
        for (let i = 0; i < w.length; i++) {
          // anchor on every placed letter equal to w[i]
          for (const p of placed) {
            if (p.dir === dir) continue
            for (let j = 0; j < p.w.length; j++) {
              if (p.w[j] !== w[i]) continue
              const pr = p.r + p.dir * j, pc = p.c + (1 - p.dir) * j
              const r = dir ? pr - i : pr, c = dir ? pc : pc - i
              const x = check(w, r, c, dir)
              if (x < 0) continue
              const rows = Math.max(r1, r + dir * (w.length - 1)) - Math.min(r0, r) + 1
              const cols = Math.max(c1, c + (1 - dir) * (w.length - 1)) - Math.min(c0, c) + 1
              const s = x * 3 + w.length * 0.4 - Math.abs(rows - cols) * 0.7 - (rows * cols) * 0.05 + rng.next() * 3
              if (s > bestS) { bestS = s; best = { w, r, c, dir } }
            }
          }
        }
      }
    }
    if (!best) break
    put(best.w, best.r, best.c, best.dir)
  }
  return placed.map(p => ({ ...p, r: p.r - r0, c: p.c - c0 }))
}

/** the puzzle of one wheel word: field + bonus words, or null when the field is too small */
export function buildWheel(word: string, rng: Rng, level: string | undefined, minSlots: number): TrailPuzzle | null {
  const spec = trailSpec(level)
  const have = counts(word)
  const B = bank()
  const pool = B.list.filter(w => buildable(w, have))
  if (pool.length < minSlots + 2) return null
  const want = spec.slots[0] + rng.int(spec.slots[1] - spec.slots[0] + 1)
  let best: Placed[] | null = null
  let bestS = -1
  for (let t = 0; t < 6; t++) {
    const p = grow(word, rng.shuffle(pool).slice(0, Math.max(spec.pool, want + 6)), rng, spec.max, want)
    // prefer the wanted count, then compact
    const bb = [Math.max(...p.map(x => x.r + (x.dir ? x.w.length : 1))), Math.max(...p.map(x => x.c + (x.dir ? 1 : x.w.length)))]
    const s = Math.min(p.length, want) * 10 - Math.abs(bb[0] - bb[1]) - bb[0] * bb[1] * 0.05
    if (s > bestS) { bestS = s; best = p }
    if (p.length >= want) break
  }
  if (!best || best.length < minSlots) return null
  const rows = Math.max(...best.map(x => x.r + (x.dir ? x.w.length : 1)))
  const cols = Math.max(...best.map(x => x.c + (x.dir ? 1 : x.w.length)))
  const solution: string[] = Array(rows * cols).fill('')
  const all: TrailSlot[] = best.map((p) => {
    const cells: number[] = []
    for (let i = 0; i < p.w.length; i++) {
      const rr = p.r + p.dir * i, cc = p.c + (1 - p.dir) * i
      cells.push(rr * cols + cc)
      solution[rr * cols + cc] = p.w[i]
    }
    return { dir: p.dir ? 'down' : 'across', len: p.w.length, cells, answer: p.w }
  })
  all.sort((a, b) => a.cells[0] - b.cells[0])
  const slots = [...all.filter(s => s.dir === 'across'), ...all.filter(s => s.dir === 'down')]
  const inField = new Set(slots.map(s => s.answer))
  const bonus = valid().filter(w => !inField.has(w) && buildable(w, have)).sort()
  let wheel = word.split('')
  for (let k = 0; k < 8; k++) {
    wheel = rng.shuffle(word.split(''))
    if (wheel.join('') !== word) break
  }
  return { rows, cols, wheel, word, solution, slots, bonus }
}

const cache = new Map<string, TrailPuzzle>()
/** the Word Wheel of a game key + day (`word-trail`, `word-trail:hard`; day may be `r-<seed>`): deterministic */
export function trailFor(key: string, level: string | undefined, day: string): TrailPuzzle {
  const id = `${key}|${day}`
  const hit = cache.get(id)
  if (hit) return hit
  const rng = rngFor(key, day)
  const spec = trailSpec(level)
  const cands = bank().byLen.get(spec.letters) || []
  let p: TrailPuzzle | null = null
  for (let i = 0; i < 400 && !p; i++) {
    const w = rng.pick(cands)
    // the first tries insist on the full range, later ones take what the word gives
    p = buildWheel(w, rng, level, i < 150 ? spec.slots[0] : i < 300 ? Math.ceil(spec.slots[0] * 0.7) : 3)
  }
  if (!p) throw new Error('word-trail: no puzzle')
  if (cache.size > 24) cache.clear()
  cache.set(id, p)
  return p
}
