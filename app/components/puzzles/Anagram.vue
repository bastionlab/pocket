<script setup lang="ts">
import { anagramHintPos, anagramSet, isAnagramAnswer } from '../../utils/puzzles/words'
import { burst, pulse, shake as fxShake } from '../../utils/puzzles/fx'

const props = defineProps<{ day: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
const set = anagramSet(props.day)
const MAX = 6
const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
// found = the words solved so far (in order); slots[i] = index of the tile in slot i (-1 = empty) for the word being solved,
// order = the order its tiles are shown in (Shuffle), locks = slots a bought hint has filled for good
const st = usePuzzleState('anagram', props.day, () => ({
  found: [] as string[],
  slots: Array.from({ length: set[0].word.length }, () => -1) as number[],
  order: [...set[0].word].map((_, i) => i),
  locks: [] as number[],
  mistakes: 0,
  res: null as PuzzleResult | null,
}))
useFinish(st, emit)
const { note, tone, say } = usePuzzleNote()
const slotsEl = ref<HTMLElement | null>(null)
const busy = ref(false) // a solved word is being shown before the next one comes
const win = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const idx = computed(() => Math.min(st.found.length, set.length - 1))
const cur = computed(() => set[idx.value]!)
const tiles = computed(() => [...cur.value.scrambled])
const N = computed(() => cur.value.word.length)
const isLocked = (s: number) => st.locks.includes(s)
const used = (i: number) => st.slots.includes(i)
const guess = computed(() => st.slots.map(s => (s >= 0 ? tiles.value[s] : '')).join(''))
const full = computed(() => st.slots.every(s => s >= 0))
const done = computed(() => !!st.res)
const lost = computed(() => !!st.res && !st.res.solved)
const locked = computed(() => done.value || busy.value)

function place(i: number) {
  if (locked.value || used(i)) return
  const s = st.slots.indexOf(-1)
  if (s < 0) return
  st.slots[s] = i
  navigator.vibrate?.(10)
}
function unplace(s: number) {
  if (locked.value || isLocked(s) || st.slots[s] < 0) return
  st.slots[s] = -1
  navigator.vibrate?.(10)
}
function clear() { if (!locked.value) st.slots = st.slots.map((v, s) => (isLocked(s) ? v : -1)) }
function shuffle() {
  if (locked.value) return
  const o = [...st.order]
  for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j]!, o[i]!] }
  st.order = o
}

/** bought hint: one more correct letter goes into its slot and stays there */
function onHint() {
  if (locked.value || st.locks.length >= N.value - 1) return
  const word = cur.value.word
  const pos = anagramHintPos(word, st.locks, `${props.day}:${idx.value}:${st.locks.length}`)
  if (pos < 0) return
  const letter = word[pos]
  const lockedTiles = new Set(st.locks.map(s => st.slots[s]))
  let tile = st.slots[pos] >= 0 && tiles.value[st.slots[pos]!] === letter ? st.slots[pos]! : -1
  if (tile < 0) tile = tiles.value.findIndex((c, i) => c === letter && !lockedTiles.has(i) && !used(i))
  if (tile < 0) tile = tiles.value.findIndex((c, i) => c === letter && !lockedTiles.has(i))
  const from = st.slots.indexOf(tile)
  if (from >= 0) st.slots[from] = -1
  st.slots[pos] = tile // whatever sat in that slot goes back to the tiles
  st.locks.push(pos)
  nextTick(() => { const el = slotsEl.value?.children[pos] as HTMLElement | undefined; if (el) burst(el, { color: '--accent', count: 8, spread: 36 }) })
}

