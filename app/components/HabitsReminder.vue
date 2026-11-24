<script setup lang="ts">
import type { HabitChecks, HabitRow } from '../utils/habits'
import { getRemind, leftToday, notify, registerPeriodic, reminderText, scheduleReminder, setRemind, timePassed } from '../local/habitsRemind'
/**
 * Reminders panel (panel) or the on-open nudge (banner). Best effort: no server, no push service.
 * Needs the habits so the banner can count what is left today.
 */
const props = defineProps<{ banner?: boolean, habits: HabitRow[], checks: HabitChecks }>()

const on = ref(false), time = ref('20:00'), msg = ref(''), ready = ref(false), dismissed = ref(false)
const supported = ref(true)
const clock = ref(new Date())
const left = computed(() => leftToday(props.habits, props.checks, clock.value))
const nudge = computed(() => ready.value && on.value && !dismissed.value && left.value > 0 && timePassed(time.value, clock.value))

async function load() {
  clock.value = new Date()
  const r = await getRemind().catch(() => ({ on: false, time: '20:00' }))
  on.value = r.on && typeof Notification !== 'undefined' && Notification.permission === 'granted'
  time.value = r.time
  ready.value = true
}
function onVis() { if (!document.hidden) load() }
onMounted(() => {
  supported.value = typeof Notification !== 'undefined'
  load()
  document.addEventListener('visibilitychange', onVis)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVis))

async function save() {
  await setRemind({ on: on.value, time: time.value })
  await scheduleReminder()
}
async function toggle() {
  msg.value = ''
  if (on.value) {
    on.value = false
    await save(); await registerPeriodic(false)
    return
  }
  if (typeof Notification === 'undefined') { msg.value = 'Notifications are not supported here. On iPhone, add the app to the Home Screen first.'; return }
  let perm: string = Notification.permission
  if (perm === 'default') perm = await Notification.requestPermission().catch(() => 'denied')
  if (perm !== 'granted') { msg.value = 'Notifications are blocked. Allow them in your browser or phone settings, then try again.'; return }
  on.value = true
  await save(); await registerPeriodic(true)
}
async function test() {
  msg.value = ''
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') { msg.value = 'Turn on the daily reminder first to allow notifications.'; return }
  try { await notify(reminderText(left.value || null)) } catch { msg.value = 'Could not show a notification.' }
}
</script>

<template>
  <div v-if="banner">
    <div v-if="nudge" class="nudge">
      <span>{{ reminderText(left) }}</span>
      <button type="button" class="x" aria-label="Dismiss" @click="dismissed = true"><Icon name="x" :size="16" /></button>
    </div>
  </div>
  <section v-else class="rem">
    <strong>Reminders</strong>
    <label class="row">
      <span>Daily reminder</span>
      <input type="checkbox" :checked="on" :disabled="!supported && !on" @change="toggle">
    </label>
    <label class="row">
      <span>Time</span>
      <input v-model="time" type="time" :disabled="!on" @change="save">
    </label>
    <div><button class="btn" type="button" @click="test">Send test notification</button></div>
    <p v-if="msg" class="msg">{{ msg }}</p>
    <p class="muted small">Reminders arrive while the app is open or when your phone lets the installed app wake up. On iPhone, add the app to the Home Screen first.</p>
  </section>
</template>

<style scoped>
.rem { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); }
.rem p { margin: 0; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.row input[type=time] { background: var(--bg); border: 1px solid var(--line-2); border-radius: var(--radius-sm); padding: 8px 10px; color: var(--text); font: inherit; }
.msg { color: var(--bad); font-size: 13px; }
.nudge { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; background: var(--accent-soft); border: 1px solid var(--accent); border-radius: var(--radius); }
.x { background: none; border: 0; color: var(--muted); cursor: pointer; padding: 4px; display: inline-flex; }
</style>
