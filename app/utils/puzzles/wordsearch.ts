import { rngFor, type Rng } from './rng'
import { WS_THEMES } from './wordsearchData'

/**
 * Word Search: a letter grid with hidden words from the day's theme. Cells are row * n + col. Every word is placed
 * once; filler letters follow English letter frequency and are re-rolled until no list word occurs anywhere but at its
 * own placement (in any of the 8 directions, so a word can never be found in two places). Pure and seeded.
 */
export interface WsPlace { word: string, cell: number, dir: number, len: number }
export interface WsPuzzle { n: number, theme: string, grid: string[], words: WsPlace[], level: string }

/** the 8 directions as [dx, dy]: right, down, down-right, down-left, then the reverses (left, up, up-left, up-right) */
export const WS_DIRS: [number, number][] = [[1, 0], [0, 1], [1, 1], [-1, 1], [-1, 0], [0, -1], [-1, -1], [1, -1]]

interface Spec { n: number, count: number, dirs: number[], min: number, max: number, long: number }
/** size, word count, allowed directions, word lengths and how many longer (up to 10 letters) words a puzzle may carry */
export const WS_SPECS: Record<string, Spec> = {
  easy: { n: 10, count: 8, dirs: [0, 1], min: 4, max: 6, long: 0 },
  medium: { n: 12, count: 12, dirs: [0, 1, 2, 3], min: 4, max: 7, long: 0 },
  hard: { n: 14, count: 16, dirs: [0, 1, 2, 3, 4, 5, 6, 7], min: 5, max: 8, long: 3 },
}
export const wsSpec = (level?: string) => WS_SPECS[level ?? 'medium'] ?? WS_SPECS.medium!

/** English letter frequency (per mille), for the filler */
const FREQ: Record<string, number> = {
  E: 127, T: 91, A: 82, O: 75, I: 70, N: 67, S: 63, R: 60, H: 61, D: 43, L: 40, C: 28, U: 28, M: 24, W: 24,
  F: 22, G: 20, Y: 20, P: 19, B: 15, V: 10, K: 8, J: 2, X: 2, Q: 1, Z: 1,
}
const LETTERS = Object.keys(FREQ)
const TOTAL = LETTERS.reduce((s, l) => s + FREQ[l]!, 0)
function letter(rng: Rng): string {
  let r = rng.next() * TOTAL
  for (const l of LETTERS) { r -= FREQ[l]!; if (r < 0) return l }
  return 'E'
}

const isPal = (w: string) => w === [...w].reverse().join('')
const rev = (w: string) => [...w].reverse().join('')

/** the cells of a placement */
export function wsCells(n: number, p: { cell: number, dir: number, len: number }): number[] {
  const [dx, dy] = WS_DIRS[p.dir]!
  const x = p.cell % n, y = Math.floor(p.cell / n)
  return Array.from({ length: p.len }, (_, k) => (y + dy * k) * n + x + dx * k)
}

/** the day's theme (random days pick by seed too) */
export function wsTheme(day: string) {
  const rng = rngFor('word-search:theme', day)
  return WS_THEMES[rng.int(WS_THEMES.length)]!
}

/** pick the words: fit the level's lengths, no word inside another (or inside its reverse) */
function pickWords(theme: string[], s: Spec, rng: Rng): string[] {
  const pool = rng.shuffle(theme.filter(w => !isPal(w) && w.length <= s.n))
  const out: string[] = []
  const clash = (w: string) => out.some(o => o.includes(w) || w.includes(o) || o.includes(rev(w)) || rev(w).includes(o))
  const take = (ok: (w: string) => boolean, upTo: number) => {
    for (const w of pool) { if (out.length >= upTo) break; if (!out.includes(w) && ok(w) && !clash(w)) out.push(w) }
  }
  if (s.long) take(w => w.length > s.max, s.long)
  take(w => w.length >= s.min && w.length <= s.max, s.count)
  take(w => w.length <= s.n, s.count) // a thin theme: whatever fits
  return out
}

/** every occurrence of a word in the grid, in all 8 directions, as `cell:dir` keys */
function occurrences(n: number, grid: string[], w: string): string[] {
  const out: string[] = []
  for (let c = 0; c < n * n; c++) {
    if (grid[c] !== w[0]) continue
    const x = c % n, y = Math.floor(c / n)
    for (let d = 0; d < 8; d++) {
      const [dx, dy] = WS_DIRS[d]!
      const ex = x + dx * (w.length - 1), ey = y + dy * (w.length - 1)
      if (ex < 0 || ey < 0 || ex >= n || ey >= n) continue
      let k = 1
      while (k < w.length && grid[(y + dy * k) * n + x + dx * k] === w[k]) k++
      if (k === w.length) out.push(`${c}:${d}`)
    }
  }
  return out
}

