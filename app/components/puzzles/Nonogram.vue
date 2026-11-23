<script setup lang="ts">
import { ngClue, ngCols, ngRows, ngSameClue, ngSize, ngSolved, nonogramPuzzle } from '../../utils/puzzles/logic'
import { burst, flash, pulse } from '../../utils/puzzles/fx'
import { gameKey } from '../../utils/puzzles/registry'

/** Nonogram (5x5 easy, 8x8 medium, 10x10 hard): row and column clues, drag across cells to paint a line, Fill / Cross tool, undo, bought hints */
const props = defineProps<{ day: string, level?: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
const VER = 3 // saved boards from the single-size version (10x10) are dropped
const NG = ngSize(props.level)
const key = gameKey('nonogram', props.level)
type Res = PuzzleResult & { summary: string }
const target = nonogramPuzzle(key, props.day, NG)
const rowClues = ngRows(target, NG).map(ngClue), colClues = ngCols(target, NG).map(ngClue)
const total = target.filter(Boolean).length
const maxRow = Math.max(...rowClues.map(c => c.length)), maxCol = Math.max(...colClues.map(c => c.length))
// cells: 0 empty, 1 filled, 2 crossed out. hist: strokes as [cell, value before]. hinted: cells a bought hint settled (locked)
const fresh = () => ({ v: 0, cells: Array.from({ length: NG * NG }, () => 0), mark: false, hist: [] as [number, number][][], hints: 0, hinted: [] as number[], sec: 0, res: null as Res | null })
const st = usePuzzleState(key, props.day, fresh)
if (st.v !== VER) Object.assign(st, fresh(), { v: VER })
useFinish(st, emit)
const time = useTimer(st)
const done = computed(() => !!st.res)
const ending = ref(false)
const locked = computed(() => done.value || ending.value)
const filled = computed(() => st.cells.map(c => c === 1))
const filledCount = computed(() => st.cells.filter(c => c === 1).length)
// which lines already match their clue (those clues fade and turn green)
const rowDone = computed(() => ngRows(filled.value, NG).map((l, r) => ngSameClue(ngClue(l), rowClues[r])))
const colDone = computed(() => ngCols(filled.value, NG).map((l, c) => ngSameClue(ngClue(l), colClues[c])))
/** cells a hint could still settle: a filled cell that is missing, or a filled one that must stay empty */
const mismatch = (i: number) => (target[i] ? st.cells[i] !== 1 : st.cells[i] === 1)
const canHint = computed(() => !locked.value && st.cells.some((_, i) => mismatch(i)))

const cellsEl = ref<HTMLElement>()
const rowsEl = ref<HTMLElement>()
const colsEl = ref<HTMLElement>()
const timers: ReturnType<typeof setTimeout>[] = []
const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }
onBeforeUnmount(() => timers.forEach(clearTimeout))
const cellEl = (i: number) => cellsEl.value?.children[i] as HTMLElement | undefined
const lineCells = (isRow: boolean, k: number) => Array.from({ length: NG }, (_, j) => (isRow ? k * NG + j : j * NG + k))
/** a finished line ripples from its first cell to its last */
function waveLine(isRow: boolean, k: number) {
  lineCells(isRow, k).forEach((c, n) => later(() => { const e = cellEl(c); if (e) pulse(e) }, n * 32))
}
watch(rowDone, (now, old) => now.forEach((v, r) => { if (v && !old[r]) waveLine(true, r) }))
watch(colDone, (now, old) => now.forEach((v, c) => { if (v && !old[c]) waveLine(false, c) }))
/** a line holding exactly as many filled cells as its clue adds up to, but not in the right places: its clue flashes red */
function checkWrong(stroke: [number, number][]) {
  const rows = new Set(stroke.map(([i]) => Math.floor(i / NG))), cols = new Set(stroke.map(([i]) => i % NG))
  const sum = (c: number[]) => (c[0] === 0 ? 0 : c.reduce((a, b) => a + b, 0))
  for (const r of rows) {
    const l = ngRows(filled.value, NG)[r]
    if (l.filter(Boolean).length === sum(rowClues[r]) && !ngSameClue(ngClue(l), rowClues[r])) { const e = rowsEl.value?.children[r] as HTMLElement | undefined; if (e) flash(e, '--bad') }
  }
  for (const c of cols) {
    const l = ngCols(filled.value, NG)[c]
    if (l.filter(Boolean).length === sum(colClues[c]) && !ngSameClue(ngClue(l), colClues[c])) { const e = colsEl.value?.children[c] as HTMLElement | undefined; if (e) flash(e, '--bad') }
  }
}
function result(): Res {
  return {
    solved: true, attempts: Math.max(1, Math.ceil(st.sec / 60)), score: st.sec,
    summary: t('puzzles.nono.sumSolved', { time: time.value, h: st.hints }),
    detail: { share: `${shareHead('Nonogram', props.day)}\n${time.value}${st.hints ? `, ${st.hints} hints` : ''}` },
  }
}
/** the picture is right: a diagonal wave over the filled cells, then the result */
function win() {
  ending.value = true
  const r = result()
  navigator.vibrate?.([20, 40, 20])
  st.cells.forEach((c, i) => { if (c === 1) later(() => { const e = cellEl(i); if (e) pulse(e) }, ((i % NG) + Math.floor(i / NG)) * 40) })
  ;[0, 1, 2].forEach(k => later(() => { const e = cellEl(st.cells.findIndex((c, i) => c === 1 && i >= NG * NG * (0.2 + k * 0.28))); if (e) burst(e, { color: '--ok', count: 12, spread: 56 }) }, 150 + k * 220))
  later(() => { st.res = r }, 950)
}
onMounted(() => { if (!st.res && ngSolved(filled.value, target, NG)) st.res = result() })

