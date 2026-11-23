<script setup lang="ts">
import { WS_DIRS, wsMatch, wsPuzzle, wsSnap } from '../../utils/puzzles/wordsearch'
import { burst } from '../../utils/puzzles/fx'
import { gameKey } from '../../utils/puzzles/registry'

/**
 * Word Search: drag from the first to the last letter of a word. The selection snaps to the nearest of 8 directions and is
 * drawn as a capsule over the letters; a real word stays (own palette colour), anything else fades away with a tiny shake.
 * Keyboard: arrows move the cursor, Space / Enter start and end a selection, Escape cancels. Levels: 10x10 right + down,
 * 12x12 + diagonals, 14x14 all 8 directions.
 */
const props = defineProps<{ day: string, level?: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
const p = wsPuzzle(props.day, props.level)
const key = gameKey('word-search', props.level)
const N = p.n, TOTAL = p.words.length
type Res = PuzzleResult & { summary: string }
// found: indexes into p.words; hinted: words whose first letter is outlined; gave: the rest was revealed
const st = usePuzzleState(key, props.day, () => ({ found: [] as number[], sec: 0, hints: 0, hinted: [] as number[], gave: false, res: null as Res | null }))
st.found = st.found.filter(i => i >= 0 && i < TOTAL)
useFinish(st, emit)
const time = useTimer(st)

interface Sel { start: number, dir: number, len: number }
const field = ref<HTMLElement | null>(null)
const sel = ref<Sel | null>(null)
const miss = ref<Sel | null>(null)
const kb = ref(false) // keyboard driven: show the cursor
const cur = ref(0)
const arm = ref(false) // Give up asks once more
const ending = ref(false)
const done = computed(() => !!st.res)
const locked = computed(() => done.value || ending.value)
const shown = computed(() => (st.gave ? p.words.map((_, i) => i) : st.found))
const left = computed(() => TOTAL - st.found.length)
const list = p.words.map((w, i) => ({ w: w.word, i })).sort((a, b) => a.w.localeCompare(b.w))
const hintCells = computed(() => new Set(st.hinted.filter(i => !shown.value.includes(i)).map(i => p.words[i]!.cell)))
const canHint = computed(() => !locked.value && p.words.some((_, i) => !st.found.includes(i) && !st.hinted.includes(i)))

const timers: ReturnType<typeof setTimeout>[] = []
const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }
onBeforeUnmount(() => timers.forEach(clearTimeout))

/** the capsule of a selection or a placed word, as percentages of the (square) field */
function capsule(s: Sel): Record<string, string> {
  const [dx, dy] = WS_DIRS[Math.max(0, s.dir)]!
  const h = .8, L = (s.len - 1) * (dx && dy ? Math.SQRT2 : 1)
  const sx = s.start % N + .5, sy = Math.floor(s.start / N) + .5
  return {
    left: `${(sx - h / 2) / N * 100}%`, top: `${(sy - h / 2) / N * 100}%`, width: `${(L + h) / N * 100}%`, height: `${h / N * 100}%`,
    transformOrigin: `${(h / 2) / (L + h) * 100}% 50%`, transform: `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`,
  }
}
const colour = (i: number) => `c${(i % 12) + 1}`
const placed = (i: number): Sel => ({ start: p.words[i]!.cell, dir: p.words[i]!.dir, len: p.words[i]!.len })

function at(e: PointerEvent): { cell: number, x: number, y: number } {
  const r = field.value!.getBoundingClientRect()
  const x = (e.clientX - r.left) / r.width * N, y = (e.clientY - r.top) / r.height * N
  const cx = Math.max(0, Math.min(N - 1, Math.floor(x))), cy = Math.max(0, Math.min(N - 1, Math.floor(y)))
  return { cell: cy * N + cx, x, y }
}
let pid = -1
function down(e: PointerEvent) {
  if (locked.value || (e.pointerType === 'mouse' && e.button !== 0)) return
  kb.value = false
  pid = e.pointerId
  field.value?.setPointerCapture?.(e.pointerId)
  const a = at(e)
  cur.value = a.cell
  miss.value = null
  sel.value = { start: a.cell, dir: -1, len: 1 }
}
function move(e: PointerEvent) {
  if (e.pointerId !== pid || !sel.value) return
  const a = at(e)
  const s = wsSnap(N, sel.value.start, a.x, a.y)
  if (s.dir !== sel.value.dir || s.len !== sel.value.len) {
    sel.value = { start: sel.value.start, ...s }
    if (s.len > 1) navigator.vibrate?.(3)
  }
}
function up(e: PointerEvent) {
  if (e.pointerId !== pid) return
  pid = -1
  commit()
}
function commit() {
  const s = sel.value
  sel.value = null
  if (!s || s.len < 2 || locked.value) return
  const i = wsMatch(p, s.start, s.dir, s.len)
  if (i >= 0 && !st.found.includes(i)) { found(i); return }
  if (i >= 0) return // already found: nothing to flag
  miss.value = s
  later(() => { if (miss.value === s) miss.value = null }, 380)
}
function found(i: number) {
  st.found.push(i)
  navigator.vibrate?.(12)
  const e = field.value?.querySelector<HTMLElement>(`[data-w="${i}"]`)
  if (e) burst(e, { color: `--pz-c${(i % 12) + 1}`, count: 8, spread: 34 })
  if (st.found.length === TOTAL) finish(false)
}
function finish(gave: boolean) {
  if (ending.value || st.res) return
  ending.value = true
  const clock = time.value
  const make = () => {
    st.res = {
      solved: !gave, attempts: Math.max(1, Math.ceil(st.sec / 60)), score: st.sec,
      summary: gave ? t('puzzles.wsearch.sumGave', { n: st.found.length, total: TOTAL })
        : st.hints ? t('puzzles.wsearch.sumHints', { time: clock, h: st.hints }) : t('puzzles.wsearch.sum', { time: clock }),
      detail: { level: props.level ?? 'medium', theme: p.theme, found: st.found.length, hints: st.hints },
    }
  }
  if (gave) { st.gave = true; make() } else later(make, 700)
}
function hint() {
  const i = p.words.findIndex((_, k) => !st.found.includes(k) && !st.hinted.includes(k))
  if (i < 0 || locked.value) return
  st.hinted.push(i)
  st.hints++
  const e = field.value?.querySelector<HTMLElement>(`[data-i="${p.words[i]!.cell}"]`)
  if (e) burst(e, { color: '--warn', count: 8, spread: 36 })
}
function giveUp() {
  if (locked.value) return
  if (!arm.value) { arm.value = true; later(() => { arm.value = false }, 3000); return }
  arm.value = false
  finish(true)
}