function next() {
  const w = set[st.found.length]!
  st.slots = Array.from({ length: w.word.length }, () => -1)
  st.order = [...w.word].map((_, i) => i)
  st.locks = []
  busy.value = false
}
function submit() {
  if (locked.value) return
  if (!full.value) { say(t('puzzles.wordle.short')); if (slotsEl.value) fxShake(slotsEl.value); navigator.vibrate?.(20); return }
  const g = guess.value
  if (isAnagramAnswer(cur.value, g)) {
    navigator.vibrate?.([10, 40, 10])
    win.value = true
    const row = slotsEl.value
    if (row) { burst(row, { color: '--ok', count: 22, spread: 90 }); pulse(row) }
    if (st.found.length === set.length - 1) {
      st.found.push(g)
      say(t('puzzles.anagram.solved'), 'ok', 0)
      const m = st.mistakes
      st.res = {
        solved: true,
        attempts: m + 3,
        score: MAX + 1 - m,
        summary: m ? t('puzzles.anagram.summaryWin', { n: m }, m) : t('puzzles.anagram.summaryClean'),
        detail: { words: [...st.found], mistakes: m },
      }
      return
    }
    say(t('puzzles.anagram.solved'), 'ok', 1100)
    busy.value = true
    clearTimeout(timer)
    timer = setTimeout(() => { st.found.push(g); win.value = false; next() }, calm ? 80 : 900)
    return
  }
  st.mistakes++
  clear()
  if (slotsEl.value) fxShake(slotsEl.value)
  navigator.vibrate?.(30)
  if (st.mistakes >= MAX) {
    st.res = {
      solved: false,
      attempts: st.mistakes,
      score: 0,
      summary: t('puzzles.anagram.summaryLoss', { k: st.found.length, a: cur.value.word.toUpperCase() }),
      detail: { words: [...st.found], missed: cur.value.word },
    }
    say(t('puzzles.anagram.missed', { a: cur.value.word.toUpperCase() }), 'bad', 0)
  } else say(t('puzzles.anagram.wrong', { n: MAX - st.mistakes }), 'warn', 2200)
}

/** a finished board (also after a reload) keeps the verdict on screen */
const endNote = computed(() => (!st.res ? '' : st.res.solved ? t('puzzles.anagram.solved') : t('puzzles.anagram.missed', { a: cur.value.word.toUpperCase() })))
const stats = computed(() => [
  { label: t('puzzles.anagram.word'), value: `${Math.min(set.length, st.found.length + (done.value ? 0 : 1))}/${set.length}` },
  { label: t('puzzles.anagram.mistakes'), value: `${st.mistakes}/${MAX}`, tone: st.mistakes >= MAX - 1 ? 'bad' as const : undefined },
])

function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test((e.target as HTMLElement)?.tagName || '')) return
  if (locked.value) return
  if (e.key === 'Enter') { e.preventDefault(); if (!e.repeat) submit() }
  else if (e.key === 'Backspace') { for (let s = N.value - 1; s >= 0; s--) if (st.slots[s]! >= 0 && !isLocked(s)) { st.slots[s] = -1; break } }
  else if (e.key === 'Escape') clear()
  else if (e.key === ' ') { e.preventDefault(); shuffle() }
  else if (/^[a-z]$/i.test(e.key)) {
    const i = tiles.value.findIndex((c, k) => c === e.key.toLowerCase() && !used(k))
    if (i >= 0) place(i)
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); clearTimeout(timer) })
</script>

