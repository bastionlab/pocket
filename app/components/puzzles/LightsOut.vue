<script setup lang="ts">
import { lightsPress, lightsPuzzle, lightsSolve, loSize } from '../../utils/puzzles/logic'
import { burst, flash, pulse } from '../../utils/puzzles/fx'
import { gameKey } from '../../utils/puzzles/registry'

/** Lights Out (4x4 easy, 5x5 medium, 6x6 hard): a press flips the cell and its four neighbours; switch every light off, ideally in the minimum moves */
const props = defineProps<{ day: string, level?: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
const VER = 2 // (unchanged by the levels: every level has its own save key)
type Res = PuzzleResult & { summary: string }
const level = ['easy', 'hard'].includes(props.level ?? '') ? props.level! : 'medium'
const key = gameKey('lights-out', level)
const LO = loSize(level)
const start = lightsPuzzle(key, props.day, LO)
const par = lightsSolve(start, LO)?.length ?? 0
// hint: the cell a bought hint points at (-1 none), kept so a reload does not lose it
const fresh = () => ({ v: 0, g: start.slice(), moves: 0, hist: [] as number[], hints: 0, hint: -1, res: null as Res | null })
const st = usePuzzleState(key, props.day, fresh)
if (st.v !== VER) Object.assign(st, fresh(), { v: VER })
useFinish(st, emit)
const done = computed(() => !!st.res)
const ending = ref(false)
const locked = computed(() => done.value || ending.value)
const last = ref(-1)
const lit = computed(() => st.g.filter(Boolean).length)

const near = (a: number, b: number) => a === b || (Math.abs((a % LO) - (b % LO)) + Math.abs(Math.floor(a / LO) - Math.floor(b / LO)) === 1)
const wait = (i: number) => (last.value < 0 || i === last.value ? 0 : near(last.value, i) ? 1 : 0)

const boardEl = ref<HTMLElement>()
const timers: ReturnType<typeof setTimeout>[] = []
const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }
onBeforeUnmount(() => timers.forEach(clearTimeout))
const cellEl = (i: number) => boardEl.value?.children[i] as HTMLElement | undefined

function result(): Res {
  return {
    solved: true, attempts: st.moves, score: st.moves,
    summary: t('puzzles.lights.sumSolved', { n: st.moves, par }),
    detail: { share: `${shareHead(level === 'medium' ? 'Lights Out' : `Lights Out ${LO}x${LO}`, props.day)}\n${st.moves} moves, minimum ${par}${st.hints ? `, ${st.hints} hints` : ''}` },
  }
}
/** every light is off: a ring of glows spreads out from the last press, then the result */
function win(from: number) {
  ending.value = true
  const r = result()
  navigator.vibrate?.([20, 40, 20])
  const d = (i: number) => Math.abs((i % LO) - (from % LO)) + Math.abs(Math.floor(i / LO) - Math.floor(from / LO))
  for (let i = 0; i < LO * LO; i++) later(() => { const e = cellEl(i); if (e) { pulse(e); flash(e, '--ok') } }, d(i) * 90)
  ;[0, 1].forEach(k => later(() => { const e = cellEl(Math.floor(LO * LO / 2)); if (e) burst(e, { color: '--ok', count: 14, spread: 70 }) }, 200 + k * 260))
  later(() => { st.res = r }, 950)
}
onMounted(() => { if (!st.res && !st.g.some(Boolean)) st.res = result() })

function press(i: number) {
  if (locked.value) return
  st.g = lightsPress(st.g, i, LO)
  st.moves++
  st.hist.push(i)
  last.value = i; st.hint = -1
  navigator.vibrate?.(8)
  const e = cellEl(i)
  if (e) pulse(e)
  if (!st.g.some(Boolean)) win(i)
}
function undo() {
  const i = st.hist.pop()
  if (i === undefined || locked.value) return
  st.g = lightsPress(st.g, i, LO)
  st.moves = Math.max(0, st.moves - 1)
  last.value = i; st.hint = -1
}
/** bought: points at the next press of a shortest solution from the board as it is now */
function hint() {
  if (locked.value) return
  const s = lightsSolve(st.g, LO)
  if (!s?.length) return
  st.hint = s[0]
  st.hints++
  const e = cellEl(s[0])
  if (e) flash(e, '--ok')
}
function restart() {
  if (locked.value) return
  st.g = start.slice(); st.moves = 0; st.hist = []
  last.value = -1; st.hint = -1
}
const msg = computed(() => {
  if (st.hint < 0 || locked.value) return ''
  const n = lightsSolve(st.g, LO)?.length
  return n ? t('puzzles.lights.left', { n }) : ''
})
onMounted(() => window.addEventListener('keydown', onUndoKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onUndoKey))
/** Ctrl/Cmd+Z or U anywhere on the page takes the last press back */
function onUndoKey(e: KeyboardEvent) {
  const tg = e.target as HTMLElement | null
  if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)) || e.altKey) return
  if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') || (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'u')) { undo(); e.preventDefault() }
}
function onKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement
  const i = Number(el.dataset.i)
  if (Number.isNaN(i)) return
  const d: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -LO, ArrowDown: LO }
  if (!(e.key in d)) return
  const to = i + d[e.key]
  if (to >= 0 && to < LO * LO && !(Math.abs(d[e.key]) === 1 && Math.floor(to / LO) !== Math.floor(i / LO))) (el.parentElement?.children[to] as HTMLElement | undefined)?.focus()
  e.preventDefault()
}
</script>

