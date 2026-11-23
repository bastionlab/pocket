<script setup lang="ts">
import { bridgesConnected, bridgesDegrees, bridgesEdgeBetween, bridgesEdgeToward, bridgesHint, bridgesInLine, bridgesPuzzle, bridgesSolved, type BrLevel } from '../../utils/puzzles/bridges'
import { burst, flash, pulse, shake } from '../../utils/puzzles/fx'

/** Bridges (Hashiwokakero): tap an island, then another one in line (or drag between them) to cycle 0, 1, 2 bridges */
const props = withDefaults(defineProps<{ day: string, level?: BrLevel }>(), { level: 'medium' })
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
type Res = PuzzleResult & { summary: string }
const pz = bridgesPuzzle(props.day, props.level)
const NI = pz.islands.length
const SZ = pz.size
// br: bridges per edge (0, 1, 2). hist: one step = [edge, value before] pairs. locked: edges a bought hint settled
const key = props.level === 'medium' ? 'bridges' : `bridges:${props.level}`
const st = usePuzzleState(key, props.day, () => ({
  br: pz.edges.map(() => 0), hist: [] as [number, number][][], sel: -1, hints: 0, locked: [] as number[], sec: 0, res: null as Res | null,
}))
// a board saved for another layout (the medium puzzle used to be a 7x7 one) cannot be applied to this one
if (st.br.length !== pz.edges.length || st.br.some(v => ![0, 1, 2].includes(v))) { st.br = pz.edges.map(() => 0); st.hist = []; st.locked = []; st.sel = -1 }
st.locked = st.locked.filter(e => e >= 0 && e < pz.edges.length)
if (st.sel >= NI) st.sel = -1
useFinish(st, emit)
const time = useTimer(st)
const done = computed(() => !!st.res)
const ending = ref(false) // the solve wave is playing
const locked = computed(() => done.value || ending.value)
const deg = computed(() => bridgesDegrees(NI, pz.edges, st.br))
const okCount = computed(() => pz.islands.filter((s, i) => deg.value[i] === s.n).length)
const hintLeft = computed(() => !locked.value && bridgesHint(pz, st.br, st.locked) !== null)

/** islands the selected one can be joined to right now (not behind a crossing bridge) */
const reach = computed(() => {
  const out = new Set<number>()
  if (st.sel < 0) return out
  pz.edges.forEach((e, k) => {
    if (e.a !== st.sel && e.b !== st.sel) return
    if (st.locked.includes(k) || (st.br[k] === 0 && pz.cross[k].some(j => st.br[j] > 0))) return
    out.add(e.a === st.sel ? e.b : e.a)
  })
  return out
})

const boardEl = ref<HTMLElement>()
const timers: ReturnType<typeof setTimeout>[] = []
const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }
onBeforeUnmount(() => timers.forEach(clearTimeout))
const islandEl = (i: number) => boardEl.value?.querySelector<HTMLElement>(`[data-i="${i}"]`) ?? undefined
const note = ref('')
let noteTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(noteTimer))
const connected = computed(() => bridgesConnected(NI, pz.edges, st.br))
const msg = computed(() => (okCount.value === NI && !connected.value ? t('puzzles.bridges.split') : note.value))
const shakeIslands = (...ids: number[]) => { note.value = t('puzzles.grid.inTheWay'); clearTimeout(noteTimer); noteTimer = setTimeout(() => { note.value = '' }, 2200); navigator.vibrate?.([20, 30, 20]); ids.forEach((i) => { const e = islandEl(i); if (e) shake(e) }) }

