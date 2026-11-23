<script setup lang="ts">
import { HANGMAN_LIVES, hangmanHint, hangmanWord } from '../../utils/puzzles/words'
import { burst, pulse, shake as fxShake } from '../../utils/puzzles/fx'

const props = defineProps<{ day: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
const word = hangmanWord(props.day)
const MAX = HANGMAN_LIVES
// tried = letters the player guessed, shown = letters a bought hint gave away (they cost no life)
const st = usePuzzleState('hangman', props.day, () => ({ tried: [] as string[], shown: [] as string[], res: null as PuzzleResult | null }))
useFinish(st, emit)
const wrong = computed(() => st.tried.filter(l => !word.includes(l)))
const known = (c: string) => st.tried.includes(c) || st.shown.includes(c)
/** keys: g = in the word, r = not in it (Keyboard locks marked keys) */
const marks = computed(() => ({
  ...Object.fromEntries(st.shown.map(l => [l, 'g'])),
  ...Object.fromEntries(st.tried.map(l => [l, word.includes(l) ? 'g' : 'r'])),
}))
const lost = computed(() => !!st.res && !st.res.solved)
const live = ref(false) // a win that just happened (letters hop), not a reload
const galEl = ref<HTMLElement | null>(null)
const wordEl = ref<HTMLElement | null>(null)
const { note, tone, say } = usePuzzleNote()
const nextHint = computed(() => hangmanHint(word, [...st.tried, ...st.shown], ''))

function settle() {
  if (st.res) return
  const won = [...word].every(known)
  const out = wrong.value.length >= MAX
  if (!won && !out) return
  live.value = won
  st.res = {
    solved: won,
    attempts: st.tried.length,
    score: won ? MAX - wrong.value.length : 0,
    summary: won ? t('puzzles.hangman.summaryWin', { n: wrong.value.length, max: MAX }) : t('puzzles.hangman.summaryLoss', { a: word.toUpperCase() }),
    detail: { word, hints: st.shown.length },
  }
  say(won ? t('puzzles.hangman.won', { n: wrong.value.length }) : t('puzzles.hangman.summaryLoss', { a: word.toUpperCase() }), won ? 'ok' : 'bad', 0)
  nextTick(() => {
    if (won) {
      navigator.vibrate?.([10, 40, 10])
      wordEl.value?.querySelectorAll<HTMLElement>('.slot').forEach((c, i) => setTimeout(() => burst(c, { color: '--ok', count: 6, spread: 40 }), i * 60))
      if (wordEl.value) pulse(wordEl.value)
    } else if (galEl.value) fxShake(galEl.value)
  })
}
/** a finished game (also after a reload) keeps the verdict on screen */
const endNote = computed(() => (!st.res ? '' : st.res.solved ? t('puzzles.hangman.won', { n: wrong.value.length }) : t('puzzles.hangman.summaryLoss', { a: word.toUpperCase() })))
const stats = computed(() => [
  { label: t('puzzles.hangman.livesLabel'), value: MAX - wrong.value.length, tone: MAX - wrong.value.length <= 2 ? 'bad' as const : undefined },
  { label: t('puzzles.hangman.wrongLabel'), value: wrong.value.length ? wrong.value.join(' ').toUpperCase() : '-' },
])

function guess(l: string) {
  if (st.res || known(l)) return
  st.tried.push(l)
  if (!word.includes(l)) {
    navigator.vibrate?.(20)
    if (galEl.value) fxShake(galEl.value)
    say(t('puzzles.hangman.noLetter', { l: l.toUpperCase() }), 'warn', 1500)
  } else {
    const hit = wordEl.value?.querySelectorAll<HTMLElement>('.slot')
    hit?.forEach((c, i) => { if (word[i] === l) pulse(c) })
  }
  settle()
}
function onHint() {
  const l = hangmanHint(word, [...st.tried, ...st.shown], `${props.day}:${st.shown.length}`)
  if (!l) return
  st.shown.push(l)
  nextTick(() => wordEl.value?.querySelectorAll<HTMLElement>('.slot').forEach((c, i) => { if (word[i] === l) burst(c, { color: '--accent', count: 8, spread: 36 }) }))
  settle()
}
</script>

<template>
  <div class="hm" :style="{ '--n': word.length }">
    <PuzzlesStage :stats="stats" :msg="note || endNote" :tone="note ? tone : st.res?.solved ? 'ok' : 'bad'">
      <template #actions>
        <PuzzlesHintButton game="hangman" :day="day" :disabled="!!st.res || !nextHint" @bought="onHint" />
      </template>

      <svg ref="galEl" class="gal" :class="{ dead: lost }" viewBox="0 0 200 190" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" role="img" :aria-label="$t('puzzles.hangman.wrong', { n: wrong.length, max: MAX })">
        <path class="f" d="M22 178h116M52 178V16M52 16h80M52 48l32-32M132 16v26" />
        <circle class="p" :class="{ on: wrong.length >= 1 }" cx="132" cy="58" r="16" />
        <path class="p" :class="{ on: wrong.length >= 2 }" d="M132 74v46" />
        <path class="p" :class="{ on: wrong.length >= 3 }" d="M132 88l-22 22" />
        <path class="p" :class="{ on: wrong.length >= 4 }" d="M132 88l22 22" />
        <path class="p" :class="{ on: wrong.length >= 5 }" d="M132 120l-20 34" />
        <path class="p" :class="{ on: wrong.length >= 6 }" d="M132 120l20 34" />
        <path v-if="lost" class="eyes" stroke-width="3" d="M124 52l5 5m0-5l-5 5M135 52l5 5m0-5l-5 5" />
      </svg>
      <div ref="wordEl" class="word" role="group" :aria-label="$t('puzzles.hangman.word', { n: word.length })">
        <span v-for="(c, i) in word" :key="i" class="slot" :class="{ hit: known(c), shown: !st.tried.includes(c) && st.shown.includes(c), miss: lost && !known(c), won: st.res?.solved, hop: live }" :style="{ '--i': i }">{{ known(c) || lost ? c : '' }}</span>
      </div>

      <template #tools>
        <PuzzlesKeyboard class="hm-kb" bare lock :marks="marks" :disabled="!!st.res" @key="guess" />
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
.hm { --c-hit: var(--pz-c3); --c-miss: color-mix(in oklab, var(--text) 9%, var(--panel)); --c-bad: var(--pz-c1); width: 100%; }
.hm-kb { flex: 1 1 100%; }
.gal { width: min(100%, 210px); height: auto; aspect-ratio: 200 / 190; color: var(--text); overflow: visible; }
.gal .f { color: var(--faint); }
.gal .p { opacity: 0; }
.gal .p.on { opacity: 1; }
.gal.dead .p.on { color: var(--bad); }
.gal .eyes { color: var(--bad); }
.word { container-type: inline-size; display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 6px; width: min(100%, calc(var(--n) * 52px + (var(--n) - 1) * 6px)); }
.slot { height: 54px; display: grid; place-items: center; border-bottom: 3px solid var(--line-2); font-size: clamp(22px, calc(60cqw / var(--n)), 34px); font-weight: 700; line-height: 1; text-transform: uppercase; }
.slot.hit { border-color: var(--text); }
.slot.shown { color: var(--accent); border-color: var(--accent); }
.slot.miss { color: var(--bad); border-color: var(--bad); }
.slot.won { color: var(--ok); border-color: var(--ok); }
@media (prefers-reduced-motion: no-preference) {
  .gal .p { transition: opacity .25s var(--ease-out), transform .25s var(--ease-out); transform: translateY(-5px); }
  .gal .p.on { transform: none; }
  .slot.hit { animation: hm-pop .18s var(--ease-out); }
  .slot.hop { animation: hm-hop .5s var(--ease-out) backwards; animation-delay: calc(var(--i) * 70ms); }
}
@keyframes hm-pop { from { transform: scale(.7); opacity: 0; } }
@keyframes hm-hop { 0% { transform: translateY(0); } 40% { transform: translateY(-10px); } 100% { transform: translateY(0); } }
</style>
