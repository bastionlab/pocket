// Puzzles add-on, browser side: port of the dashboard's server/utils/puzzles.ts onto kv (prefix `puzzles:`).
// Puzzle content is never stored: the page generates it from (game id + day). Coins are global (wallet + ledger).
import { defineLocal, LocalError } from './registry'
import { kv, nowSec } from './store'
import { PUZZLE_GAMES, gameMeta, parseGameKey, isDay, shiftDay } from '../utils/puzzles/registry'

interface Row { game: string, day: string, solved: number, attempts: number, score: number, detail: string, updated: number }

const START_COINS = 20
const HINT_DEFAULT = 6
const HINT_COSTS: Record<string, number> = {
  'wordle': 8, 'quordle': 8, 'crossword-mini': 8, 'crossword': 8, 'connections': 8, 'capital-quiz': 8, 'outline-guess': 8,
  'quiz-knowledge': 8, 'quiz-science': 8, 'quiz-history': 8, 'quiz-travel': 8,
  'bridges': 6, 'queens': 6, 'sudoku': 6, 'sudoku-mini': 6, 'nonogram': 6, 'takuzu': 6, 'minesweeper': 6,
  'anagram': 5,
  'memory-match': 4, 'sliding-3x3': 4, 'higher-lower': 4, 'lights-out': 4, 'hangman': 4,
}
const hintCosts = () => Object.fromEntries(PUZZLE_GAMES.map(g => [g.id, HINT_COSTS[g.id] ?? HINT_DEFAULT]))
const REWARDS = { base: 10, perStreak: 2, maxStreak: 10, archive: 10 }
const reward = (streak: number, isToday: boolean) =>
  isToday ? { total: REWARDS.base + REWARDS.perStreak * Math.min(streak, REWARDS.maxStreak), bonus: REWARDS.perStreak * Math.min(streak, REWARDS.maxStreak) }
    : { total: REWARDS.archive, bonus: 0 }

const rk = (game: string, day: string) => `puzzles:r:${game}|${day}`
const bad = (m: string) => new LocalError(400, m)
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' })

