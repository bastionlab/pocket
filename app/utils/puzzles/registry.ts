/** The games: shared by the page and the server (which only accepts these ids). */
export type Kind = 'word' | 'logic' | 'geo' | 'quiz'
/** the order of the groups on the overview */
export const KINDS: Kind[] = ['word', 'logic', 'geo', 'quiz']
/** `icon` is a core <Icon> name; `unit` picks the "Solved in …" wording; `high` = a higher score is better (default lower: tries, moves, seconds); `hint` = the one-liner on the card (older games keep it in i18n `puzzles.games.<id>.hint`) */
export interface GameMeta {
  id: string, name: string, kind: Kind, unit: string, icon: string, hint?: string, high?: boolean, levels?: string[]
  /** stage width in px (the shell sets `--pz-max` on the play column; default 560): level seg, stats bar, board and tools share it */
  max?: number
  /** `true` = a board that must fit the viewport height on PC (the stage width also shrinks to `100dvh - chrome`, no page scroll) */
  fit?: boolean
}

/**
 * Difficulty levels. A game with `levels` (a subset, in order, of LEVELS) shows an Easy / Medium / Hard selector and
 * gets the prop `level`. Medium is the default AND keeps the plain game id as its key (old saves and results stay
 * valid); the other levels use `<id>:<level>`. The same key is used for usePuzzleState, results, hints and history.
 */
export const LEVELS = ['easy', 'medium', 'hard']
export const DEFAULT_LEVEL = 'medium'
/** the key of a game at a level: `queens` (medium / no levels) or `queens:hard` */
export const gameKey = (id: string, level?: string) => (level && level !== DEFAULT_LEVEL ? `${id}:${level}` : id)
/** split a key into its game and level; null when the id is unknown or the level is not one the game has */
export function parseGameKey(key: unknown): { game: GameMeta, level: string, key: string } | null {
  const [id, lv, ...rest] = String(key ?? '').split(':')
  const game = gameMeta(id ?? '')
  if (!game || rest.length) return null
  if (lv === undefined) return { game, level: game.levels ? DEFAULT_LEVEL : '', key: game.id }
  if (!game.levels?.includes(lv) || lv === DEFAULT_LEVEL) return null // `queens:medium` is spelled `queens`
  return { game, level: lv, key: `${game.id}:${lv}` }
}

