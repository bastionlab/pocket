<script setup lang="ts">
import { byCode } from '../../utils/puzzles/countries'
import { CW_MAX, CW_TILES, compareCw, countryWordleTarget, cwStateKey, type CwLevel, type CwTone } from '../../utils/puzzles/geo'
import { burst, shake } from '../../utils/puzzles/fx'

const props = defineProps<{ day: string, level?: CwLevel }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const level: CwLevel = props.level ?? 'medium'
const target = countryWordleTarget(props.day, level)
const MAX = CW_MAX[level]
/** the hints open after this many guesses: first letter of the answer, then of its capital */
const HINT_AT = [3, 5]
/** `h` = hints bought so far: 1 = the answer's first letter, 2 = also its capital's first letter */
const st = usePuzzleState(cwStateKey(level), props.day, () => ({ guesses: [] as string[], h: 0, res: null as PuzzleResult | null }))
useFinish(st, emit)
const { t } = usePuzzleI18n()
const fresh = ref('')
const listEl = ref<HTMLElement>()

/** newest guess first, so it sits right under the input */
const rows = computed(() => st.guesses.flatMap((code) => {
  const c = byCode(code)
  return c ? [{ c, info: compareCw(c, target) }] : []
}).reverse())

/** map colours: the distance tile's tone per guess (`no` = red) */
const heat = computed(() => Object.fromEntries(rows.value.map(r => [r.c.code, r.info.tone.dist === 'no' ? 'bad' as const : r.info.tone.dist])))
const slots = computed(() => [
  { k: 'first', v: target.name[0], on: st.h >= 1 || !!st.res, at: HINT_AT[0]! },
  { k: 'cap', v: target.capital[0], on: st.h >= 2 || !!st.res, at: HINT_AT[1]! },
])
const msg = computed(() => {
  if (st.res) return st.res.solved ? t('puzzles.cw.correct') : t('puzzles.geo2.answer', { a: target.name })
  return ''
})
const locked = computed(() => st.guesses.length < (HINT_AT[st.h] ?? 99))

const SQ: Record<CwTone, string> = { ok: '\u{1F7E9}', warn: '\u{1F7E8}', no: '\u{2B1C}' }
function shareText(won: boolean) {
  const lvl = level === 'medium' ? '' : ` (${level})`
  const head = `Country Wordle${lvl} ${won ? st.guesses.length : 'X'}/${MAX}${st.h ? `, ${st.h} hint${st.h > 1 ? 's' : ''}` : ''}`
  const lines = st.guesses.flatMap((code) => {
    const c = byCode(code)
    return c ? [CW_TILES.map(k => SQ[compareCw(c, target).tone[k]]).join('')] : []
  })
  return [head, ...lines].join('\n')
}

function guess(code: string) {
  if (st.res || st.guesses.includes(code) || !byCode(code)) return
  st.guesses.push(code)
  fresh.value = code
  const n = st.guesses.length
  const won = code === target.code
  nextTick(() => {
    const el = listEl.value?.firstElementChild as HTMLElement | undefined
    if (!el) return
    if (won) burst(el, { color: '--ok', count: 22, spread: 110 })
    else shake(el)
  })
  if (won || n >= MAX) {
    const lvl = level === 'medium' ? '' : ` (${level})`
    const summary = won ? `Country Wordle${lvl} ${n}/${MAX}` : `Country Wordle${lvl}, out of guesses: ${target.name}`
    st.res = { solved: won, attempts: n, score: won ? n : 0, summary, detail: { answer: target.name, level, hints: st.h, share: shareText(won) } }
  }
}
</script>

<template>
  <div class="cw">
    <PuzzlesStage
      :stats="[{ label: $t('puzzles.geo2.guesses'), value: `${st.guesses.length}/${MAX}`, tone: !st.res && MAX - st.guesses.length === 1 ? 'warn' : undefined }]"
      :msg="msg" :tone="st.res ? (st.res.solved ? 'ok' : 'bad') : 'warn'"
    >
      <template #actions>
        <PuzzlesHintButton game="country-wordle" :day="day" :label="$t(st.h === 0 ? 'puzzles.cwg.hintFirst' : 'puzzles.cwg.hintCap')" :disabled="!!st.res || st.h >= 2 || locked" @bought="st.h++" />
      </template>
      <ul class="slots">
        <li v-for="s in slots" :key="s.k" :class="{ on: s.on }">
          <span class="lab">{{ $t(`puzzles.cwg.slot.${s.k}`) }}</span>
          <b>{{ s.on ? s.v : $t('puzzles.cwg.after', { n: s.at }) }}</b>
        </li>
      </ul>
      <PuzzlesCountryInput v-if="!st.res" :exclude="st.guesses" @pick="guess" />
    </PuzzlesStage>
    <PuzzlesWorldMap v-if="rows.length" :guesses="st.guesses" :heat="heat" :target="st.res ? target.code : null" />
    <ul v-if="rows.length" ref="listEl" class="list">
      <PuzzlesCountryCwRow v-for="r in rows" :key="r.c.code" :c="r.c" :info="r.info" :fresh="r.c.code === fresh" :no-dir="level === 'hard'" />
    </ul>
    <p v-else class="muted small empty">{{ $t('puzzles.geo.cwEmpty') }}</p>
  </div>
</template>

<style scoped>
.cw { display: flex; flex-direction: column; gap: 12px; width: 100%; min-width: 0; }
.slots { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; width: 100%; margin: 0; padding: 0; list-style: none; }
.slots li { display: flex; flex-direction: column; gap: 3px; justify-content: center; min-height: 48px; padding: 6px 12px; border: 1px dashed var(--line-2); border-radius: var(--radius-sm); min-width: 0; }
.slots li.on { border-style: solid; border-color: var(--accent); background: var(--accent-soft); }
.lab { font-size: 11px; line-height: 1; color: var(--muted); letter-spacing: .03em; text-transform: uppercase; }
.slots b { font-size: 14px; color: var(--faint); font-weight: 600; overflow-wrap: anywhere; }
.slots li.on b { color: var(--text); }
.list { display: flex; flex-direction: column; gap: 8px; width: 100%; margin: 0; padding: 0; }
.empty { margin: 0; text-align: center; }
</style>
