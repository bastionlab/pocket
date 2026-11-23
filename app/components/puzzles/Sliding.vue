<script setup lang="ts">
import { slGoal, slSpec, slideHint, slideRun, slidingPuzzle } from '../../utils/puzzles/logic'
import { burst, pulse } from '../../utils/puzzles/fx'
import { gameKey } from '../../utils/puzzles/registry'

/** Sliding tiles: easy 3x3 (short shuffle), medium 4x4, hard 4x4 shuffled further from home */
const props = defineProps<{ day: string, level?: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
const level = ['easy', 'hard'].includes(props.level ?? '') ? props.level! : 'medium'
const key = gameKey('sliding-3x3', level)
const SL = slSpec(level).n
const fresh = () => slidingPuzzle(key, props.day, level)
// hint = the tile a bought hint points at (cleared by the next move, kept across a reload)
const st = usePuzzleState(key, props.day, () => ({ t: fresh(), moves: 0, hint: 0, hints: 0, res: null as PuzzleResult | null }))
// a save of another size (the old 3x3 game): start again
if (st.t.length !== SL * SL) { st.t = fresh(); st.moves = 0; st.hint = 0; st.res = null }
useFinish(st, emit)

const GOAL = slGoal(SL)
const root = ref<HTMLElement | null>(null)
const ending = ref(false)
const timers: ReturnType<typeof setTimeout>[] = []
const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }
onBeforeUnmount(() => timers.forEach(clearTimeout))
const done = computed(() => !!st.res || ending.value)
// where tile n sits (0 = the gap): tiles keep their element, so a move is a slide, not a repaint
const where = computed(() => { const m: number[] = []; st.t.forEach((v, i) => { m[v] = i }); return m })

function move(i: number) {
  if (done.value) return false
  const r = slideRun(st.t, i, SL)
  if (!r) return false
  st.t = r.t
  st.moves += r.n
  st.hint = 0
  navigator.vibrate?.(10)
  if (st.t.join() === GOAL.join()) win()
  return true
}
/** solved: a wave of pops across the tiles and a burst on the last row, then the result (the shell adds the confetti) */
function win() {
  ending.value = true
  navigator.vibrate?.([20, 40, 20])
  for (let n = 1; n < SL * SL; n++) later(() => { const e = root.value?.querySelector<HTMLElement>(`.sl-tile[data-n="${n}"] .sl-face`); if (e) pulse(e) }, (n - 1) * 45)
  for (let c = 0; c < SL; c++) later(() => { const e = root.value?.querySelector<HTMLElement>(`.sl-tile[data-n="${SL * (SL - 1) + c + 1}"]`) ?? root.value?.querySelector<HTMLElement>('.sl-board'); if (e) burst(e, { color: '--ok', count: 10, spread: 50 }) }, 150 + c * 120)
  later(() => {
    const base = t('puzzles.slide.sum', { n: st.moves })
    st.res = { solved: true, attempts: st.moves, score: st.moves, summary: st.hints ? `${base} ${t('puzzles.slide.sumHints', { h: st.hints })}` : base, detail: { moves: st.moves, hints: st.hints } }
  }, 800)
}
function reset() {
  if (done.value || !st.moves) return
  st.t = fresh()
  st.moves = 0
  st.hint = 0
}
/** bought: the next tile of a reasonable way home (slideHint: weighted IDA*, greedy when it runs out of budget) */
function hint() {
  if (done.value) return
  st.hint = slideHint(st.t)
  st.hints++
}

// swipe: drag a tile towards the gap; every tile in between goes along. A swipe also fires a click: ignore that one.
let down: { x: number, y: number, n: number } | null = null
let swiped = false
function onDown(e: PointerEvent) {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-n]')
  down = { x: e.clientX, y: e.clientY, n: el ? Number(el.dataset.n) : -1 }
}
function onUp(e: PointerEvent) {
  const d = down
  down = null
  if (!d || d.n < 0) return
  const dx = e.clientX - d.x, dy = e.clientY - d.y
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return
  swiped = true
  setTimeout(() => { swiped = false }, 60)
  const i = where.value[d.n], b = where.value[0]
  const horiz = Math.abs(dx) > Math.abs(dy)
  const ok = horiz ? Math.floor(i / SL) === Math.floor(b / SL) && (b - i) * dx > 0 : i % SL === b % SL && (b - i) * dy > 0
  if (ok) move(i)
}
function onClick(i: number) {
  if (swiped) return
  move(i)
}

