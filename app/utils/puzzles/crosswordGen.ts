/** Crossword generator: any square size, block patterns in, a grid filled only with bank words out (pure, seeded, bounded). */
import type { CwEntry } from './crosswordBank'
import { makeRng, type Rng } from './rng'

export interface CwSlot {
  n: number
  dir: 'across' | 'down'
  r: number
  c: number
  len: number
  /** cell indexes (row * size + col) */
  cells: number[]
  answer: string
  clue: string
}

export interface CwPuzzle {
  size: number
  pattern: string
  /** size * size cells: the solution letter (A-Z), '' for a black square */
  solution: string[]
  /** clue number printed in a cell, 0 = none */
  numbers: number[]
  across: CwSlot[]
  down: CwSlot[]
}

/** words by length plus their clues */
export interface CwBank { byLen: Map<number, string[]>, clue: Map<string, string>, size: number }

/** a bank from entries: only A-Z answers of 3..maxLen letters with a clue, the first entry of a word wins */
export function makeBank(entries: readonly CwEntry[], maxLen: number): CwBank {
  const clue = new Map<string, string>()
  const byLen = new Map<number, string[]>()
  for (const e of entries) {
    const a = e?.a
    if (typeof a !== 'string' || a.length < 3 || a.length > maxLen || !/^[A-Z]+$/.test(a) || !e.c || clue.has(a)) continue
    clue.set(a, e.c)
    const l = byLen.get(a.length)
    if (l) l.push(a)
    else byLen.set(a.length, [a])
  }
  return { byLen, clue, size: clue.size }
}

interface Raw { dir: 'across' | 'down', r: number, c: number, cells: number[] }

/** the across / down runs (3+ cells) of a pattern, in reading order, and the printed clue numbers */
export function runsOf(rows: string[], N: number): { raw: Raw[], numbers: number[] } {
  const blk = (r: number, c: number) => r < 0 || c < 0 || r >= N || c >= N || rows[r][c] === '#'
  const raw: Raw[] = []
  const numbers: number[] = Array(N * N).fill(0)
  let n = 0
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (blk(r, c)) continue
      const a = blk(r, c - 1) && !blk(r, c + 1)
      const d = blk(r - 1, c) && !blk(r + 1, c)
      if (!a && !d) continue
      numbers[r * N + c] = ++n
      if (a) { const cells: number[] = []; for (let k = c; !blk(r, k); k++) cells.push(r * N + k); raw.push({ dir: 'across', r, c, cells }) }
      if (d) { const cells: number[] = []; for (let k = r; !blk(k, c); k++) cells.push(k * N + c); raw.push({ dir: 'down', r, c, cells }) }
    }
  }
  return { raw, numbers }
}

/** half-turn / mirror / diagonal symmetric? (optional: irregular shapes are welcome, this only tells them apart) */
export function patternSymmetric(pattern: string): boolean {
  const rows = pattern.split('/')
  const N = rows.length
  const sym = (f: (r: number, c: number) => [number, number]) => rows.every((row, r) => [...row].every((_, c) => { const [r2, c2] = f(r, c); return row[c] === rows[r2]?.[c2] }))
  return sym((r, c) => [N - 1 - r, N - 1 - c]) || sym((r, c) => [r, N - 1 - c]) || sym((r, c) => [N - 1 - r, c]) || sym((r, c) => [c, r])
}

/**
 * a pattern is usable when it is square, every white run is 3+ long (across and down, so no single cell or 1-2 letter run),
 * the white cells are connected (so none is isolated) and there is at least one block. Symmetry is NOT required: stepped
 * corners, notches and one-sided blocks are what real printed grids look like.
 */
export function patternProblem(pattern: string, N: number): string {
  const rows = pattern.split('/')
  if (rows.length !== N || rows.some(r => r.length !== N || /[^.#]/.test(r))) return 'shape'
  const w = (r: number, c: number) => rows[r][c] === '.'
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (!w(r, c)) continue
      let a = 1, d = 1
      for (let k = c - 1; k >= 0 && w(r, k); k--) a++
      for (let k = c + 1; k < N && w(r, k); k++) a++
      for (let k = r - 1; k >= 0 && w(k, c); k--) d++
      for (let k = r + 1; k < N && w(k, c); k++) d++
      if (a < 3 || d < 3) return `run ${r},${c}`
    }
  }
  if (!rows.join('').includes('#')) return 'plain'
  const seen = new Set<number>()
  const first = rows.join('').indexOf('.')
  if (first < 0) return 'empty'
  const stack = [first]
  while (stack.length) {
    const i = stack.pop()!
    if (seen.has(i)) continue
    seen.add(i)
    const r = Math.floor(i / N), c = i % N
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const r2 = r + dr, c2 = c + dc
      if (r2 >= 0 && c2 >= 0 && r2 < N && c2 < N && w(r2, c2)) stack.push(r2 * N + c2)
    }
  }
  return seen.size === rows.join('').split('.').length - 1 ? '' : 'connected'
}

