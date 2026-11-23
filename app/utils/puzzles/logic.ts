import { rngFor, type Rng } from './rng'
import { SEARCH_TERMS, type SearchTerm } from './searchTerms'
import { isRandomDay } from './registry'

/** Pure logic of the number / logic games. Everything is a function of the day string. */

// ---- Sudoku (9x9 and the 6x6 mini with 2x3 boxes) ----
export interface SudokuSpec { n: number, br: number, bc: number }
export const SUDOKU9: SudokuSpec = { n: 9, br: 3, bc: 3 }
export const SUDOKU6: SudokuSpec = { n: 6, br: 2, bc: 3 }

/** bitmask of digits (bit d) that still fit cell i */
function candMask(g: number[], sp: SudokuSpec, i: number): number {
  const { n, br, bc } = sp
  const r = Math.floor(i / n), c = i % n
  let used = 0
  for (let k = 0; k < n; k++) { used |= 1 << g[r * n + k]; used |= 1 << g[k * n + c] }
  const r0 = r - (r % br), c0 = c - (c % bc)
  for (let y = 0; y < br; y++) for (let x = 0; x < bc; x++) used |= 1 << g[(r0 + y) * n + c0 + x]
  return ((1 << (n + 1)) - 2) & ~used
}
const bits = (m: number) => { let k = 0; while (m) { k += m & 1; m >>= 1 } return k }

/** how many solutions (stops at `limit`); running out of `budget` nodes counts as "not unique" */
export function sudokuCount(grid: number[], sp: SudokuSpec, limit = 2, budget = 30000): number {
  const g = grid.slice()
  let count = 0, nodes = 0
  const rec = () => {
    if (count >= limit || nodes++ > budget) return
    let best = -1, bm = 0, bn = 99
    for (let i = 0; i < g.length; i++) {
      if (g[i]) continue
      const m = candMask(g, sp, i), k = bits(m)
      if (k < bn) { best = i; bm = m; bn = k; if (!k) return }
    }
    if (best < 0) { count++; return }
    for (let d = 1; d <= sp.n; d++) {
      if (!(bm & (1 << d))) continue
      g[best] = d; rec(); g[best] = 0
      if (count >= limit) return
    }
  }
  rec()
  return nodes > budget ? limit : count
}

function sudokuFull(sp: SudokuSpec, rng: Rng): number[] {
  const g = Array.from({ length: sp.n * sp.n }, () => 0)
  const digits = Array.from({ length: sp.n }, (_, i) => i + 1)
  const rec = (): boolean => {
    let best = -1, bm = 0, bn = 99
    for (let i = 0; i < g.length; i++) {
      if (g[i]) continue
      const m = candMask(g, sp, i), k = bits(m)
      if (k < bn) { best = i; bm = m; bn = k; if (!k) return false }
    }
    if (best < 0) return true
    for (const d of rng.shuffle(digits)) {
      if (!(bm & (1 << d))) continue
      g[best] = d
      if (rec()) return true
      g[best] = 0
    }
    return false
  }
  rec()
  return g
}

/** a puzzle with exactly one solution: dig holes out of a full grid while it stays unique */
export function sudokuPuzzle(game: string, day: string, sp: SudokuSpec, minClues: number): { puzzle: number[], solution: number[] } {
  const rng = rngFor(game, day)
  const solution = sudokuFull(sp, rng)
  const puzzle = solution.slice()
  let clues = puzzle.length
  for (const i of rng.shuffle(puzzle.map((_, k) => k))) {
    if (clues <= minClues) break
    const v = puzzle[i]
    puzzle[i] = 0
    if (sudokuCount(puzzle, sp) === 1) clues--
    else puzzle[i] = v
  }
  return { puzzle, solution }
}

/** cells that break a row / column / box rule right now (for the highlight) */
export function sudokuConflicts(g: number[], sp: SudokuSpec): Set<number> {
  const bad = new Set<number>()
  const { n, br, bc } = sp
  const groups: number[][] = []
  for (let k = 0; k < n; k++) {
    groups.push(Array.from({ length: n }, (_, j) => k * n + j), Array.from({ length: n }, (_, j) => j * n + k))
  }
  for (let r0 = 0; r0 < n; r0 += br) for (let c0 = 0; c0 < n; c0 += bc) {
    const b: number[] = []
    for (let y = 0; y < br; y++) for (let x = 0; x < bc; x++) b.push((r0 + y) * n + c0 + x)
    groups.push(b)
  }
  for (const grp of groups) {
    const seen = new Map<number, number>()
    for (const i of grp) {
      if (!g[i]) continue
      if (seen.has(g[i])) { bad.add(i); bad.add(seen.get(g[i])!) } else seen.set(g[i], i)
    }
  }
  return bad
}

/** digits that still fit cell i given what is placed now (for hints) */
export function sudokuCandidates(g: number[], sp: SudokuSpec, i: number): number[] {
  const m = candMask(g, sp, i), out: number[] = []
  for (let d = 1; d <= sp.n; d++) if (m & (1 << d)) out.push(d)
  return out
}

/** the cell a hint fills: the selected one if it is wrong or empty, else the open cell with the fewest candidates
 * (a naked single when there is one), else a wrong cell; -1 when the grid already equals the solution */
export function sudokuHintCell(g: number[], solution: number[], sp: SudokuSpec, sel: number): number {
  if (sel >= 0 && g[sel] !== solution[sel]) return sel
  let best = -1, bn = 99
  for (let i = 0; i < g.length; i++) {
    if (g[i]) continue
    const k = sudokuCandidates(g, sp, i).length
    if (k > 0 && k < bn) { best = i; bn = k }
  }
  return best >= 0 ? best : g.findIndex((v, i) => v !== solution[i])
}

/** candidate notes (one bitmask per cell, bit d = digit d) for every empty cell, 0 for filled ones (auto notes) */
export function sudokuAutoNotes(g: number[], sp: SudokuSpec): number[] {
  return g.map((v, i) => (v ? 0 : candMask(g, sp, i)))
}

