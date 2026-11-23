import { rngFor, type Rng } from './rng'

/**
 * Queens: an N x N board split into N colour regions; one queen per row, per column and per region, and no two queens
 * touching (diagonals too). Generated from the day: a valid layout, regions grown around its queens, kept only when a
 * solver finds exactly ONE solution. Cells are row * n + col; `solution[r]` is the column of row r's queen.
 */
export interface QueensPuzzle { n: number, regions: number[], solution: number[] }

/** board size by level: easy 6x6, medium 8x8, hard 10x10 (n colour regions each) */
export const QUEENS_SIZES: Record<string, number> = { easy: 6, medium: 8, hard: 10 }
export const queensSize = (level?: string) => QUEENS_SIZES[level ?? 'medium'] ?? 8

/**
 * solutions of a region map, counted up to `limit`. Always branches on the region with the fewest cells still legal
 * (row, column and touching queens ruled out), and backs out as soon as some region has none: fast enough for 10x10.
 */
export function queensCount(n: number, regions: number[], limit = 2): number {
  return queensSolutions(n, regions, limit).length
}

/** the solutions themselves (each a list of queen cells), up to `limit` */
export function queensSolutions(n: number, regions: number[], limit = 2): number[][] {
  const N2 = n * n
  const blk = new Int16Array(N2) // how many placed queens rule a cell out (its row, column, or touching)
  const rowU = new Array<boolean>(n).fill(false), colU = new Array<boolean>(n).fill(false), regU = new Array<boolean>(n).fill(false)
  const out: number[][] = [], put: number[] = []
  const mark = (i: number, d: number) => {
    const r = Math.floor(i / n), c = i % n
    for (let k = 0; k < n; k++) { blk[r * n + k] += d; blk[k * n + c] += d }
    // the row and column are counted twice at the queen's own cell; the touching cells off the row / column:
    for (let y = Math.max(0, r - 1); y <= Math.min(n - 1, r + 1); y++) for (let x = Math.max(0, c - 1); x <= Math.min(n - 1, c + 1); x++) if (y !== r && x !== c) blk[y * n + x] += d
  }
  const rc = new Int16Array(n), cc = new Int16Array(n), gc = new Int16Array(n)
  const rec = (left: number) => {
    if (out.length >= limit) return
    if (!left) { out.push(put.slice()); return }
    // each open row, column and region must still have a legal cell; branch on the one with the fewest
    rc.fill(0); cc.fill(0); gc.fill(0)
    for (let i = 0; i < N2; i++) {
      if (blk[i] || regU[regions[i]!]) continue
      rc[Math.floor(i / n)]++; cc[i % n]++; gc[regions[i]!]++
    }
    let kind = -1, at = -1, min = 99
    for (let k = 0; k < n; k++) {
      if (!rowU[k]) { if (rc[k]! < min) { min = rc[k]!; kind = 0; at = k } }
      if (!colU[k]) { if (cc[k]! < min) { min = cc[k]!; kind = 1; at = k } }
      if (!regU[k]) { if (gc[k]! < min) { min = gc[k]!; kind = 2; at = k } }
    }
    if (min === 0) return
    const cand: number[] = []
    for (let i = 0; i < N2; i++) {
      if (blk[i] || regU[regions[i]!]) continue
      if (kind === 0 ? Math.floor(i / n) === at : kind === 1 ? i % n === at : regions[i] === at) cand.push(i)
    }
    for (const i of cand) {
      const g = regions[i]!, r = Math.floor(i / n), c = i % n
      mark(i, 1); rowU[r] = colU[c] = regU[g] = true; put.push(i)
      rec(left - 1)
      mark(i, -1); rowU[r] = colU[c] = regU[g] = false; put.pop()
      if (out.length >= limit) return
    }
  }
  rec(n)
  return out
}

/** a random placement with one queen per row and column and no two touching */
function layout(n: number, rng: Rng): number[] | null {
  const cols = new Array<number>(n).fill(-1)
  const used = new Array<boolean>(n).fill(false)
  const rec = (r: number): boolean => {
    if (r === n) return true
    for (const c of rng.shuffle(Array.from({ length: n }, (_, k) => k))) {
      if (used[c] || (r > 0 && Math.abs(cols[r - 1]! - c) <= 1)) continue
      cols[r] = c; used[c] = true
      if (rec(r + 1)) return true
      used[c] = false
    }
    return false
  }
  return rec(0) ? cols : null
}

/** n regions grown around the queens: random cells next to a region join it until the board is covered */
function grow(n: number, queens: number[], rng: Rng): number[] {
  const reg = new Array<number>(n * n).fill(-1)
  queens.forEach((c, r) => { reg[r * n + c] = r })
  const edge: number[][] = Array.from({ length: n }, () => [])
  const open = (i: number) => [i % n > 0 ? i - 1 : -1, i % n < n - 1 ? i + 1 : -1, i >= n ? i - n : -1, i < n * (n - 1) ? i + n : -1].filter(j => j >= 0 && reg[j] === -1)
  queens.forEach((c, r) => { edge[r]!.push(r * n + c) })
  let left = n * n - n
  // uneven growth speeds: some regions stay small, which pins their queens and makes a single solution much likelier
  const w = Array.from({ length: n }, () => 0.03 + rng.next() ** 4)
  const wsum = w.reduce((a, b) => a + b, 0)
  const draw = () => { let x = rng.next() * wsum, g = 0; while (g < n - 1 && x >= w[g]!) { x -= w[g]!; g++ } return g }
  while (left > 0) {
    const g = draw()
    const list = edge[g]!
    while (list.length) {
      const k = rng.int(list.length)
      const free = open(list[k]!)
      if (!free.length) { list.splice(k, 1); continue }
      const j = rng.pick(free)
      reg[j] = g; list.push(j); left--
      break
    }
  }
  return reg
}