function result(): Res {
  return {
    solved: true, attempts: Math.max(1, Math.ceil(st.sec / 60)), score: st.sec,
    summary: t('puzzles.bridges.sumSolved', { time: time.value, h: st.hints }),
    detail: { share: `${shareHead('Bridges', props.day, props.level === 'medium' ? '' : props.level)}\n${time.value}${st.hints ? `, ${st.hints} hints` : ''}` },
  }
}
/** every number is met and nothing is cut off: a wave over the islands, then the result */
function win() {
  if (ending.value || st.res) return
  ending.value = true
  st.sel = -1
  const r = result()
  navigator.vibrate?.([20, 40, 20])
  pz.islands.forEach((s, i) => later(() => { const e = islandEl(i); if (e) { pulse(e); burst(e, { color: '--ok', count: 6, spread: 34 }) } }, (s.r + s.c) * 70))
  later(() => { st.res = r }, 1000)
}
onMounted(() => { if (!st.res && bridgesSolved(pz, st.br)) st.res = result() })
const solvedNow = () => bridgesSolved(pz, st.br)

/** 0 -> 1 -> 2 -> 0; a crossing bridge or a hinted edge blocks it with a shake */
function cycle(e: number, a: number, b: number) {
  if (st.locked.includes(e)) { shakeIslands(a, b); return }
  const next = (st.br[e] + 1) % 3
  if (next > 0 && pz.cross[e].some(j => st.br[j] > 0)) { shakeIslands(a, b); return }
  st.hist.push([[e, st.br[e]]])
  if (st.hist.length > 200) st.hist.shift()
  st.br[e] = next
  navigator.vibrate?.(8)
  if (solvedNow()) win()
}
/** link two islands: cycles their bridge; shakes when another island is in the way; nothing when they are not in line */
function link(a: number, b: number) {
  const e = bridgesEdgeBetween(pz, a, b)
  if (e >= 0) cycle(e, a, b)
  else if (bridgesInLine(pz, a, b)) shakeIslands(a, b)
}
function tap(i: number) {
  if (locked.value) return
  if (st.sel === i) { st.sel = -1; return }
  if (st.sel < 0) { st.sel = i; return }
  link(st.sel, i)
  st.sel = i
}
function undo() {
  if (locked.value) return
  let step = st.hist.pop()
  while (step && step.every(([e]) => st.locked.includes(e))) step = st.hist.pop()
  if (!step) return
  for (let k = step.length - 1; k >= 0; k--) if (!st.locked.includes(step[k][0])) st.br[step[k][0]] = step[k][1]
  st.sel = -1
}
/** clears every bridge as one undoable step (hinted ones stay) */
function clear() {
  if (locked.value) return
  const s = st.br.map((v, e) => [e, v] as [number, number]).filter(([e, v]) => v > 0 && !st.locked.includes(e))
  if (!s.length) return
  st.hist.push(s)
  s.forEach(([e]) => { st.br[e] = 0 })
  st.sel = -1
}
/** bought: draws one correct bridge (or takes away a wrong one that is in its way), settled for good */
function hint() {
  if (locked.value) return
  const h = bridgesHint(pz, st.br, st.locked)
  if (!h) return
  st.br[h.edge] = h.value
  if (h.value > 0) st.locked.push(h.edge)
  st.hints++
  st.sel = -1
  const { a, b } = pz.edges[h.edge]
  ;[a, b].forEach((i) => { const e = islandEl(i); if (e) flash(e, '--ok') })
  navigator.vibrate?.(10)
  if (solvedNow()) win()
}