/** a move a human would find: `naked` = the cell has one candidate left, `row` / `col` / `box` = the digit fits one cell of that line only.
 * `cells` = the cells that explain it (the line, or the cell's row, column and box peers that block the other digits). */
export interface SudokuTechnique { cell: number, digit: number, kind: 'naked' | 'row' | 'col' | 'box', cells: number[] }
export function sudokuTechnique(g: number[], sp: SudokuSpec, sel = -1): SudokuTechnique | null {
  const { n, br, bc } = sp
  const size = n * n
  const masks = g.map((v, i) => (v ? 0 : candMask(g, sp, i)))
  const found: SudokuTechnique[] = []
  for (let i = 0; i < size; i++) {
    if (g[i] || bits(masks[i]) !== 1) continue
    let d = 1
    while (!(masks[i] & (1 << d))) d++
    const r = Math.floor(i / n), c = i % n
    const peers: number[] = []
    for (let j = 0; j < size; j++) {
      if (j === i || !g[j]) continue
      const rj = Math.floor(j / n), cj = j % n
      if (rj === r || cj === c || (Math.floor(rj / br) === Math.floor(r / br) && Math.floor(cj / bc) === Math.floor(c / bc))) peers.push(j)
    }
    found.push({ cell: i, digit: d, kind: 'naked', cells: peers })
  }
  const lines: ['row' | 'col' | 'box', number[]][] = []
  for (let k = 0; k < n; k++) {
    lines.push(['row', Array.from({ length: n }, (_, j) => k * n + j)], ['col', Array.from({ length: n }, (_, j) => j * n + k)])
  }
  for (let r0 = 0; r0 < n; r0 += br) for (let c0 = 0; c0 < n; c0 += bc) {
    const b: number[] = []
    for (let y = 0; y < br; y++) for (let x = 0; x < bc; x++) b.push((r0 + y) * n + c0 + x)
    lines.push(['box', b])
  }
  for (const [kind, cells] of lines) {
    for (let d = 1; d <= n; d++) {
      if (cells.some(i => g[i] === d)) continue
      const at = cells.filter(i => masks[i] & (1 << d))
      if (at.length === 1) found.push({ cell: at[0]!, digit: d, kind, cells })
    }
  }
  return found.find(f => f.cell === sel) ?? found[0] ?? null
}

// ---- Takuzu: equal 0s and 1s per line, no three in a row, no two equal lines; 6x6 / 8x8 / 10x10 by level ----
export const TZ = 8 // the medium size (the default `n` of every helper below)
export const TZ_SPEC: Record<string, { n: number, clues: number }> = { easy: { n: 6, clues: 18 }, medium: { n: 8, clues: 20 }, hard: { n: 10, clues: 32 } }
export const tzSpec = (level?: string) => TZ_SPEC[level ?? 'medium'] ?? TZ_SPEC.medium!
function tzLineOk(line: number[]): boolean {
  const TZ = line.length
  let a = 0, b = 0
  for (const v of line) { if (v === 0) a++; else if (v === 1) b++ }
  if (a > TZ / 2 || b > TZ / 2) return false
  for (let i = 0; i + 2 < line.length; i++) if (line[i] >= 0 && line[i] === line[i + 1] && line[i] === line[i + 2]) return false
  return true
}
export function takuzuRows(g: number[], TZ = 8): number[][] { return Array.from({ length: TZ }, (_, r) => g.slice(r * TZ, r * TZ + TZ)) }
export function takuzuCols(g: number[], TZ = 8): number[][] { return Array.from({ length: TZ }, (_, c) => Array.from({ length: TZ }, (_, r) => g[r * TZ + c])) }
/** no rule broken so far (unknown cells are -1) */
export function takuzuOk(g: number[], TZ = 8): boolean {
  for (const lines of [takuzuRows(g, TZ), takuzuCols(g, TZ)]) {
    const done: string[] = []
    for (const l of lines) {
      if (!tzLineOk(l)) return false
      if (!l.includes(-1)) { const k = l.join(''); if (done.includes(k)) return false; done.push(k) }
    }
  }
  return true
}
/** up to `limit` solutions of a partial grid (row-major search that only re-checks the row and column it just touched) */
function takuzuSolutions(grid: number[], limit: number, rng?: Rng, TZ = 8, budget = Infinity): number[][] {
  const g = grid.slice(), found: number[][] = []
  let nodes = 0 // past the budget the search gives up (the caller then treats the grid as not provably unique)
  const rowOf = (r: number) => g.slice(r * TZ, r * TZ + TZ)
  const colOf = (c: number) => Array.from({ length: TZ }, (_, r) => g[r * TZ + c])
  /** the line is fine and, when full, differs from every other full line of its kind */
  const lineOk = (line: number[], others: (k: number) => number[], self: number) => {
    if (!tzLineOk(line)) return false
    if (line.includes(-1)) return true
    const key = line.join('')
    for (let k = 0; k < TZ; k++) if (k !== self) { const o = others(k); if (!o.includes(-1) && o.join('') === key) return false }
    return true
  }
  const cellOk = (i: number) => {
    const r = Math.floor(i / TZ), c = i % TZ
    return lineOk(rowOf(r), rowOf, r) && lineOk(colOf(c), colOf, c)
  }
  const rec = (from: number) => {
    if (found.length >= limit || ++nodes > budget) return
    let i = from
    while (i < g.length && g[i] !== -1) i++
    if (i >= g.length) { found.push(g.slice()); return }
    for (const v of rng ? rng.shuffle([0, 1]) : [0, 1]) {
      g[i] = v
      if (cellOk(i)) rec(i + 1)
      if (found.length >= limit) { g[i] = -1; return }
    }
    g[i] = -1
  }
  // the givens themselves must not already break a rule
  if (!takuzuOk(g, TZ)) return found
  rec(0)
  return nodes > budget ? Array.from({ length: limit }, () => g.slice()) : found // out of budget: "not unique"
}
/** a puzzle with exactly one solution: holes dug out of a full grid while it stays unique (`minClues` keeps a few givens);
 * `key` = the game key (`takuzu`, `takuzu:hard`), the seed, and the level sets the size */
