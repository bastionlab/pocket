import { rngFor, type Rng } from './rng'

/**
 * Bridges (Hashiwokakero): numbered islands, joined by straight single or double bridges that never cross. Each island's
 * number is how many bridge ends it carries and all islands end up in one group. Three levels (7x7, 9x9, 11x11 grids).
 * The puzzle is derived from a random connected layout of the day and kept only when a backtracking solver finds exactly
 * one solution.
 */
export type BrLevel = 'easy' | 'medium' | 'hard'
/** size = grid side, min/max = island count, dbl = chance a bridge is double, loops = chance of an extra loop-closing bridge */
export const BR_LEVELS: Record<BrLevel, { size: number, min: number, max: number, dbl: number, loops: number }> = {
  easy: { size: 7, min: 8, max: 10, dbl: 0.1, loops: 0.2 },
  medium: { size: 9, min: 13, max: 15, dbl: 0.3, loops: 0.3 },
  hard: { size: 11, min: 20, max: 24, dbl: 0.35, loops: 0.35 },
}

export interface BrIsland { r: number, c: number, n: number }
/** a possible bridge between two islands that see each other along a row (`horiz`) or a column; a is the left / upper one */
export interface BrEdge { a: number, b: number, horiz: boolean }
export interface BrPuzzle { size: number, islands: BrIsland[], edges: BrEdge[], solution: number[], cross: number[][] }

/** the islands each island sees: the nearest one to the right and below (neighbours in the next cell included) */
function candidateEdges(pos: { r: number, c: number }[], size: number): BrEdge[] {
  const at = new Map<number, number>()
  pos.forEach((p, i) => at.set(p.r * size + p.c, i))
  const out: BrEdge[] = []
  pos.forEach((p, a) => {
    for (const horiz of [true, false]) {
      for (let k = 1; k < size; k++) {
        const r = p.r + (horiz ? 0 : k), c = p.c + (horiz ? k : 0)
        if (r >= size || c >= size) break
        const b = at.get(r * size + c)
        if (b === undefined) continue
        out.push({ a, b, horiz })
        break
      }
    }
  })
  return out
}

/** for every edge, the edges that would cross it */
function crossings(pos: { r: number, c: number }[], edges: BrEdge[]): number[][] {
  const crosses = (h: BrEdge, v: BrEdge) => {
    const hr = pos[h.a].r, hc1 = pos[h.a].c, hc2 = pos[h.b].c
    const vc = pos[v.a].c, vr1 = pos[v.a].r, vr2 = pos[v.b].r
    return vc > hc1 && vc < hc2 && hr > vr1 && hr < vr2
  }
  return edges.map((e, i) => edges.map((f, j) => (j !== i && e.horiz !== f.horiz && (e.horiz ? crosses(e, f) : crosses(f, e)) ? j : -1)).filter(j => j >= 0))
}

export function bridgesDegrees(n: number, edges: BrEdge[], vals: number[]): number[] {
  const d = Array.from({ length: n }, () => 0)
  edges.forEach((e, i) => { d[e.a] += vals[i]; d[e.b] += vals[i] })
  return d
}

/** are all islands in one group (counting the edges that carry a bridge)? */
export function bridgesConnected(n: number, edges: BrEdge[], vals: number[]): boolean {
  const p = Array.from({ length: n }, (_, i) => i)
  const find = (x: number): number => (p[x] === x ? x : (p[x] = find(p[x])))
  edges.forEach((e, i) => { if (vals[i] > 0) p[find(e.a)] = find(e.b) })
  const root = find(0)
  return p.every((_, i) => find(i) === root)
}

/** every island has exactly its number of bridges and nothing is split off */
export function bridgesSolved(pz: BrPuzzle, vals: number[]): boolean {
  const d = bridgesDegrees(pz.islands.length, pz.edges, vals)
  return pz.islands.every((s, i) => d[i] === s.n) && bridgesConnected(pz.islands.length, pz.edges, vals)
}

