<script setup lang="ts">
import { takuzuErrors, takuzuHintCell, takuzuOk, takuzuPuzzle, tzSpec } from '../../utils/puzzles/logic'
import { burst, pulse, shake } from '../../utils/puzzles/fx'
import { gameKey } from '../../utils/puzzles/registry'

/** Takuzu (6x6 easy, 8x8 medium, 10x10 hard): tap a cell to cycle empty, 0, 1; rule breaks light up live; row and column counters on the edges */
const props = defineProps<{ day: string, level?: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
const VER = 2 // (unchanged by the levels: every level has its own save key)
type Res = PuzzleResult & { summary: string }
const level = ['easy', 'hard'].includes(props.level ?? '') ? props.level! : 'medium'
const key = gameKey('takuzu', level)
const sp = tzSpec(level)
const TZ = sp.n
const p = takuzuPuzzle(key, props.day, TZ, sp.clues)
const SIZE = TZ * TZ, HALF = TZ / 2
// hist: one entry per move, [cell, value before]; hinted cells are settled for good
const fresh = () => ({ v: 0, vals: p.puzzle.slice(), sel: -1, hist: [] as [number, number][][], hints: 0, hinted: [] as number[], sec: 0, res: null as Res | null })
const st = usePuzzleState(key, props.day, fresh)
if (st.v !== VER) Object.assign(st, fresh(), { v: VER })
useFinish(st, emit)
const time = useTimer(st)
const done = computed(() => !!st.res)
const ending = ref(false)
const locked = computed(() => done.value || ending.value)
const bad = computed(() => takuzuErrors(st.vals, TZ))
const given = (i: number) => p.puzzle[i] >= 0
const fixed = (i: number) => given(i) || st.hinted.includes(i)
const rowOf = (i: number) => Math.floor(i / TZ)
const colOf = (i: number) => i % TZ
const canHint = computed(() => !locked.value && st.vals.some((v, i) => v !== p.solution[i]))
/** [zeros, ones] per row and per column */
const rowCount = computed(() => Array.from({ length: TZ }, (_, r) => [0, 1].map(v => st.vals.slice(r * TZ, r * TZ + TZ).filter(x => x === v).length)))
const colCount = computed(() => Array.from({ length: TZ }, (_, c) => [0, 1].map(v => st.vals.filter((x, i) => colOf(i) === c && x === v).length)))
const msg = computed(() => (bad.value.size ? t('puzzles.grid.tzClash') : t('puzzles.takuzu.counts')))
const tone = (n: number) => (n > HALF ? 'bad' : n === HALF ? 'ok' : '')

const gridEl = ref<HTMLElement>()
const timers: ReturnType<typeof setTimeout>[] = []
const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }
onBeforeUnmount(() => timers.forEach(clearTimeout))
const cellEl = (i: number) => gridEl.value?.children[i] as HTMLElement | undefined
const lineOf = (isRow: boolean, k: number) => Array.from({ length: TZ }, (_, j) => (isRow ? k * TZ + j : j * TZ + k))
const lineRight = (cells: number[]) => cells.every(i => st.vals[i] === p.solution[i])
const rowRight = computed(() => Array.from({ length: TZ }, (_, r) => lineRight(lineOf(true, r))))
const colRight = computed(() => Array.from({ length: TZ }, (_, c) => lineRight(lineOf(false, c))))
/** a finished line ripples from its first cell to its last */
function waveLine(cells: number[]) {
  cells.forEach((c, n) => later(() => { const e = cellEl(c); if (e) pulse(e) }, n * 38))
  later(() => { const e = cellEl(cells[cells.length - 1]); if (e) burst(e, { color: '--ok', count: 8, spread: 40 }) }, cells.length * 38)
}
watch(rowRight, (now, old) => { if (!ending.value) now.forEach((v, r) => { if (v && !old[r]) waveLine(lineOf(true, r)) }) })
watch(colRight, (now, old) => { if (!ending.value) now.forEach((v, c) => { if (v && !old[c]) waveLine(lineOf(false, c)) }) })
// a cell that starts breaking a rule shakes
watch(bad, (now, old) => { now.forEach((i) => { if (!old.has(i)) { const e = cellEl(i); if (e) shake(e) } }) })