export function takuzuPuzzle(key: string, day: string, TZ = 8, minClues = 20): { puzzle: number[], solution: number[] } {
  const rng = rngFor(key, day)
  const solution = takuzuSolutions(Array.from({ length: TZ * TZ }, () => -1), 1, rng, TZ)[0]
  const puzzle = solution.slice()
  let clues = puzzle.length
  for (const i of rng.shuffle(puzzle.map((_, k) => k))) {
    if (clues <= minClues) break
    const v = puzzle[i]
    puzzle[i] = -1
    // a hole stays only when the search PROVES one solution within the budget (keeps the 10x10 generation quick)
    if (takuzuSolutions(puzzle, 2, undefined, TZ, TZ > 8 ? 1500 : Infinity).length !== 1) puzzle[i] = v
    else clues--
  }
  return { puzzle, solution }
}

/** cells that break a rule right now: three in a row, more than half of one value, or two identical full lines */
export function takuzuErrors(g: number[], TZ = 8): Set<number> {
  const out = new Set<number>()
  const lines: number[][] = []
  for (let k = 0; k < TZ; k++) {
    lines.push(Array.from({ length: TZ }, (_, x) => k * TZ + x), Array.from({ length: TZ }, (_, y) => y * TZ + k))
  }
  const full = new Map<string, number[]>()
  for (const cells of lines) {
    for (const v of [0, 1]) {
      const m = cells.filter(x => g[x] === v)
      if (m.length > TZ / 2) m.forEach(x => out.add(x))
    }
    for (let i = 0; i + 2 < TZ; i++) {
      const [a, b, c] = [cells[i], cells[i + 1], cells[i + 2]]
      if (g[a] >= 0 && g[a] === g[b] && g[a] === g[c]) [a, b, c].forEach(x => out.add(x))
    }
    if (cells.every(x => g[x] >= 0)) {
      const key = (cells[1] - cells[0] === 1 ? 'r' : 'c') + cells.map(x => g[x]).join('')
      const twin = full.get(key)
      if (twin) { twin.forEach(x => out.add(x)); cells.forEach(x => out.add(x)) } else full.set(key, cells)
    }
  }
  return out
}

/** the cell a Takuzu hint fills: an empty cell the plain rules force (the selected one first), else any empty one, else a wrong one */
export function takuzuHintCell(g: number[], solution: number[], sel: number, TZ = 8): number {
  const forced = (i: number) => {
    const t = g.slice()
    t[i] = 1 - solution[i]
    const r = Math.floor(i / TZ), c = i % TZ
    return !tzLineOk(takuzuRows(t, TZ)[r]) || !tzLineOk(takuzuCols(t, TZ)[c])
  }
  const open = g.map((v, i) => (v < 0 ? i : -1)).filter(i => i >= 0)
  if (sel >= 0 && g[sel] < 0 && forced(sel)) return sel
  return open.find(forced) ?? open[0] ?? g.findIndex((v, i) => v !== solution[i])
}

// ---- Minesweeper: fair boards (solvable without guessing from the opening); three sizes (the hard board is tall, not wide, so it fits a phone) ----
export interface MsSpec { w: number, h: number, mines: number }
export const MS_LEVELS: Record<string, MsSpec> = {
  easy: { w: 9, h: 9, mines: 10 },
  medium: { w: 12, h: 12, mines: 24 },
  hard: { w: 12, h: 20, mines: 50 },
}
export const msSpec = (level?: string): MsSpec => MS_LEVELS[level ?? 'medium'] ?? MS_LEVELS.medium!
export function msNeighbors(i: number, sp: MsSpec): number[] {
  const x = i % sp.w, y = Math.floor(i / sp.w), out: number[] = []
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const nx = x + dx, ny = y + dy
    if ((dx || dy) && nx >= 0 && nx < sp.w && ny >= 0 && ny < sp.h) out.push(ny * sp.w + nx)
  }
  return out
}
/** how many mines touch each cell */
export const msCounts = (mines: boolean[], sp: MsSpec): number[] => mines.map((_, i) => msNeighbors(i, sp).filter(n => mines[n]).length)

/**
 * What the open numbers PROVE. `st`: 0 closed / unknown, 1 open, 2 known mine. One pass of: a number with all / none of
 * its mines left, one number's cells inside another's (subset), the mine total, and, only when those find nothing, an
 * exhaustive search over each connected group of border cells (capped). Returns closed cells that are certainly safe / mines.
 */
export function msDeduce(st: ArrayLike<number>, counts: number[], sp: MsSpec): { safe: number[], mine: number[] } {
  const N = sp.w * sp.h
  const safe = new Set<number>(), mine = new Set<number>()
  const cons: { cells: number[], need: number }[] = []
  let known = 0, closed = 0
  for (let i = 0; i < N; i++) {
    if (st[i] === 2) known++
    else if (st[i] === 0) closed++
    if (st[i] !== 1 || !counts[i]) continue
    const nb = msNeighbors(i, sp)
    const cells = nb.filter(n => st[n] === 0)
    if (cells.length) cons.push({ cells, need: counts[i] - nb.filter(n => st[n] === 2).length })
  }
  const add = (cells: number[], need: number) => {
    if (need === 0) cells.forEach(c => safe.add(c))
    else if (need === cells.length) cells.forEach(c => mine.add(c))
  }
  for (const c of cons) add(c.cells, c.need)
  const left = sp.mines - known
  if (closed && left === 0) for (let i = 0; i < N; i++) if (st[i] === 0) safe.add(i)
  if (closed && left === closed) for (let i = 0; i < N; i++) if (st[i] === 0) mine.add(i)
  if (!safe.size && !mine.size) {
    const by = new Map<number, number[]>()
    cons.forEach((c, k) => c.cells.forEach((x) => { (by.get(x) ?? by.set(x, []).get(x)!).push(k) }))
    for (let k = 0; k < cons.length; k++) {
      const a = cons[k]!, seen = new Set<number>()
      for (const x of a.cells) for (const j of by.get(x)!) {
        if (j === k || seen.has(j)) continue
        seen.add(j)
        const b = cons[j]!
        if (a.cells.length >= b.cells.length || !a.cells.every(c => b.cells.includes(c))) continue
        add(b.cells.filter(c => !a.cells.includes(c)), b.need - a.need)
      }
    }
  }
  if (!safe.size && !mine.size) msEnumerate(cons, safe, mine)
  return { safe: [...safe], mine: [...mine] }
}