let drag: { want: number, val: number, sr: number, sc: number, axis: '' | 'row' | 'col', last: number, stroke: [number, number][], id: number } | null = null
const cur = ref(-1)

function paint(i: number) {
  if (!drag || st.hinted.includes(i)) return
  const old = st.cells[i]
  if (drag.val === 0 ? old === drag.want : (old === 0 || (drag.stroke.length === 0 && old !== drag.want))) {
    drag.stroke.push([i, old])
    st.cells[i] = drag.val
    navigator.vibrate?.(5)
  }
}
function begin(tool: number, i: number, id = -1) {
  if (locked.value) return
  drag = { want: tool, val: st.cells[i] === tool ? 0 : tool, sr: Math.floor(i / NG), sc: i % NG, axis: '', last: i, stroke: [], id }
  paint(i)
}
function end() {
  const d = drag
  drag = null
  if (!d) return
  if (d.stroke.length) {
    st.hist.push(d.stroke)
    if (st.hist.length > 120) st.hist.shift()
    if (ngSolved(filled.value, target, NG)) win()
    else checkWrong(d.stroke)
  }
}
function at(e: PointerEvent): number {
  const r = cellsEl.value?.getBoundingClientRect()
  if (!r) return -1
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
  if (x < 0 || y < 0 || x >= 1 || y >= 1) return -1
  return Math.floor(y * NG) * NG + Math.floor(x * NG)
}
function down(e: PointerEvent) {
  const i = at(e)
  if (i < 0 || (e.pointerType === 'mouse' && e.button > 2)) return
  e.preventDefault()
  // right mouse button uses the other tool
  const tool = (e.pointerType === 'mouse' && e.button === 2) !== st.mark ? 2 : 1
  begin(tool, i, e.pointerId)
  cur.value = i
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}
function move(e: PointerEvent) {
  let i = at(e)
  if (e.pointerType === 'mouse' || drag) cur.value = i
  if (!drag || i < 0 || i === drag.last) return
  let r = Math.floor(i / NG), c = i % NG
  if (!drag.axis) {
    if (r === drag.sr && c !== drag.sc) drag.axis = 'row'
    else if (c === drag.sc && r !== drag.sr) drag.axis = 'col'
    else if (r !== drag.sr && c !== drag.sc) drag.axis = Math.abs(c - drag.sc) >= Math.abs(r - drag.sr) ? 'row' : 'col'
  }
  if (drag.axis === 'row') r = drag.sr
  else if (drag.axis === 'col') c = drag.sc
  i = r * NG + c
  // a fast drag can skip cells: walk along the line
  const step = drag.axis === 'row' ? Math.sign(c - (drag.last % NG)) : Math.sign(r - Math.floor(drag.last / NG)) * NG
  if (!step) return
  for (let k = drag.last + step; ; k += step) {
    paint(k)
    if (k === i) break
  }
  drag.last = i
}
function up() { end(); cur.value = -1 }
function leave(e: PointerEvent) { if (e.pointerType === 'mouse' && !drag) cur.value = -1 }
/** keyboard: Enter / Space uses the tool, X crosses */
function click(e: MouseEvent, i: number) {
  if (e.detail !== 0) return
  begin(st.mark ? 2 : 1, i); end()
}
function onKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement
  const i = Number(el.dataset.i)
  if (Number.isNaN(i)) return
  if (e.key === 'x' || e.key === 'X') { begin(2, i); end(); e.preventDefault(); return }
  const d: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -NG, ArrowDown: NG }
  if (!(e.key in d)) return
  const to = i + d[e.key]
  if (to >= 0 && to < NG * NG && !(Math.abs(d[e.key]) === 1 && Math.floor(to / NG) !== Math.floor(i / NG))) (el.parentElement?.children[to] as HTMLElement | undefined)?.focus()
  e.preventDefault()
}

