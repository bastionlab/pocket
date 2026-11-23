<script setup lang="ts">
import { fracOp, fracText, is24, math24Puzzle, solve24Step, type Frac } from '../../utils/puzzles/logic'
import { burst, flash, pulse, shake } from '../../utils/puzzles/fx'

const props = defineProps<{ day: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
const p = math24Puzzle(props.day)
// a card owns one of four reserved slots (0..3, a 2 x 2 grid) for good: combining two moves one onto the other and
// leaves ONE card in that slot, so no card is ever added or re-flowed
interface Item { v: Frac, s: string, id: number, slot: number }
type Hint = { i: number, j: number, op: string } | 'dead' | null
const fresh = (): Item[] => p.nums.map((n, k) => ({ v: [n, 1] as Frac, s: String(n), id: k, slot: k }))
const st = usePuzzleState('math-24', props.day, () => ({
  items: fresh(), a: -1, op: '', resets: 0, res: null as PuzzleResult | null,
  steps: [] as string[], stack: [] as { items: Item[], steps: string[] }[], hints: 0, hint: null as Hint,
}))
// saves from before the slots: the cards were packed, so their position is their slot
st.items.forEach((it, k) => { if (it.id === undefined) it.id = k; if (it.slot === undefined) it.slot = k })
st.stack.forEach(s => s.items.forEach((it, k) => { if (it.slot === undefined) it.slot = k }))
let nid = Math.max(100, ...st.items.map(it => it.id + 1))
useFinish(st, emit)
const { armed, arm } = useArm(3000)
const root = ref<HTMLElement | null>(null)

const OPS = ['+', '-', '*', '/']
const SYM: Record<string, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' }
const OPNAME: Record<string, string> = { '+': 'plus', '-': 'minus', '*': 'times', '/': 'divide' }
const fmt = (f: Frac) => (f[0] < 0 ? '−' : '') + fracText([Math.abs(f[0]), f[1]])
const pretty = (s: string | null) => (s ?? '').replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−')
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

const note = ref('')
const done = computed(() => !!st.res)
const won = computed(() => !!st.res?.solved)
const dead = computed(() => st.items.length === 1 && !st.res)
const hl = computed(() => (st.hint && st.hint !== 'dead' ? st.hint : null))
const buzz = () => navigator.vibrate?.(10)
const timers: ReturnType<typeof setTimeout>[] = []
const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }
onBeforeUnmount(() => timers.forEach(clearTimeout))

// the two cards that were just merged: drawn for ~300 ms flying onto the result's slot (never a fifth card: they are the two that left)
const ghosts = ref<{ id: number, v: Frac, slot: number, to: number }[]>([])
const popped = ref<number[]>([]) // ids that animate in (a result, or cards brought back by Undo)
const cardEl = (id: number) => root.value?.querySelector<HTMLElement>(`.mc[data-id="${id}"]`) ?? null
const slotXY = (s: number) => ({ '--x': s % 2, '--y': Math.floor(s / 2) })

function clearSel() { st.a = -1; st.op = ''; st.hint = null; note.value = '' }

function pickNum(i: number) {
  if (st.res) return
  st.hint = null; note.value = ''
  if (st.a < 0 || !st.op) { st.a = st.a === i ? -1 : i; buzz(); return }
  if (i === st.a) { st.a = -1; return }
  combine(st.a, i, st.op)
}
function pickOp(o: string) {
  if (st.res) return
  st.hint = null; note.value = ''
  st.op = st.op === o ? '' : o
  buzz()
}
function combine(a: number, b: number, op: string) {
  const A = st.items[a]!, B = st.items[b]!
  const v = fracOp(A.v, B.v, op)
  if (!v) { note.value = t('puzzles.m24.div0'); st.op = ''; return }
  st.stack.push({ items: clone(st.items), steps: [...st.steps] })
  st.steps.push(`${fmt(A.v)} ${SYM[op]} ${fmt(B.v)} = ${fmt(v)}`)
  const s = `(${A.s} ${op} ${B.s})`
  const id = nid++
  ghosts.value = [{ id: A.id, v: A.v, slot: A.slot, to: B.slot }, { id: B.id, v: B.v, slot: B.slot, to: B.slot }]
  later(() => { ghosts.value = [] }, 320)
  popped.value = [id]
  later(() => { popped.value = [] }, 700)
  // the result takes B's slot; the other slots keep what they hold
  st.items = [...st.items.filter((_, k) => k !== a && k !== b), { v, s, id, slot: B.slot }]
  st.a = -1; st.op = ''
  buzz()
  const win = st.items.length === 1 && is24(v)
  if (win) {
    const n = st.resets + 1
    const base = n === 1 ? t('puzzles.m24.sumFirst') : t('puzzles.m24.sumTries', { n })
    st.res = { solved: true, attempts: n, score: n, summary: st.hints ? `${base} ${t('puzzles.m24.sumHints', { h: st.hints })}` : base, detail: { expr: s, hints: st.hints, level: p.level } }
  }
  nextTick(() => later(() => {
    const e = cardEl(id)
    if (!e) return
    if (win) { burst(e, { color: '--ok', count: 22, spread: 90 }); pulse(e) }
    else if (st.items.length === 1) { shake(e); flash(e, '--bad') }
    else pulse(e)
  }, 200))
}
function undo() {
  const prev = st.stack.pop()
  if (st.res || !prev) return
  st.items = prev.items; st.steps = prev.steps
  popped.value = st.items.map(it => it.id)
  later(() => { popped.value = [] }, 500)
  clearSel()
}
function reset() {
  if (st.res) return
  const used = st.steps.length > 0
  clearSel()
  if (!used) return // nothing to throw away: not a new try
  st.items = fresh(); st.steps = []; st.stack = []
  popped.value = st.items.map(it => it.id)
  later(() => { popped.value = [] }, 500)
  st.resets++
}
/** bought: points at the next step (kept in the saved state, so a reload keeps it without charging again) */
function hint() {
  if (st.res) return
  st.a = -1; st.op = ''; note.value = ''
  st.hints++
  st.hint = solve24Step(st.items.map(it => it.v)) ?? 'dead'
}
function giveUp() {
  if (st.res || !arm('give')) return
  st.res = { solved: false, attempts: st.resets + 1, score: 0, summary: t('puzzles.m24.sumLost', { s: pretty(p.solution) }), detail: { expr: p.solution, hints: st.hints, level: p.level } }
}

