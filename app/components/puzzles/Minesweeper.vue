<script setup lang="ts">
import { msBoard, msHint, msNeighbors, msSpec } from '../../utils/puzzles/logic'
import { burst, pulse, shake } from '../../utils/puzzles/fx'
import { gameKey } from '../../utils/puzzles/registry'

/** Minesweeper: tap digs, long-press or right-click flags, tap a satisfied number to chord; the day's board is fixed and fair (solvable without a guess from the opening shown at the start) */
const props = defineProps<{ day: string, level?: string }>()
const { t } = usePuzzleI18n()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
// levels: easy 9x9 / 10 mines, medium 12x12 / 24, hard 12x20 / 50 (tall rather than wide, so it fits a phone)
const sp = msSpec(props.level)
const key = gameKey('minesweeper', props.level)
const N = sp.w * sp.h
const VER = 4 // v4: the board no longer depends on the first click (fixed fair layout + pre-opened start); older saves are dropped
type Res = PuzzleResult & { summary: string }
// the layout is a function of (game, day) alone, with a no-guess check (msBoard); the opening is open from the start
const board = msBoard(key, props.day, sp)
const mines = board.mines, counts = board.counts
function opening() {
  const open = Array.from({ length: N }, () => 0), q = [board.start]
  while (q.length) {
    const c = q.pop()!
    if (open[c]) continue
    open[c] = 1
    if (!counts[c]) for (const n of msNeighbors(c, sp)) if (!open[n]) q.push(n)
  }
  return open
}
// open: 0 closed, 1 open, 2 flagged. first = the first dig / hint (starts the clock), -1 before
const fresh = () => ({ v: 0, first: -1, open: opening(), flag: false, sec: 0, hit: -1, hints: 0, res: null as Res | null })
const st = usePuzzleState(key, props.day, fresh)
if (st.v !== VER) Object.assign(st, fresh(), { v: VER })
useFinish(st, emit)
const clock = useTimer(st)
const time = computed(() => (st.first >= 0 ? clock.value : '0:00'))
const flags = computed(() => st.open.filter(o => o === 2).length)
const lost = computed(() => !!st.res && !st.res.solved)
const won = computed(() => !!st.res && st.res.solved)
const ending = ref(false) // the explosion / win animation is playing: input is locked
const locked = computed(() => !!st.res || ending.value)
/** the other mines that already popped during the explosion (all of them once the game is lost) */
const popped = ref<number[]>([])
const showMine = (i: number) => !!mines[i] && st.open[i] !== 2 && st.hit !== i && (lost.value || popped.value.includes(i))
/** cascade order of the cells opened by the last dig (animation only, never saved) */
const fresher = ref<Record<number, number>>({})
let freshTimer: ReturnType<typeof setTimeout> | undefined

// tall boards (hard, 12 x 20) lie on their side on wider screens so they fill the play column; only the drawing turns, cell numbers stay
const wide = ref(false)
const tr = computed(() => wide.value && sp.h > sp.w)
const cols = computed(() => (tr.value ? sp.h : sp.w)), rows = computed(() => (tr.value ? sp.w : sp.h))
const place = (i: number) => (tr.value ? { gridColumn: Math.floor(i / sp.w) + 1, gridRow: (i % sp.w) + 1 } : {})
let mq: MediaQueryList | undefined
const onMq = () => { wide.value = !!mq?.matches }
onMounted(() => { mq = window.matchMedia('(min-width: 641px)'); onMq(); mq.addEventListener('change', onMq) })
onBeforeUnmount(() => mq?.removeEventListener('change', onMq))
const left = computed(() => sp.mines - flags.value)
const note = ref('') // the hint's reason, until the next move
const hintAt = ref(-1)
const msg = computed(() => (lost.value ? t('puzzles.mines.boom') : note.value || (st.first < 0 ? t('puzzles.mines.fair') : '')))

const boardEl = ref<HTMLElement>()
const timers: ReturnType<typeof setTimeout>[] = []
const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }
onBeforeUnmount(() => { timers.forEach(clearTimeout); clearTimeout(freshTimer) })
const cellEl = (i: number) => boardEl.value?.children[i] as HTMLElement | undefined
const dist = (a: number, b: number) => Math.max(Math.abs((a % sp.w) - (b % sp.w)), Math.abs(Math.floor(a / sp.w) - Math.floor(b / sp.w)))