function result(): Res {
  return {
    solved: true, attempts: Math.max(1, Math.ceil(st.sec / 60)), score: st.sec,
    summary: t('puzzles.takuzu.sumSolved', { time: time.value, h: st.hints }),
    detail: { share: `${shareHead(level === 'medium' ? 'Takuzu' : `Takuzu ${TZ}x${TZ}`, props.day)}\n${time.value}${st.hints ? `, ${st.hints} hints` : ''}` },
  }
}
function win() {
  if (ending.value || st.res) return
  ending.value = true
  const r = result()
  navigator.vibrate?.([20, 40, 20])
  Array.from({ length: SIZE }, (_, i) => i).forEach(i => later(() => { const e = cellEl(i); if (e) pulse(e) }, (rowOf(i) + colOf(i)) * 45))
  ;[0, 1, 2].forEach(k => later(() => { const e = cellEl(Math.floor(SIZE * (0.2 + k * 0.3))); if (e) burst(e, { color: '--ok', count: 12, spread: 56 }) }, 150 + k * 220))
  later(() => { st.res = r }, 900)
}
function check() {
  if (st.res || st.vals.includes(-1) || !takuzuOk(st.vals, TZ) || bad.value.size) return
  win()
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  if (!st.res && !st.vals.includes(-1) && takuzuOk(st.vals, TZ) && !bad.value.size) st.res = result()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function set(i: number, v: number) {
  if (locked.value || fixed(i) || st.vals[i] === v) return
  st.hist.push([[i, st.vals[i]]])
  if (st.hist.length > 200) st.hist.shift()
  st.vals[i] = v
  navigator.vibrate?.(8)
  check()
}
function tap(i: number) {
  st.sel = i
  if (!fixed(i)) set(i, st.vals[i] === -1 ? 0 : st.vals[i] === 0 ? 1 : -1)
}
function undo() {
  const s = st.hist.pop()
  if (!s || locked.value) return
  for (let k = s.length - 1; k >= 0; k--) st.vals[s[k][0]] = s[k][1]
  st.sel = s[0][0]
}
/** bought: fills a cell the plain rules force (the selected one first), settled for good */
function hint() {
  if (locked.value) return
  const i = takuzuHintCell(st.vals, p.solution, st.sel, TZ)
  if (i < 0) return
  st.hist.push([[i, st.vals[i]]])
  st.vals[i] = p.solution[i]
  st.sel = i; st.hints++
  if (!st.hinted.includes(i)) st.hinted.push(i)
  navigator.vibrate?.(10)
  const e = cellEl(i)
  if (e) burst(e, { color: '--ok', count: 8, spread: 36 })
  check()
}
/** clears every entry as one undoable step, so no confirm is needed */
function clear() {
  if (locked.value) return
  const s = st.vals.map((v, i) => [i, v] as [number, number]).filter(([i, v]) => !fixed(i) && v >= 0)
  if (!s.length) return
  st.hist.push(s)
  s.forEach(([i]) => { st.vals[i] = -1 })
}
const empties = computed(() => st.vals.some((v, i) => !fixed(i) && v >= 0))

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
  if (e.altKey) return
  if (e.ctrlKey || e.metaKey) { if (e.key.toLowerCase() === 'z') { undo(); e.preventDefault() } return }
  const k = e.key
  if (k === '0' || k === '1') { if (st.sel >= 0) set(st.sel, +k) }
  else if (k === 'Backspace' || k === 'Delete') { if (st.sel >= 0) set(st.sel, -1) }
  else if (k === 'u' || k === 'U') undo()
  else if (k.startsWith('Arrow')) {
    const dx = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0, dy = k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0
    if (st.sel < 0) st.sel = 0
    else {
      const x = colOf(st.sel) + dx, y = rowOf(st.sel) + dy
      if (x >= 0 && x < TZ && y >= 0 && y < TZ) st.sel = y * TZ + x
    }
    e.preventDefault()
  } else return
}

const state = (v: number) => (v < 0 ? 'puzzles.takuzu.empty' : `puzzles.takuzu.v${v}`)
</script>

