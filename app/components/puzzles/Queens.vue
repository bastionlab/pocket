<script setup lang="ts">
import { queensConflicts, queensHintCell, queensPuzzle } from '../../utils/puzzles/queens'
import { burst, pulse, shake } from '../../utils/puzzles/fx'
import { gameKey } from '../../utils/puzzles/registry'

/**
 * Queens: one queen per row, column and colour region, none touching. Tap cycles empty, X mark, queen. Levels: 6x6 easy,
 * 8x8 medium, 10x10 hard. "Auto X" greys out the cells a placed queen rules out (drawn only, never saved as marks).
 */
const props = defineProps<{ day: string, level?: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
const p = queensPuzzle(props.day, props.level)
const key = gameKey('queens', props.level)
const N = p.n, SIZE = N * N
type Res = PuzzleResult & { summary: string }
// m: one entry per cell, 0 empty, 1 X mark, 2 queen; hinted cells are queens the player cannot change; hist: undo steps as
// [cell, value before] lists
const st = usePuzzleState(key, props.day, () => ({ m: new Array<number>(SIZE).fill(0), sec: 0, hints: 0, hinted: [] as number[], auto: false, hist: [] as [number, number][][], res: null as Res | null }))
if (st.m.length !== SIZE) st.m = new Array<number>(SIZE).fill(0)
useFinish(st, emit)
const time = useTimer(st)

const root = ref<HTMLElement | null>(null)
const ending = ref(false)
const last = ref(-1) // the cell that was just filled (its mark pops once)
const done = computed(() => !!st.res)
const locked = computed(() => done.value || ending.value)
const queens = computed(() => st.m.flatMap((v, i) => (v === 2 ? [i] : [])))
const bad = computed(() => queensConflicts(N, p.regions, queens.value))
/** cells a placed queen rules out (its row, column, region and the cells touching it), for the Auto X display */
const ruled = computed(() => {
  const out = new Set<number>()
  if (!st.auto) return out
  for (const q of queens.value) {
    const r = Math.floor(q / N), c = q % N
    for (let i = 0; i < SIZE; i++) {
      const y = Math.floor(i / N), x = i % N
      if (y === r || x === c || p.regions[i] === p.regions[q] || (Math.abs(y - r) <= 1 && Math.abs(x - c) <= 1)) out.add(i)
    }
  }
  return out
})
const auto = (i: number) => st.m[i] === 0 && ruled.value.has(i)
const canHint = computed(() => !locked.value && queensHintCell(p, queens.value) >= 0)

const rowOf = (i: number) => Math.floor(i / N)
const colOf = (i: number) => i % N
// a thin line wherever the region changes (drawn on the right / bottom edge of the cell that borders the next region)
const edgeR = (i: number) => colOf(i) < N - 1 && p.regions[i] !== p.regions[i + 1]
const edgeB = (i: number) => rowOf(i) < N - 1 && p.regions[i] !== p.regions[i + N]
const cellEl = (i: number) => root.value?.querySelector<HTMLElement>(`[data-i="${i}"]`) ?? null
const label = (i: number) => t('puzzles.queens.cell', {
  r: rowOf(i) + 1, c: colOf(i) + 1, g: p.regions[i]! + 1,
  s: st.m[i] === 2 ? t('puzzles.queens.queen') : st.m[i] === 1 ? t('puzzles.queens.mark') : t('puzzles.queens.empty'),
})
const timers: ReturnType<typeof setTimeout>[] = []
const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }
onBeforeUnmount(() => timers.forEach(clearTimeout))

function tap(i: number) {
  if (locked.value || st.hinted.includes(i)) return
  // a cell that Auto X already crosses goes straight to a queen
  const was = st.m[i]!
  st.m[i] = was === 0 && auto(i) ? 2 : (was + 1) % 3
  st.hist.push([[i, was]])
  if (st.hist.length > 200) st.hist.shift()
  last.value = i
  later(() => { if (last.value === i) last.value = -1 }, 380)
  navigator.vibrate?.(8)
  if (st.m[i] === 2) {
    const e = cellEl(i)
    if (queensConflicts(N, p.regions, queens.value).has(i)) { if (e) shake(e) } else if (e) pulse(e)
    check()
  }
}
function clear() {
  if (locked.value) return
  const step = st.m.flatMap((v, i) => (v && !st.hinted.includes(i) ? [[i, v] as [number, number]] : []))
  if (step.length) st.hist.push(step) // one undoable step, so no confirm is needed
  st.m = st.m.map((v, i) => (st.hinted.includes(i) ? 2 : 0))
}
function undo() {
  const step = st.hist.pop()
  if (!step || locked.value) return
  for (let k = step.length - 1; k >= 0; k--) st.m[step[k]![0]] = step[k]![1]
}
function hint() {
  const i = queensHintCell(p, queens.value)
  if (i < 0 || locked.value) return
  st.m[i] = 2
  st.hinted.push(i)
  st.hints++
  last.value = i
  later(() => { if (last.value === i) last.value = -1 }, 380)
  const e = cellEl(i)
  if (e) burst(e, { color: '--warn', count: 10, spread: 46 })
  check()
}

function check() {
  if (ending.value || st.res) return
  if (queens.value.length !== N || queensConflicts(N, p.regions, queens.value).size) return
  ending.value = true
  const clock = time.value
  navigator.vibrate?.([20, 40, 20])
  // a wave of pops across the queens, a burst on each, then the result (the shell adds the confetti)
  queens.value.slice().sort((a, b) => rowOf(a) - rowOf(b)).forEach((c, k) => later(() => {
    const e = cellEl(c)
    if (e) { pulse(e); burst(e, { color: '--ok', count: 8, spread: 40 }) }
  }, k * 90))
  later(() => {
    st.res = {
      solved: true, attempts: Math.max(1, Math.ceil(st.sec / 60)), score: st.sec,
      summary: st.hints ? t('puzzles.queens.sumHints', { time: clock, h: st.hints }) : t('puzzles.queens.sum', { time: clock }),
      detail: { n: N, level: props.level ?? 'medium', hints: st.hints },
    }
  }, N * 90 + 300)
}
</script>

