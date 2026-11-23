/** Seeded randomness: the same (game, day) gives the same puzzle on every device. */
export function fnv1a(s: string): number {
  let h = 0x811C9DC5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return h >>> 0
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Rng {
  next: () => number
  /** integer in [0, n) */
  int: (n: number) => number
  pick: <T>(a: readonly T[]) => T
  /** a shuffled copy */
  shuffle: <T>(a: readonly T[]) => T[]
}

export function makeRng(seed: number): Rng {
  const next = mulberry32(seed)
  const int = (n: number) => Math.floor(next() * n)
  return {
    next,
    int,
    pick: a => a[int(a.length)],
    shuffle: (a) => {
      const o = [...a]
      for (let i = o.length - 1; i > 0; i--) { const j = int(i + 1); [o[i], o[j]] = [o[j], o[i]] }
      return o
    },
  }
}

export const rngFor = (game: string, day: string, salt = '') => makeRng(fnv1a(`${game}:${day}${salt}`))