/** every way to place the mines of one connected group of constraints; a cell that is a mine in all (none) of them is certain */
function msEnumerate(cons: { cells: number[], need: number }[], safe: Set<number>, mine: Set<number>) {
  const by = new Map<number, number[]>()
  cons.forEach((c, k) => c.cells.forEach((x) => { (by.get(x) ?? by.set(x, []).get(x)!).push(k) }))
  const done = new Set<number>()
  for (let s = 0; s < cons.length; s++) {
    if (done.has(s)) continue
    // the group: constraints linked by shared cells; its cells in BFS order so a constraint closes early
    const cells: number[] = [], inGroup = [s], cset = new Set<number>()
    done.add(s)
    for (let q = 0; q < inGroup.length; q++) for (const x of cons[inGroup[q]!]!.cells) {
      if (cset.has(x)) continue
      cset.add(x); cells.push(x)
      for (const j of by.get(x)!) if (!done.has(j)) { done.add(j); inGroup.push(j) }
    }
    if (cells.length > 44) continue
    const ids = inGroup
    const cc = ids.map(k => cons[k]!)
    const of = cells.map(c => by.get(c)!.filter(k => ids.includes(k)).map(k => ids.indexOf(k)))
    const got = cc.map(() => 0), rest = cc.map(c => c.cells.length)
    const asg = new Array<number>(cells.length).fill(0), hit = new Array<number>(cells.length).fill(0)
    let total = 0, nodes = 0, bust = false
    const rec = (p: number) => {
      if (bust) return
      if (++nodes > 60000) { bust = true; return }
      if (p === cells.length) { total++; asg.forEach((v, i) => { hit[i]! += v }); return }
      for (const v of [0, 1]) {
        let ok = true
        for (const k of of[p]!) { got[k]! += v; rest[k]!-- }
        for (const k of of[p]!) if (got[k]! > cc[k]!.need || got[k]! + rest[k]! < cc[k]!.need) ok = false
        if (ok) { asg[p] = v; rec(p + 1) }
        for (const k of of[p]!) { got[k]! -= v; rest[k]!++ }
      }
      asg[p] = 0
    }
    rec(0)
    if (bust || !total) continue
    cells.forEach((c, i) => { if (hit[i] === 0) safe.add(c); else if (hit[i] === total) mine.add(c) })
  }
}

/** open a cell on a solver state, flooding through zeros */
function msOpen(st: Uint8Array, counts: number[], sp: MsSpec, i: number): number {
  let n = 0
  const q = [i]
  while (q.length) {
    const c = q.pop()!
    if (st[c] !== 0) continue
    st[c] = 1; n++
    if (!counts[c]) for (const x of msNeighbors(c, sp)) if (st[x] === 0) q.push(x)
  }
  return n
}
/** play the board from `start` using only certain moves; true when every safe cell gets opened (no guess ever needed) */
export function msSolves(mines: boolean[], counts: number[], sp: MsSpec, start: number): boolean {
  const N = sp.w * sp.h, st = new Uint8Array(N)
  let opened = msOpen(st, counts, sp, start)
  for (;;) {
    if (opened === N - sp.mines) return true
    const d = msDeduce(st, counts, sp)
    if (!d.safe.length && !d.mine.length) return false
    for (const c of d.mine) { if (!mines[c]) return false; st[c] = 2 }
    for (const c of d.safe) { if (mines[c]) return false; opened += msOpen(st, counts, sp, c) }
  }
}

export interface MsBoard { mines: boolean[], counts: number[], start: number, tries: number }
const msMade = new Map<string, MsBoard>()
/**
 * The day's board, the same on every device and independent of where the player taps: random layouts (seeded from
 * game + day, up to 300 tries) until the solver clears one from its opening cell with certain moves only. The opening
 * (`start`, a cell with no mine around it) is shown open from the start. `game` is the game key (`minesweeper:hard`).
 */
export function msBoard(game: string, day: string, sp: MsSpec): MsBoard {
  const ck = `${game}|${day}`
  const hit = msMade.get(ck)
  if (hit) return hit
  const rng = rngFor(game, day), N = sp.w * sp.h
  let best: MsBoard | null = null
  for (let t = 1; t <= 300; t++) {
    const start = rng.int(N), skip = new Set([start, ...msNeighbors(start, sp)])
    const mines = Array.from({ length: N }, () => false)
    rng.shuffle(mines.map((_, i) => i)).filter(i => !skip.has(i)).slice(0, sp.mines).forEach((i) => { mines[i] = true })
    const counts = msCounts(mines, sp)
    best = { mines, counts, start, tries: t }
    if (msSolves(mines, counts, sp, start)) break
  }
  msMade.set(ck, best!)
  if (msMade.size > 12) msMade.delete(msMade.keys().next().value!)
  return best!
}

/**
 * A hint for the board as the player sees it: a closed cell that the open numbers certainly prove safe, else a certain
 * mine. Flags are not trusted, only open numbers count. `open`: 0 closed, 1 open, 2 flagged.
 */
export function msHint(open: number[], counts: number[], sp: MsSpec): { cell: number, kind: 'safe' | 'mine' } | null {
  // proven mines join the state (never the player's flags), so the search carries on past mines that are already flagged
  const st = Uint8Array.from(open, o => (o === 1 ? 1 : 0)), found = new Set<number>()
  for (;;) {
    const d = msDeduce(st, counts, sp)
    const s = d.safe.sort((x, y) => x - y)[0]
    if (s !== undefined) return { cell: s, kind: 'safe' }
    const fresh = d.mine.filter(c => st[c] !== 2)
    if (!fresh.length) break
    fresh.forEach((c) => { st[c] = 2; found.add(c) })
  }
  const m = [...found].filter(c => open[c] === 0).sort((x, y) => x - y)[0]
  return m !== undefined ? { cell: m, kind: 'mine' } : null
}