/** is the region still one connected piece (4-neighbours) if cell `skip` leaves it? */
function connected(n: number, reg: number[], g: number, skip: number): boolean {
  const cells = reg.flatMap((x, i) => (x === g && i !== skip ? [i] : []))
  if (!cells.length) return false
  const seen = new Set<number>([cells[0]!]), stack = [cells[0]!]
  while (stack.length) {
    const i = stack.pop()!
    for (const j of [i % n > 0 ? i - 1 : -1, i % n < n - 1 ? i + 1 : -1, i - n, i + n]) {
      if (j >= 0 && j < n * n && j !== skip && reg[j] === g && !seen.has(j)) { seen.add(j); stack.push(j) }
    }
  }
  return seen.size === cells.length
}

/**
 * Starting from the grown regions, move border cells to a neighbouring region (the queens stay put, so the layout
 * always remains a solution) and keep moves that do not add solutions, until only the one is left.
 */
function narrow(n: number, queens: number[], reg: number[], rng: Rng, steps: number): boolean {
  const isQueen = new Set(queens.map((c, r) => r * n + c))
  const CAP = 40
  let cur = queensCount(n, reg, CAP)
  for (let s = 0; s < steps && cur > 1; s++) {
    // aim at the wrong answers: a cell where another solution puts a queen is the one to hand to a neighbour region.
    // A few such moves are tried and the one that leaves the fewest solutions is kept (when it is no worse).
    const alt = queensSolutions(n, reg, 8).flat().filter(c => !isQueen.has(c))
    if (!alt.length) return true
    let bestC = Infinity, bestI = -1, bestTo = -1
    for (let k = 0; k < 4; k++) {
      const i = rng.pick(alt), g = reg[i]!
      const to = [...new Set([i % n > 0 ? reg[i - 1]! : g, i % n < n - 1 ? reg[i + 1]! : g, i >= n ? reg[i - n]! : g, i < n * (n - 1) ? reg[i + n]! : g])].filter(x => x !== g)
      if (!to.length || reg.filter(x => x === g).length <= 2 || !connected(n, reg, g, i)) continue
      const h = rng.pick(to)
      reg[i] = h
      const c = queensCount(n, reg, CAP)
      reg[i] = g
      if (c < bestC) { bestC = c; bestI = i; bestTo = h }
    }
    if (bestI >= 0 && bestC <= cur) { reg[bestI] = bestTo; cur = bestC }
  }
  return cur === 1
}

const cache = new Map<string, QueensPuzzle>()
/** the puzzle of a day at a level (each level has its own board, seeded by day + level) */
export function queensPuzzle(day: string, level?: string): QueensPuzzle {
  const lv = level && QUEENS_SIZES[level] ? level : 'medium'
  const ck = `${lv}:${day}`
  const hit = cache.get(ck)
  if (hit) return hit
  const n = queensSize(lv)
  const rng = rngFor(lv === 'medium' ? 'queens' : `queens:${lv}`, day)
  for (let k = 0; k < 400; k++) {
    const sol = layout(n, rng)
    if (!sol) continue
    const regions = grow(n, sol, rng)
    if (narrow(n, sol, regions, rng, n * n * 3) && queensCount(n, regions, 2) === 1) {
      const perm = rng.shuffle(Array.from({ length: n }, (_, g) => g)) // region numbers must not give away the rows
      const p = { n, regions: regions.map(g => perm[g]!), solution: sol }
      cache.set(ck, p)
      return p
    }
  }
  throw new Error('queens: no unique board') // not reached with these sizes
}

/** cells whose queen breaks a rule: same row, column or region as another queen, or touching one */
export function queensConflicts(n: number, regions: number[], cells: number[]): Set<number> {
  const bad = new Set<number>()
  for (let a = 0; a < cells.length; a++) for (let b = a + 1; b < cells.length; b++) {
    const i = cells[a]!, j = cells[b]!
    const ri = Math.floor(i / n), rj = Math.floor(j / n), ci = i % n, cj = j % n
    if (ri === rj || ci === cj || regions[i] === regions[j] || (Math.abs(ri - rj) <= 1 && Math.abs(ci - cj) <= 1)) { bad.add(i); bad.add(j) }
  }
  return bad
}

/** the cell a bought hint fills: a solution queen not placed yet, preferring a row with no queen on it */
export function queensHintCell(p: QueensPuzzle, queens: number[]): number {
  const at = p.solution.map((c, r) => r * p.n + c)
  const todo = at.filter(i => !queens.includes(i))
  if (!todo.length) return -1
  const rows = new Set(queens.map(i => Math.floor(i / p.n)))
  return todo.find(i => !rows.has(Math.floor(i / p.n))) ?? todo[0]!
}