<template>
  <div class="lo" :class="{ won: done }" :style="{ '--n': LO }">
    <PuzzlesStage :stats="[{ label: $t('puzzles.lights.moves'), value: st.moves }, { label: $t('puzzles.lights.lit'), value: lit }, { label: $t('puzzles.lights.min'), value: par }]" :msg="msg" tone="ok">
      <template #actions>
        <PuzzlesHintButton :game="key" :day="day" :disabled="locked || !lit" @bought="hint" />
      </template>

      <div ref="boardEl" class="lo-board" role="group" :aria-label="$t('puzzles.grid.lightsBoard')" @keydown="onKey">
        <button
          v-for="(on, i) in st.g" :key="i" type="button" class="lo-cell" :class="{ on, hint: st.hint === i }" :style="{ '--dl': wait(i) }"
          :data-i="i" :aria-pressed="on" :aria-label="$t('puzzles.lights.cell', { r: Math.floor(i / LO) + 1, c: (i % LO) + 1, s: on ? $t('puzzles.lights.on') : $t('puzzles.lights.off') })" @click="press(i)"
        >
          <span class="lo-glow" /><span class="lo-disc" />
        </button>
      </div>

      <template #tools>
        <PuzzlesTool icon="undo-2" :label="$t('puzzles.sudoku.undo')" :disabled="locked || !st.hist.length" @click="undo" />
        <PuzzlesTool icon="rotate-ccw" :label="$t('puzzles.restart')" :disabled="locked || !st.moves" @click="restart" />
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
/* the frame (stats bar, tools, width) is <PuzzlesStage>; only the board is Lights Out's */
.lo { width: 100%; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }

.lo-board { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: clamp(6px, 2.4vw, 12px); width: 100%; padding: 6px; box-sizing: border-box; touch-action: manipulation; }
.lo-cell {
  position: relative; aspect-ratio: 1; min-width: 0; min-height: 0; padding: 0; border: 1px solid var(--line-2); border-radius: 50%;
  background: var(--panel-2); cursor: pointer; font: inherit; color: var(--accent);
}
.lo-disc, .lo-glow { position: absolute; border-radius: 50%; pointer-events: none; }
.lo-disc { inset: 9%; background: var(--accent); opacity: 0; transform: scale(.4); }
.lo-glow { inset: 0; box-shadow: 0 0 20px 5px color-mix(in srgb, var(--accent) 55%, transparent); opacity: 0; }
.lo-cell.on { border-color: var(--accent); }
.lo-cell.on .lo-disc { opacity: 1; transform: scale(1); }
.lo-cell.on .lo-glow { opacity: 1; }
.lo-cell.hint::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; border: 2px solid var(--ok); pointer-events: none; }
.lo-cell:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; }
.won .lo-cell { border-color: var(--ok); }

@media (prefers-reduced-motion: no-preference) {
  .lo-disc { transition: transform var(--dur) var(--ease-spring), opacity var(--dur) var(--ease-out); transition-delay: calc(var(--dl) * 55ms); }
  .lo-glow { transition: opacity var(--dur-slow) var(--ease-out); transition-delay: calc(var(--dl) * 55ms); }
  .lo-cell { transition: transform var(--dur-fast) var(--ease-out); }
  .lo-cell:active { transform: scale(.92); }
  .lo-cell.hint::after { animation: lo-hint 1.1s var(--ease-out) infinite; }
}
@keyframes lo-hint { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(1.06); } }
</style>
