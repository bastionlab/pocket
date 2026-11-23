<script setup lang="ts">
import { trailFor } from '../../utils/puzzles/trail'
import { fnv1a, makeRng } from '../../utils/puzzles/rng'
import { gameKey } from '../../utils/puzzles/registry'
import { burst, shake } from '../../utils/puzzles/fx'

/**
 * Word Wheel (game id word-trail): letters on a wheel and a crossword-shaped field. Drag a line through the wheel's letters (any
 * order, each letter once per word; tap them one by one and press Enter works too) or type the letters. A word that is an
 * answer of the field flies into it; any other valid word of 3+ letters is a bonus word. Solved when the field is full.
 */
const props = defineProps<{ day: string, level?: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
const key = gameKey('word-trail', props.level)
const pz = trailFor(key, props.level, props.day)
const n = pz.wheel.length
const sig = String(fnv1a(pz.word + pz.solution.join('')))
const VER = 2 // 2 = the wheel replaced the tile grid: boards saved by the Word Trail are dropped
const fresh = () => ({ v: VER, found: [] as string[], bonus: [] as string[], hinted: [] as number[], sec: 0, sig, res: null as PuzzleResult | null })
const st = usePuzzleState(key, props.day, fresh)
useFinish(st, emit)
const clock = useTimer(st)
const { note, tone, say } = usePuzzleNote()

if (st.v !== VER) Object.assign(st, fresh())
else if (st.sig !== sig) Object.assign(st, fresh(), st.res ? { found: pz.slots.map(s => s.answer), res: st.res } : {})
st.found = st.found.filter(w => pz.slots.some(s => s.answer === w))

const over = computed(() => !!st.res)
const isFound = (i: number) => st.found.includes(pz.slots[i].answer)
const bonusSet = new Set(pz.bonus)
/** the letter a square shows: finished words, hint letters, and everything once the game is over */
const shown = computed(() => {
  const m = new Map<number, string>()
  pz.slots.forEach((s) => { if (over.value || st.found.includes(s.answer)) s.cells.forEach((c, k) => m.set(c, s.answer[k])) })
  return m
})
const lostCells = computed(() => {
  const s = new Set<number>()
  if (over.value && !st.res?.solved) pz.slots.forEach((x) => { if (!st.found.includes(x.answer)) x.cells.forEach(c => s.add(c)) })
  return s
})
const doneCells = computed(() => {
  const s = new Set<number>()
  pz.slots.forEach((x) => { if (st.found.includes(x.answer)) x.cells.forEach(c => s.add(c)) })
  return s
})
const stats = computed(() => [
  { label: t('puzzles.trail.words'), value: `${st.found.length}/${pz.slots.length}`, tone: st.res?.solved ? 'ok' as const : undefined },
  { label: t('puzzles.trail.bonus'), value: st.bonus.length },
  { label: t('puzzles.trail.time'), value: clock.value },
])

// --- wheel geometry: slot k of n on a circle, in % of the wheel box (centre 50,50) ---
const R = 35
const pos = (k: number) => ({ x: Math.sin((k / n) * Math.PI * 2) * R, y: -Math.cos((k / n) * Math.PI * 2) * R })
/** slot of each wheel letter (a shuffle permutes it; the letters glide to their new slots) */
const slot = ref<number[]>(pz.wheel.map((_, i) => i))
const spin = ref(0)
function shuffle() {
  if (over.value) return
  const rng = makeRng(Date.now() & 0x7fffffff)
  let next = slot.value
  for (let k = 0; k < 6 && next.join() === slot.value.join(); k++) next = rng.shuffle(slot.value)
  slot.value = next
  spin.value++
}
const point = (i: number) => { const p = pos(slot.value[i]); return { x: 50 + p.x, y: 50 + p.y } }

// --- the trace: wheel letter indexes in order ---
const trace = ref<number[]>([])
const word = computed(() => trace.value.map(i => pz.wheel[i]).join(''))
const live = ref<{ x: number, y: number } | null>(null)
const wheelEl = ref<HTMLElement | null>(null)
const traceEl = ref<HTMLElement | null>(null)
const fieldEl = ref<HTMLElement | null>(null)
const fly = ref(new Map<number, { x: number, y: number, d: number }>())
const timers = new Set<ReturnType<typeof setTimeout>>()
const later = (fn: () => void, ms: number) => { const id = setTimeout(() => { timers.delete(id); fn() }, ms); timers.add(id) }
onBeforeUnmount(() => timers.forEach(clearTimeout))
const lineD = computed(() => {
  const pts = trace.value.map(point)
  if (live.value && pts.length) pts.push(live.value)
  return pts.length > 1 ? pts.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ') : ''
})

function clear() { trace.value = []; live.value = null }
function fail(msg: string) {
  say(msg, 'warn', 1800)
  navigator.vibrate?.(20)
  if (wheelEl.value) shake(wheelEl.value)
  clear()
}
/** the answer flies from the wheel to its squares, one after the other */
function flyIn(cells: number[]) {
  const from = wheelEl.value?.getBoundingClientRect()
  const m = new Map<number, { x: number, y: number, d: number }>()
  cells.forEach((c, k) => {
    const el = fieldEl.value?.querySelector<HTMLElement>(`[data-c="${c}"]`)
    const b = el?.getBoundingClientRect()
    m.set(c, b && from ? { x: from.left + from.width / 2 - (b.left + b.width / 2), y: from.top + from.height / 2 - (b.top + b.height / 2), d: k * 60 } : { x: 0, y: 40, d: k * 60 })
  })
  fly.value = m
  later(() => { fly.value = new Map() }, 900)
}
function submit() {
  const w = word.value
  if (!w || over.value) return
  const i = pz.slots.findIndex(s => s.answer === w)
  if (w.length < 3) return fail(t('puzzles.trail.short'))
  if (i >= 0) {
    if (st.found.includes(w)) return fail(t('puzzles.trail.have'))
    flyIn(pz.slots[i].cells)
    st.found.push(w)
    say(t('puzzles.trail.placed'), 'ok', 1600)
    navigator.vibrate?.([10, 30, 10])
    if (traceEl.value) burst(traceEl.value, { color: '--ok', count: 14, spread: 80 })
    clear()
    verify()
  } else if (bonusSet.has(w)) {
    if (st.bonus.includes(w)) return fail(t('puzzles.trail.have'))
    st.bonus.push(w)
    say(t('puzzles.trail.bonusFound'), 'ok', 1600)
    navigator.vibrate?.(10)
    clear()
  } else fail(t('puzzles.trail.unknown'))
}
const detail = () => ({ sec: st.sec, hints: st.hinted.length, words: pz.slots.length, found: st.found.length, bonus: st.bonus.length, letters: n, ...(props.level ? { level: props.level } : {}) })
function verify() {
  if (st.res || st.found.length < pz.slots.length) return
  st.res = { solved: true, attempts: st.hinted.length, score: st.sec, summary: t('puzzles.trail.summary', { time: clock.value }), detail: detail() }
}

// pointer: press a letter and drag over the others; release submits after a drag. A plain tap adds the letter (tap the last one again to remove it).
let dragging = false
let moved = false
function local(e: PointerEvent) {
  const box = wheelEl.value?.getBoundingClientRect()
  if (!box || !box.width) return null
  return { x: ((e.clientX - box.left) / box.width) * 100, y: ((e.clientY - box.top) / box.height) * 100 }
}
function letterAt(p: { x: number, y: number }, r: number): number {
  let best = -1
  let bd = r
  for (let i = 0; i < n; i++) {
    const c = point(i)
    const d = Math.hypot(p.x - c.x, p.y - c.y)
    if (d <= bd) { bd = d; best = i }
  }
  return best
}
function down(e: PointerEvent) {
  if (over.value || (e.pointerType === 'mouse' && e.button !== 0)) return
  const p = local(e)
  const i = p ? letterAt(p, 14) : -1
  if (!p || i < 0) return
  e.preventDefault()
  wheelEl.value?.setPointerCapture(e.pointerId)
  dragging = true
  moved = false
  const tr = trace.value
  if (tr[tr.length - 1] === i) trace.value = tr.slice(0, -1)
  else if (!tr.includes(i)) trace.value = [...tr, i]
  navigator.vibrate?.(8)
}
function move(e: PointerEvent) {
  if (!dragging) return
  const p = local(e)
  if (!p) return
  const tr = trace.value
  const i = letterAt(p, 11)
  if (i >= 0 && i !== tr[tr.length - 1]) {
    if (tr.length > 1 && i === tr[tr.length - 2]) { trace.value = tr.slice(0, -1); moved = true }
    else if (!tr.includes(i)) { trace.value = [...tr, i]; moved = true; navigator.vibrate?.(8) }
  }
  if (trace.value.length) live.value = p
}
function up() {
  if (!dragging) return
  dragging = false
  live.value = null
  if (moved && trace.value.length >= 2) submit()
}
/** keyboard on a focused letter (Enter / Space): the same as a tap */
function tap(i: number, e: MouseEvent) {
  if (e.detail !== 0 || over.value) return
  const tr = trace.value
  if (tr[tr.length - 1] === i) trace.value = tr.slice(0, -1)
  else if (!tr.includes(i)) trace.value = [...tr, i]
}

// physical keyboard: type the letters of a word, Backspace, Enter, Escape
function typeLetter(l: string) {
  const i = pz.wheel.findIndex((x, k) => x === l && !trace.value.includes(k))
  if (i >= 0) trace.value = [...trace.value, i]
  else { say(t('puzzles.trail.noLetter', { l }), 'warn', 1400); navigator.vibrate?.(20) }
}
function onKey(e: KeyboardEvent) {
  if (over.value || e.ctrlKey || e.metaKey || e.altKey) return
  const tag = (e.target as HTMLElement)?.tagName || ''
  if (/input|textarea|select/i.test(tag)) return
  if (e.key === 'Enter') { if (/button|a/i.test(tag)) return; e.preventDefault(); if (!e.repeat) submit() }
  else if (e.key === 'Backspace') trace.value = trace.value.slice(0, -1)
  else if (e.key === 'Escape') clear()
  else if (e.key === ' ' && !/button|a/i.test(tag)) { e.preventDefault(); shuffle() }
  else if (/^[a-z]$/i.test(e.key)) typeLetter(e.key.toUpperCase())
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// --- hint, give up ---
/** squares of unfinished words that show nothing yet */
const hidden = computed(() => {
  const s = new Set<number>()
  pz.slots.forEach((x) => { if (!st.found.includes(x.answer)) x.cells.forEach((c) => { if (!st.hinted.includes(c) && !shown.value.has(c)) s.add(c) }) })
  return [...s].sort((a, b) => a - b)
})
function hint() {
  const cells = hidden.value
  if (!cells.length || over.value) return
  const c = makeRng(fnv1a(`${key}:${props.day}:hint${st.hinted.length}`)).pick(cells)
  st.hinted.push(c)
  say(t('puzzles.trail.revealed'), 'ok', 1600)
}
const sure = ref(false)
function giveUp() {
  if (!sure.value) { sure.value = true; later(() => { sure.value = false }, 3000); return }
  sure.value = false
  clear()
  st.res = { solved: false, attempts: st.hinted.length, score: 0, summary: t('puzzles.trail.gaveUp'), detail: detail() }
}

// the field beside the wheel when the stage is wide enough (PC), above it otherwise
const rootEl = ref<HTMLElement | null>(null)
const wide = ref(false)
let ro: ResizeObserver | undefined
onMounted(() => {
  if (!rootEl.value || typeof ResizeObserver === 'undefined') return
  ro = new ResizeObserver(([e]) => { wide.value = e.contentRect.width >= 500 })
  ro.observe(rootEl.value)
})
onBeforeUnmount(() => ro?.disconnect())
const bonusSorted = computed(() => [...st.bonus].sort((a, b) => a.length - b.length || a.localeCompare(b)))
</script>

<template>
  <div ref="rootEl" class="ww" :style="{ '--cols': pz.cols, '--rows': pz.rows }">
    <PuzzlesStage :stats="stats" :msg="note" :tone="tone">
      <template #actions>
        <PuzzlesHintButton :game="key" :day="day" :disabled="over || !hidden.length" @bought="hint" />
      </template>

      <div class="top" :class="{ side: wide }">
        <div class="fieldw">
          <div ref="fieldEl" class="field" role="img" :aria-label="$t('puzzles.trail.field', { n: st.found.length, total: pz.slots.length })">
            <template v-for="(x, i) in pz.solution" :key="i">
              <i v-if="!x" class="gap" />
              <div
                v-else :data-c="i" class="c"
                :class="{ fill: doneCells.has(i), lost: lostCells.has(i), flying: fly.has(i) }"
                :style="fly.has(i) ? { '--fx': fly.get(i)!.x + 'px', '--fy': fly.get(i)!.y + 'px', '--d': fly.get(i)!.d + 'ms' } : undefined"
                aria-hidden="true"
              >
                <span class="l" :class="{ rev: !shown.has(i) }">{{ shown.get(i) || (st.hinted.includes(i) ? x : '') }}</span>
              </div>
            </template>
          </div>
        </div>

        <div class="pad">
          <div ref="traceEl" class="trace" aria-live="polite" :aria-label="$t('puzzles.trail.trace')">
            <span v-for="(c, i) in word" :key="i">{{ c }}</span>
            <i v-if="!word" class="ph">{{ $t('puzzles.trail.placeholder') }}</i>
          </div>
          <div class="wheelw">
            <div
              ref="wheelEl" class="wheel" role="group" :aria-label="$t('puzzles.trail.wheel')"
              @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @contextmenu.prevent
            >
              <svg class="line" viewBox="0 0 100 100" aria-hidden="true">
                <polyline v-if="lineD" :points="lineD" />
              </svg>
              <button
                v-for="(l, i) in pz.wheel" :key="i" type="button" class="ltr"
                :class="{ on: trace.includes(i), last: trace[trace.length - 1] === i }"
                :style="{ '--x': pos(slot[i]).x, '--y': pos(slot[i]).y }"
                :aria-label="l" :aria-pressed="trace.includes(i)" :disabled="over" @click="tap(i, $event)"
              >{{ l }}</button>
              <button type="button" class="mix" :class="{ odd: spin % 2 }" :aria-label="$t('puzzles.trail.shuffle')" :disabled="over" @click="shuffle">
                <Icon name="refresh-cw" :size="20" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <template #tools>
        <PuzzlesTool icon="x" :label="$t('puzzles.trail.clear')" :disabled="over || !trace.length" @click="clear" />
        <button type="button" class="btn primary go" :disabled="over || trace.length < 2" @click="submit">{{ $t('puzzles.enter') }}</button>
        <PuzzlesTool icon="flag" :label="sure ? $t('puzzles.trail.sure') : $t('puzzles.trail.giveUp')" :disabled="over" @click="giveUp" />
        <p v-if="bonusSorted.length" class="bonus">
          <span class="bl">{{ $t('puzzles.trail.bonusList') }}</span>
          <b v-for="w in bonusSorted" :key="w">{{ w }}</b>
        </p>
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
.ww { width: 100%; }
.top { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.top.side { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; align-items: center; }
.fieldw { width: min(100%, calc(var(--cols) * 40px)); }
.top.side .fieldw { width: 100%; }
.field { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 3px; container-type: inline-size; }
.gap { aspect-ratio: 1; }
.c { position: relative; aspect-ratio: 1; min-width: 0; display: grid; place-items: center; background: var(--panel-2); border: 1px solid var(--line-2); border-radius: 6px; color: var(--text); }
.c.fill { background: var(--pz-c3-soft); border-color: transparent; }
.c.lost { background: var(--panel); }
.l { font-size: calc(46cqw / var(--cols)); font-weight: 700; line-height: 1; text-transform: uppercase; }
.l.rev { color: var(--accent); opacity: .85; }
.c.lost .l { color: var(--muted); }
.pad { width: min(100%, 260px); display: flex; flex-direction: column; align-items: stretch; gap: 4px; }
.top.side .pad { justify-self: center; }
.trace { min-height: 40px; display: flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 700; letter-spacing: .08em; line-height: 1; text-transform: uppercase; }
.ph { font-size: 14px; font-weight: 400; font-style: normal; letter-spacing: 0; text-transform: none; color: var(--muted); }
.wheelw { width: 100%; }
.wheel { position: relative; container-type: inline-size; width: 100%; aspect-ratio: 1; border-radius: 50%; background: var(--panel-2); border: 1px solid var(--line-2); touch-action: none; user-select: none; -webkit-user-select: none; cursor: pointer; }
.line { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
.line polyline { fill: none; stroke: var(--accent); stroke-opacity: .75; stroke-width: 3.2; stroke-linecap: round; stroke-linejoin: round; }
.ltr { position: absolute; left: 50%; top: 50%; width: 22cqw; height: 22cqw; margin: -11cqw 0 0 -11cqw; padding: 0; border: 0; border-radius: 50%; display: grid; place-items: center; background: var(--panel); color: var(--text); box-shadow: inset 0 0 0 1px var(--line-2); font: inherit; font-size: 11cqw; font-weight: 700; line-height: 1; touch-action: none; -webkit-tap-highlight-color: transparent; transform: translate(calc(var(--x) * 1cqw), calc(var(--y) * 1cqw)); }
.ltr.on { background: var(--accent); color: var(--bg); box-shadow: none; }
.ltr:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ltr:disabled { cursor: default; }
.mix { position: absolute; left: 50%; top: 50%; width: 17cqw; height: 17cqw; margin: -8.5cqw 0 0 -8.5cqw; padding: 0; border-radius: 50%; border: 1px solid var(--line-2); background: var(--panel); color: var(--muted); display: grid; place-items: center; cursor: pointer; }
.mix:disabled { opacity: .5; cursor: default; }
.mix:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.go { min-height: 40px; min-width: 96px; }
@media (pointer: coarse) { .go { min-height: 44px; } }
.bonus { flex: 1 1 100%; display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; justify-content: center; margin: 2px 0 0; font-size: 13px; }
.bonus b { font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
.bl { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: .06em; }
@media (max-width: 640px) { .fieldw { width: min(100%, calc(var(--cols) * min(36px, 224px / var(--rows)))); } .pad { width: min(100%, 190px); } .trace { min-height: 30px; font-size: 24px; } .c { border-radius: 5px; } }
@media (hover: hover) { .ltr:not(.on):not(:disabled):hover { background: color-mix(in oklab, var(--text) 12%, var(--panel)); } .mix:not(:disabled):hover { color: var(--text); } }
@media (prefers-reduced-motion: no-preference) {
  .ltr { transition: transform .45s var(--ease-out), background-color var(--dur-fast) var(--ease-out); }
  .ltr.on { scale: .94; }
  .mix svg { transition: transform .45s var(--ease-out); }
  .mix.odd svg { transform: rotate(180deg); }
  .c.flying { animation: ww-fly .55s var(--ease-out) var(--d) backwards; }
  .trace span { animation: ww-in .14s var(--ease-out); }
}
@keyframes ww-fly { from { transform: translate(var(--fx), var(--fy)) scale(.4); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes ww-in { from { transform: translateY(4px); opacity: 0; } to { transform: none; opacity: 1; } }
</style>