// drag from one island to another; a plain tap selects
let from = -1
const cancel = () => { from = -1 }
function down(e: PointerEvent, i: number) {
  if (e.button > 0 && e.pointerType === 'mouse') return
  from = i
}
function up(e: PointerEvent) {
  const a = from
  from = -1
  if (a < 0 || locked.value) return
  const over = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-i]')
  const b = over ? Number(over.dataset.i) : a
  if (b === a) {
    // dragged off the island without reaching another: the way it went picks the neighbour in that direction
    const box = islandEl(a)?.getBoundingClientRect()
    const dx = box ? e.clientX - (box.left + box.width / 2) : 0, dy = box ? e.clientY - (box.top + box.height / 2) : 0
    if (box && Math.max(Math.abs(dx), Math.abs(dy)) > box.width * 0.9) {
      const horiz = Math.abs(dx) > Math.abs(dy)
      const k = bridgesEdgeToward(pz, a, horiz ? 0 : Math.sign(dy), horiz ? Math.sign(dx) : 0)
      st.sel = -1
      if (k >= 0) cycle(k, pz.edges[k].a, pz.edges[k].b); else shakeIslands(a)
      return
    }
    tap(a)
    return
  }
  st.sel = -1
  const direct = bridgesEdgeBetween(pz, a, b)
  if (direct >= 0 || !bridgesInLine(pz, a, b)) { link(a, b); return }
  // same row / column with an island in between: the first one towards it
  const pa = pz.islands[a], pb = pz.islands[b]
  const k = bridgesEdgeToward(pz, a, Math.sign(pb.r - pa.r), Math.sign(pb.c - pa.c))
  if (k >= 0) cycle(k, pz.edges[k].a, pz.edges[k].b); else shakeIslands(a, b)
}
/** keyboard activation (Enter / Space) arrives as a click without a pointer */
function click(e: MouseEvent, i: number) { if (e.detail === 0) tap(i) }
/** arrows move the focus to the neighbouring island in that direction; Escape drops the selection */
function onKey(e: KeyboardEvent, i: number) {
  if (e.key === 'Escape') { st.sel = -1; return }
  const dr = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0, dc = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
  if (!dr && !dc) return
  e.preventDefault()
  const k = bridgesEdgeToward(pz, i, dr, dc)
  if (k >= 0) islandEl(pz.edges[k].a === i ? pz.edges[k].b : pz.edges[k].a)?.focus()
}
onMounted(() => window.addEventListener('keydown', onUndoKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onUndoKey))
/** Ctrl/Cmd+Z or U anywhere on the page undoes the last bridge */
function onUndoKey(e: KeyboardEvent) {
  const tg = e.target as HTMLElement | null
  if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)) || e.altKey) return
  if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') || (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'u')) { undo(); e.preventDefault() }
}

const pct = (n: number) => `${(n + 0.5) / SZ * 100}%`
const bridges = computed(() => pz.edges.map((e, k) => ({ e, k, v: st.br[k] })).filter(x => x.v > 0).map(({ e, k, v }) => {
  const p = pz.islands[e.a], q = pz.islands[e.b]
  const over = deg.value[e.a] > p.n || deg.value[e.b] > q.n
  return {
    key: `${k}-${v}`, v, horiz: e.horiz, over, hint: st.locked.includes(k),
    style: e.horiz
      ? { left: pct(p.c), top: pct(p.r), width: `${(q.c - p.c) / SZ * 100}%` }
      : { left: pct(p.c), top: pct(p.r), height: `${(q.r - p.r) / SZ * 100}%` },
  }
}))
const label = (i: number) => t('puzzles.bridges.island', { n: pz.islands[i].n, have: deg.value[i] })
</script>

