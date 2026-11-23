<script setup lang="ts">
import { QUORDLE_TRIES, isWordleGuess, quordleAnswers, quordleBoard, quordleKeys, wordleHint } from '../../utils/puzzles/words'
import { burst, pulse, shake as fxShake } from '../../utils/puzzles/fx'

const props = defineProps<{ day: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
const answers = quordleAnswers(props.day)
const TRIES = QUORDLE_TRIES
const st = usePuzzleState('quordle', props.day, () => ({ guesses: [] as string[], cur: '', hints: [] as { b: number, pos: number, l: string }[], res: null as PuzzleResult | null }))
useFinish(st, emit)
const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

const gridEl = ref<HTMLElement | null>(null)
const { note, tone, say } = usePuzzleNote()
const revealRow = ref(-1) // the guess whose tiles are flipping right now
let timer: ReturnType<typeof setTimeout> | undefined

const boards = computed(() => answers.map(a => quordleBoard(st.guesses, a)))
const solvedN = computed(() => boards.value.filter(b => b.solved).length)
const over = computed(() => solvedN.value === 4 || st.guesses.length >= TRIES)
const locked = computed(() => over.value || revealRow.value >= 0)
const fxDone = new Set<number>(boards.value.map((b, i) => (b.solved ? i : -1)).filter(i => i >= 0)) // boards that already had their burst

/** the nine rows of a board: guesses (a solved board stops), then the row being typed, then empty ones */
const rowsOf = (b: number) => {
  const bd = boards.value[b]
  const live = !bd.solved && !over.value
  return Array.from({ length: TRIES }, (_, i) => {
    if (i < bd.rows.length) return { ...bd.rows[i], cur: false }
    if (live && i === bd.rows.length) return { word: st.cur, ev: '', cur: true }
    return { word: '', ev: '', cur: false }
  })
}
/** each key shows four quarters, one per board; rows still flipping are not counted yet */
const quad = computed(() => quordleKeys(st.guesses, answers, revealRow.value))

/** hints: a letter in its right place on the first unsolved board, shown faintly in the row being typed */
const hintBoard = computed(() => boards.value.findIndex(b => !b.solved))
const ghostAt = (b: number, ri: number, c: number) => {
  const bd = boards.value[b]
  if (bd.solved || over.value || ri !== bd.rows.length || c < st.cur.length) return ''
  return st.hints.find(h => h.b === b && h.pos === c && !bd.rows.some(r => r.word[c] === answers[b][c]))?.l ?? ''
}
const hintFor = (seed: string) => {
  const b = hintBoard.value
  if (b < 0) return null
  const h = wordleHint(answers[b], boards.value[b].rows.map(r => r.word), st.hints.filter(x => x.b === b).map(x => x.pos), seed)
  return h ? { b, ...h } : null
}
const nextHint = computed(() => hintFor(''))
function onHint() {
  const h = hintFor(`${props.day}:${st.hints.length}`)
  if (h) st.hints.push(h)
}

function reject(msg: string) {
  say(msg)
  gridEl.value?.querySelectorAll<HTMLElement>('.r.cur').forEach(fxShake)
  navigator.vibrate?.(20)
}
function key(l: string) { if (!locked.value && st.cur.length < 5) st.cur += l }
function back() { if (!locked.value) st.cur = st.cur.slice(0, -1) }
function enter() {
  if (locked.value) return
  if (st.cur.length < 5) return reject(t('puzzles.wordle.short'))
  if (!isWordleGuess(st.cur)) return reject(t('puzzles.wordle.unknown'))
  st.guesses.push(st.cur)
  st.cur = ''
  revealRow.value = st.guesses.length - 1
  clearTimeout(timer)
  timer = setTimeout(() => { revealRow.value = -1; settle(true) }, calm ? 120 : 1450)
}
/** boards that were solved by the last guess get their burst; the result is saved after the last flip */
function settle(live: boolean) {
  if (live) {
    boards.value.forEach((bd, b) => {
      if (!bd.solved || fxDone.has(b)) return
      fxDone.add(b)
      const el = gridEl.value?.children[b] as HTMLElement | undefined
      if (el) { burst(el, { color: '--ok', count: 18, spread: 80 }); pulse(el) }
      navigator.vibrate?.([10, 30, 10])
    })
  }
  if (!over.value || st.res) return
  const won = solvedN.value === 4
  const n = st.guesses.length
  const missed = answers.filter((_, b) => !boards.value[b].solved).map(a => a.toUpperCase()).join(', ')
  st.res = {
    solved: won,
    attempts: n,
    score: won ? Math.max(1, TRIES + 1 - n) : 0,
    summary: won ? t('puzzles.quordle.summaryWin', { n, max: TRIES }) : t('puzzles.quordle.summaryLoss', { k: solvedN.value, a: missed }),
    detail: { answers, hints: st.hints.length },
  }
  if (live) say(won ? t('puzzles.quordle.summaryWin', { n, max: TRIES }) : t('puzzles.quordle.missed', { a: missed }), won ? 'ok' : 'bad', 0)
  if (live && !won && gridEl.value) fxShake(gridEl.value)
}
onMounted(() => settle(false))
onBeforeUnmount(() => clearTimeout(timer))

/** a finished game (also after a reload) keeps the verdict on screen */
const endNote = computed(() => {
  if (!st.res || locked.value) return ''
  return st.res.solved ? t('puzzles.quordle.summaryWin', { n: st.guesses.length, max: TRIES }) : t('puzzles.quordle.missed', { a: answers.filter((_, b) => !boards.value[b].solved).map(a => a.toUpperCase()).join(', ') })
})
const stats = computed(() => [
  { label: t('puzzles.quordle.solved'), value: `${solvedN.value}/4`, tone: solvedN.value === 4 ? 'ok' as const : undefined },
  { label: t('puzzles.quordle.triesLeft'), value: Math.max(0, TRIES - st.guesses.length), tone: !over.value && TRIES - st.guesses.length <= 2 ? 'warn' as const : undefined },
])
const label = (r: { word: string, ev: string }, c: number) => (r.word[c] ? `${r.word[c]}${r.ev ? `, ${t(`puzzles.wordle.state.${r.ev[c]}`)}` : ''}` : t('puzzles.wordle.empty'))
</script>

<template>
  <div class="qd">
    <PuzzlesStage :stats="stats" :msg="note || endNote" :tone="note ? tone : st.res?.solved ? 'ok' : 'bad'">
      <template #actions>
        <PuzzlesHintButton game="quordle" :day="day" :disabled="locked || !nextHint" @bought="onHint" />
      </template>

      <div class="bx">
        <div ref="gridEl" class="boards" role="group" :aria-label="$t('puzzles.quordle.boards')">
          <div v-for="(a, b) in answers" :key="b" class="board" :class="{ done: boards[b].solved }" role="grid" :aria-label="$t('puzzles.quordle.board', { n: b + 1 })">
            <div v-for="(r, ri) in rowsOf(b)" :key="ri" class="r" :class="{ cur: r.cur }" role="row">
              <div v-for="c in 5" :key="c" class="t" :style="{ '--i': c - 1 }" role="gridcell" :aria-label="label(r, c - 1)">
                <div class="in" :class="{ rev: !!r.ev, flip: ri === revealRow && !!r.ev }">
                  <span class="f" :class="{ filled: !!r.word[c - 1], ghost: !!ghostAt(b, ri, c - 1) }">{{ r.word[c - 1] || ghostAt(b, ri, c - 1) }}</span>
                  <span class="b" :class="r.ev[c - 1]">{{ r.word[c - 1] }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #tools>
        <PuzzlesKeyboard class="qd-kb" :quad="quad" :disabled="over" @key="key" @back="back" @enter="enter" />
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
/* four boards: 2 x 2 in a narrow stage, one row of four in a wide one (container query on .bx) */
.qd { --c-hit: var(--pz-c3); --c-near: var(--pz-c12); --c-miss: color-mix(in oklab, var(--text) 9%, var(--panel)); width: 100%; }
.qd-kb { flex: 1 1 100%; }
.bx { container: bx / inline-size; width: 100%; }
.boards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 12px; }
@container bx (min-width: 600px) { .boards { grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; } .t { aspect-ratio: 4 / 5; } }
.board { --gap: 3px; container-type: inline-size; display: grid; align-content: start; gap: var(--gap); padding: 4px; border-radius: var(--radius-sm); border: 1.5px solid var(--line); }
.board.done { border-color: var(--ok); background: var(--ok-soft); }
.r { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: var(--gap); }
.t { aspect-ratio: 1; perspective: 400px; }
.in { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; }
.in.rev { transform: rotateX(180deg); }
.f, .b { position: absolute; inset: 0; display: grid; place-items: center; border-radius: 4px; font-size: clamp(11px, 9cqw, 28px); font-weight: 700; line-height: 1; text-transform: uppercase; backface-visibility: hidden; -webkit-backface-visibility: hidden; }
.f { border: 1.5px solid var(--line-2); color: var(--text); background: var(--panel); }
.f.filled { border-color: var(--faint); }
.f.ghost { border-color: var(--accent); border-style: dashed; color: var(--accent); opacity: .85; }
.r.cur .f:not(.filled):not(.ghost) { border-color: var(--faint); }
.b { transform: rotateX(180deg); color: var(--pz-ink); }
.b.g { background: var(--c-hit); }
.b.y { background: var(--c-near); }
.b.x { background: var(--c-miss); color: var(--muted); }
@media (prefers-reduced-motion: no-preference) {
  .f.filled { animation: qd-pop .1s var(--ease-out); }
  .in.flip { animation: qd-flip .45s ease-in-out backwards; animation-delay: calc(var(--i) * 200ms); }
}
@keyframes qd-pop { 0% { transform: scale(.88); } 55% { transform: scale(1.1); } 100% { transform: scale(1); } }
@keyframes qd-flip { from { transform: rotateX(0); } }
</style>
