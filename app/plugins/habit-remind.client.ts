// Keeps the in-page habit reminder timer armed while the app is open (see app/local/habitsRemind.ts).
import { scheduleReminder } from '../local/habitsRemind'

export default defineNuxtPlugin(() => {
  const go = () => { scheduleReminder().catch(() => {}) }
  go()
  document.addEventListener('visibilitychange', () => { if (!document.hidden) go() })
})