onMounted(() => window.addEventListener('keydown', onUndoKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onUndoKey))
/** Ctrl/Cmd+Z or U anywhere on the page undoes the last stroke */
function onUndoKey(e: KeyboardEvent) {
  const tg = e.target as HTMLElement | null
  if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)) || e.altKey) return
  if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') || (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'u')) { undo(); e.preventDefault() }
}
function undo() {
  const s = st.hist.pop()
  if (!s || locked.value) return
  for (let k = s.length - 1; k >= 0; k--) st.cells[s[k][0]] = s[k][1]
}
/** clears the board as one undoable step, so no confirm is needed (hinted cells stay) */
function reset() {
  if (locked.value) return
  const s = st.cells.map((v, i) => [i, v] as [number, number]).filter(x => x[1] && !st.hinted.includes(x[0]))
  if (!s.length) return
  st.hist.push(s)
  s.forEach(([i]) => { st.cells[i] = 0 })
}
/** bought: settles one cell for good (the one whose lines are closest to done), a missing fill or a wrong one cleared */
function hint() {
  if (locked.value) return
  const rowLeft = (r: number) => lineCells(true, r).filter(mismatch).length
  const colLeft = (c: number) => lineCells(false, c).filter(mismatch).length
  const open = st.cells.map((_, i) => i).filter(mismatch)
  if (!open.length) return
  const i = open.reduce((best, k) => (rowLeft(Math.floor(k / NG)) + colLeft(k % NG) < rowLeft(Math.floor(best / NG)) + colLeft(best % NG) ? k : best))
  st.cells[i] = target[i] ? 1 : 2
  st.hinted.push(i); st.hints++
  navigator.vibrate?.(10)
  const e = cellEl(i)
  if (e) burst(e, { color: '--ok', count: 8, spread: 36 })
  if (ngSolved(filled.value, target, NG)) win()
}
</script>

<template>
  <div class="ng" :class="{ won: done }" :style="{ '--n': NG, '--rc': maxRow, '--cc': maxCol }">
    <PuzzlesStage :stats="[{ label: $t('puzzles.grid.time'), value: time }, { label: $t('puzzles.grid.filled'), value: `${filledCount}/${total}`, tone: filledCount > total ? 'warn' : undefined }]">
      <template #actions>
        <PuzzlesHintButton :game="key" :day="day" :disabled="!canHint" @bought="hint" />
      </template>

      <div class="ng-grid">
        <span />
        <div ref="colsEl" class="ng-cols">
          <div v-for="(c, x) in colClues" :key="x" class="ng-clue col" :class="{ ok: colDone[x], hl: cur >= 0 && cur % NG === x }"><b v-for="(n, k) in c" :key="k">{{ n }}</b></div>
        </div>
        <div ref="rowsEl" class="ng-rows">
          <div v-for="(c, y) in rowClues" :key="y" class="ng-clue row" :class="{ ok: rowDone[y], hl: cur >= 0 && Math.floor(cur / NG) === y }"><b v-for="(n, k) in c" :key="k">{{ n }}</b></div>
        </div>
        <div
          ref="cellsEl" class="ng-cells" role="group" :aria-label="$t('puzzles.grid.nonogramBoard')" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @pointerleave="leave" @contextmenu.prevent @keydown="onKey"
        >
          <button
            v-for="(c, i) in st.cells" :key="i" type="button" class="ng-cell"
            :class="{ on: c === 1, x: c === 2, locked: st.hinted.includes(i), g5r: NG >= 10 && i % NG % 5 === 4 && i % NG < NG - 1, g5b: NG >= 10 && Math.floor(i / NG) % 5 === 4 && Math.floor(i / NG) < NG - 1, hl: cur >= 0 && (cur % NG === i % NG || Math.floor(cur / NG) === Math.floor(i / NG)) }"
            :data-i="i" :aria-label="$t('puzzles.nono.cell', { r: Math.floor(i / NG) + 1, c: (i % NG) + 1, s: c === 1 ? $t('puzzles.nono.filled') : c === 2 ? $t('puzzles.nono.crossed') : $t('puzzles.nono.empty') })" @click="click($event, i)"
          >
            <Icon v-if="c === 2" name="x" :size="14" />
          </button>
        </div>
      </div>

      <template #tools>
        <PuzzlesTool icon="x" :label="$t('puzzles.nono.mark')" :on="st.mark" :disabled="locked" @click="st.mark = !st.mark" />
        <PuzzlesTool icon="undo-2" :label="$t('puzzles.nono.undo')" :disabled="locked || !st.hist.length" @click="undo" />
        <PuzzlesTool icon="rotate-ccw" :label="$t('puzzles.clear')" :disabled="locked || !st.cells.some((c, i) => c && !st.hinted.includes(i))" @click="reset" />
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
/* the frame (stats bar, tools, width) is <PuzzlesStage>; the clues and the grid are Nonogram's. The clue size grows with the board
   (--u), the cells take whatever width is left, so a long clue never squashes the grid */