export const PUZZLE_GAMES: GameMeta[] = [
  { id: 'wordle', name: 'Wordle', kind: 'word', unit: 'tries', icon: 'square-pen', max: 440 },
  { id: 'anagram', name: 'Anagram', kind: 'word', unit: 'tries', icon: 'refresh-cw', high: true, max: 480 },
  { id: 'hangman', name: 'Hangman', kind: 'word', unit: 'guesses', icon: 'heart', high: true, max: 440 },
  { id: 'word-ladder', name: 'Word Ladder', kind: 'word', unit: 'steps', icon: 'trending-up', high: true, max: 480 },
  { id: 'connections', name: 'Connections', kind: 'word', unit: 'tries', icon: 'link', high: true, max: 520 },
  { id: 'spelling-bee', name: 'Spelling Bee', kind: 'word', unit: 'words', icon: 'sparkles', high: true, max: 440 },
  { id: 'quordle', name: 'Quordle', kind: 'word', unit: 'tries', icon: 'grid', hint: 'Four Wordles at once', max: 720 },
  { id: 'crossword-mini', name: 'Mini Crossword', kind: 'word', unit: 'min', icon: 'pencil', hint: 'Mini crossword', max: 480 },
  { id: 'crossword', name: 'Crossword', kind: 'word', unit: 'min', icon: 'pencil', hint: 'A 7x7 crossword with clues', levels: ['easy', 'medium', 'hard'], max: 560, fit: true },
  { id: 'word-trail', name: 'Word Trail', kind: 'word', unit: 'min', icon: 'share-2', hint: 'Trace letters to fill a crossword', levels: ['easy', 'medium', 'hard'], max: 560, fit: true },
  { id: 'word-search', name: 'Word Search', kind: 'word', unit: 'min', icon: 'eye', hint: 'Find the hidden words', levels: ['easy', 'medium', 'hard'], max: 560, fit: true },
  { id: 'sudoku-mini', name: 'Mini Sudoku', kind: 'logic', unit: 'min', icon: 'grid', max: 520, fit: true },
  { id: 'sudoku', name: 'Sudoku', kind: 'logic', unit: 'min', icon: 'list-checks', levels: ['easy', 'medium', 'hard'], max: 520, fit: true },
  { id: 'minesweeper', name: 'Minesweeper', kind: 'logic', unit: 'min', icon: 'bug', levels: ['easy', 'medium', 'hard'], max: 560, fit: true },
  { id: 'nonogram', name: 'Nonogram', kind: 'logic', unit: 'min', icon: 'image', levels: ['easy', 'medium', 'hard'], max: 560, fit: true },
  { id: 'lights-out', name: 'Lights Out', kind: 'logic', unit: 'moves', icon: 'lightbulb', levels: ['easy', 'medium', 'hard'], max: 500, fit: true },
  { id: 'mastermind', name: 'Mastermind', kind: 'logic', unit: 'tries', icon: 'key-round', levels: ['easy', 'medium', 'hard'], max: 440 },
  { id: 'higher-lower', name: 'Higher or Lower', kind: 'logic', unit: 'points', icon: 'scale', high: true, max: 440 },
  { id: 'math-24', name: 'Make 24', kind: 'logic', unit: 'tries', icon: 'target', max: 460 },
  { id: 'sliding-3x3', name: 'Sliding Tiles', kind: 'logic', unit: 'moves', icon: 'panel-left', levels: ['easy', 'medium', 'hard'], max: 480, fit: true },
  { id: 'takuzu', name: 'Takuzu', kind: 'logic', unit: 'min', icon: 'square', levels: ['easy', 'medium', 'hard'], max: 560, fit: true },
  { id: 'memory-match', name: 'Memory Match', kind: 'logic', unit: 'flips', icon: 'brain', levels: ['easy', 'medium', 'hard'], max: 520, fit: true },
  { id: 'bridges', name: 'Bridges', kind: 'logic', unit: 'min', icon: 'link', hint: 'Connect the islands', levels: ['easy', 'medium', 'hard'], max: 560, fit: true },
  { id: 'queens', name: 'Queens', kind: 'logic', unit: 'min', icon: 'star', hint: 'One queen per row, column and colour', levels: ['easy', 'medium', 'hard'], max: 560, fit: true },
  { id: 'country-wordle', name: 'Country Wordle', kind: 'geo', unit: 'tries', icon: 'globe', levels: ['easy', 'medium', 'hard'], max: 600 },
  { id: 'flaggle', name: 'Flaggle', kind: 'geo', unit: 'tries', icon: 'flag', max: 520 },
  { id: 'capital-quiz', name: 'Capital Quiz', kind: 'geo', unit: 'right', icon: 'building-2', high: true, max: 520 },
  { id: 'outline-guess', name: 'Country Facts', kind: 'geo', unit: 'right', icon: 'map-pin', high: true, max: 520 },
  { id: 'shape-guess', name: 'Country Shape', kind: 'geo', unit: 'points', high: true, icon: 'globe', hint: 'Name the country by its shape', levels: ['easy', 'medium', 'hard'], max: 520 },
  { id: 'quiz-knowledge', name: 'Knowledge Quiz', kind: 'quiz', unit: 'right', icon: 'circle-help', hint: 'General knowledge', high: true, max: 640 },
  { id: 'quiz-science', name: 'Science Quiz', kind: 'quiz', unit: 'right', icon: 'flask-conical', hint: 'Science', high: true, max: 640 },
  { id: 'quiz-history', name: 'History Quiz', kind: 'quiz', unit: 'right', icon: 'history', hint: 'History', high: true, max: 640 },
  { id: 'quiz-travel', name: 'Travel Quiz', kind: 'quiz', unit: 'right', icon: 'map-pin', hint: 'Travel and places', high: true, max: 640 },
]

export const gameMeta = (id: string) => PUZZLE_GAMES.find(g => g.id === id)

export const isDay = (s: unknown): s is string =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s

/** day +/- n days, as YYYY-MM-DD (UTC arithmetic on the plain date, no timezone drift) */
export function shiftDay(day: string, n: number): string {
  return new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
}


// --- random mode: /puzzles?g=<id>&r=<seed>. The game still gets a `day` string, namely `r-<seed>`; it only seeds the
// generator with it (rngFor(key, day)), so nothing but code that PARSES `day` as a date has to care ---
/** a short random seed (base36) */
export const randomSeed = () => Math.random().toString(36).slice(2, 8).padEnd(4, '0')
export const isSeed = (s: unknown): s is string => typeof s === 'string' && /^[a-z0-9]{3,12}$/.test(s)
/** the pseudo day a random puzzle is played under */
export const randomDay = (seed: string) => `r-${seed}`
export const isRandomDay = (day: unknown): day is string => typeof day === 'string' && /^r-[a-z0-9]{3,12}$/.test(day)
/** a stable integer for a day string that may be a random seed (for code that walks a pool by day number) */
export function daySeedNumber(day: string): number {
  let h = 0x811C9DC5
  for (let i = 0; i < day.length; i++) { h ^= day.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0) % 100000
}
/** what a day string is called in share text and popups: the date itself, or `Random <seed>` */
export const dayLabel = (day: string) => (isRandomDay(day) ? `Random ${day.slice(2)}` : day)
