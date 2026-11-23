<script setup lang="ts">
import { memSpec, memoryHintPair, memoryLayout } from '../../utils/puzzles/logic'
import { burst, pulse, shake } from '../../utils/puzzles/fx'
import { gameKey } from '../../utils/puzzles/registry'

/** Memory match: easy 4x3 (6 pairs), medium 5x4 (10), hard 6x5 (15) */
const props = defineProps<{ day: string, level?: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
const level = ['easy', 'hard'].includes(props.level ?? '') ? props.level! : 'medium'
const key = gameKey('memory-match', level)
const sp = memSpec(level)
const cards = memoryLayout(key, props.day, sp.pairs)
const PAIRS = cards.length / 2
// hinted = cards of pairs a bought hint pointed out (kept: a reload neither charges twice nor loses them)
const st = usePuzzleState(key, props.day, () => ({ matched: [] as number[], open: [] as number[], flips: 0, sec: 0, hinted: [] as number[], res: null as PuzzleResult | null }))
// a save from the 4x4 game: start again
if (st.matched.concat(st.open, st.hinted).some(i => i >= cards.length)) Object.assign(st, { matched: [], open: [], flips: 0, sec: 0, hinted: [], res: null })
useFinish(st, emit)
const root = ref<HTMLElement | null>(null)
const peek = ref<number[]>([]) // a hinted pair shown face up for a moment (not a flip)
const ending = ref(false)

// every pair gets its own palette colour (plus its letter), so two cards are easy to compare once they are open
// (the shared palette has twelve; hard has fifteen pairs, the extra three reuse a colour under a different letter)
const HUES = [1, 5, 12, 10, 9, 3, 11, 6, 2, 8, 4, 7] // palette numbers in hue order
const tone = new Map([...new Set(cards)].sort().map((l, k) => [l, HUES[(k * 5) % 12]])) // stride 5: consecutive pairs sit far apart on the colour wheel
const clock = computed(() => `${Math.floor(st.sec / 60)}:${String(st.sec % 60).padStart(2, '0')}`)
const locked = computed(() => st.open.length >= 2)
const miss = computed(() => st.open.length === 2)
const note = computed(() => (miss.value ? t('puzzles.mem.miss') : fresh.value.length ? t('puzzles.mem.match') : ''))
const fresh = ref<number[]>([]) // the pair that just matched (pops once)
const done = computed(() => !!st.res || ending.value)
const gridKey = (e: KeyboardEvent) => { // arrow keys walk the cards
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')
  if (!el) return
  const i = Number(el.dataset.i), C = sp.cols
  const to = { ArrowLeft: i % C ? i - 1 : -1, ArrowRight: i % C < C - 1 ? i + 1 : -1, ArrowUp: i - C, ArrowDown: i + C }[e.key]
  if (to === undefined) return
  e.preventDefault()
  if (to >= 0 && to < cards.length) cardEl(to)?.focus()
}
const up = (i: number) => st.open.includes(i) || st.matched.includes(i) || peek.value.includes(i)
const cardEl = (i: number) => root.value?.querySelector<HTMLElement>(`[data-i="${i}"]`) ?? null

let timer: ReturnType<typeof setTimeout> | undefined
let tick: ReturnType<typeof setInterval> | undefined
// a reload mid-mismatch: close the two cards again
onMounted(() => {
  if (st.open.length === 2) st.open = []
  // the clock starts with the first flip and stops at the end; it also pauses while the tab is hidden
  tick = setInterval(() => { if (st.flips > 0 && !st.res && document.visibilityState === 'visible') st.sec++ }, 1000)
})
const later: ReturnType<typeof setTimeout>[] = []
onBeforeUnmount(() => { clearTimeout(timer); clearInterval(tick); later.forEach(clearTimeout) })

function tap(i: number) {
  if (done.value || locked.value || up(i)) return
  st.open.push(i)
  st.flips++
  navigator.vibrate?.(10)
  if (st.open.length < 2) return
  const [a, b] = st.open
  if (cards[a] === cards[b]) {
    st.matched.push(a, b)
    st.open = []
    fresh.value = [a, b]
    later.push(setTimeout(() => { fresh.value = [] }, 600))
    // the flip takes ~380 ms: the burst follows once the second card is face up
    later.push(setTimeout(() => { for (const c of [a, b]) { const e = cardEl(c); if (e) burst(e, { color: '--accent', count: 10, spread: 48 }) } }, 380))
    if (st.matched.length === cards.length) win()
  } else {
    later.push(setTimeout(() => { for (const c of [a, b]) { const e = cardEl(c); if (e) shake(e) } }, 380))
    timer = setTimeout(() => { st.open = [] }, 900)
  }
}
/** every pair found: a wave across the cards, then the result (the shell adds the confetti) */
function win() {
  ending.value = true
  navigator.vibrate?.([20, 40, 20])
  cards.forEach((_, i) => later.push(setTimeout(() => { const e = cardEl(i); if (e) pulse(e) }, 450 + i * 35)))
  later.push(setTimeout(() => {
    const base = t('puzzles.mem.sum', { n: st.flips, time: clock.value })
    st.res = { solved: true, attempts: st.flips, score: st.flips, summary: st.hinted.length ? `${base} ${t('puzzles.mem.sumHints', { h: st.hinted.length / 2 })}` : base, detail: { flips: st.flips, sec: st.sec, hints: st.hinted.length / 2 } }
  }, 450 + cards.length * 35 + 400))
}
/** bought: shows one pair for a moment, then marks both cards with the pair's colour dot */
function hint() {
  const pair = memoryHintPair(key, props.day, cards, st.matched, st.hinted)
  if (!pair || done.value) return
  st.hinted.push(...pair)
  peek.value = [...pair]
  later.push(setTimeout(() => { peek.value = [] }, 1400))
}
const canHint = computed(() => !done.value && !locked.value && !peek.value.length && !!memoryHintPair(key, props.day, cards, st.matched, st.hinted))
</script>

<template>
  <div ref="root" class="mem">
    <PuzzlesStage
      :stats="[{ label: $t('puzzles.mem.flips'), value: st.flips }, { label: $t('puzzles.mem.pairs'), value: `${st.matched.length / 2}/${PAIRS}` }, { label: $t('puzzles.mem.time'), value: clock }]"
      :msg="note" :tone="miss ? 'warn' : 'ok'"
    >
      <template #actions>
        <PuzzlesHintButton :game="key" :day="day" :disabled="!canHint" @bought="hint" />
      </template>

      <div class="mem-grid" :class="{ locked, solved: done }" :style="{ '--cols': sp.cols }" role="group" :aria-label="$t('puzzles.mem.board')" @keydown="gridKey">
        <button
          v-for="(c, i) in cards" :key="i" class="mem-card" :data-i="i"
          :class="{ up: up(i), matched: st.matched.includes(i), miss: miss && st.open.includes(i), pop: fresh.includes(i), tip: st.hinted.includes(i) && !up(i) }"
          :style="{ '--pc': `var(--pz-c${tone.get(c)})`, '--ps': `var(--pz-c${tone.get(c)}-soft)` }"
          :aria-label="up(i) ? c : $t('puzzles.mem.card', { n: i + 1 })" :aria-pressed="up(i)" :disabled="done"
          @click="tap(i)"
        >
          <span class="mem-in">
            <span class="mem-face back" aria-hidden="true"><i /></span>
            <span class="mem-face front">{{ c }}</span>
          </span>
        </button>
      </div>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
.mem { width: 100%; }
.mem-grid { container-type: inline-size; display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 8px; width: 100%; }
.mem-grid.locked .mem-card:not(.up) { cursor: default; }
.mem-card { position: relative; aspect-ratio: 1; min-width: 0; padding: 0; border: 0; background: none; font: inherit; cursor: pointer; perspective: 600px; -webkit-tap-highlight-color: transparent; }
.mem-card:disabled { cursor: default; opacity: 1; }
.mem-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: var(--radius-sm); }
.mem-in { position: absolute; inset: 0; transform-style: preserve-3d; }
.mem-card.up .mem-in { transform: rotateY(180deg); }
.mem-face { position: absolute; inset: 0; display: grid; place-items: center; box-sizing: border-box; border: 1px solid var(--line-2); border-radius: var(--radius-sm); backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.mem-face.back { background: var(--panel-2); }
.mem-face.back i { width: 22%; aspect-ratio: 1; border-radius: 50%; background: var(--line-2); }
.mem-card.tip .mem-face.back { border-color: var(--pc); }
.mem-card.tip .mem-face.back i { background: var(--pc); }
.mem-face.front { transform: rotateY(180deg); font-size: calc(100cqw / var(--cols) * .38); font-weight: 700; color: var(--text); border: 2px solid var(--pc); background: var(--ps); }
.mem-card.miss .mem-face.front { border-color: var(--bad); background: var(--bad-soft); }
.mem-card.matched .mem-face.front { border-color: var(--pc); background: var(--pc); color: var(--pz-ink); }
@media (hover: hover) { .mem-card:not(.up):not(:disabled) .mem-face.back:hover { border-color: var(--faint); background: var(--panel); } }

@media (prefers-reduced-motion: no-preference) {
  .mem-in { transition: transform 380ms var(--ease-out); }
  .mem-card:active:not(:disabled):not(.up) { transform: scale(.95); transition: transform 60ms; }
  .mem-card.pop { animation: mem-pop 380ms var(--ease-out) 300ms; }
}
@keyframes mem-pop { 40% { transform: scale(1.1); } }
</style>