// ---- Nonogram (5x5 / 8x8 / 10x10, `n` = the side): every puzzle can be solved by line logic alone (no guessing) ----
export const NG_SIZES: Record<string, number> = { easy: 5, medium: 8, hard: 10 }
export const ngSize = (level?: string) => NG_SIZES[level ?? 'medium'] ?? 8
export const ngRows = (g: boolean[], n: number) => Array.from({ length: n }, (_, r) => g.slice(r * n, r * n + n))
export const ngCols = (g: boolean[], n: number) => Array.from({ length: n }, (_, c) => Array.from({ length: n }, (_, r) => g[r * n + c]))
/** run lengths of filled cells, e.g. [1, 3]; an empty line is [0] */
export function ngClue(line: boolean[]): number[] {
  const out: number[] = []
  let run = 0
  for (const v of line) { if (v) run++; else if (run) { out.push(run); run = 0 } }
  if (run) out.push(run)
  return out.length ? out : [0]
}
export const ngSameClue = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i])
/** the grid matches the clues of `target` (it need not be the same picture when the puzzle has several answers) */
export function ngSolved(g: boolean[], target: boolean[], n: number): boolean {
  const mine = [...ngRows(g, n), ...ngCols(g, n)], want = [...ngRows(target, n), ...ngCols(target, n)]
  return mine.every((l, i) => ngSameClue(ngClue(l), ngClue(want[i]!)))
}

/** every way to lay `clue` into a line that agrees with `known` (-1 unknown, 0 empty, 1 filled) */
function ngPlacements(clue: number[], known: number[]): number[][] {
  const len = known.length, out: number[][] = []
  const runs = clue[0] === 0 ? [] : clue
  const line = Array.from({ length: len }, () => 0)
  const rec = (k: number, pos: number) => {
    if (k === runs.length) {
      for (let x = pos; x < len; x++) if (known[x] === 1) return
      out.push(line.slice())
      return
    }
    const rest = runs.slice(k + 1).reduce((a, b) => a + b + 1, 0)
    for (let s = pos; s + runs[k] + rest <= len; s++) {
      if (s > pos && known[s - 1] === 1) break // a filled cell can't be skipped over
      const sep = s + runs[k]
      let ok = !(sep < len && known[sep] === 1)
      for (let x = s; ok && x < sep; x++) if (known[x] === 0) ok = false
      if (!ok) continue
      for (let x = s; x < sep; x++) line[x] = 1
      rec(k + 1, sep + 1)
      for (let x = s; x < sep; x++) line[x] = 0
    }
  }
  rec(0, 0)
  return out
}

/** what line-by-line logic alone can fill in: 1 filled, 0 empty, -1 still unknown */
export function ngDeduce(rowC: number[][], colC: number[][]): number[] {
  const NG = rowC.length
  const g = Array.from({ length: NG * NG }, () => -1)
  for (let changed = true; changed;) {
    changed = false
    for (let k = 0; k < 2 * NG; k++) {
      const isRow = k < NG, idx = isRow ? k : k - NG
      const cells = Array.from({ length: NG }, (_, j) => (isRow ? idx * NG + j : j * NG + idx))
      const pl = ngPlacements((isRow ? rowC : colC)[idx], cells.map(c => g[c]))
      if (!pl.length) return g
      cells.forEach((c, j) => {
        const v = pl[0][j]
        if (g[c] !== v && pl.every(p => p[j] === v)) { g[c] = v; changed = true }
      })
    }
  }
  return g
}

/** `game` is the game key (`nonogram:hard`), so each level is its own picture */
export function nonogramPuzzle(game: string, day: string, n: number): boolean[] {
  const rng = rngFor(game, day)
  // fill ratio and clue width per size: narrow clues keep the cells big enough on a phone
  const lo = Math.round(n * n * (n <= 5 ? 0.4 : 0.48)), hi = Math.round(n * n * (n <= 5 ? 0.7 : 0.66))
  const maxRun = n <= 5 ? 3 : n <= 8 ? 4 : 4, maxRunC = n <= 5 ? 3 : n <= 8 ? 4 : 5
  let g: boolean[] = []
  for (let tries = 0; tries < 4000; tries++) {
    g = Array.from({ length: n * n }, () => rng.next() < 0.56)
    const cnt = g.filter(Boolean).length
    const rows = ngRows(g, n), cols = ngCols(g, n)
    if (cnt < lo || cnt > hi) continue
    if (!rows.every(l => l.some(Boolean) && !l.every(Boolean) && ngClue(l).length <= maxRun)) continue
    if (!cols.every(l => l.some(Boolean) && !l.every(Boolean) && ngClue(l).length <= maxRunC)) continue
    if (!ngDeduce(rows.map(ngClue), cols.map(ngClue)).includes(-1)) return g
  }
  return g
}

// ---- Lights out: 4x4 / 5x5 / 6x6 by level ----
export const LO = 5 // the medium size (the default `n` of the helpers below)
export const LO_SIZES: Record<string, number> = { easy: 4, medium: 5, hard: 6 }
export const loSize = (level?: string) => LO_SIZES[level ?? 'medium'] ?? LO
export function lightsPress(g: boolean[], i: number, n = LO): boolean[] {
  const o = g.slice(), x = i % n, y = Math.floor(i / n)
  for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nx = x + dx, ny = y + dy
    if (nx >= 0 && nx < n && ny >= 0 && ny < n) o[ny * n + nx] = !o[ny * n + nx]
  }
  return o
}
/** start from the solved board and press random cells, so a solution always exists; the shortest solution is at least
 * 4 / 8 / 10 presses (easy / medium / hard). `key` = the game key, the seed */
