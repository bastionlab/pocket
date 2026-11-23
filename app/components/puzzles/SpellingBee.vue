<script setup lang="ts">
import { beeHint, beePoints, beePuzzle } from '../../utils/puzzles/words'
import { burst, pulse } from '../../utils/puzzles/fx'

const props = defineProps<{ day: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
const p = beePuzzle(props.day)
const st = usePuzzleState('spelling-bee', props.day, () => ({ found: [] as string[], cur: '', ended: false, outer: [] as string[], hinted: [] as string[], res: null as PuzzleResult | null }))
useFinish(st, emit)
const { note, tone, say: sayNote } = usePuzzleNote()
const shake = ref(false)
const wordEl = ref<HTMLElement | null>(null)
const hiveEl = ref<HTMLElement | null>(null)
const showFound = ref(false)
const showRanks = ref(false)

/** share of the maximum score each rank needs (Beginner ... Queen Bee) */
const RANK_PCT = [0, 2, 5, 8, 15, 25, 40, 50, 70, 100]
/** hex slots around the centre, in hex widths / heights: top, top right, bottom right, bottom, bottom left, top left */
const SLOTS = [[0.75, 0], [1.5, 0.5], [1.5, 1.5], [0.75, 2], [0, 1.5], [0, 0.5]]

const outer = computed(() => (st.outer.length === 6 ? st.outer : p.outer))
const points = computed(() => st.found.reduce((n, w) => n + beePoints(w, p.letters), 0))
const hasPangram = computed(() => st.found.some(w => p.pangrams.includes(w)))
const total = computed(() => p.words.reduce((n, w) => n + beePoints(w, p.letters), 0))
const need = computed(() => RANK_PCT.map(x => Math.round(total.value * x / 100)))
const rank = computed(() => need.value.reduce((r, n, i) => (points.value >= n ? i : r), 0))
/** where the fill ends on the rank track: whole dots passed + the part towards the next one */
const progress = computed(() => {
  const i = rank.value
  if (i >= 9) return 1
  return (i + (points.value - need.value[i]) / Math.max(1, need.value[i + 1] - need.value[i])) / 9
})
const sortedFound = computed(() => [...st.found].sort())
const latest = computed(() => [...st.found].reverse().join(', '))

/** the result exists once the pangram is found (and keeps growing) or after Finish */
function sync() {
  if (!hasPangram.value && !st.ended) return
  st.res = {
    solved: hasPangram.value,
    attempts: st.found.length,
    score: points.value,
    summary: t('puzzles.bee.summary', { rank: t(`puzzles.bee.rank.${rank.value}`), pts: points.value, n: st.found.length }),
    detail: { points: points.value, total: total.value, words: st.found.length, hints: st.hinted.length },
  }
}
function say(msg: string) {
  sayNote(msg, 'warn', 1600)
  shake.value = false
  nextTick(() => { shake.value = true; setTimeout(() => { shake.value = false }, 450) })
  navigator.vibrate?.(20)
}
function key(l: string) {
  if (p.letters.includes(l) && st.cur.length < 15) { st.cur += l; navigator.vibrate?.(10) }
}
function back() { st.cur = st.cur.slice(0, -1) }
function enter() {
  const w = st.cur
  if (!w) return
  st.cur = ''
  if (w.length < 4) say(t('puzzles.bee.short'))
  else if (!w.includes(p.centre)) say(t('puzzles.bee.missing'))
  else if (st.found.includes(w)) say(t('puzzles.bee.dupe'))
  else if (!p.words.includes(w)) say(t('puzzles.bee.unknown'))
  else {
    const pts = beePoints(w, p.letters)
    st.found.push(w)
    const pan = p.pangrams.includes(w)
    sayNote(pan ? t('puzzles.bee.pangramPts', { n: pts }) : t('puzzles.bee.plus', { n: pts }), 'ok', 1700)
    navigator.vibrate?.([10, 30, 10])
    if (wordEl.value) { burst(wordEl.value, { color: pan ? '--warn' : '--ok', count: pan ? 30 : 12, spread: pan ? 120 : 70 }); pulse(wordEl.value) }
    if (pan && hiveEl.value) burst(hiveEl.value, { color: '--warn', count: 24, spread: 110 })
    sync()
  }
}
/** the unfound words a bought hint has shown the first two letters of */
const hints = computed(() => st.hinted.filter(w => !st.found.includes(w)))
function onHint() {
  const w = beeHint(p, st.found, st.hinted, `${props.day}:${st.hinted.length}`)
  if (w) st.hinted.push(w)
}
/** the line under the hive: the last feedback, else the goal (or that the pangram is in) */
const line = computed(() => (note.value ? { m: note.value, t: tone.value } : hasPangram.value ? { m: t('puzzles.bee.pangramFound'), t: 'ok' as const } : { m: t('puzzles.bee.goal'), t: undefined }))
const toNext = computed(() => (rank.value >= 9 ? 0 : need.value[rank.value + 1] - points.value))
const stats = computed(() => [
  { label: t('puzzles.bee.pointsLabel'), value: points.value },
  { label: t('puzzles.bee.wordsLabel'), value: st.found.length },
])
function shuffle() {
  const a = [...outer.value]
  for (let k = 0; k < 8; k++) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
    if (a.join('') !== outer.value.join('')) break
  }
  st.outer = a
}
function finish() { st.ended = true; sync() }
// physical keyboard
function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test((e.target as HTMLElement)?.tagName || '')) return
  if (e.key === 'Enter') { e.preventDefault(); if (!e.repeat) enter() }
  else if (e.key === 'Backspace') back()
  else if (e.key === 'Escape') st.cur = ''
  else if (e.key === ' ') { e.preventDefault(); shuffle() }
  else if (/^[a-z]$/i.test(e.key)) key(e.key.toLowerCase())
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="bee">
    <PuzzlesStage :stats="stats" :msg="line.m" :tone="line.t">
      <template #actions>
        <PuzzlesHintButton game="spelling-bee" :day="day" :disabled="!beeHint(p, st.found, st.hinted, '')" @bought="onHint" />
      </template>

      <div class="ranks">
        <button class="rank" :aria-expanded="showRanks" :aria-label="$t('puzzles.bee.ranks')" @click="showRanks = !showRanks">
          <b>{{ $t(`puzzles.bee.rank.${rank}`) }}</b>
          <span class="track">
            <i class="line" /><i class="fill" :style="{ transform: `scaleX(${progress})` }" />
            <i v-for="k in 10" :key="k" class="dot" :class="{ done: k - 1 <= rank, now: k - 1 === rank }" :style="{ left: `${(k - 1) / 9 * 100}%` }" />
          </span>
          <span class="nxt num">{{ toNext ? $t('puzzles.bee.toNext', { n: toNext }) : '' }}</span>
        </button>
        <ol v-if="showRanks" class="ladder">
          <li v-for="k in 10" :key="k" :class="{ now: k - 1 === rank, done: k - 1 < rank }"><span>{{ $t(`puzzles.bee.rank.${k - 1}`) }}</span><span class="num">{{ need[k - 1] }}</span></li>
        </ol>
      </div>

      <div ref="wordEl" class="word" :class="{ shake }" aria-live="polite">
        <span v-for="(c, i) in st.cur" :key="i" :class="{ mid: c === p.centre }">{{ c }}</span><i class="caret" />
      </div>

      <div ref="hiveEl" class="hive" role="group" :aria-label="$t('puzzles.bee.letters')">
        <button v-for="l in outer" :key="l" class="hx" :style="{ '--x': SLOTS[outer.indexOf(l)][0], '--y': SLOTS[outer.indexOf(l)][1] }" :aria-label="l" @mousedown.prevent @click="key(l)"><span class="shape">{{ l }}</span></button>
        <button class="hx centre" :style="{ '--x': 0.75, '--y': 1 }" :aria-label="$t('puzzles.bee.centreLetter', { l: p.centre })" @mousedown.prevent @click="key(p.centre)"><span class="shape">{{ p.centre }}</span></button>
      </div>

      <ul v-if="hints.length" class="hints" :aria-label="$t('puzzles.bee.hints')">
        <li v-for="w in hints" :key="w"><b>{{ w.slice(0, 2) }}</b><span aria-hidden="true">{{ '.'.repeat(w.length - 2) }}</span><i class="faint">{{ w.length }}</i></li>
      </ul>

      <template #tools>
        <PuzzlesTool icon="x" :label="$t('puzzles.delete')" :disabled="!st.cur" @click="back" />
        <PuzzlesTool icon="refresh-cw" :label="$t('puzzles.anagram.shuffle')" @click="shuffle" />
        <button class="btn primary go" :disabled="!st.cur" @click="enter">{{ $t('puzzles.enter') }}</button>
        <div class="found">
          <button class="fhead" :aria-expanded="showFound" @click="showFound = !showFound">
            <span class="fcount">{{ $t('puzzles.bee.words', { n: st.found.length }) }}</span>
            <span v-if="!showFound" class="fprev">{{ latest }}</span>
            <Icon name="chevron-down" :size="18" :class="{ up: showFound }" class="chev" />
          </button>
          <ul v-if="showFound" class="flist">
            <li v-for="w in sortedFound" :key="w" :class="{ pan: p.pangrams.includes(w) }">{{ w }}</li>
            <li v-if="!sortedFound.length" class="none">{{ $t('puzzles.bee.none') }}</li>
          </ul>
        </div>
        <PuzzlesTool v-if="!st.res" icon="flag" :label="$t('puzzles.bee.finish')" @click="finish" />
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
.bee { --gold: var(--pz-c12); width: 100%; }
.ranks { width: 100%; }
.rank { width: 100%; min-height: 44px; display: grid; grid-template-columns: 104px minmax(0, 1fr) 76px; align-items: center; gap: 10px; padding: 0; border: 0; background: none; color: var(--text); font: inherit; text-align: left; cursor: pointer; }
.rank b { font-size: 14px; }
.nxt { min-width: 0; overflow: hidden; text-overflow: ellipsis; text-align: right; font-size: 12px; color: var(--muted); white-space: nowrap; }
.track { position: relative; height: 16px; margin: 0 6px; }
.line, .fill { position: absolute; left: 0; right: 0; top: 7px; height: 2px; background: var(--line-2); }
.fill { background: var(--gold); transform-origin: left center; }
.dot { position: absolute; top: 4px; width: 8px; height: 8px; margin-left: -4px; border-radius: 50%; background: var(--line-2); }
.dot.done { background: var(--gold); }
.dot.now { top: 1px; width: 14px; height: 14px; margin-left: -7px; background: var(--gold); box-shadow: 0 0 0 3px var(--panel); }
.ladder { list-style: none; margin: 4px 0 0; padding: 6px 12px; display: grid; gap: 2px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel-2); font-size: 13px; color: var(--muted); }
.ladder li { display: flex; justify-content: space-between; min-height: 26px; align-items: center; }
.ladder li.done { color: var(--text); }
.ladder li.now { color: var(--text); font-weight: 700; }
.word { min-height: 46px; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.word .mid { color: var(--gold); }
.caret { width: 2px; height: 32px; margin-left: 2px; background: var(--gold); }
.hive { container-type: inline-size; position: relative; width: min(100%, max(230px, calc(100dvh - 520px)), 340px); aspect-ratio: 2.5 / 2.598; margin: 2px 0; }
.hx { position: absolute; left: 0; top: 0; width: 40%; height: 33.333%; padding: 0; border: 0; background: transparent; clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%); transform: translate(calc(var(--x) * 100%), calc(var(--y) * 100%)); font: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.shape { position: absolute; inset: 0; display: grid; place-items: center; background: color-mix(in oklab, var(--text) 15%, var(--panel)); color: var(--text); clip-path: polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%); transform: scale(.94); font-size: clamp(22px, 11cqw, 36px); font-weight: 700; text-transform: uppercase; }
.hx.centre .shape { background: var(--gold); color: var(--pz-ink); }
.hx:focus-visible .shape { background: var(--accent); color: var(--bg); }
.go { min-height: 40px; min-width: 110px; }
@media (pointer: coarse) { .go { min-height: 44px; } }
.found { flex: 1 1 100%; border: 1px solid var(--line); border-radius: var(--radius-sm); }
.fhead { width: 100%; min-height: 46px; display: flex; align-items: center; gap: 10px; padding: 0 12px; border: 0; background: none; color: var(--text); font: inherit; cursor: pointer; }
.fcount { font-size: 14px; font-weight: 600; white-space: nowrap; }
.fprev { flex: 1; min-width: 0; font-size: 13px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; }
.chev { margin-left: auto; flex-shrink: 0; }
.chev.up { transform: rotate(180deg); }
.flist { list-style: none; margin: 0; padding: 4px 12px 12px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 2px 14px; border-top: 1px solid var(--line); }
.flist li { min-height: 30px; display: flex; align-items: center; border-bottom: 1px solid var(--line); font-size: 14px; }
.flist li.pan { font-weight: 700; }
.flist li.pan::before { content: ''; width: 8px; height: 8px; margin-right: 6px; border-radius: 50%; background: var(--gold); }
.flist li.none { grid-column: 1 / -1; color: var(--muted); border: 0; }
.hints { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.hints li { display: inline-flex; align-items: baseline; gap: 4px; padding: 4px 10px; border: 1px dashed var(--accent); border-radius: 999px; color: var(--accent); font-size: 14px; letter-spacing: .06em; text-transform: uppercase; }
.hints i { font-style: normal; font-size: 11px; letter-spacing: 0; }
@media (prefers-reduced-motion: no-preference) {
  .hx { transition: transform .35s var(--ease-out); }
  .shape { transition: transform var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out); }
  .hx:active .shape { transform: scale(.86); }
  .fill { transition: transform .5s var(--ease-out); }
  .dot { transition: background-color .3s var(--ease-out); }
  .caret { animation: bee-blink 1s steps(1) infinite; }
  .word.shake { animation: bee-shake .45s ease-in-out; }
  .chev { transition: transform var(--dur) var(--ease-out); }
}
@media (hover: hover) { .hx:hover .shape { background: color-mix(in oklab, var(--text) 24%, var(--panel)); } .hx.centre:hover .shape { background: var(--gold); filter: brightness(1.06); } }
@keyframes bee-blink { 50% { opacity: 0; } }
@keyframes bee-shake { 10%, 90% { transform: translateX(-2px); } 20%, 80% { transform: translateX(4px); } 30%, 50%, 70% { transform: translateX(-6px); } 40%, 60% { transform: translateX(6px); } }
</style>