<template>
  <div ref="root" class="qn">
    <PuzzlesStage :stats="[{ label: $t('puzzles.queens.queens'), value: `${queens.length}/${N}` }, { label: $t('puzzles.queens.time'), value: time }]" :msg="bad.size ? $t('puzzles.queens.clash') : ''" tone="bad">
      <template #actions>
        <PuzzlesHintButton :game="key" :day="day" :disabled="!canHint" @bought="hint" />
      </template>

      <div class="qn-board" :class="{ solved: done || ending }" :style="{ '--n': N }" role="grid" :aria-label="$t('puzzles.queens.board')">
        <button
          v-for="(g, i) in p.regions" :key="i" class="qc" role="gridcell" :data-i="i"
          :class="[`r${g}`, { er: edgeR(i), eb: edgeB(i), bad: st.m[i] === 2 && bad.has(i), hint: st.hinted.includes(i), pop: last === i }]"
          :disabled="locked" :aria-label="label(i)" @click="tap(i)"
        >
          <svg v-if="st.m[i] === 2" class="qc-ic queen" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 18.5h17l.9-10.5-5 4L12 5.5 7.6 12l-5-4zM4.5 20.5h15" /></svg>
          <svg v-else-if="st.m[i] === 1" class="qc-ic mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8l8 8M16 8l-8 8" /></svg>
          <svg v-else-if="auto(i)" class="qc-ic mark auto" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 8l8 8M16 8l-8 8" /></svg>
        </button>
      </div>

      <template #tools>
        <PuzzlesTool icon="x" :label="$t('puzzles.queens.autoX')" :on="st.auto" @click="st.auto = !st.auto" />
        <PuzzlesTool icon="undo-2" :label="$t('puzzles.queens.undo')" :disabled="locked || !st.hist.length" @click="undo" />
        <PuzzlesTool icon="rotate-ccw" :label="$t('puzzles.clear')" :disabled="locked || !st.m.some((v, i) => v && !st.hinted.includes(i))" @click="clear" />
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
/* the frame (stats bar, tools, width) is <PuzzlesStage>; only the board is Queens'. Regions use the shared palette --pz-c1..10 */
.qn { --edge: color-mix(in srgb, var(--text) 78%, transparent); width: 100%; }

.qn-board {
  display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 1px; width: 100%; box-sizing: border-box;
  border: 2px solid var(--edge); border-radius: var(--radius-sm); background: var(--edge); overflow: hidden; touch-action: manipulation; user-select: none; -webkit-user-select: none;
}
.qc {
  --rc: var(--pz-c1);
  position: relative; display: grid; place-items: center; aspect-ratio: 1; min-width: 0; padding: 0; border: 0; border-radius: 0; font: inherit; color: var(--text); cursor: pointer;
  background: color-mix(in oklab, var(--rc) 62%, var(--panel));
  box-shadow: var(--e1, 0 0 0 0 transparent), var(--e2, 0 0 0 0 transparent);
  -webkit-tap-highlight-color: transparent;
}
.qc.r0 { --rc: var(--pz-c1); } .qc.r1 { --rc: var(--pz-c2); } .qc.r2 { --rc: var(--pz-c3); } .qc.r3 { --rc: var(--pz-c4); } .qc.r4 { --rc: var(--pz-c5); }
.qc.r5 { --rc: var(--pz-c6); } .qc.r6 { --rc: var(--pz-c7); } .qc.r7 { --rc: var(--pz-c8); } .qc.r8 { --rc: var(--pz-c9); } .qc.r9 { --rc: var(--pz-c10); }
.qc.er { --e1: inset -2px 0 0 var(--edge); }
.qc.eb { --e2: inset 0 -2px 0 var(--edge); }
@media (hover: hover) { .qc:hover:not(:disabled) { background: color-mix(in oklab, var(--rc) 78%, var(--panel)); } }
.qc:disabled { cursor: default; opacity: 1; }
.qc:focus-visible { outline: 2px solid var(--accent); outline-offset: -3px; z-index: 1; }
.qc.bad::after { content: ''; position: absolute; inset: 0; background: var(--bad-soft); box-shadow: inset 0 0 0 2px var(--bad); pointer-events: none; }
.qc.hint::before { content: ''; position: absolute; inset: 3px; border: 1.5px dashed var(--warn); border-radius: 4px; pointer-events: none; }

.qc-ic { position: relative; z-index: 1; width: 62%; height: 62%; fill: none; stroke: currentColor; stroke-width: 1.75; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
.qc-ic.queen { fill: currentColor; fill-opacity: .92; }
.qc-ic.mark { width: 46%; height: 46%; stroke-width: 2; opacity: .6; }
.qc-ic.mark.auto { opacity: .3; }
.qc.bad .qc-ic { color: var(--bad); }
.qn-board.solved .qc-ic.queen { color: var(--text); }

@media (prefers-reduced-motion: no-preference) {
  .qc.pop .qc-ic { animation: qc-pop 260ms var(--ease-out); }
  .qc:active:not(:disabled) .qc-ic { transform: scale(.9); }
}
@keyframes qc-pop { from { transform: scale(1.5); opacity: .2; } to { transform: none; opacity: 1; } }
</style>