export function lightsPuzzle(key: string, day: string, n = LO): boolean[] {
  const rng = rngFor(key, day)
  const minSol = n === 4 ? 4 : n === 5 ? 8 : 10
  const presses = n === 4 ? () => 5 + rng.int(4) : n === 5 ? () => 10 + rng.int(7) : () => 14 + rng.int(8)
  for (let tries = 0; ; tries++) {
    let g = Array.from({ length: n * n }, () => false)
    for (const i of rng.shuffle(g.map((_, k) => k)).slice(0, presses())) g = lightsPress(g, i, n)
    if (g.filter(Boolean).length >= Math.min(8, minSol) && ((lightsSolve(g, n)?.length ?? 0) >= minSol || tries > 400)) return g
  }
}

/** fewest presses that switch every light off (GF(2) elimination; a 4x4 / 5x5 / 6x6 board has a 4 / 2 / 4-dimensional
 * null space, so all the solutions are compared); null when the board cannot be solved. Rows are BigInt bit sets (36 bits) */
export function lightsSolve(g: boolean[], size = LO): number[] | null {
  const n = size * size
  const none = Array.from({ length: n }, () => false)
  const eff = Array.from({ length: n }, (_, j) => lightsPress(none, j, size))
  const bit = (k: number) => 1n << BigInt(k)
  const at = (r: bigint, k: number) => (r >> BigInt(k)) & 1n
  const rows = Array.from({ length: n }, (_, i) => {
    let r = g[i] ? bit(n) : 0n
    for (let j = 0; j < n; j++) if (eff[j][i]) r |= bit(j)
    return r
  })
  const piv: number[] = []
  let row = 0
  for (let col = 0; col < n && row < n; col++) {
    const p = rows.findIndex((r, k) => k >= row && at(r, col))
    if (p < 0) continue
    ;[rows[row], rows[p]] = [rows[p], rows[row]]
    for (let k = 0; k < n; k++) if (k !== row && at(rows[k], col)) rows[k] ^= rows[row]
    piv.push(col); row++
  }
  for (let k = row; k < n; k++) if (at(rows[k], n)) return null
  const x0 = Array.from({ length: n }, () => 0)
  piv.forEach((c, k) => { x0[c] = Number(at(rows[k], n)) })
  const basis = Array.from({ length: n }, (_, f) => f).filter(f => !piv.includes(f)).map((f) => {
    const v = Array.from({ length: n }, () => 0)
    v[f] = 1
    piv.forEach((c, k) => { v[c] = Number(at(rows[k], f)) })
    return v
  })
  let best = x0
  for (let m = 1; m < 1 << basis.length; m++) {
    const v = x0.slice()
    basis.forEach((b, k) => { if ((m >> k) & 1) b.forEach((bit, i) => { v[i] ^= bit }) })
    if (v.reduce((a, b) => a + b, 0) < best.reduce((a, b) => a + b, 0)) best = v
  }
  return best.map((v, i) => (v ? i : -1)).filter(i => i >= 0)
}

// ---- Mastermind (repeats allowed): easy 4 pegs / 5 colours / 10 tries, medium 5 / 6 / 8, hard 5 / 8 / 10 ----
export const MM_SPECS: Record<string, { len: number, colours: number, tries: number }> = {
  easy: { len: 4, colours: 5, tries: 10 }, medium: { len: 5, colours: 6, tries: 8 }, hard: { len: 5, colours: 8, tries: 10 },
}
export const MM = MM_SPECS.medium!
export const mmSpec = (level?: string) => MM_SPECS[level ?? 'medium'] ?? MM
export const mastermindCode = (key: string, day: string, sp = MM) => { const r = rngFor(key, day); return Array.from({ length: sp.len }, () => r.int(sp.colours)) }
export function mastermindMark(guess: number[], code: number[]): { exact: number, partial: number } {
  let exact = 0
  const g: number[] = [], c: number[] = []
  guess.forEach((v, i) => { if (v === code[i]) exact++; else { g.push(v); c.push(code[i]) } })
  let partial = 0
  for (const v of g) { const k = c.indexOf(v); if (k >= 0) { partial++; c.splice(k, 1) } }
  return { exact, partial }
}
/** the position a bought hint reveals: not shown yet, and (when possible) one the last guess still got wrong; -1 = nothing left */
export function mastermindHintPos(key: string, day: string, code: number[], shown: number[], last?: number[]): number {
  const order = rngFor(key, day, ':hint').shuffle(code.map((_, i) => i)).filter(i => !shown.includes(i))
  return order.find(i => !last || last[i] !== code[i]) ?? order[0] ?? -1
}

// ---- Higher or Lower (search volumes): twelve rounds, thirteen terms, each used once ----
/** correct guesses in a row that count as solved (the sequence has twelve rounds) */
export const HL_GOAL = 6
export const HL_ROUNDS = 12
/** smallest ratio between the two terms of a round: wide at the start, closer later */
export const HL_RATIO = [6, 5, 4, 3, 3, 2.5, 2.2, 2, 1.8, 1.6, 1.5, 1.4]
export function higherLowerSequence(day: string): SearchTerm[] {
  const rng = rngFor('higher-lower', day)
  for (let tries = 0; tries < 400; tries++) {
    const out: SearchTerm[] = [rng.pick(SEARCH_TERMS)]
    while (out.length <= HL_ROUNDS) {
      const prev = out[out.length - 1]!, need = HL_RATIO[out.length - 1]!
      const ok = SEARCH_TERMS.filter(t => !out.includes(t) && Math.max(t.vol, prev.vol) / Math.min(t.vol, prev.vol) >= need)
      if (!ok.length) break
      out.push(rng.pick(ok))
    }
    if (out.length > HL_ROUNDS) return out
  }
  return rng.shuffle(SEARCH_TERMS).slice(0, HL_ROUNDS + 1) // cannot happen with this data
}

