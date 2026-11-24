// Habit reminder settings + the in-page timer. Best effort only: there is no server and no push service.
// kv `habits:remind` = { on, time: 'HH:MM' }, `habits:remind:last` = YYYY-MM-DD of the last notification (also written by public/sw.js).
import { kv } from './store'
import { isDoneOn, isoDay, isScheduled, weekdayOf, type HabitChecks, type HabitRow } from '../utils/habits'

export interface Remind { on: boolean, time: string }
const KEY = 'habits:remind', LAST = 'habits:remind:last'

export async function getRemind(): Promise<Remind> {
  const v = await kv.get<Remind>(KEY).catch(() => undefined)
  return { on: !!v?.on, time: /^\d{2}:\d{2}$/.test(v?.time ?? '') ? v!.time : '20:00' }
}
export const setRemind = (r: Remind) => kv.set(KEY, { on: !!r.on, time: r.time })

/** minutes after midnight for 'HH:MM' */
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
export const timePassed = (time: string, d = new Date()) => d.getHours() * 60 + d.getMinutes() >= mins(time)

/** scheduled today and not ticked yet (same rule as the Today tab) */
export function leftToday(habits: HabitRow[], ck: HabitChecks, d = new Date()) {
  const day = isoDay(d), wd = weekdayOf(d)
  return habits.filter(h => isScheduled(h, wd) && !isDoneOn(ck, h.id, day)).length
}

export async function fetchLeft(): Promise<number | null> {
  try {
    const r = await $fetch<{ habits: HabitRow[], checks: Record<string, string[]> }>('/api/habits')
    const ck: HabitChecks = Object.fromEntries(Object.entries(r.checks ?? {}).map(([k, v]) => [k, new Set(v)]))
    return leftToday(r.habits ?? [], ck)
  } catch { return null }
}

export const reminderText = (n: number | null) => (n == null ? 'Time to check your habits' : `${n} habit${n === 1 ? '' : 's'} left today`)

export async function notify(body: string) {
  const opts = { body, tag: 'habit-reminder', icon: '/icons/icon-192.png', data: { url: '/habits' } } as NotificationOptions
  try {
    const reg = await navigator.serviceWorker?.ready
    if (reg) return await reg.showNotification('Habits', opts)
  } catch { /* fall through */ }
  new Notification('Habits', opts)
}

let timer: ReturnType<typeof setTimeout> | undefined
/** (re)arm the timer for the next reminder time while the app is open; fires once per day */
export async function scheduleReminder() {
  clearTimeout(timer)
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const r = await getRemind()
  if (!r.on) return
  const now = new Date(), at = new Date(now)
  at.setHours(Number(r.time.slice(0, 2)), Number(r.time.slice(3, 5)), 0, 0)
  if (+at <= +now) {
    // already past today: the on-open banner covers it; just wait for tomorrow
    at.setDate(at.getDate() + 1)
  }
  timer = setTimeout(async () => {
    try {
      const day = isoDay()
      if ((await kv.get<string>(LAST)) !== day) {
        const n = await fetchLeft()
        if (n !== 0) { await kv.set(LAST, day); await notify(reminderText(n)) }
      }
    } catch { /* best effort */ }
    scheduleReminder()
  }, Math.min(+at - +now, 2 ** 31 - 1))
}

export async function registerPeriodic(on: boolean) {
  try {
    const reg: any = await navigator.serviceWorker?.ready
    if (!reg?.periodicSync) return false
    if (on) await reg.periodicSync.register('habit-reminder', { minInterval: 60 * 60 * 1000 })
    else await reg.periodicSync.unregister('habit-reminder')
    return true
  } catch { return false }
}