const popcnt = (x: number) => { x -= (x >>> 1) & 0x55555555; x = (x & 0x33333333) + ((x >>> 2) & 0x33333333); return (((x + (x >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24 }

/**
 * backtracking fill: most constrained slot first, words in seeded random order, bank words only, no word twice.
 * Candidates are bitsets over the (shuffled) bank, so a node costs a few AND operations.
 */
function fill(raw: Raw[], N: number, bank: CwBank, rng: Rng, budget: number): string[] | null {
  const lens = [...new Set(raw.map(s => s.cells.length))]
  const W: Record<number, string[]> = {}
  const nw: Record<number, number> = {}
  const idx: Record<number, Uint32Array[]> = {}
  const avail: Record<number, Uint32Array> = {}
  for (const L of lens) {
    const list = bank.byLen.get(L)
    if (!list?.length) return null
    W[L] = rng.shuffle(list)
    const n = Math.ceil(W[L].length / 32)
    nw[L] = n
    avail[L] = new Uint32Array(n)
    idx[L] = Array.from({ length: L * 26 }, () => new Uint32Array(n))
    W[L].forEach((w, i) => {
      avail[L][i >>> 5] |= 1 << (i & 31)
      for (let k = 0; k < L; k++) idx[L][k * 26 + w.charCodeAt(k) - 65][i >>> 5] |= 1 << (i & 31)
    })
  }
  const g: string[] = Array(N * N).fill('')
  const done: boolean[] = Array(raw.length).fill(false)
  const word: string[] = Array(raw.length).fill('')
  const tmp = new Uint32Array(Math.max(...lens.map(L => nw[L])))
  let nodes = 0

  /** candidates of slot s into tmp, returns how many */
  function cands(s: Raw): number {
    const L = s.cells.length
    const n = nw[L]
    for (let j = 0; j < n; j++) tmp[j] = avail[L][j]
    for (let k = 0; k < L; k++) {
      const x = g[s.cells[k]]
      if (!x) continue
      const b = idx[L][k * 26 + x.charCodeAt(0) - 65]
      for (let j = 0; j < n; j++) tmp[j] &= b[j]
    }
    let c = 0
    for (let j = 0; j < n; j++) c += popcnt(tmp[j])
    return c
  }

  function go(left: number): boolean {
    if (left === 0) return true
    if (++nodes > budget) return false
    let best = -1
    let bestC = 1e9
    for (let i = 0; i < raw.length; i++) {
      if (done[i]) continue
      const c = cands(raw[i])
      if (c === 0) return false
      if (c < bestC) { best = i; bestC = c }
    }
    const s = raw[best]
    const L = s.cells.length
    cands(s)
    const list: number[] = []
    for (let j = 0; j < nw[L]; j++) for (let b = tmp[j]; b; b &= b - 1) list.push(j * 32 + (31 - Math.clz32(b & -b)))
    done[best] = true
    for (const id of list) {
      const w = W[L][id]
      const old = s.cells.map(i => g[i])
      s.cells.forEach((i, k) => { g[i] = w[k] })
      avail[L][id >>> 5] &= ~(1 << (id & 31))
      word[best] = w
      if (go(left - 1)) return true
      avail[L][id >>> 5] |= 1 << (id & 31)
      s.cells.forEach((i, k) => { g[i] = old[k] })
      if (nodes > budget) break
    }
    done[best] = false
    word[best] = ''
    return false
  }
  return go(raw.length) ? word : null
}

/** one fill attempt of a pattern (null = no fill within the node budget) */
export function buildPuzzle(bank: CwBank, pattern: string, N: number, rng: Rng, budget: number): CwPuzzle | null {
  const { raw, numbers } = runsOf(pattern.split('/'), N)
  const res = fill(raw, N, bank, rng, budget)
  if (!res) return null
  const solution: string[] = Array(N * N).fill('')
  const slots: CwSlot[] = raw.map((s, i) => {
    s.cells.forEach((cell, k) => { solution[cell] = res[i][k] })
    return { n: numbers[s.cells[0]], dir: s.dir, r: s.r, c: s.c, len: s.cells.length, cells: s.cells, answer: res[i], clue: bank.clue.get(res[i]) || '' }
  })
  return { size: N, pattern, solution, numbers, across: slots.filter(s => s.dir === 'across'), down: slots.filter(s => s.dir === 'down') }
}

/**
 * a puzzle for a seed string: pure and deterministic. Patterns are tried from a seeded start with a node budget each;
 * rounds grow the budget, so a hard seed still ends (after at most `rounds` x patterns attempts) instead of looping.
 */
export function generate(bank: CwBank, patterns: readonly string[], N: number, seed: number, budget = 2500, rounds = 6): CwPuzzle {
  const rng = makeRng(seed)
  const start = rng.int(patterns.length)
  for (let r = 0; r < rounds; r++) {
    for (let t = 0; t < patterns.length; t++) {
      const p = buildPuzzle(bank, patterns[(start + t) % patterns.length], N, rng, budget * (r + 1))
      if (p) return p
    }
  }
  throw new Error('crossword: no fill')
}
