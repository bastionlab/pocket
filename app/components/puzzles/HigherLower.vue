<script setup lang="ts">
import { HL_GOAL, HL_ROUNDS, higherLowerSequence } from '../../utils/puzzles/logic'
import { termLabel } from '../../utils/puzzles/searchTerms'
import { burst, pulse, shake } from '../../utils/puzzles/fx'

/**
 * Higher or Lower, the search-volume game: term A shows its (approximate) monthly Google searches, the player says
 * whether term B is searched more or less. B's number counts up, a right answer slides B into A's place, a wrong one
 * ends the round. Twelve rounds a day; a streak of HL_GOAL solves it.
 */
const props = defineProps<{ day: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
const seq = higherLowerSequence(props.day)
// i = the term on top, rev = the bottom one is shown (answered, the next card is about to slide in); hint = the round a bought hint belongs to
const st = usePuzzleState('higher-lower', props.day, () => ({ i: 0, streak: 0, wrong: false, rev: false, hint: -1, hints: 0, res: null as PuzzleResult | null }))
useFinish(st, emit)

const root = ref<HTMLElement | null>(null)
const counted = ref(0) // B's number while it counts up
const lastOk = ref(true)
const busy = ref(false) // a guess is being played out
const timers: ReturnType<typeof setTimeout>[] = []
const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }
let raf = 0
onBeforeUnmount(() => { timers.forEach(clearTimeout); cancelAnimationFrame(raf) })

const done = computed(() => !!st.res)
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
// the cards that exist: the one that left, A, B and the one waiting below
const idxs = computed(() => [st.i - 1, st.i, st.i + 1, st.i + 2].filter(k => k >= 0 && k < seq.length))
const vol = (k: number) => seq[k]!.vol
const label = (k: number) => termLabel(seq[k]!.name)
/** the number a card shows: past and current top cards in full, the bottom one only once answered (counting up) */
const numOf = (k: number): number | null => (k <= st.i ? vol(k) : k === st.i + 1 && st.rev ? counted.value : null)
const mask = (k: number) => fmtNum(vol(k)).replace(/\d/g, '•')
const digits = (k: number) => String(vol(k)).length
const canHint = computed(() => !done.value && !busy.value && !st.rev && st.hint !== st.i)
/** the line under the board: how the last answer went (kept while the next pair slides in) */
const feedback = computed(() => {
  if (st.res?.solved) return t('puzzles.hl.reached', { n: st.streak })
  if (st.rev) return lastOk.value ? t('puzzles.hl.correct') : t(vol(st.i + 1) > vol(st.i) ? 'puzzles.hl.wasHigher' : 'puzzles.hl.wasLower')
  if (st.res) return st.res.solved ? t('puzzles.hl.reached', { n: st.streak }) : t('puzzles.hl.short', { n: st.streak, m: HL_GOAL - st.streak })
  return ''
})
const trail = computed(() => Array.from({ length: HL_ROUNDS }, (_, k) => (k < st.streak ? 'ok' : st.wrong && k === st.streak ? 'bad' : '')))