<template>
  <div class="tz" :class="{ won: done, big: TZ > 8 }" :style="{ '--n': TZ }">
    <PuzzlesStage :stats="[{ label: $t('puzzles.grid.time'), value: time }]" :msg="msg" :tone="bad.size ? 'bad' : undefined">
      <template #actions>
        <PuzzlesHintButton :game="key" :day="day" :disabled="!canHint" @bought="hint" />
      </template>

      <div class="tz-wrap">
        <div ref="gridEl" class="tz-grid" role="group" :aria-label="$t('puzzles.grid.takuzuBoard')">
          <button
            v-for="(v, i) in st.vals" :key="i" type="button" class="tz-cell"
            :class="{ given: given(i), z: v === 0, o: v === 1, bad: bad.has(i), sel: st.sel === i, hint: st.hinted.includes(i) && v === p.solution[i] && !given(i) }"
            :aria-disabled="fixed(i)"
            :aria-label="$t('puzzles.takuzu.cell', { r: rowOf(i) + 1, c: colOf(i) + 1, s: $t(state(v)) })" @click="tap(i)"
          >{{ v >= 0 ? v : '' }}</button>
        </div>
        <div class="tz-rows" aria-hidden="true">
          <div v-for="(c, r) in rowCount" :key="r" class="tz-cnt"><span :class="tone(c[0])">{{ c[0] }}</span><span :class="tone(c[1])">{{ c[1] }}</span></div>
        </div>
        <div class="tz-cols" aria-hidden="true">
          <div v-for="(c, x) in colCount" :key="x" class="tz-cnt"><span :class="tone(c[0])">{{ c[0] }}</span><span :class="tone(c[1])">{{ c[1] }}</span></div>
        </div>
      </div>

      <template #tools>
        <PuzzlesTool icon="undo-2" :label="$t('puzzles.sudoku.undo')" :disabled="locked || !st.hist.length" @click="undo" />
        <PuzzlesTool icon="rotate-ccw" :label="$t('puzzles.clear')" :disabled="locked || !empties" @click="clear" />
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
/* the frame (stats bar, tools, width) is <PuzzlesStage>; the grid with its edge counters is Takuzu's */
.tz {
  --gap: 4px; --cw: 30px;
  container-type: inline-size; width: 100%;
  user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
}
/* 10x10: tighter gaps so the cells stay as large as they can on a phone */
.tz.big { --gap: 3px; }

.tz-wrap {
  --cell: calc((100cqw - var(--cw) - var(--n) * var(--gap)) / var(--n));
  display: grid; grid-template-columns: auto var(--cw); gap: var(--gap); justify-content: center; align-items: start;
}
.tz-grid { display: grid; grid-template-columns: repeat(var(--n), var(--cell)); grid-auto-rows: var(--cell); gap: var(--gap); touch-action: manipulation; }
.tz-cell {
  min-width: 0; min-height: 0; padding: 0; display: grid; place-items: center; border: 1px solid var(--line-2); border-radius: 8px;
  background: var(--panel-2); color: var(--text); font: inherit; font-size: min(calc(var(--cell) * .46), 30px); font-weight: 600; line-height: 1; cursor: pointer;
}
.tz-cell.o { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.tz-cell.given { background: var(--track); border-color: var(--line-2); color: var(--text); font-weight: 800; cursor: default; }
.tz-cell.given.o { background: color-mix(in srgb, var(--accent) 28%, var(--track)); border-color: var(--accent); color: var(--text); }
.tz-cell.hint { color: var(--ok); border-color: var(--ok); }
.tz-cell.bad { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }
.tz-cell.sel { box-shadow: 0 0 0 2px var(--accent); z-index: 1; }
.tz-cell:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.tz-rows { display: grid; grid-auto-rows: var(--cell); gap: var(--gap); }
.tz-cols { display: grid; grid-template-columns: repeat(var(--n), var(--cell)); gap: var(--gap); }
.tz-cnt { display: flex; align-items: center; justify-content: center; gap: 5px; font-size: 12px; font-variant-numeric: tabular-nums; color: var(--muted); }
.tz-rows .tz-cnt { flex-direction: column; gap: 1px; }
.tz-cols .tz-cnt { height: 22px; }
.tz-cnt .ok { color: var(--ok); }
.tz-cnt .bad { color: var(--bad); font-weight: 700; }

@media (hover: hover) {
  .tz-cell:not(.given):hover { border-color: var(--accent); }
}
@media (prefers-reduced-motion: no-preference) {
  .tz-cell:not(.given) { transition: transform var(--dur-fast) var(--ease-out); }
  .tz-cell:not(.given):active { transform: scale(.93); }
}
</style>