const mm = () => `${Math.floor(st.sec / 60)}:${String(st.sec % 60).padStart(2, '0')}`
const cleared = () => st.open.filter(o => o === 1).length
function result(solved: boolean): Res {
  return {
    solved, attempts: Math.max(1, Math.ceil(st.sec / 60)), score: solved ? st.sec : 0,
    summary: solved ? t('puzzles.mines.sumSolved', { time: mm(), h: st.hints }) : t('puzzles.mines.sumFailed', { n: cleared(), total: N - sp.mines }),
    detail: { share: solved ? `${shareHead('Minesweeper', props.day)}\n${mm()}${st.hints ? `, ${st.hints} hints` : ''}` : `${shareHead('Minesweeper', props.day, 'X')}\n${cleared()} of ${N - sp.mines} cleared` },
  }
}
onMounted(() => {
  // reloaded in the middle of an animation: finish at once
  if (!st.res && st.hit >= 0) st.res = result(false)
  else if (!st.res && cleared() === N - sp.mines) st.res = result(true)
})

function reveal(i: number) {
  const depth: Record<number, number> = { [i]: 0 }
  const q = [i]
  while (q.length) {
    const c = q.shift()!
    if (st.open[c] === 1 || st.open[c] === 2 || mines[c]) continue
    st.open[c] = 1
    if (!counts[c]) for (const n of msNeighbors(c, sp)) if (st.open[n] === 0 && depth[n] === undefined) { depth[n] = depth[c] + 1; q.push(n) }
  }
  fresher.value = depth
  clearTimeout(freshTimer)
  freshTimer = setTimeout(() => { fresher.value = {} }, 900)
}
/** the mine you hit goes off, the board shakes, then the other mines pop one after another */
function explode(i: number) {
  ending.value = true
  navigator.vibrate?.([30, 40, 60])
  const e = cellEl(i)
  if (e) burst(e, { color: '--bad', count: 26, spread: 96 })
  if (boardEl.value) shake(boardEl.value)
  const rest = mines.map((m, k) => (m && k !== i && st.open[k] !== 2 ? k : -1)).filter(k => k >= 0).sort((a, b) => dist(a, i) - dist(b, i))
  const gap = Math.min(110, 900 / Math.max(1, rest.length))
  rest.forEach((k, n) => later(() => {
    popped.value.push(k)
    const c = cellEl(k)
    if (c) burst(c, { color: '--bad', count: 8, spread: 40 })
    navigator.vibrate?.(6)
  }, 320 + n * gap))
  later(() => { st.res = result(false) }, 320 + rest.length * gap + 380)
}
/** all safe cells are open: a ripple across the board from the last cell, then the result */
function win(from: number) {
  ending.value = true
  mines.forEach((m, k) => { if (m) st.open[k] = 2 })
  navigator.vibrate?.([20, 40, 20])
  const r = result(true)
  for (let k = 0; k < N; k++) later(() => { const c = cellEl(k); if (c) pulse(c) }, dist(k, from) * 55)
  ;[0, 1, 2].forEach(k => later(() => { const c = cellEl(Math.floor(N * (0.2 + k * 0.3))); if (c) burst(c, { color: '--ok', count: 12, spread: 56 }) }, 120 + k * 200))
  later(() => { st.res = r }, 900)
}
function afterOpen(i: number) {
  if (cleared() === N - sp.mines) win(i)
}
function dig(i: number) {
  if (locked.value || st.open[i] !== 0) return
  note.value = ''; hintAt.value = -1
  if (st.first < 0) { st.first = i; st.sec = 0 }
  if (mines[i]) {
    st.hit = i
    explode(i)
    return
  }
  reveal(i)
  navigator.vibrate?.(8)
  afterOpen(i)
}
function toggleFlag(i: number) {
  if (locked.value || st.open[i] === 1) return
  st.open[i] = st.open[i] === 2 ? 0 : 2
  navigator.vibrate?.(14)
}
/** a number with as many flags around it as it counts opens the rest of its neighbours */
function chord(i: number) {
  if (locked.value || st.open[i] !== 1 || !counts[i]) return
  const nb = msNeighbors(i, sp)
  if (nb.filter(n => st.open[n] === 2).length !== counts[i]) return
  for (const n of nb) if (!locked.value) dig(n)
}
function act(i: number) {
  if (locked.value) return
  if (st.open[i] === 1) chord(i)
  else if (st.flag) toggleFlag(i)
  else dig(i)
}
/** bought: opens a cell the open numbers prove safe, or flags a certain mine, and says which kind it was */
function hint() {
  if (locked.value) return
  const h = msHint(st.open, counts, sp)
  if (!h) return
  if (st.first < 0) { st.first = h.cell; st.sec = 0 }
  st.hints++
  note.value = t(h.kind === 'mine' ? 'puzzles.mines.hintMine' : 'puzzles.mines.hintSafe')
  hintAt.value = h.cell
  const c = cellEl(h.cell)
  if (c) burst(c, { color: '--ok', count: 10, spread: 44 })
  if (h.kind === 'mine') { st.open[h.cell] = 2; return }
  if (st.open[h.cell] === 2) st.open[h.cell] = 0
  reveal(h.cell)
  afterOpen(h.cell)
}

