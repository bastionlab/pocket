<script setup lang="ts">
import { isWordleGuess, wordleAnswer, wordleEval, wordleHint } from '../../utils/puzzles/words'
import { burst, pulse, shake as fxShake } from '../../utils/puzzles/fx'

const props = defineProps<{ day: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
const answer = wordleAnswer(props.day)
const ORD = ['1st', '2nd', '3rd', '4th', '5th']
const PREF = 'puzzles:pref:wordle'
const pref = (() => { try { return JSON.parse(localStorage.getItem(PREF) || '{}') as { hc?: boolean, hard?: boolean } } catch { return {} } })()
const savePref = () => { try { localStorage.setItem(PREF, JSON.stringify({ hc: hc.value, hard: st.hard })) } catch { /* private mode */ } }
const st = usePuzzleState('wordle', props.day, () => ({ guesses: [] as string[], cur: '', hard: !!pref.hard, hints: [] as { pos: number, l: string }[], res: null as PuzzleResult | null }))
useFinish(st, emit)
const hc = ref(!!pref.hc)
const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

const won = computed(() => st.guesses[st.guesses.length - 1] === answer)
const over = computed(() => won.value || st.guesses.length >= 6)
const revealRow = ref(-1) // the row whose tiles are flipping right now
const bounceRow = ref(-1)
const boardEl = ref<HTMLElement | null>(null)
const rowEl = (i: number) => boardEl.value?.children[i] as HTMLElement | undefined
const { note, tone, say } = usePuzzleNote()
let timer: ReturnType<typeof setTimeout> | undefined

const rows = computed(() => Array.from({ length: 6 }, (_, i) => {
  const g = st.guesses[i]
  if (g) return { word: g, ev: wordleEval(g, answer) }
  return { word: i === st.guesses.length ? st.cur : '', ev: '' }
}))
/** keyboard colours = best state per letter, but only once a row has finished flipping */
const marks = computed(() => {
  const m: Record<string, string> = {}
  const rank: Record<string, number> = { x: 1, y: 2, g: 3 }
  st.guesses.forEach((g, gi) => {
    if (gi === revealRow.value) return
    wordleEval(g, answer).split('').forEach((e, i) => { if ((rank[m[g[i]]] || 0) < rank[e]) m[g[i]] = e })
  })
  return m
})
/** a bought hint shows its letter faintly in its column of the row being typed, until a guess hits that spot */
const ghosts = computed(() => st.hints.filter(h => !st.guesses.some(g => g[h.pos] === answer)))
const ghostAt = (ri: number, c: number) => (ri === st.guesses.length && !over.value && c >= st.cur.length ? ghosts.value.find(h => h.pos === c)?.l ?? '' : '')
const nextHint = computed(() => wordleHint(answer, st.guesses, st.hints.map(h => h.pos), ''))
function onHint() {
  const h = wordleHint(answer, st.guesses, st.hints.map(h => h.pos), `${props.day}:${st.hints.length}`)
  if (h) st.hints.push(h)
}
const busy = computed(() => revealRow.value >= 0)
const locked = computed(() => over.value || busy.value)

/** hard mode: every revealed hint has to be used in the next guess */
function hardCheck(w: string): string {
  const need: Record<string, number> = {}
  const place: Record<number, string> = {}
  for (const g of st.guesses) {
    const ev = wordleEval(g, answer)
    const n: Record<string, number> = {}
    for (let i = 0; i < 5; i++) {
      if (ev[i] === 'x') continue
      n[g[i]] = (n[g[i]] || 0) + 1
      if (ev[i] === 'g') place[i] = g[i]
    }
    for (const l in n) need[l] = Math.max(need[l] || 0, n[l])
  }
  for (let i = 0; i < 5; i++) if (place[i] && w[i] !== place[i]) return t('puzzles.wordle.hardPos', { n: ORD[i], l: place[i].toUpperCase() })
  for (const l in need) if ([...w].filter(c => c === l).length < need[l]) return t('puzzles.wordle.hardHas', { l: l.toUpperCase() })
  return ''
}

function reject(msg: string) {
  say(msg)
  const r = rowEl(st.guesses.length)
  if (r) fxShake(r)
  navigator.vibrate?.(20)
}
function key(l: string) { if (!locked.value && st.cur.length < 5) st.cur += l }
function back() { if (!locked.value) st.cur = st.cur.slice(0, -1) }
function enter() {
  if (locked.value) return
  if (st.cur.length < 5) return reject(t('puzzles.wordle.short'))
  if (!isWordleGuess(st.cur)) return reject(t('puzzles.wordle.unknown'))
  if (st.hard) { const bad = hardCheck(st.cur); if (bad) return reject(bad) }
  st.guesses.push(st.cur)
  st.cur = ''
  revealRow.value = st.guesses.length - 1
  clearTimeout(timer)
  timer = setTimeout(() => { revealRow.value = -1; settle(true) }, calm ? 120 : 1580)
}
/** the result is saved only after the last flip, so the answer is not spoiled by the result card */
function settle(live: boolean) {
  if (!over.value || st.res) return
  const n = st.guesses.length
  st.res = {
    solved: won.value,
    attempts: n,
    score: won.value ? n : 0,
    summary: won.value ? t('puzzles.wordle.summaryWin', { praise: t(`puzzles.wordle.praise.${n}`), n }) : t('puzzles.wordle.summaryLoss', { a: answer.toUpperCase() }),
    detail: { answer, hard: st.hard, hints: st.hints.length },
  }
  if (live) say(won.value ? t(`puzzles.wordle.praise.${n}`) : t('puzzles.wordle.summaryLoss', { a: answer.toUpperCase() }), won.value ? 'ok' : 'bad', 0)
  if (live && won.value) {
    bounceRow.value = n - 1
    navigator.vibrate?.([10, 40, 10])
    nextTick(() => {
      rowEl(n - 1)?.querySelectorAll<HTMLElement>('.t').forEach((tile, i) => setTimeout(() => burst(tile, { color: '--ok', count: 7, spread: 46 }), i * 90))
      if (boardEl.value) pulse(boardEl.value)
    })
  } else if (live && boardEl.value) fxShake(boardEl.value)
}
function toggleHard() {
  if (st.guesses.length || over.value) return
  st.hard = !st.hard
  savePref()
}
function toggleHc() { hc.value = !hc.value; savePref() }

onMounted(() => settle(false))
onBeforeUnmount(() => clearTimeout(timer))

/** a finished board (also after a reload) keeps saying how it went */
const endNote = computed(() => (!st.res || busy.value ? '' : won.value ? t(`puzzles.wordle.praise.${st.guesses.length}`) : t('puzzles.wordle.summaryLoss', { a: answer.toUpperCase() })))
const stats = computed(() => [
  { label: t('puzzles.wordle.tries'), value: `${st.guesses.length}/6` },
  ...(st.hints.length ? [{ label: t('puzzles.wordle.hints'), value: st.hints.length }] : []),
])
const label = (r: { word: string, ev: string }, c: number) => (r.word[c] ? `${r.word[c]}${r.ev ? `, ${t(`puzzles.wordle.state.${r.ev[c]}`)}` : ''}` : t('puzzles.wordle.empty'))
</script>

<template>
  <div class="wd" :class="{ hc }">
    <PuzzlesStage :stats="stats" :msg="note || endNote" :tone="note ? tone : won ? 'ok' : 'bad'">
      <template #actions>
        <PuzzlesTool icon="shield" icon-only :label="$t('puzzles.wordle.hard')" :on="st.hard" :disabled="st.guesses.length > 0" @click="toggleHard" />
        <PuzzlesTool icon="eye" icon-only :label="$t('puzzles.wordle.contrast')" :on="hc" @click="toggleHc" />
        <PuzzlesHintButton game="wordle" :day="day" :disabled="locked || !nextHint" @bought="onHint" />
      </template>

      <div ref="boardEl" class="board" role="grid" :aria-label="$t('puzzles.wordle.board')">
        <div v-for="(r, ri) in rows" :key="ri" class="r" role="row">
          <div v-for="c in 5" :key="c" class="t" :class="{ bounce: bounceRow === ri }" :style="{ '--i': c - 1 }" role="gridcell" :aria-label="label(r, c - 1)">
            <div class="in" :class="{ rev: !!r.ev, flip: ri === revealRow }">
              <span class="f" :class="{ filled: !!r.word[c - 1], ghost: !!ghostAt(ri, c - 1) }">{{ r.word[c - 1] || ghostAt(ri, c - 1) }}</span>
              <span class="b" :class="r.ev[c - 1]">{{ r.word[c - 1] }}</span>
            </div>
          </div>
        </div>
      </div>

      <template #tools>
        <PuzzlesKeyboard class="wd-kb" :marks="marks" :disabled="over" @key="key" @back="back" @enter="enter" />
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
/* the frame is <PuzzlesStage>; the board is sized from the stage width AND the window height (keyboard stays in view) */
.wd { --c-hit: var(--pz-c3); --c-near: var(--pz-c12); --c-miss: color-mix(in oklab, var(--text) 9%, var(--panel)); width: 100%; }
.wd.hc { --c-hit: var(--pz-c5); --c-near: var(--pz-c2); }
.wd-kb { flex: 1 1 100%; }
.board { --gap: 6px; container-type: inline-size; width: min(100%, max(240px, calc((100dvh - 430px) * .8333))); display: grid; gap: var(--gap); }
@media (max-width: 640px) { .board { width: min(100%, max(240px, calc((100dvh - 500px) * .8333))); } }
.r { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--gap); }
.t { aspect-ratio: 1; perspective: 500px; }
.in { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; }
.in.rev { transform: rotateX(180deg); }
.f, .b { position: absolute; inset: 0; display: grid; place-items: center; border-radius: 6px; font-size: clamp(22px, 10.5cqw, 44px); font-weight: 700; line-height: 1; text-transform: uppercase; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.f { border: 2px solid var(--line-2); color: var(--text); background: var(--panel); }
.f.filled { border-color: var(--faint); }
.f.ghost { border-color: var(--accent); border-style: dashed; color: var(--accent); opacity: .85; }
.b { transform: rotateX(180deg); color: var(--pz-ink); }
.b.g { background: var(--c-hit); }
.b.y { background: var(--c-near); }
.b.x { background: var(--c-miss); color: var(--muted); }
@media (prefers-reduced-motion: no-preference) {
  .f.filled { animation: wd-pop .1s var(--ease-out); }
  .in.flip { animation: wd-flip .5s ease-in-out backwards; animation-delay: calc(var(--i) * 250ms); }
  .t.bounce { animation: wd-bounce .7s var(--ease-out) both; animation-delay: calc(var(--i) * 90ms); }
}
@keyframes wd-pop { 0% { transform: scale(.88); } 55% { transform: scale(1.1); } 100% { transform: scale(1); } }
@keyframes wd-flip { from { transform: rotateX(0); } }
@keyframes wd-bounce { 0%, 20% { transform: translateY(0); } 40% { transform: translateY(-14px); } 55% { transform: translateY(3px); } 70% { transform: translateY(-5px); } 85%, 100% { transform: translateY(0); } }
</style>
