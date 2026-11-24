<script setup lang="ts">
/** Home "Today" card: read-only glance at habits, the daily puzzle, languages due and open todos. Data from the local handlers only. */
interface Row { key: string, to: string, label: string, text: string, bar?: number }

const rows = ref<Row[]>([])
const loading = ref(true)
const noHabits = ref(false)

async function habitsRow(): Promise<Row | 'none' | null> {
  const r: any = await $fetch('/api/habits')
  const habits: any[] = r?.habits ?? []
  if (!habits.length) return 'none'
  const d = new Date(), pad = (n: number) => String(n).padStart(2, '0')
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, wd = (d.getDay() + 6) % 7
  const due = habits.filter(h => h.freq === 'daily' || (h.days ?? []).includes(wd))
  if (!due.length) return null
  const done = due.filter(h => (r.checks?.[h.id] ?? []).includes(day)).length
  return { key: 'habits', to: '/habits', label: 'Habits', text: done === due.length ? 'All done' : `${done} of ${due.length} done`, bar: done / due.length }
}
async function puzzleRow(): Promise<Row | null> {
  const r: any = await $fetch('/api/puzzles')
  const games: any[] = r?.games ?? []
  if (!games.length) return null
  const solved = games.some(g => g.today?.solved)
  return { key: 'puzzles', to: '/puzzles', label: 'Daily puzzle', text: solved ? 'Solved' : 'Not solved yet' }
}
async function langRows(): Promise<Row[]> {
  const r: any = await $fetch('/api/lang')
  const out: Row[] = []
  for (const id of r?.enabled ?? []) {
    const n = Number(r.due?.[id] ?? 0)
    const name = (r.languages ?? []).find((l: any) => l.id === id)?.name ?? id
    out.push({ key: `lang-${id}`, to: '/languages', label: name, text: n > 0 ? `${n} card${n === 1 ? '' : 's'} due` : 'Nothing due' })
  }
  return out
}
async function notesRow(): Promise<Row | null> {
  const r: any = await $fetch('/api/notes')
  const n = (r?.notes ?? []).filter((x: any) => x.kind === 'todo' && x.state === 'active').length
  return n ? { key: 'notes', to: '/notes', label: 'Notes', text: `${n} open todo${n === 1 ? '' : 's'}` } : null
}

let seq = 0
async function load() {
  const my = ++seq
  const [h, p, l, n] = await Promise.allSettled([habitsRow(), puzzleRow(), langRows(), notesRow()])
  if (my !== seq) return
  const val = <T,>(s: PromiseSettledResult<T>) => (s.status === 'fulfilled' ? s.value : null)
  const out: Row[] = []
  const hv = val(h)
  noHabits.value = hv === 'none'
  if (hv && hv !== 'none') out.push(hv)
  const pv = val(p); if (pv) out.push(pv)
  out.push(...(val(l) ?? []).slice(0, 3))
  const nv = val(n); if (nv) out.push(nv)
  rows.value = out.slice(0, 4)
  loading.value = false
}
function onVis() { if (!document.hidden) load() }
onMounted(() => { load(); document.addEventListener('visibilitychange', onVis) })
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVis))
</script>

<template>
  <section class="today">
    <strong>Today</strong>
    <div v-if="loading" class="rows" aria-hidden="true">
      <div v-for="i in 3" :key="i" class="sk" />
    </div>
    <div v-else class="rows">
      <NuxtLink v-for="r in rows" :key="r.key" :to="r.to" class="r">
        <span class="l">{{ r.label }}</span>
        <span class="v">{{ r.text }}</span>
        <i v-if="r.bar != null" class="bar"><b :style="{ width: `${Math.round(r.bar * 100)}%` }" /></i>
      </NuxtLink>
      <NuxtLink v-if="noHabits" to="/habits" class="r"><span class="l">Habits</span><span class="v muted">Add your first habit</span></NuxtLink>
      <p v-if="!rows.length && !noHabits" class="muted small">Nothing to show yet.</p>
    </div>
  </section>
</template>

<style scoped>
.today { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px; margin-bottom: 10px; background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); }
.rows { display: flex; flex-direction: column; gap: 2px; }
.rows p { margin: 0; }
.r { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; padding: 8px 0; color: var(--text); text-decoration: none; border-top: 1px solid var(--line); }
.r:first-child { border-top: 0; }
.r:hover { text-decoration: none; }
.l { color: var(--muted); font-size: 13px; min-width: 96px; }
.v { flex: 1; }
.bar { flex-basis: 100%; height: 4px; border-radius: 2px; background: var(--line); overflow: hidden; }
.bar b { display: block; height: 100%; background: var(--accent); }
.sk { height: 20px; margin: 6px 0; border-radius: 6px; background: var(--line); opacity: .6; }
</style>