// ---- Make 24 (exact fractions) ----
export type Frac = [number, number]
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a))
const norm = (n: number, d: number): Frac => { const g = gcd(n, d) || 1; return d < 0 ? [-n / g, -d / g] : [n / g, d / g] }
export function fracOp(a: Frac, b: Frac, op: string): Frac | null {
  if (op === '+') return norm(a[0] * b[1] + b[0] * a[1], a[1] * b[1])
  if (op === '-') return norm(a[0] * b[1] - b[0] * a[1], a[1] * b[1])
  if (op === '*') return norm(a[0] * b[0], a[1] * b[1])
  if (op === '/') return b[0] === 0 ? null : norm(a[0] * b[1], a[1] * b[0])
  return null
}
export const fracText = (f: Frac) => (f[1] === 1 ? String(f[0]) : `${f[0]}/${f[1]}`)
export const is24 = (f: Frac) => f[0] === 24 * f[1]

export function solve24(nums: number[]): string | null {
  const rec = (items: { v: Frac, s: string }[]): string | null => {
    if (items.length === 1) return is24(items[0].v) ? items[0].s : null
    for (let i = 0; i < items.length; i++) for (let j = 0; j < items.length; j++) {
      if (i === j) continue
      const rest = items.filter((_, k) => k !== i && k !== j)
      for (const op of ['+', '-', '*', '/']) {
        if ((op === '+' || op === '*') && j < i) continue
        const v = fracOp(items[i].v, items[j].v, op)
        if (!v) continue
        const r = rec([...rest, { v, s: `(${items[i].s} ${op} ${items[j].s})` }])
        if (r) return r
      }
    }
    return null
  }
  return rec(nums.map(n => ({ v: [n, 1] as Frac, s: String(n) })))
}
/** the kinds of way to 24: any, one without division, one where every step stays a whole number */
export function solve24Kinds(nums: number[]): { any: string | null, noDiv: string | null, intOnly: string | null } {
  const out = { any: null as string | null, noDiv: null as string | null, intOnly: null as string | null }
  interface It { v: Frac, s: string, div: boolean, frac: boolean }
  const rec = (items: It[]) => {
    if (items.length === 1) {
      const it = items[0]!
      if (!is24(it.v)) return
      out.any ??= it.s
      if (!it.div) out.noDiv ??= it.s
      if (!it.frac) out.intOnly ??= it.s
      return
    }
    for (let i = 0; i < items.length; i++) for (let j = 0; j < items.length; j++) {
      if (i === j) continue
      const rest = items.filter((_, k) => k !== i && k !== j)
      for (const op of ['+', '-', '*', '/']) {
        if ((op === '+' || op === '*') && j < i) continue
        const a = items[i]!, b = items[j]!
        const v = fracOp(a.v, b.v, op)
        if (!v) continue
        rec([...rest, { v, s: `(${a.s} ${op} ${b.s})`, div: a.div || b.div || op === '/', frac: a.frac || b.frac || v[1] !== 1 }])
      }
    }
  }
  rec(nums.map(n => ({ v: [n, 1] as Frac, s: String(n), div: false, frac: false })))
  return out
}
/** can these values still be combined into 24? */
function can24(items: Frac[]): boolean {
  if (items.length === 1) return is24(items[0])
  for (let i = 0; i < items.length; i++) for (let j = 0; j < items.length; j++) {
    if (i === j) continue
    const rest = items.filter((_, k) => k !== i && k !== j)
    for (const op of ['+', '-', '*', '/']) {
      if ((op === '+' || op === '*') && j < i) continue
      const v = fracOp(items[i], items[j], op)
      if (v && can24([...rest, v])) return true
    }
  }
  return false
}
/** the first move of a way to 24 from the cards on the table (indices into `vals`), whole-number results first; null = dead end */
export function solve24Step(vals: Frac[]): { i: number, j: number, op: string } | null {
  for (const wholeOnly of [true, false]) {
    for (let i = 0; i < vals.length; i++) for (let j = 0; j < vals.length; j++) {
      if (i === j) continue
      const rest = vals.filter((_, k) => k !== i && k !== j)
      for (const op of ['+', '-', '*', '/']) {
        if ((op === '+' || op === '*') && j < i) continue
        const v = fracOp(vals[i], vals[j], op)
        if (!v || (wholeOnly && v[1] !== 1)) continue
        if (can24([...rest, v])) return { i, j, op }
      }
    }
  }
  return null
}
/** how hard the day is: 0 = plain + - x, 1 = needs a division, 2 = needs a fraction on the way (Sat, Sun) */
export function math24Level(day: string): 0 | 1 | 2 {
  if (isRandomDay(day)) return 1 // a random puzzle is medium
  const wd = new Date(`${day}T12:00:00Z`).getUTCDay() // 0 = Sunday
  return wd === 0 || wd === 6 ? 2 : wd === 4 || wd === 5 ? 1 : 0
}
export function math24Puzzle(day: string): { nums: number[], solution: string, level: 0 | 1 | 2 } {
  const rng = rngFor('math-24', day)
  const level = math24Level(day)
  for (let n = 0; n < 4000; n++) {
    const nums = Array.from({ length: 4 }, () => 1 + rng.int(9))
    const k = solve24Kinds(nums)
    const sum = nums.reduce((a, b) => a + b, 0), prod = nums.reduce((a, b) => a * b, 1)
    if (level === 0 && k.noDiv && sum !== 24 && prod !== 24) return { nums, solution: k.noDiv, level }
    if (level === 1 && !k.noDiv && k.intOnly) return { nums, solution: k.intOnly, level }
    if (level === 2 && !k.intOnly && k.any) return { nums, solution: k.any, level }
  }
  for (;;) { // not reached in practice: any solvable set
    const nums = Array.from({ length: 4 }, () => 1 + rng.int(9))
    const solution = solve24(nums)
    if (solution) return { nums, solution, level }
  }
}

