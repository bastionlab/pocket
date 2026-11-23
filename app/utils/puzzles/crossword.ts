/** Crosswords: the daily mini (5x5) and the 7x7 Crossword at three levels. Fills use only bank words (3 banks combined). */
import { CW_BANK } from './crosswordBank'
import { CW_BANK_X45 } from './crosswordBank6'
import { CW_BANK_X67 } from './crosswordBank7'
import { generate, makeBank, type CwBank, type CwPuzzle } from './crosswordGen'
import { fnv1a } from './rng'
import { gameKey } from './registry'

export type { CwSlot, CwPuzzle } from './crosswordGen'

export const CW_N = 5
export const CW_BIG = 7

/**
 * hand-picked block patterns ('#' black), deliberately irregular like a printed crossword: stepped corners, notched edges,
 * a missing corner, one-sided blocks. Symmetry is optional (some are, most are not). Every white run is 3+ long across and
 * down, the white cells are connected (`patternProblem` in crosswordGen.ts checks that; scripts test every one) and each one
 * was filled from the banks over 120 days in node (a 5x5 with few blocks is the hardest to fill, so those are few)
 */
export const CW_PATTERNS: readonly string[] = [
  '...##/....#/...../#..../##...',
  '##.../##.../...../...../.....',
  '...##/...##/...../...../#....',
  '...##/...##/...../##.../##...',
  '...##/...##/...../#..../##...',
  '...##/....#/...../#..../#....',
  '...##/...##/...../#..../#....',
  '##.../#..../...../...../.....',
  '...##/...../...../...../#....',
  '#...#/...../...../...../#...#',
  '##.../#..../...../...../....#',
  '...##/...../...../#..../#....',
  '#..../...../...../...../.....',
]

/** 7x7 patterns by level: easy = most blocks (short entries), hard = fewest blocks (long entries) */
export const CW_PATTERNS7: Record<string, readonly string[]> = {
  // 21-24 blocks: mostly 3-5 letter entries
  easy: [
    '####.../###..../##...../#.....#/....###/....###/...####',
    '....###/....###/....###/###..../###..../###..../###...#',
    '##...##/.....##/.....##/....###/##...../####.../####...',
    '...####/...####/...####/....###/##...../##...../####...',
    '...####/....###/.....##/......#/###..../####.../####...',
    '####.../####.../###..../###..../......./....###/...####',
    '###...#/##...../##...../...#.../...####/...####/...####',
    '###...#/###..../###..../###..../....###/...####/...####',
  ],
  // 16-20 blocks: 3-7 letter entries
  medium: [
    '####.../##...../#....../#.....#/.....##/...####/...####',
    '#...###/....###/....###/...#.../##...../###..../###....',
    '###...#/###...#/###...#/....###/......./...#.../####...',
    '...####/.....##/.....##/##...../...#.../...#.../...####',
    '...#.../...#.../...#.../#....##/#.....#/###...#/###...#',
    '...####/...#.../......./###..../#.....#/#...###/#...###',
    '###..../......./......./....###/##...../####.../####...',
    '###...#/###...#/#.....#/...#.../...#.../...#.../...####',
    '#...###/#...###/#....../...#.../...#.../...#.../####...',
    '####.../###..../##...../##...##/...#.../...#.../...#...',
  ],
  // the fewest blocks the bank can fill (12-16): long entries
  hard: [
    '###...#/#.....#/#.....#/.....##/...#.../...#.../####...',
    '...#.../...#.../......./##...../....###/....###/....###',
    '...####/...####/....###/##....#/......./...#.../...#...',
    '...#.../...#.../...#.../.....##/##....#/###...#/###...#',
    '.....##/.....##/......./####.../#....../#.....#/#....##',
    '###...#/##...../#....../...#.../......#/....###/....###',
    '###..../###..../......./...####/......./###..../###....',
    '####.../####.../###..../....###/......./...#.../...#...',
    '##....#/##....#/##....#/#....../...#.../...#.../...####',
  ],
}

const BANK: { all?: CwBank } = {}
/** the combined bank: CW_BANK first (its clues win for a word that is in several banks) */
const bank = (): CwBank => (BANK.all ||= makeBank([...CW_BANK, ...CW_BANK_X45, ...CW_BANK_X67], CW_BIG))

const cache = new Map<string, CwPuzzle>()

/** the puzzle of a game key + day on a size: pure and deterministic (same key + day = same grid on every device) */
export function crosswordGrid(size: number, key: string, day: string, patterns: readonly string[]): CwPuzzle {
  const id = `${key}|${day}`
  const hit = cache.get(id)
  if (hit) return hit
  const p = generate(bank(), patterns, size, fnv1a(`${key}:${day}`))
  cache.set(id, p)
  return p
}

/** the daily Mini Crossword (5x5) */
export const crosswordFor = (day: string) => crosswordGrid(CW_N, 'crossword-mini', day, CW_PATTERNS)

/** the 7x7 Crossword of a level (medium = no suffix in the key, as for every leveled game) */
export function crossword7For(day: string, level?: string): CwPuzzle {
  const lv = CW_PATTERNS7[level || 'medium'] ? level || 'medium' : 'medium'
  return crosswordGrid(CW_BIG, gameKey('crossword', lv), day, CW_PATTERNS7[lv])
}

/** bank sizes by source, for tests */
export const CW_BANKS = { base: CW_BANK, x45: CW_BANK_X45, x67: CW_BANK_X67 }