<template>
  <div class="br" :class="{ won: done }" :style="{ '--n': SZ }">
    <PuzzlesStage :stats="[{ label: $t('puzzles.grid.time'), value: time }, { label: $t('puzzles.grid.islands'), value: `${okCount}/${NI}`, tone: okCount === NI ? (connected ? 'ok' : 'warn') : undefined }]" :msg="msg" tone="warn">
      <template #actions>
        <PuzzlesHintButton :game="key" :day="day" :disabled="!hintLeft" @bought="hint" />
      </template>

      <div ref="boardEl" class="br-board" role="group" :aria-label="$t('puzzles.grid.bridgesBoard')">
        <div v-for="b in bridges" :key="b.key" class="br-bridge" :class="[b.horiz ? 'h' : 'v', { two: b.v === 2, over: b.over, hint: b.hint }]" :style="b.style" aria-hidden="true">
          <i /><i v-if="b.v === 2" />
        </div>
        <button
          v-for="(s, i) in pz.islands" :key="i" type="button" class="br-island" :data-i="i" :aria-label="label(i)" :aria-pressed="st.sel === i"
          :class="{ sel: st.sel === i, cand: reach.has(i), met: deg[i] === s.n, over: deg[i] > s.n }" :style="{ left: pct(s.c), top: pct(s.r) }"
          @pointerdown="down($event, i)" @pointerup="up" @pointercancel="cancel" @click="click($event, i)" @keydown="onKey($event, i)"
        ><b>{{ s.n }}</b></button>
      </div>

      <template #tools>
        <PuzzlesTool icon="undo-2" :label="$t('puzzles.sudoku.undo')" :disabled="locked || !st.hist.length" @click="undo" />
        <PuzzlesTool icon="rotate-ccw" :label="$t('puzzles.clear')" :disabled="locked || !st.br.some((v, e) => v && !st.locked.includes(e))" @click="clear" />
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
/* the frame (stats bar, tools, width) is <PuzzlesStage>; only the board is Bridges' */
.br { width: 100%; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }

.br-board {
  --is: min(60px, calc(100cqw / var(--n) * .86));
  container-type: inline-size; position: relative; width: 100%; aspect-ratio: 1; border-radius: var(--radius); background-color: var(--panel);
  background-image: radial-gradient(circle, var(--line-2) 1.5px, transparent 2px); background-size: calc(100% / var(--n)) calc(100% / var(--n));
  box-shadow: inset 0 0 0 1px var(--line); touch-action: none;
}
.br-island {
  position: absolute; width: var(--is); height: var(--is); margin: calc(var(--is) / -2) 0 0 calc(var(--is) / -2); padding: 0;
  display: grid; place-items: center; border: 2px solid var(--muted); border-radius: 50%; background: linear-gradient(var(--tint), var(--tint)), var(--panel); color: var(--text);
  --tint: transparent;
  font: inherit; font-size: calc(var(--is) * .5); font-weight: 700; line-height: 1; cursor: pointer; touch-action: none; z-index: 1;
}
.br-island::after { content: ''; position: absolute; inset: min(0px, calc((var(--is) - 36px) / 2)); } /* tap area of at least 36px */
.br-island b { font-weight: 700; font-variant-numeric: tabular-nums; }
.br-island.sel { --tint: var(--accent-soft); border-color: var(--accent); color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.br-island.cand { border-style: dashed; border-color: var(--accent); }
.br-island.met { --tint: var(--ok-soft); border-color: var(--ok); color: var(--ok); }
.br-island.over { --tint: var(--bad-soft); border-color: var(--bad); color: var(--bad); }
.br-island:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.br-bridge { position: absolute; pointer-events: none; display: flex; align-items: center; justify-content: center; gap: 4px; color: var(--text); }
.br-bridge.h { height: 14px; margin-top: -7px; flex-direction: column; }
.br-bridge.v { width: 14px; margin-left: -7px; flex-direction: row; }
.br-bridge i { display: block; border-radius: 2px; background: currentcolor; opacity: .8; }
.br-bridge.h i { width: 100%; height: 3px; transform-origin: left center; }
.br-bridge.v i { height: 100%; width: 3px; transform-origin: center top; }
.br-bridge.hint { color: var(--ok); }
.br-bridge.over { color: var(--bad); }
.won .br-bridge { color: var(--ok); }

@media (hover: hover) {
  .br-island:hover:not(.sel):not(.met):not(.over) { border-color: var(--accent); }
}
@media (prefers-reduced-motion: no-preference) {
  .br-island { transition: transform var(--dur-fast) var(--ease-out); }
  .br-island:active { transform: scale(.93); }
  .br-bridge.h i { animation: br-x 220ms var(--ease-out) backwards; }
  .br-bridge.v i { animation: br-y 220ms var(--ease-out) backwards; }
}
@keyframes br-x { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes br-y { from { transform: scaleY(0); } to { transform: scaleY(1); } }
</style>