// desktop: an arrow key slides the tile next to the gap in that direction
function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  const b = where.value[0]!, x = b % SL, y = Math.floor(b / SL)
  const from = { ArrowLeft: x < SL - 1 ? b + 1 : -1, ArrowRight: x > 0 ? b - 1 : -1, ArrowUp: y < SL - 1 ? b + SL : -1, ArrowDown: y > 0 ? b - SL : -1 }[e.key]
  if (from === undefined) return
  e.preventDefault()
  if (from >= 0) move(from)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div ref="root" class="sl">
    <PuzzlesStage :stats="[{ label: $t('puzzles.slide.moves'), value: st.moves }]" :msg="done && st.res?.solved !== false && st.moves ? $t('puzzles.slide.solved', { n: st.moves }) : st.hint ? $t('puzzles.slide.hintMove', { n: st.hint }) : ''" :tone="done ? 'ok' : 'warn'">
      <template #actions>
        <PuzzlesHintButton :game="key" :day="day" :disabled="done" @bought="hint" />
      </template>

      <div class="sl-board pz-sq" :class="{ solved: done }" :style="{ '--n': SL }" @pointerdown="onDown" @pointerup="onUp" @pointercancel="down = null">
        <div class="sl-grid">
          <button
            v-for="n in SL * SL - 1" :key="n" class="sl-tile" :data-n="n" :class="{ right: where[n] === n - 1, tip: st.hint === n }"
            :style="{ '--x': where[n]! % SL, '--y': Math.floor(where[n]! / SL), '--d': n }"
            :aria-label="String(n)" :disabled="done" @click="onClick(where[n])"
          ><span class="sl-face num">{{ n }}</span></button>
        </div>
      </div>

      <template #tools>
        <PuzzlesTool icon="rotate-ccw" :label="$t('puzzles.slide.reset')" :disabled="done || !st.moves" @click="reset" />
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
.sl { width: 100%; }

.sl-board { container-type: inline-size; position: relative; box-sizing: border-box; border: 1px solid var(--line-2); border-radius: var(--radius); background: var(--track); touch-action: none; user-select: none; -webkit-user-select: none; }
.sl-board.solved { border-color: var(--ok); }
.sl-grid { position: absolute; inset: 5px; }
.sl-tile {
  position: absolute; left: 0; top: 0; width: calc(100% / var(--n)); height: calc(100% / var(--n)); padding: 3px; box-sizing: border-box;
  border: 0; background: none; color: var(--text); font: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent;
  transform: translate(calc(var(--x) * 100%), calc(var(--y) * 100%));
}
.sl-tile:disabled { cursor: default; opacity: 1; }
.sl-face { display: grid; place-items: center; width: 100%; height: 100%; border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--panel-2); font-size: calc(100cqw / var(--n) * .36); font-weight: 700; transition: transform var(--dur-fast) var(--ease-out); }
@media (hover: hover) { .sl-tile:hover:not(:disabled) .sl-face { border-color: var(--faint); } }
.sl-tile.right .sl-face { border-color: var(--ok); color: var(--ok); }
.sl-tile.tip .sl-face { border-color: var(--warn); background: var(--warn-soft); color: var(--warn); box-shadow: 0 0 0 2px var(--warn); }
.sl-tile:active:not(:disabled) .sl-face { transform: scale(.94); }
.sl-tile:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: var(--radius-sm); }
.sl-board.solved .sl-face { background: var(--ok-soft); }

@media (prefers-reduced-motion: no-preference) {
  .sl-tile { transition: transform 170ms var(--ease-out); }
}
</style>
