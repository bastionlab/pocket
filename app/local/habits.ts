// Habits, browser edition of addons/habits/web/server: same URLs and JSON, data in IndexedDB kv under `habits:`.
// habits:h:<id> = habit row (soft-deleted via .deleted), habits:c:<id>:<YYYY-MM-DD> = 1 while the day is done.
import { defineLocal, LocalError } from './registry'
import { kv, uid } from './store'

type Freq = 'daily' | 'weekly' | 'days'
interface Row { id: string, title: string, freq: Freq, days: number[], created: number, updated: number, deleted: number, seq: number }

const H = 'habits:h:', C = 'habits:c:'
const bad = (m: string, code = 400) => new LocalError(code, m)

function parseDay(s: unknown): string {
  const d = String(s ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw bad('bad day')
  const t = Date.parse(`${d}T12:00:00Z`)
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== d) throw bad('bad day')
  if (t > Date.now() + 36 * 3_600_000) throw bad('day is in the future')
  return d
}

function schedule(freq: unknown, days: unknown): { freq: Freq, days: number[] } {
  if (freq === 'daily') return { freq, days: [0, 1, 2, 3, 4, 5, 6] }
  if (freq !== 'weekly' && freq !== 'days') throw bad('bad schedule')
  const ds = [...new Set((Array.isArray(days) ? days : []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))].sort()
  if (!ds.length) throw bad('pick a day')
  return { freq, days: freq === 'weekly' ? ds.slice(0, 1) : ds }
}

const rows = async () => (await kv.list<Row>(H)).map(e => e.value)

defineLocal('GET', '/api/habits', async () => {
  const live = (await rows()).filter(r => !r.deleted).sort((a, b) => a.created - b.created || a.seq - b.seq)
  const ids = new Set(live.map(r => r.id))
  const checks: Record<string, string[]> = {}
  for (const { key } of await kv.list(C)) {
    const rest = key.slice(C.length), i = rest.length - 10 - 1 // "<id>:" + YYYY-MM-DD
    const h = rest.slice(0, i), d = rest.slice(i + 1)
    if (ids.has(h)) (checks[h] ??= []).push(d)
  }
  for (const k of Object.keys(checks)) checks[k]!.sort()
  return { habits: live.map(r => ({ id: r.id, title: r.title, freq: r.freq, days: r.days, created: r.created })), checks }
})

defineLocal('POST', '/api/habits/save', async ({ body: b }) => {
  const title = String(b?.title ?? '').trim().slice(0, 120)
  if (!title) throw bad('name it')
  const s = schedule(b?.freq, b?.days)
  const id = b?.id ? String(b.id).slice(0, 64) : uid()
  const now = Date.now()
  const cur = await kv.get<Row>(H + id)
  if (cur && !cur.deleted) await kv.set(H + id, { ...cur, title, freq: s.freq, days: s.days, updated: now })
  else {
    const seq = Math.max(0, ...(await rows()).map(r => r.seq)) + 1
    await kv.set(H + id, { id, title, freq: s.freq, days: s.days, created: now, updated: now, deleted: 0, seq })
  }
  return { id }
})

defineLocal('POST', '/api/habits/remove', async ({ body }) => {
  const cur = await kv.get<Row>(H + String(body?.id ?? ''))
  if (cur) await kv.set(H + cur.id, { ...cur, deleted: 1, updated: Date.now() })
  return { ok: true }
})

// set (not flip) so a repeated or retried request can't undo itself
defineLocal('POST', '/api/habits/check', async ({ body: b }) => {
  const h = String(b?.habit ?? ''), d = parseDay(b?.day)
  const cur = await kv.get<Row>(H + h)
  if (!cur || cur.deleted) throw bad('no such habit', 404)
  if (b?.done === true) await kv.set(`${C}${h}:${d}`, 1)
  else await kv.del(`${C}${h}:${d}`)
  return { ok: true }
})