const guide = computed(() => {
  if (note.value) return note.value
  if (hl.value) return t('puzzles.m24.hintStep', { a: fmt(st.items[hl.value.i]!.v), op: SYM[hl.value.op], b: fmt(st.items[hl.value.j]!.v) })
  if (st.hint === 'dead') return t('puzzles.m24.hintNone')
  if (won.value) return t('puzzles.m24.won')
  if (done.value) return ''
  if (dead.value) return t('puzzles.m24.not', { n: fmt(st.items[0]!.v) })
  if (st.a >= 0 && st.op) return `${fmt(st.items[st.a]!.v)} ${SYM[st.op]} ?`
  if (st.a >= 0) return t('puzzles.m24.pick2')
  return t('puzzles.m24.pick1')
})
const guideTone = computed(() => (won.value ? 'ok' : dead.value || note.value || st.hint === 'dead' ? 'bad' : ''))

// desktop: 1-4 pick a card (by position), + - * / pick the operation, Backspace undoes, Escape clears the pick
function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement | null)?.closest('input, textarea, select')) return
  if (/^[1-4]$/.test(e.key) && Number(e.key) <= st.items.length) pickNum(Number(e.key) - 1)
  else if (OPS.includes(e.key)) pickOp(e.key)
  else if (e.key === 'x' || e.key === 'X') pickOp('*')
  else if (e.key === 'Backspace') undo()
  else if (e.key === 'Escape') clearSel()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div ref="root" class="m24">
    <PuzzlesStage
      :stats="[{ label: $t('puzzles.m24.levelLabel'), value: $t(`puzzles.m24.level${p.level}`), tone: p.level === 2 ? 'warn' : undefined }, { label: $t('puzzles.m24.try'), value: st.resets + 1 }]"
      :msg="guide" :tone="guideTone || undefined"
    >
      <template #actions>
        <PuzzlesHintButton game="math-24" :day="day" :disabled="done || dead" @bought="hint" />
      </template>

      <div class="m24-cards">
        <i v-for="s in 4" :key="`s${s}`" class="pos m24-slot" :style="slotXY(s - 1)" aria-hidden="true" />
        <button
          v-for="(it, i) in st.items" :key="it.id" class="pos mc" :data-id="it.id" :style="slotXY(it.slot)"
          :class="{ on: st.a === i, hint: hl && (hl.i === i || hl.j === i), win: won && st.items.length === 1, in: popped.includes(it.id) }"
          :disabled="done" :aria-pressed="st.a === i" :aria-label="fmt(it.v)" @click="pickNum(i)"
        >
          <span class="mc-face">
            <span v-if="it.v[1] === 1" class="mc-n num">{{ fmt(it.v) }}</span>
            <span v-else class="mc-fr num"><i>{{ fmt([it.v[0], 1]) }}</i><i>{{ it.v[1] }}</i></span>
          </span>
        </button>
        <div v-for="g in ghosts" :key="`g${g.id}`" class="pos mc mc-ghost" :style="{ ...slotXY(g.slot), '--tx': g.to % 2, '--ty': Math.floor(g.to / 2) }" aria-hidden="true">
          <span class="mc-face">
            <span v-if="g.v[1] === 1" class="mc-n num">{{ fmt(g.v) }}</span>
            <span v-else class="mc-fr num"><i>{{ fmt([g.v[0], 1]) }}</i><i>{{ g.v[1] }}</i></span>
          </span>
        </div>
      </div>

      <div class="m24-ops" role="group" :aria-label="$t('puzzles.m24.ops')">
        <button
          v-for="o in OPS" :key="o" class="mo" :class="{ on: st.op === o, hint: hl?.op === o }"
          :disabled="done" :aria-pressed="st.op === o" :aria-label="$t(`puzzles.m24.op.${OPNAME[o]}`)" @click="pickOp(o)"
        >{{ SYM[o] }}</button>
      </div>

      <div class="m24-work">
        <b class="m24-wh">{{ $t('puzzles.m24.working') }}</b>
        <ol v-if="st.steps.length" class="mono">
          <li v-for="(s, k) in st.steps" :key="k" :class="{ last: won && k === st.steps.length - 1 }">{{ s }}</li>
        </ol>
        <p v-else-if="st.res && !won" class="mono m24-sol">{{ pretty(p.solution) }}</p>
      </div>

      <template #tools>
        <PuzzlesTool icon="undo-2" :label="$t('puzzles.m24.undo')" :class="{ 'm24-urge': dead }" :disabled="done || !st.stack.length" @click="undo" />
        <PuzzlesTool icon="rotate-ccw" :label="$t('puzzles.m24.reset')" :disabled="done || (!st.steps.length && st.a < 0 && !st.op)" @click="reset" />
        <PuzzlesTool icon="flag" :label="armed === 'give' ? $t('puzzles.m24.sure') : $t('puzzles.giveUp')" :class="{ 'm24-sure': armed === 'give' }" :disabled="done" @click="giveUp" />
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
.m24 { --mc-h: clamp(76px, 22vw, 108px); --gap: 10px; width: 100%; }
.m24-urge { border-color: var(--accent); color: var(--accent); }
.m24-sure { border-color: var(--bad); color: var(--bad); }