<template>
  <div class="an" :style="{ '--n': N }">
    <PuzzlesStage :stats="stats" :msg="note || endNote" :tone="note ? tone : st.res?.solved ? 'ok' : 'bad'">
      <template #actions>
        <PuzzlesHintButton game="anagram" :day="day" :disabled="locked || st.locks.length >= N - 1" @bought="onHint" />
      </template>

      <ol class="steps" :aria-label="$t('puzzles.anagram.words')">
        <li v-for="(w, i) in set" :key="i" :class="{ ok: i < st.found.length, now: i === idx && !done }">{{ st.found[i] ?? $t('puzzles.anagram.letterCount', { n: w.word.length }) }}</li>
      </ol>
      <div ref="slotsEl" class="row slots" role="group" :aria-label="$t('puzzles.anagram.answer')">
        <template v-for="(s, i) in st.slots" :key="`${idx}-${i}`">
          <span v-if="lost" class="tile miss" :style="{ '--i': i }">{{ cur.word[i] }}</span>
          <button v-else-if="s >= 0" class="tile" :class="{ lock: isLocked(i), ok: win || !!st.res?.solved, live: win }" :style="{ '--i': i }" :disabled="locked || isLocked(i)" :aria-label="tiles[s]" @click="unplace(i)">{{ tiles[s] }}</button>
          <span v-else class="spot" />
        </template>
      </div>
      <TransitionGroup tag="div" name="tl" class="row pool" role="group" :aria-label="$t('puzzles.anagram.letters')">
        <span v-for="i in st.order" :key="`${idx}-${i}`" class="cell" :class="{ gap: used(i) }">
          <button class="tile" :class="{ used: used(i) }" :disabled="used(i) || locked" :tabindex="used(i) ? -1 : 0" :aria-label="tiles[i]" @click="place(i)">{{ tiles[i] }}</button>
        </span>
      </TransitionGroup>

      <template #tools>
        <PuzzlesTool icon="refresh-cw" :label="$t('puzzles.anagram.shuffle')" :disabled="locked" @click="shuffle" />
        <PuzzlesTool icon="rotate-ccw" :label="$t('puzzles.clear')" :disabled="locked || !st.slots.some((v, s) => v >= 0 && !isLocked(s))" @click="clear" />
        <button class="btn primary go" :disabled="locked || !full" @click="submit">{{ $t('puzzles.submit') }}</button>
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
/* the frame is <PuzzlesStage>; tiles are sized from the stage width and the word length (--n), at most 72px */
.an { --gap: 6px; width: 100%; }
.steps { display: flex; gap: 8px; margin: 0; padding: 0; list-style: none; flex-wrap: wrap; justify-content: center; }
.steps li { min-width: 92px; padding: 6px 12px; border: 1px dashed var(--line-2); border-radius: 999px; font-size: 13px; color: var(--muted); text-align: center; text-transform: uppercase; letter-spacing: .04em; }
.steps li.now { border-style: solid; border-color: var(--accent); color: var(--accent); }
.steps li.ok { border-style: solid; border-color: transparent; background: var(--pz-c3-soft); color: var(--text); font-weight: 700; }
.row { container-type: inline-size; display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: var(--gap); width: min(100%, calc(var(--n) * 72px + (var(--n) - 1) * var(--gap))); }
.pool { margin-top: 6px; }
.cell, .spot { display: block; aspect-ratio: 1; min-width: 0; }
.spot { border: 2px dashed var(--line-2); border-radius: 10px; }
.cell { border-radius: 10px; }
.cell.gap { outline: 2px dashed var(--line); outline-offset: -2px; }
.tile { aspect-ratio: 1; width: 100%; min-width: 0; padding: 0; display: grid; place-items: center; border: 2px solid var(--line-2); border-radius: 10px; background: var(--panel-2); color: var(--text); font: inherit; font-size: clamp(18px, calc(52cqw / var(--n)), 36px); font-weight: 700; line-height: 1; text-transform: uppercase; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.tile.used { opacity: 0; pointer-events: none; }
.tile.lock { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); cursor: default; }
.tile.miss { border-color: var(--bad); background: var(--bad-soft); color: var(--bad); cursor: default; }
.tile:disabled { cursor: default; }
.tile:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.slots .tile.ok { border-color: transparent; background: var(--pz-c3); color: var(--pz-ink); }
.go { min-height: 40px; min-width: 120px; }
@media (pointer: coarse) { .go { min-height: 44px; } }
@media (hover: hover) { .tile:hover:not(:disabled):not(.lock):not(.miss) { border-color: var(--faint); } }
@media (prefers-reduced-motion: no-preference) {
  .tile { transition: transform var(--dur-fast) var(--ease-out); animation: an-pop .14s var(--ease-out); }
  .tile.used { animation: none; }
  .tile:active:not(:disabled) { transform: scale(.92); }
  .tile.miss { animation: an-pop .2s var(--ease-out) backwards; animation-delay: calc(var(--i) * 60ms); }
  .tile.ok.live { animation: an-win .5s var(--ease-spring) backwards; animation-delay: calc(var(--i) * 70ms); }
  .tl-move { transition: transform .3s var(--ease-out); }
}
@keyframes an-pop { from { transform: scale(.82); } }
@keyframes an-win { 0% { transform: translateY(0); } 40% { transform: translateY(-12px); } 100% { transform: translateY(0); } }
</style>