// touch: a long press flags, a short tap acts; mouse: right-click flags
let pressed = -1, longDone = false, sx = 0, sy = 0
let timer: ReturnType<typeof setTimeout> | undefined
const cancel = () => { clearTimeout(timer); pressed = -1 }
function down(e: PointerEvent, i: number) {
  if (e.pointerType === 'mouse' && e.button === 2) { toggleFlag(i); pressed = -1; return }
  if (e.button !== 0) return
  pressed = i; longDone = false; sx = e.clientX; sy = e.clientY
  clearTimeout(timer)
  if (e.pointerType === 'mouse') return
  timer = setTimeout(() => { if (pressed === i) { longDone = true; if (st.open[i] !== 1) toggleFlag(i) } }, 360)
}
function move(e: PointerEvent) {
  if (pressed >= 0 && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) cancel()
}
function up(i: number) {
  clearTimeout(timer)
  const ok = pressed === i && !longDone
  pressed = -1
  if (ok) act(i)
}
/** keyboard activation (Enter / Space) arrives as a click without a pointer */
function click(e: MouseEvent, i: number) { if (e.detail === 0) act(i) }

function retry() {
  cancel()
  popped.value = []; ending.value = false; note.value = ''; hintAt.value = -1
  st.first = -1; st.open.splice(0, N, ...opening()); st.hit = -1; st.sec = 0; st.hints = 0; st.res = null
}
function onKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement
  const i = Number(el.dataset.i)
  if (Number.isNaN(i)) return
  const k = e.key
  if (k === 'f' || k === 'F') { toggleFlag(i); e.preventDefault(); return }
  const dx = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0, dy = k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0
  if (!dx && !dy) return
  // the arrows follow what is drawn: on a board lying on its side, right is one row further down in the data
  const x = (i % sp.w) + (tr.value ? dy : dx), y = Math.floor(i / sp.w) + (tr.value ? dx : dy)
  if (x >= 0 && x < sp.w && y >= 0 && y < sp.h) (el.parentElement?.children[y * sp.w + x] as HTMLElement | undefined)?.focus()
  e.preventDefault()
}

function cellLabel(i: number) {
  const o = st.open[i]
  if (o === 2) return t('puzzles.mines.flagged')
  if (o === 1) return counts[i] ? String(counts[i]) : t('puzzles.mines.blank')
  return showMine(i) || st.hit === i ? t('puzzles.mines.mine') : t('puzzles.mines.closed')
}
</script>