/** solutions of a set of numbers (stops at `limit`); running out of `budget` search nodes counts as "too many" */
export function bridgesSolutions(need: number[], pos: { r: number, c: number }[], size: number, limit = 2, budget = 300000): number[][] {
  const edges = candidateEdges(pos, size), cross = crossings(pos, edges)
  const n = need.length
  const rem = need.slice()
  const free = Array.from({ length: n }, () => 0)
  edges.forEach((e) => { free[e.a]++; free[e.b]++ })
  const vals = Array.from({ length: edges.length }, () => 0)
  const done = Array.from({ length: edges.length }, () => false)
  const found: number[][] = []
  let nodes = 0, over = false
  const rec = (i: number) => {
    if (found.length >= limit || over) return
    if (nodes++ > budget) { over = true; return }
    if (i === edges.length) {
      if (rem.every(x => x === 0) && bridgesConnected(n, edges, vals)) found.push(vals.slice())
      return
    }
    const { a, b } = edges[i]
    free[a]--; free[b]--
    done[i] = true
    for (let v = 0; v <= 2; v++) {
      if (v > 0 && cross[i].some(j => done[j] && vals[j] > 0)) break
      if (rem[a] < v || rem[b] < v) break
      rem[a] -= v; rem[b] -= v
      vals[i] = v
      if (rem[a] <= 2 * free[a] && rem[b] <= 2 * free[b]) rec(i + 1)
      rem[a] += v; rem[b] += v
      if (found.length >= limit || over) break
    }
    vals[i] = 0
    done[i] = false
    free[a]++; free[b]++
  }
  rec(0)
  return over ? [] : found
}

/** a random connected layout: grow a tree of bridges, then add a few extra ones that close loops */
function layout(rng: Rng, size: number, target: number, cfg: { dbl: number, loops: number }): { pos: { r: number, c: number }[], need: number[] } | null {
  const pos: { r: number, c: number }[] = [{ r: rng.int(size), c: rng.int(size) }]
  const occ = new Set<number>([pos[0].r * size + pos[0].c])
  const bridge: { a: number, b: number, m: number }[] = []
  const DIRS = [[0, 1], [1, 0], [0, -1], [-1, 0]]
  for (let guard = 0; pos.length < target && guard < 800; guard++) {
    const a = rng.int(pos.length), [dr, dc] = rng.pick(DIRS)
    let len = 0
    while (true) {
      const r = pos[a].r + dr * (len + 1), c = pos[a].c + dc * (len + 1)
      if (r < 0 || c < 0 || r >= size || c >= size || occ.has(r * size + c)) break
      len++
    }
    if (len < 1 || (len < 2 && rng.next() > 0.25)) continue
    const d = len < 2 ? 1 : 2 + rng.int(len - 1)
    const nr = pos[a].r + dr * d, nc = pos[a].c + dc * d
    pos.push({ r: nr, c: nc })
    const b = pos.length - 1
    for (let k = 1; k <= d; k++) occ.add((pos[a].r + dr * k) * size + pos[a].c + dc * k)
    bridge.push({ a, b, m: rng.next() < cfg.dbl ? 2 : 1 })
  }
  if (pos.length < target) return null
  // extra bridges between islands that already see each other with nothing but empty cells between them
  const bridgeCells = new Set<number>()
  for (const x of bridge) {
    const p = pos[x.a], q = pos[x.b]
    for (let r = Math.min(p.r, q.r); r <= Math.max(p.r, q.r); r++) for (let c = Math.min(p.c, q.c); c <= Math.max(p.c, q.c); c++) bridgeCells.add(r * size + c)
  }
  for (const e of candidateEdges(pos, size)) {
    if (bridge.some(x => (x.a === e.a && x.b === e.b) || (x.a === e.b && x.b === e.a))) continue
    if (rng.next() > cfg.loops) continue
    const pa = pos[e.a], pb = pos[e.b], len = Math.abs(e.horiz ? pb.c - pa.c : pb.r - pa.r)
    let ok = true
    for (let k = 1; ok && k < len; k++) if (bridgeCells.has((pa.r + (e.horiz ? 0 : k)) * size + pa.c + (e.horiz ? k : 0))) ok = false
    if (!ok) continue
    for (let k = 1; k < len; k++) bridgeCells.add((pa.r + (e.horiz ? 0 : k)) * size + pa.c + (e.horiz ? k : 0))
    bridge.push({ a: e.a, b: e.b, m: rng.next() < cfg.dbl ? 2 : 1 })
  }
  const need = pos.map(() => 0)
  for (const x of bridge) { need[x.a] += x.m; need[x.b] += x.m }
  return { pos, need }
}