function countUp(to: number) {
  cancelAnimationFrame(raf)
  if (reduced()) { counted.value = to; return }
  const t0 = performance.now(), ms = 650
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / ms)
    counted.value = Math.round(to * (1 - (1 - p) ** 3))
    if (p < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

function finalize() {
  if (st.res) return
  const solved = st.streak >= HL_GOAL
  const base = solved ? t('puzzles.hl.sumWon', { n: st.streak, max: HL_ROUNDS }) : t('puzzles.hl.sumShort', { n: st.streak, m: HL_GOAL - st.streak })
  st.res = { solved, attempts: st.streak, score: st.streak, summary: st.hints ? `${base} ${t('puzzles.hl.sumHints', { h: st.hints })}` : base, detail: { rounds: HL_ROUNDS, hints: st.hints } }
}
/** after the answer was shown: slide on to the next pair, or end the game */
function settle() {
  busy.value = false
  if (st.wrong || st.i + 1 >= HL_ROUNDS) { finalize(); return }
  st.i++
  st.rev = false
}
// reloaded between the guess and the next pair: carry on at once
onMounted(() => { if (st.rev && !st.res) { counted.value = vol(st.i + 1); settle() } else if (st.rev) counted.value = vol(st.i + 1) })

function pick(more: boolean) {
  if (done.value || busy.value || st.rev) return
  const a = vol(st.i), b = vol(st.i + 1)
  const ok = (b > a) === more
  busy.value = true
  lastOk.value = ok
  st.rev = true
  if (ok) st.streak++
  else st.wrong = true
  counted.value = 0
  countUp(b)
  navigator.vibrate?.(ok ? 10 : [20, 40, 20])
  const card = () => root.value?.querySelector<HTMLElement>('.hl-card.b')
  later(() => {
    const e = card()
    if (!e) return
    if (ok) { burst(e, { color: '--ok', count: 18, spread: 80 }); const s = root.value?.querySelector<HTMLElement>('.hl-streak b'); if (s) pulse(s) }
    else { shake(e); burst(e, { color: '--bad', count: 30, spread: 120 }) }
  }, 700)
  later(settle, ok ? 1500 : 1800)
}
// desktop: Arrow up / H = more, Arrow down / L = less
function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement | null)?.closest('input, textarea, select')) return
  if (e.key === 'ArrowUp' || e.key === 'h' || e.key === 'H') { e.preventDefault(); pick(true) } else if (e.key === 'ArrowDown' || e.key === 'l' || e.key === 'L') { e.preventDefault(); pick(false) }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
function hint() {
  if (!canHint.value) return
  st.hint = st.i
  st.hints++
}
</script>

<template>
  <div ref="root" class="hl">
    <PuzzlesStage
      :stats="[{ label: $t('puzzles.hl.streakLabel'), value: `${st.streak}/${HL_GOAL}`, tone: st.streak >= HL_GOAL ? 'ok' : undefined }, { label: $t('puzzles.hl.round'), value: `${Math.min(st.i + 1, HL_ROUNDS)}/${HL_ROUNDS}` }]"
      :msg="feedback" :tone="st.rev && !lastOk ? 'bad' : st.rev || st.res?.solved ? 'ok' : undefined"
    >
      <template #actions>
        <PuzzlesHintButton game="higher-lower" :day="day" :disabled="!canHint" :label="$t('puzzles.hl.hintLabel')" @bought="hint" />
      </template>

      <div class="hl-trail" role="img" :aria-label="$t('puzzles.hl.rounds', { n: st.streak, max: HL_ROUNDS })">
        <i v-for="(c, k) in trail" :key="k" :class="[c, { goal: k === HL_GOAL - 1 }]" />
      </div>

      <div class="hl-stage" :style="{ '--cur': st.i }">
        <div class="hl-track">
          <div
            v-for="k in idxs" :key="k" class="hl-card" :class="{ a: k === st.i, b: k === st.i + 1, ok: k === st.i + 1 && st.rev && lastOk, bad: k === st.i + 1 && st.rev && !lastOk }"
            :style="{ '--k': k }" :aria-hidden="k < st.i || k > st.i + 1"
          >
            <b class="hl-name">{{ label(k) }}</b>
            <span v-if="numOf(k) !== null" class="hl-num num">{{ fmtNum(numOf(k)) }}</span>
            <span v-else-if="st.hint === st.i && k === st.i + 1" class="hl-num hl-mask num" :aria-label="$t('puzzles.hl.digits', { n: digits(k) })">{{ mask(k) }}</span>
            <span v-else class="hl-num hl-q" aria-hidden="true">?</span>
            <span class="hl-cap">{{ numOf(k) !== null ? $t('puzzles.hl.perMonth') : st.hint === st.i && k === st.i + 1 ? $t('puzzles.hl.digits', { n: digits(k) }) : $t('puzzles.hl.hidden') }}</span>
          </div>
        </div>
      </div>

      <p class="hl-ask" aria-live="polite">{{ done ? $t('puzzles.hl.ended') : $t('puzzles.hl.question', { b: label(Math.min(st.i + 1, seq.length - 1)), a: label(st.i) }) }}</p>
      <div class="hl-btns">
        <button class="btn hl-btn" :disabled="done || busy || st.rev" @click="pick(true)"><Icon name="chevron-up" :size="18" />{{ $t('puzzles.hl.more') }}<kbd class="hl-kbd" aria-hidden="true">H</kbd></button>
        <button class="btn hl-btn" :disabled="done || busy || st.rev" @click="pick(false)"><Icon name="chevron-down" :size="18" />{{ $t('puzzles.hl.less') }}<kbd class="hl-kbd" aria-hidden="true">L</kbd></button>
      </div>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