.ng {
  --gap: 2px;
  container-type: inline-size; width: 100%;
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
}

.ng-grid {
  --u: clamp(13px, 3.3cqw, 19px);
  --cell: calc((100cqw - var(--rc) * var(--u) - 6px - var(--n) * var(--gap)) / var(--n));
  display: grid; grid-template-columns: auto auto; gap: var(--gap); justify-content: center; align-items: start;
}
.ng-cols { display: grid; grid-template-columns: repeat(var(--n), var(--cell)); gap: var(--gap); min-height: calc(var(--cc) * var(--u)); }
.ng-rows { display: grid; grid-template-rows: repeat(var(--n), var(--cell)); gap: var(--gap); min-width: calc(var(--rc) * var(--u)); }
.ng-clue { display: flex; font-size: calc(var(--u) * .92); line-height: var(--u); color: var(--text); font-variant-numeric: tabular-nums; border-radius: 4px; }
.ng-clue b { min-width: var(--u); text-align: center; font-weight: 600; }
.ng-clue.col { flex-direction: column; justify-content: flex-end; align-items: center; padding-bottom: 3px; }
.ng-clue.row { flex-direction: row; justify-content: flex-end; align-items: center; padding-right: 5px; }
.ng-clue.hl { background: color-mix(in srgb, var(--accent) 10%, transparent); }
.ng-clue.ok { color: var(--ok); }
.ng-clue.ok b { opacity: .45; }

.ng-cells { display: grid; grid-template-columns: repeat(var(--n), var(--cell)); grid-auto-rows: var(--cell); gap: var(--gap); touch-action: none; }
.ng-cell {
  min-width: 0; min-height: 0; padding: 0; display: grid; place-items: center; border: 1px solid var(--line-2); border-radius: 5px;
  background: var(--panel-2); color: var(--muted); font: inherit; cursor: pointer; touch-action: none;
}
.ng-cell.g5r { border-right-color: var(--muted); }
.ng-cell.g5b { border-bottom-color: var(--muted); }
.ng-cell.hl { border-color: color-mix(in srgb, var(--accent) 45%, var(--line-2)); }
.ng-cell.on { background: var(--accent); border-color: var(--accent); }
.ng-cell.x { background: transparent; }
.ng-cell.locked { box-shadow: inset 0 0 0 2px var(--ok); }
.ng-cell:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.won .ng-cell.on { background: var(--ok); border-color: var(--ok); }
.won .ng-cell.x { opacity: 0; }
.won .ng-cell:not(.on):not(.x) { opacity: .5; }

@media (prefers-reduced-motion: no-preference) {
  .ng-cell { transition: opacity var(--dur) var(--ease-out); }
  .ng-cell.on { animation: ng-pop 140ms var(--ease-out); }
  .ng-clue b { transition: opacity var(--dur) var(--ease-out); }
}
@keyframes ng-pop { from { transform: scale(.8); } to { transform: scale(1); } }
</style>