/** the puzzle of a day and level: exactly one solution (retried with the same seeded stream until it is) */
export function bridgesPuzzle(day: string, level: BrLevel = 'medium'): BrPuzzle {
  const cfg = BR_LEVELS[level] ?? BR_LEVELS.medium, size = cfg.size
  const rng = rngFor('bridges', day, ':' + level)
  let fallback: BrPuzzle | null = null, any: BrPuzzle | null = null
  for (let tries = 0; tries < 400; tries++) {
    const lay = layout(rng, size, cfg.min + rng.int(cfg.max - cfg.min + 1), cfg)
    if (!lay) continue
    // sort the islands by position so the numbering does not give the layout away
    const order = lay.pos.map((_, i) => i).sort((x, y) => lay.pos[x].r - lay.pos[y].r || lay.pos[x].c - lay.pos[y].c)
    const pos = order.map(i => lay.pos[i]), need = order.map(i => lay.need[i])
    const edges = candidateEdges(pos, size)
    const build = (sol: number[]): BrPuzzle => ({ size, islands: pos.map((p, i) => ({ ...p, n: need[i] })), edges, solution: sol, cross: crossings(pos, edges) })
    const sols = bridgesSolutions(need, pos, size)
    if (sols.length !== 1) { if (!any && sols.length > 0) any = build(sols[0]); continue }
    const pz = build(sols[0])
    // a puzzle that needs real thinking: some double bridge and a few islands with 3+ bridges (easy has no such demand)
    if (level === 'easy' || (pz.solution.some(v => v === 2) && need.filter(x => x >= 3).length >= 3)) return pz
    fallback ??= pz
  }
  return (fallback ?? any)!
}

/** the edge between two islands, or -1 when they do not see each other along a free line */
export function bridgesEdgeBetween(pz: BrPuzzle, a: number, b: number): number {
  return pz.edges.findIndex(e => (e.a === a && e.b === b) || (e.a === b && e.b === a))
}

/**
 * The edge a drag from `a` means: the one to `b` when they see each other, else the one from `a` that leads towards `b`
 * (same row / column, island in between) or towards a point (`dr`, `dc` = which way, -1 / 0 / 1). -1 when there is none.
 */
export function bridgesEdgeToward(pz: BrPuzzle, a: number, dr: number, dc: number): number {
  const p = pz.islands[a]
  return pz.edges.findIndex((e) => {
    const o = e.a === a ? pz.islands[e.b] : e.b === a ? pz.islands[e.a] : null
    return !!o && Math.sign(o.r - p.r) === dr && Math.sign(o.c - p.c) === dc
  })
}

/** do the two islands share a row or column (so a blocked tap deserves a shake rather than a new selection)? */
export function bridgesInLine(pz: BrPuzzle, a: number, b: number): boolean {
  const p = pz.islands[a], q = pz.islands[b]
  return p.r === q.r || p.c === q.c
}

/**
 * The edge a hint draws: one the solution has more bridges on than the board, unless a wrong bridge crosses it (then that
 * wrong bridge is taken away first). Returns the edge and the value to set, or null when the board equals the solution.
 */
export function bridgesHint(pz: BrPuzzle, vals: number[], locked: number[]): { edge: number, value: number } | null {
  const diff = pz.solution.map((s, i) => (s !== vals[i] && !locked.includes(i) ? i : -1)).filter(i => i >= 0)
  const add = diff.find(i => pz.solution[i] > vals[i] && pz.cross[i].every(j => vals[j] === 0))
  if (add !== undefined) return { edge: add, value: pz.solution[add] }
  const drop = diff.find(i => vals[i] > pz.solution[i])
  return drop === undefined ? null : { edge: drop, value: pz.solution[drop] }
}