/* the four reserved slots: every card and ghost sits at a fixed spot and only ever moves by transform */
.m24-cards { position: relative; width: 100%; height: calc(var(--mc-h) * 2 + var(--gap)); }
.pos {
  position: absolute; left: 0; top: 0; width: calc((100% - var(--gap)) / 2); height: var(--mc-h); box-sizing: border-box;
  transform: translate(calc(var(--x) * (100% + var(--gap))), calc(var(--y) * (100% + var(--gap))));
}
.m24-slot { border: 1px dashed var(--line); border-radius: var(--radius); pointer-events: none; }
.mc { padding: 0; border: 0; background: none; color: var(--text); font: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.mc:disabled { cursor: default; opacity: 1; }
.mc-face {
  display: grid; place-items: center; width: 100%; height: 100%; box-sizing: border-box; border: 1px solid var(--line-2); border-radius: var(--radius); background: var(--panel-2);
  font-size: clamp(32px, 10vw, 46px); font-weight: 700;
  transition: border-color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
}
.mc:active:not(:disabled) .mc-face { transform: scale(.96); }
.mc:focus-visible, .mo:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.mc.on .mc-face { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.mc.hint .mc-face, .mo.hint { border-color: var(--warn); background: var(--warn-soft); color: var(--warn); }
.mc.win .mc-face { border-color: var(--ok); background: var(--ok-soft); color: var(--ok); }
.mc-fr { display: grid; justify-items: center; font-size: .72em; line-height: 1.15; }
.mc-fr i { font-style: normal; padding: 0 10px; }
.mc-fr i:first-child { border-bottom: 2px solid currentColor; padding-bottom: 1px; }
.mc-ghost { display: none; pointer-events: none; z-index: 1; }

.m24-ops { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; width: 100%; }
.mo { min-height: 52px; border: 1px solid var(--line-2); border-radius: var(--radius); background: var(--panel); color: var(--text); font: inherit; font-size: 26px; font-weight: 600; cursor: pointer; transition: border-color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
.mo:active:not(:disabled) { transform: scale(.94); }
.mo:disabled { cursor: default; opacity: .45; }
.mo.on { border-color: var(--accent); background: var(--accent); color: var(--bg); }


.m24-work { width: 100%; min-height: 92px; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel); }
.m24-wh { display: block; margin-bottom: 4px; font-size: 11.5px; font-weight: 600; color: var(--faint); text-transform: uppercase; letter-spacing: .04em; }
.m24-work ol { margin: 0; padding: 0; list-style: none; counter-reset: step; }
.m24-work li { counter-increment: step; display: flex; gap: 8px; padding: 2px 0; font-size: 14px; }
.m24-work li::before { content: counter(step); width: 1.2em; color: var(--faint); text-align: right; }
.m24-work li.last { color: var(--ok); font-weight: 600; }
.m24-sol { margin: 0; font-size: 14px; word-break: break-word; }

/* motion (transform + opacity): the two merged cards slide onto the result's slot and fade as the result pops in there */
@media (prefers-reduced-motion: no-preference) {
  .mc-ghost { display: block; animation: mc-merge 280ms var(--ease-out) both; }
  .mc.in .mc-face { animation: mc-in 280ms var(--ease-out) 120ms both; }
  .mc.win .mc-face { animation: mc-win 420ms var(--ease-out); }
}
@keyframes mc-merge {
  to { transform: translate(calc(var(--tx) * (100% + var(--gap))), calc(var(--ty) * (100% + var(--gap)))) scale(.72); opacity: 0; }
}
@keyframes mc-in { from { transform: scale(.6); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes mc-win { 40% { transform: scale(1.08); } }
</style>