<template>
  <div class="ms" :class="{ lost, won }" :style="{ '--cols': cols, '--rows': rows }">
    <PuzzlesStage :stats="[{ label: $t('puzzles.grid.mines'), value: left, tone: left < 0 ? 'bad' : undefined }, { label: $t('puzzles.grid.time'), value: time }]" :msg="msg" :tone="lost ? 'bad' : undefined">
      <template #actions>
        <PuzzlesHintButton :game="key" :day="day" :disabled="locked" @bought="hint" />
      </template>

      <div ref="boardEl" class="ms-board" :class="{ tr }" role="group" :aria-label="$t('puzzles.mines.left', { n: left })" @keydown="onKey" @contextmenu.prevent>
        <button
          v-for="(o, i) in st.open" :key="i" type="button" class="ms-cell" :data-i="i" :data-n="o === 1 ? counts[i] : 0"
          :class="{ open: o === 1, flagged: o === 2, boom: st.hit === i, hinted: hintAt === i, wrong: lost && o === 2 && !mines[i], mine: showMine(i), cas: fresher[i] !== undefined }" :style="{ '--dl': fresher[i] ?? 0, ...place(i) }"
          :aria-label="$t('puzzles.mines.cell', { r: Math.floor(i / sp.w) + 1, c: (i % sp.w) + 1, s: cellLabel(i) })"
          @pointerdown="down($event, i)" @pointermove="move" @pointerup="up(i)" @pointercancel="cancel" @click="click($event, i)"
        >
          <Icon v-if="o === 2" name="flag" :size="16" />
          <svg v-else-if="showMine(i) || st.hit === i" class="ms-ico ms-mine" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="6" fill="currentColor" /><path d="M12 3v3M12 20v3M3 13h3M18 13h3M5.6 6.6l2.1 2.1M16.3 17.3l2.1 2.1M18.4 6.6l-2.1 2.1M7.7 17.3l-2.1 2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" /></svg>
          <template v-else-if="o === 1 && counts[i]">{{ counts[i] }}</template>
        </button>
      </div>

      <template #tools>
        <PuzzlesTool icon="flag" :label="$t('puzzles.mines.flag')" :on="st.flag" :disabled="locked" @click="st.flag = !st.flag" />
        <PuzzlesTool v-if="lost" icon="rotate-ccw" :label="$t('puzzles.mines.retry')" @click="retry" />
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
/* the frame (stats bar, tools, width) is <PuzzlesStage>; only the board is Minesweeper's. Digit colours are a deliberate palette */
.ms {
  --ms-1: hsl(215 85% 64%); --ms-2: hsl(140 55% 46%); --ms-3: hsl(2 78% 60%); --ms-4: hsl(255 60% 70%);
  --ms-5: hsl(22 78% 54%); --ms-6: hsl(175 60% 44%); --ms-7: var(--text); --ms-8: var(--muted);
  width: 100%; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent;
}
.ms-ico { width: 16px; height: 16px; flex: none; }

.ms-board {
  container-type: inline-size; display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 2px; width: 100%; box-sizing: border-box;
  touch-action: manipulation; padding: 3px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel);
}
.ms-cell {
  --cs: calc((100cqw - 6px - (var(--cols) - 1) * 2px) / var(--cols));
  position: relative; aspect-ratio: 1; min-width: 0; min-height: 0; padding: 0; display: grid; place-items: center; touch-action: manipulation;
  border: 1px solid var(--line-2); border-radius: 5px; background: var(--panel-2); color: var(--text); font: inherit; font-weight: 700; line-height: 1;
  font-size: min(calc(var(--cs) * .56), 28px); cursor: pointer;
}
.ms-cell :deep(.icon) { width: 52%; height: 52%; }
.ms-cell .ms-ico { width: 58%; height: 58%; }
.ms-cell.open { background: var(--bg); border-color: var(--line); cursor: default; }
.ms-cell.open[data-n="1"] { color: var(--ms-1); }
.ms-cell.open[data-n="2"] { color: var(--ms-2); }
.ms-cell.open[data-n="3"] { color: var(--ms-3); }
.ms-cell.open[data-n="4"] { color: var(--ms-4); }
.ms-cell.open[data-n="5"] { color: var(--ms-5); }
.ms-cell.open[data-n="6"] { color: var(--ms-6); }
.ms-cell.open[data-n="7"] { color: var(--ms-7); }
.ms-cell.open[data-n="8"] { color: var(--ms-8); }
.ms-cell.flagged { color: var(--warn); }
.ms-cell.mine { background: var(--bad-soft); border-color: var(--line); color: var(--text); }
.ms-cell.boom { background: var(--bad); border-color: var(--bad); color: var(--bg); }
.ms-cell.wrong { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }
.ms-cell.wrong::after { content: ''; position: absolute; width: 70%; height: 2px; border-radius: 1px; background: var(--bad); transform: rotate(-45deg); }
.ms-cell.hinted { outline: 2px solid var(--ok); outline-offset: 1px; }
.ms-cell:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.won .ms-cell.flagged { color: var(--ok); }

@media (hover: hover) {
  .ms-cell:not(.open):hover { border-color: var(--accent); }
}
@media (prefers-reduced-motion: no-preference) {
  .ms-cell:not(.open):active { transform: scale(.92); transition: transform var(--dur-fast) var(--ease-out); }
  .ms-cell.cas { animation: ms-open 240ms var(--ease-spring) backwards; animation-delay: calc(var(--dl) * 38ms); }
  .ms-cell.boom { animation: ms-boom 360ms var(--ease-out); }
  .ms-mine { animation: ms-pop 220ms var(--ease-spring) backwards; }
}
@keyframes ms-open { from { transform: scale(.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
@keyframes ms-boom { 0% { transform: scale(1); } 35% { transform: scale(1.3); } 100% { transform: scale(1); } }
@keyframes ms-pop { from { transform: scale(.3); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>