// keyboard: arrows move the cursor; Space / Enter set the start, then end the selection; Escape cancels
function onKey(e: KeyboardEvent) {
  const d = ({ ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] } as Record<string, [number, number]>)[e.key]
  if (d) {
    e.preventDefault()
    kb.value = true
    const x = Math.max(0, Math.min(N - 1, cur.value % N + d[0])), y = Math.max(0, Math.min(N - 1, Math.floor(cur.value / N) + d[1]))
    cur.value = y * N + x
    if (sel.value) sel.value = { start: sel.value.start, ...wsSnap(N, sel.value.start, x + .5, y + .5) }
  } else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    kb.value = true
    if (locked.value) return
    if (sel.value) commit()
    else sel.value = { start: cur.value, dir: -1, len: 1 }
  } else if (e.key === 'Escape') sel.value = null
}
const cellLabel = computed(() => t('puzzles.wsearch.cursor', { r: Math.floor(cur.value / N) + 1, c: cur.value % N + 1, l: p.grid[cur.value]! }))
</script>

<template>
  <div class="ws">
    <PuzzlesStage :stats="[{ label: $t('puzzles.wsearch.found'), value: `${st.found.length}/${TOTAL}` }, { label: $t('puzzles.wsearch.time'), value: time }]">
      <template #actions>
        <PuzzlesHintButton :game="key" :day="day" :disabled="!canHint" @bought="hint" />
      </template>

      <p class="ws-theme"><span>{{ $t('puzzles.wsearch.theme') }}</span> <b>{{ p.theme }}</b></p>
      <div class="ws-board" :class="{ solved: done || ending }" :style="{ '--n': N }">
        <div
          ref="field" class="ws-field" role="application" tabindex="0" :aria-label="$t('puzzles.wsearch.board', { theme: p.theme })" :aria-description="cellLabel"
          @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @keydown="onKey" @contextmenu.prevent @blur="sel = null"
        >
          <div class="ws-caps" aria-hidden="true">
            <i v-for="i in shown" :key="i" class="ws-cap" :class="[colour(i), { gave: !st.found.includes(i) }]" :data-w="i" :style="capsule(placed(i))" />
            <i v-if="miss" class="ws-cap miss" :style="capsule(miss)"><span /></i>
            <i v-if="sel && sel.len > 1" class="ws-cap live" :style="capsule(sel)" />
          </div>
          <div class="ws-grid">
            <span v-for="(g, i) in p.grid" :key="i" class="wc" :data-i="i" :class="{ hint: hintCells.has(i), cur: kb && cur === i, start: sel && sel.start === i }">{{ g }}</span>
          </div>
        </div>
      </div>

      <ul class="ws-words" :aria-label="$t('puzzles.wsearch.words')">
        <li v-for="x in list" :key="x.i" class="ws-chip" :class="[{ on: st.found.includes(x.i), gave: st.gave && !st.found.includes(x.i) }, colour(x.i)]">{{ x.w }}</li>
      </ul>

      <template #tools>
        <PuzzlesTool icon="flag" :label="arm ? $t('puzzles.wsearch.sure') : $t('puzzles.wsearch.giveUp')" :on="arm" :disabled="locked || !left" @click="giveUp" />
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
/* frame = <PuzzlesStage>; the board and word list are Word Search's. Found words use the shared palette --pz-c1..12 */
.ws { width: 100%; }
.ws-theme { margin: 0 0 6px; font-size: 13px; line-height: 1.2; color: var(--muted); text-align: center; }
.ws-theme b { color: var(--text); font-weight: 600; }