// wallet: created on first use with the starting coins (and a ledger line), like the server's INSERT OR IGNORE
async function wallet(): Promise<{ coins: number }> {
  let w = await kv.get<{ coins: number }>('puzzles:wallet')
  if (!w) {
    w = { coins: START_COINS }
    await kv.set('puzzles:wallet', w)
    await kv.set(`puzzles:l:${Date.now()}-start`, { ts: Date.now(), delta: START_COINS, reason: 'start', game: '', day: '' })
  }
  return w
}
async function move(delta: number, reason: string, game = '', day = '') {
  const w = await wallet()
  w.coins += delta
  await kv.set('puzzles:wallet', w)
  await kv.set(`puzzles:l:${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, { ts: Date.now(), delta, reason, game, day })
}

function streakOf(solvedDays: Set<string>, t: string): number {
  let d = solvedDays.has(t) ? t : shiftDay(t, -1)
  let n = 0
  while (solvedDays.has(d)) { n++; d = shiftDay(d, -1) }
  return n
}
function bestOf(days: string[]): number {
  const s = new Set(days)
  let best = 0
  for (const d of days) {
    if (s.has(shiftDay(d, -1))) continue
    let n = 0, x = d
    while (s.has(x)) { n++; x = shiftDay(x, 1) }
    best = Math.max(best, n)
  }
  return best
}
const ofGame = <T extends { game: string }>(rows: T[], id: string) => rows.filter(r => r.game === id || r.game.startsWith(`${id}:`))
const levelOf = (key: string) => key.split(':')[1] ?? 'medium'
const allRows = async () => (await kv.list<Row>('puzzles:r:')).map(e => e.value)

function checkGameDay(b: any) {
  const p = parseGameKey(b?.game)
  if (!p) throw bad('unknown game or level')
  if (!isDay(b?.day)) throw bad('bad day')
  if (b.day > shiftDay(today(), 1)) throw bad('day is in the future')
  return { game: p.key, id: p.game.id, day: b.day as string }
}

defineLocal('GET', '/api/puzzles', async () => {
  const t = today()
  const rows = await allRows()
  const games = PUZZLE_GAMES.map((g) => {
    const mine = ofGame(rows, g.id)
    const solved = mine.filter(r => r.solved).map(r => r.day)
    const todays = mine.filter(r => r.day === t)
    const order = g.levels ?? ['medium']
    const won = todays.filter(r => r.solved).sort((a, b) => order.indexOf(levelOf(b.game)) - order.indexOf(levelOf(a.game)))[0]
    const r = won ?? todays[0]
    return {
      id: g.id, name: g.name, kind: g.kind,
      ...(g.levels ? { levels: g.levels } : {}),
      today: r ? { solved: !!r.solved, attempts: r.attempts, score: r.score, ...(g.levels ? { level: levelOf(r.game) } : {}) } : null,
      streak: streakOf(new Set(solved), t),
      best: bestOf(solved),
    }
  })
  return { today: t, games, coins: (await wallet()).coins, hintCosts: hintCosts(), rewards: REWARDS }
})

defineLocal('GET', '/api/puzzles/history', async ({ query }) => {
  const p = parseGameKey(query.game)
  if (!p) throw bad('unknown game or level')
  const rows = (await allRows()).filter(r => r.game === p.key).sort((a, b) => (a.day < b.day ? 1 : -1)).slice(0, 30)
  return rows.map(r => ({ day: r.day, solved: !!r.solved, attempts: r.attempts, score: r.score, detail: JSON.parse(r.detail || '{}') }))
})

defineLocal('POST', '/api/puzzles/result', async ({ body: b }) => {
  const { game, id, day } = checkGameDay(b)
  const attempts = Number(b.attempts), score = Number(b.score)
  if (!Number.isFinite(attempts) || !Number.isFinite(score)) throw bad('bad numbers')
  const detail = JSON.stringify(b.detail ?? {})
  if (detail.length > 2048) throw bad('detail too large')
  const solved = b.solved === true || b.solved === 1 ? 1 : 0
  const t = today()
  const rows = await allRows()
  const solvedDays = new Set(ofGame(rows, id).filter(r => r.solved).map(r => r.day))
  const old = await kv.get<Row>(rk(game, day))
  const none = async (kept = false) => ({ ok: true, ...(kept ? { kept: true } : {}), earned: 0, coins: (await wallet()).coins, streak: streakOf(solvedDays, t), bonus: 0 })

  if (old?.solved && !solved) return none(true)
  if (old?.solved && solved) {
    const better = gameMeta(id)!.high ? score >= old.score : score <= old.score
    if (!better) return none(true)
  }

  let earned = 0, bonus = 0, streak = streakOf(solvedDays, t)
  await kv.set(rk(game, day), { game, day, solved, attempts: Math.round(attempts), score: Math.round(score), detail, updated: nowSec() } satisfies Row)
  // coins: only the first solve of (game, day), ever (the paid marker outlives result rows)
  const paid = await kv.get(`puzzles:paid:${game}|${day}`)
  if (solved && !old?.solved && !paid && b.restore !== true) {
    solvedDays.add(day)
    streak = streakOf(solvedDays, t)
    const r = reward(streak, day === t)
    earned = r.total; bonus = r.bonus
    await kv.set(`puzzles:paid:${game}|${day}`, 1)
    await move(earned, 'solve', game, day)
  }
  return { ok: true, earned, coins: (await wallet()).coins, streak, bonus }
})

// hints are local: they cost coins from the wallet, nothing else (no AI / network)
defineLocal('POST', '/api/puzzles/hint', async ({ body }) => {
  const { game, id, day } = checkGameDay(body)
  const cost = hintCosts()[id]!
  const coins = (await wallet()).coins
  if (coins < cost) {
    const e = new LocalError(402, 'not enough coins')
    e.data = { error: 'not enough coins', coins, cost, statusMessage: 'not enough coins' }
    throw e
  }
  await move(-cost, 'hint', game, day)
  return { ok: true, coins: (await wallet()).coins, cost }
})