// ---- Sliding tiles: easy 3x3 (a short shuffle), medium 4x4 (the 15 puzzle), hard 4x4 shuffled further from home ----
export const SL = 4 // the default size `n` of the helpers below
export const SL_SPEC: Record<string, { n: number, moves: number, min: number }> = {
  easy: { n: 3, moves: 22, min: 8 }, medium: { n: 4, moves: 160, min: 30 }, hard: { n: 4, moves: 240, min: 42 },
}
export const slSpec = (level?: string) => SL_SPEC[level ?? 'medium'] ?? SL_SPEC.medium!
export const slGoal = (n = SL) => [...Array.from({ length: n * n - 1 }, (_, k) => k + 1), 0]
export const SL_GOAL = slGoal()
/** sum of the distances of every tile from its home square */
export function slideManhattan(t: number[], SL = 4): number {
  let h = 0
  t.forEach((v, i) => { if (v) h += Math.abs(Math.floor(i / SL) - Math.floor((v - 1) / SL)) + Math.abs((i % SL) - ((v - 1) % SL)) })
  return h
}
/** a shuffle of random legal moves from the goal (so it is always solvable); `key` = the game key, the seed */
export function slidingPuzzle(key: string, day: string, level?: string): number[] {
  const sp = slSpec(level), n = sp.n
  const rng = rngFor(key, day)
  for (let tries = 0; ; tries++) {
    const t = slGoal(n)
    let blank = n * n - 1, prev = -1
    for (let k = 0; k < sp.moves; k++) {
      const m = rng.pick(slideMoves(blank, n).filter(x => x !== prev))
      t[blank] = t[m]; t[m] = 0; prev = blank; blank = m
    }
    if (slideManhattan(t, n) >= sp.min || tries > 300) return t // not a puzzle that is nearly solved
  }
}
/** tap or swipe on tile i: every tile between it and the gap (same row or column) moves one step towards the gap; n = tiles moved */
export function slideRun(t: number[], i: number, SL = 4): { t: number[], n: number } | null {
  const b = t.indexOf(0)
  if (i === b || i < 0 || i >= SL * SL) return null
  const sameRow = Math.floor(i / SL) === Math.floor(b / SL), sameCol = i % SL === b % SL
  if (!sameRow && !sameCol) return null
  const d = (sameRow ? 1 : SL) * (i > b ? 1 : -1)
  const o = t.slice()
  for (let k = b; k !== i; k += d) o[k] = o[k + d]
  o[i] = 0
  return { t: o, n: Math.abs(i - b) / Math.abs(d) }
}
export function slideMoves(blank: number, SL = 4): number[] {
  const x = blank % SL, y = Math.floor(blank / SL), out: number[] = []
  if (x > 0) out.push(blank - 1)
  if (x < SL - 1) out.push(blank + 1)
  if (y > 0) out.push(blank - SL)
  if (y < SL - 1) out.push(blank + SL)
  return out
}
/**
 * The next tile to move on a reasonable way to the goal: weighted IDA* on the Manhattan distance (it is quick and
 * finds a solution a few moves longer than the shortest), and when the budget runs out a greedy step that brings
 * one tile closer to home. Returns the tile number, or 0 when the board is solved.
 */
export function slideHint(start: number[]): number {
  const N = start.length, SL = Math.round(Math.sqrt(N))
  if (start.join() === slGoal(SL).join()) return 0
  const nb: number[][] = Array.from({ length: N }, (_, i) => slideMoves(i, SL))
  const dist = (v: number, i: number) => (v ? Math.abs(Math.floor(i / SL) - Math.floor((v - 1) / SL)) + Math.abs((i % SL) - ((v - 1) % SL)) : 0)
  const search = (w: number, cap: number): number => {
    const b = start.slice()
    let blank = b.indexOf(0), nodes = 0
    const path: number[] = []
    const h0 = slideManhattan(b, SL)
    const dfs = (g: number, h: number, bound: number, prev: number): number => {
      const f = g + w * h
      if (f > bound) return f
      if (h === 0) return -1
      if (++nodes > cap) return Infinity
      let min = Infinity
      for (const m of nb[blank]!) {
        if (m === prev) continue
        const v = b[m]!
        const nh = h - dist(v, m) + dist(v, blank)
        const old = blank
        b[blank] = v; b[m] = 0; blank = m
        path.push(v)
        const r = dfs(g + 1, nh, bound, old)
        if (r === -1) return -1
        path.pop()
        b[m] = v; b[old] = 0; blank = old
        if (r < min) min = r
        if (nodes > cap) return Infinity
      }
      return min
    }
    let bound = w * h0
    for (let k = 0; k < 80; k++) {
      path.length = 0
      const r = dfs(0, h0, bound, -1)
      if (r === -1) return path[0]!
      if (!isFinite(r)) return -2
      bound = r
    }
    return -2
  }
  for (const [w, cap] of [[1, 250_000], [1.7, 600_000], [3, 1_200_000]] as const) {
    const r = search(w, cap)
    if (r > 0) return r
  }
  // greedy fallback: the move that lowers the total distance the most (ties: the first)
  const blank = start.indexOf(0)
  let best = -1, bestD = Infinity
  for (const m of nb[blank]!) {
    const d = dist(start[m]!, blank) - dist(start[m]!, m)
    if (d < bestD) { bestD = d; best = start[m]! }
  }
  return best
}

// ---- Memory match: easy 4x3 (6 pairs), medium 5x4 (10), hard 6x5 (15) ----
export const MEM_SPEC: Record<string, { cols: number, pairs: number }> = { easy: { cols: 4, pairs: 6 }, medium: { cols: 5, pairs: 10 }, hard: { cols: 6, pairs: 15 } }
export const MEM = MEM_SPEC.medium!
export const memSpec = (level?: string) => MEM_SPEC[level ?? 'medium'] ?? MEM
export function memoryLayout(key: string, day: string, pairs = MEM.pairs): string[] {
  const rng = rngFor(key, day)
  const letters = rng.shuffle([...'ABCDEFGHJKLMNPRSTUWXYZ']).slice(0, pairs)
  return rng.shuffle([...letters, ...letters])
}
/** two cards of a pair that is neither found nor already hinted; null when there is none */
export function memoryHintPair(key: string, day: string, cards: string[], matched: number[], hinted: number[]): [number, number] | null {
  const rng = rngFor(key, day, ':hint')
  for (const l of rng.shuffle([...new Set(cards)])) {
    const at = cards.flatMap((c, i) => (c === l ? [i] : []))
    if (at.some(i => matched.includes(i) || hinted.includes(i))) continue
    return [at[0]!, at[1]!]
  }
  return null
}