.ws-board { width: 100%; box-sizing: border-box; padding: 3px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--panel-2); }
.ws-field { position: relative; width: 100%; aspect-ratio: 1; container-type: inline-size; touch-action: none; user-select: none; -webkit-user-select: none; cursor: crosshair; outline: none; -webkit-tap-highlight-color: transparent; }
.ws-field:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 2px; }
.ws-grid { position: absolute; inset: 0; display: grid; grid-template-columns: repeat(var(--n), 1fr); grid-auto-rows: 1fr; pointer-events: none; }
.wc {
  position: relative; display: grid; place-items: center; font-weight: 600; line-height: 1; color: var(--text); letter-spacing: 0;
  font-size: calc(100cqw / var(--n) * .52); font-variant-numeric: tabular-nums;
}
.wc.start { color: var(--accent); }
.wc.hint::after { content: ''; position: absolute; inset: 9%; border: 2px solid var(--warn); border-radius: 50%; }
.wc.cur::before { content: ''; position: absolute; inset: 6%; border: 2px solid var(--accent); border-radius: 6px; }

.ws-caps { position: absolute; inset: 0; pointer-events: none; }
.ws-cap {
  position: absolute; box-sizing: border-box; border-radius: 999px;
  --c: var(--pz-c1);
  background: color-mix(in oklab, var(--c) 52%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in oklab, var(--c) 90%, transparent);
}
.ws-cap.c1 { --c: var(--pz-c1); } .ws-cap.c2 { --c: var(--pz-c2); } .ws-cap.c3 { --c: var(--pz-c3); } .ws-cap.c4 { --c: var(--pz-c4); }
.ws-cap.c5 { --c: var(--pz-c5); } .ws-cap.c6 { --c: var(--pz-c6); } .ws-cap.c7 { --c: var(--pz-c7); } .ws-cap.c8 { --c: var(--pz-c8); }
.ws-cap.c9 { --c: var(--pz-c9); } .ws-cap.c10 { --c: var(--pz-c10); } .ws-cap.c11 { --c: var(--pz-c11); } .ws-cap.c12 { --c: var(--pz-c12); }
.ws-cap.gave { background: color-mix(in oklab, var(--c) 24%, transparent); box-shadow: inset 0 0 0 1.5px color-mix(in oklab, var(--c) 70%, transparent); }
.ws-cap.live { --c: var(--accent); background: color-mix(in oklab, var(--accent) 30%, transparent); box-shadow: inset 0 0 0 2px var(--accent); }
.ws-cap.miss { background: color-mix(in oklab, var(--bad) 22%, transparent); box-shadow: inset 0 0 0 2px var(--bad); }
.ws-cap.miss span { position: absolute; inset: 0; }

.ws-words { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; }
.ws-chip {
  --c: var(--pz-c1);
  padding: 3px 9px; border: 1px solid var(--border); border-radius: 999px; background: var(--panel-2); color: var(--text);
  font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; line-height: 1.5;
}
.ws-chip.c1 { --c: var(--pz-c1); } .ws-chip.c2 { --c: var(--pz-c2); } .ws-chip.c3 { --c: var(--pz-c3); } .ws-chip.c4 { --c: var(--pz-c4); }
.ws-chip.c5 { --c: var(--pz-c5); } .ws-chip.c6 { --c: var(--pz-c6); } .ws-chip.c7 { --c: var(--pz-c7); } .ws-chip.c8 { --c: var(--pz-c8); }
.ws-chip.c9 { --c: var(--pz-c9); } .ws-chip.c10 { --c: var(--pz-c10); } .ws-chip.c11 { --c: var(--pz-c11); } .ws-chip.c12 { --c: var(--pz-c12); }
.ws-chip.on { text-decoration: line-through; text-decoration-thickness: 1.5px; color: var(--muted); background: color-mix(in oklab, var(--c) 34%, var(--panel)); border-color: color-mix(in oklab, var(--c) 70%, transparent); }
.ws-chip.gave { color: var(--muted); border-style: dashed; }
@media (min-width: 641px) { .ws-chip { font-size: 13px; padding: 3px 11px; } }

@media (prefers-reduced-motion: no-preference) {
  .ws-cap:not(.live):not(.miss) { animation: ws-in 260ms var(--ease-out); }
  .ws-cap.miss { animation: ws-out 380ms ease-in forwards; }
  .ws-cap.miss span { animation: ws-shake 380ms ease-in-out; }
  .ws-chip.on { transition: opacity 200ms; }
}
@keyframes ws-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes ws-out { 0%, 40% { opacity: 1; } to { opacity: 0; } }
@keyframes ws-shake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-4px); } 50% { transform: translateX(3px); } 75% { transform: translateX(-2px); } }
</style>

<style>
/* the word list sits under the board, so a fit board leaves room for it on PC (the shell default chrome is 330px) */
.pz-game:has(.ws) { --pz-chrome: 440px; }
</style>