function build(day: string, level: string, attempt: number): WsPuzzle | null {
  const s = wsSpec(level), n = s.n
  const rng = rngFor(`word-search:${level}`, day, attempt ? `#${attempt}` : '')
  const theme = wsTheme(day)
  const words = pickWords(theme.words, s, rng).sort((a, b) => b.length - a.length)
  if (words.length < s.count) return null
  const grid: string[] = new Array(n * n).fill('')
  const mine = new Array<boolean>(n * n).fill(false) // cells that carry part of a word
  const placed: WsPlace[] = []
  for (const w of words) {
    // sample placements; of a few that fit, prefer one that crosses an existing letter
    let best: WsPlace | null = null, bestScore = -1, fits = 0
    for (let t = 0; t < 400 && fits < 10; t++) {
      const dir = rng.pick(s.dirs), [dx, dy] = WS_DIRS[dir]!
      const x = rng.int(n), y = rng.int(n)
      const ex = x + dx * (w.length - 1), ey = y + dy * (w.length - 1)
      if (ex < 0 || ey < 0 || ex >= n || ey >= n) continue
      let ok = true, cross = 0
      for (let k = 0; k < w.length && ok; k++) {
        const g = grid[(y + dy * k) * n + x + dx * k]
        if (g === w[k]) cross++
        else if (g) ok = false
      }
      if (!ok || cross === w.length) continue
      fits++
      const score = Math.min(cross, 2) * 2 + rng.next()
      if (score > bestScore) { bestScore = score; best = { word: w, cell: y * n + x, dir, len: w.length } }
    }
    if (!best) return null
    wsCells(n, best).forEach((c, k) => { grid[c] = w[k]!; mine[c] = true })
    placed.push(best)
  }
  // filler, then re-roll filler cells wherever a list word shows up by accident (or a placed word shows up twice)
  for (let c = 0; c < n * n; c++) if (!grid[c]) grid[c] = letter(rng)
  for (let round = 0; round < 60; round++) {
    let bad = false
    for (const p of placed) {
      for (const o of occurrences(n, grid, p.word)) {
        if (o === `${p.cell}:${p.dir}`) continue
        bad = true
        const [c, d] = o.split(':').map(Number) as [number, number]
        const free = wsCells(n, { cell: c, dir: d, len: p.len }).filter(i => !mine[i])
        if (!free.length) return null // made of placed letters only: try the next attempt
        const i = rng.pick(free)
        grid[i] = letter(rng)
      }
    }
    if (!bad) return { n, theme: theme.name, grid, words: placed, level }
  }
  return null
}

const cache = new Map<string, WsPuzzle>()
/** the puzzle of a level on a day (a day string or `r-<seed>`); same input, same puzzle */
export function wsPuzzle(day: string, level?: string): WsPuzzle {
  const lv = level && WS_SPECS[level] ? level : 'medium'
  const key = `${lv}:${day}`
  const hit = cache.get(key)
  if (hit) return hit
  let p: WsPuzzle | null = null
  for (let a = 0; a < 40 && !p; a++) p = build(day, lv, a)
  if (!p) throw new Error('word search: no puzzle')
  if (cache.size > 20) cache.clear()
  cache.set(key, p)
  return p
}

/** cells from a start cell towards a pointer position (in cell units, cell centres at x + .5), snapped to 8 directions */
export function wsSnap(n: number, start: number, px: number, py: number): { dir: number, len: number } {
  const sx = start % n + .5, sy = Math.floor(start / n) + .5
  const dx = px - sx, dy = py - sy
  if (Math.hypot(dx, dy) < .5) return { dir: -1, len: 1 }
  const ang = Math.atan2(dy, dx) // 0 = right, +y = down
  const oct = ((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8 // 0 right, 1 down-right, 2 down, 3 down-left, 4 left, ...
  const dir = [0, 2, 1, 3, 4, 6, 5, 7][oct]!
  const [ux, uy] = WS_DIRS[dir]!
  let len = Math.round((dx * ux + dy * uy) / (ux * ux + uy * uy)) + 1
  // keep the line on the board
  const x0 = start % n, y0 = Math.floor(start / n)
  const lim = Math.min(ux > 0 ? n - 1 - x0 : ux < 0 ? x0 : 99, uy > 0 ? n - 1 - y0 : uy < 0 ? y0 : 99) + 1
  len = Math.max(1, Math.min(len, lim))
  return { dir, len }
}

/** the word a selection spells, and the placement index it matches (either reading direction), or -1 */
export function wsMatch(p: WsPuzzle, start: number, dir: number, len: number): number {
  if (dir < 0) return -1
  const cells = wsCells(p.n, { cell: start, dir, len })
  const s = cells.map(c => p.grid[c]).join('')
  const r = rev(s)
  return p.words.findIndex(w => (w.word === s || w.word === r) && w.len === len && sameLine(p.n, w, cells))
}
function sameLine(n: number, w: WsPlace, cells: number[]) {
  const mine = wsCells(n, w)
  return mine[0] === cells[0] && mine[mine.length - 1] === cells[cells.length - 1] || mine[0] === cells[cells.length - 1] && mine[mine.length - 1] === cells[0]
}