.hl { --h: 118px; --gap: 12px; width: 100%; }
.hl-trail { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 3px; width: 100%; }
.hl-trail i { height: 6px; border-radius: 3px; background: var(--track); }
.hl-trail i.goal { box-shadow: 0 0 0 1px var(--accent); }
.hl-trail i.ok { background: var(--ok); }
.hl-trail i.bad { background: var(--bad); }

/* two card slots, clipped: cards sit at fixed offsets on a track and the track moves, nothing reflows */
.hl-stage { position: relative; width: 100%; height: calc(var(--h) * 2 + var(--gap)); overflow: hidden; border-radius: var(--radius); }
.hl-track { position: absolute; inset: 0; transform: translateY(calc(var(--cur) * (var(--h) + var(--gap)) * -1)); }
.hl-card {
  position: absolute; left: 0; right: 0; top: calc(var(--k) * (var(--h) + var(--gap))); height: var(--h); box-sizing: border-box;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 8px 14px; text-align: center;
  border: 1px solid var(--line-2); border-radius: var(--radius); background: var(--panel-2); overflow: hidden;
}
.hl-card.b { background: var(--panel); border-style: dashed; }
.hl-card.b.ok { border-style: solid; border-color: var(--ok); background: var(--ok-soft); }
.hl-card.b.bad { border-style: solid; border-color: var(--bad); background: var(--bad-soft); }
.hl-name { max-width: 100%; font-size: 20px; line-height: 1.2; font-weight: 700; overflow-wrap: anywhere; }
.hl-num { font-size: clamp(26px, 8.4vw, 34px); line-height: 1.15; font-weight: 700; font-variant-numeric: tabular-nums; }
.hl-q { color: var(--faint); }
.hl-mask { color: var(--warn); letter-spacing: .04em; }
.hl-cap { font-size: 12px; color: var(--muted); }

.hl-ask { margin: 0; min-height: 36px; width: 100%; display: flex; align-items: center; justify-content: center; text-align: center; font-size: 13.5px; color: var(--muted); }
.hl-btns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; }
.hl-btn { position: relative; min-height: 52px; gap: 6px; font-size: 15px; font-weight: 600; }
.hl-kbd { display: none; margin-left: 4px; min-width: 18px; height: 18px; padding: 0 4px; box-sizing: border-box; border-radius: 4px; border: 1px solid var(--line-2); color: var(--muted); font: inherit; font-size: 10.5px; line-height: 16px; text-align: center; }
@media (hover: hover) and (pointer: fine) { .hl-kbd { display: inline-block; } }

@media (prefers-reduced-motion: no-preference) {
  .hl-track { transition: transform 460ms var(--ease-out); }
  .hl-card { transition: border-color var(--dur) var(--ease-out), background-color var(--dur) var(--ease-out); }
}
@media (max-width: 380px) { .hl { --h: 108px; } }
</style>
