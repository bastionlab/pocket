<script setup lang="ts">
import { byCode } from '../../utils/puzzles/countries'
import { compareGuess, flaggleTarget } from '../../utils/puzzles/geo'
import { burst, shake } from '../../utils/puzzles/fx'

const props = defineProps<{ day: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const target = flaggleTarget(props.day)
const MAX = 6
/** `hints` = bought sharpening steps */
const st = usePuzzleState('flaggle', props.day, () => ({ guesses: [] as string[], hints: 0, res: null as PuzzleResult | null }))
useFinish(st, emit)
const fresh = ref('')
const listEl = ref<HTMLElement>()
const stageEl = ref<HTMLElement>()

const wrong = computed(() => st.guesses.filter(c => c !== target.code).length)
/** the flag starts as blurred colour blocks and sharpens with every wrong guess and every bought hint; the end shows it in full */
const BLUR = [26, 19, 13, 8, 4, 1.5]
const step = computed(() => Math.min(wrong.value + (st.hints ?? 0), BLUR.length - 1))
const blur = computed(() => (st.res ? 0 : BLUR[step.value]!))

const rows = computed(() => st.guesses.flatMap((code) => {
  const c = byCode(code)
  return c ? [{ c, info: compareGuess(c, target) }] : []
}).reverse())

/** map colours: the distance tone per guess */
const heat = computed(() => Object.fromEntries(rows.value.map(r => [r.c.code, r.info.kmTone])))

function onHint() {
  st.hints = (st.hints ?? 0) + 1
  if (stageEl.value) burst(stageEl.value, { color: '--accent', count: 10, spread: 90 })
}

function guess(code: string) {
  if (st.res || st.guesses.includes(code) || !byCode(code)) return
  st.guesses.push(code)
  fresh.value = code
  const n = st.guesses.length
  const won = code === target.code
  nextTick(() => {
    const el = listEl.value?.firstElementChild as HTMLElement | undefined
    if (won && stageEl.value) burst(stageEl.value, { color: '--ok', count: 26, spread: 120 })
    else if (!won && el) shake(el)
  })
  if (won || n >= MAX) {
    const summary = won ? `Flaggle ${n}/${MAX}` : `Flaggle, out of guesses: ${target.name}`
    st.res = { solved: won, attempts: n, score: won ? n : 0, summary, detail: { answer: target.name, share: summary } }
  }
}
</script>

<template>
  <div class="fg">
    <PuzzlesStage
      :stats="[{ label: $t('puzzles.geo2.guesses'), value: `${st.guesses.length}/${MAX}`, tone: !st.res && MAX - st.guesses.length === 1 ? 'warn' : undefined }]"
      :msg="st.res ? (st.res.solved ? $t('puzzles.cw.correct') : $t('puzzles.geo2.answer', { a: target.name })) : ''" :tone="st.res ? (st.res.solved ? 'ok' : 'bad') : undefined"
    >
      <template #actions>
        <PuzzlesHintButton game="flaggle" :day="day" :label="$t('puzzles.flag.sharpen')" :disabled="!!st.res || step >= BLUR.length - 1" @bought="onHint" />
      </template>
      <div ref="stageEl" class="frame" :class="{ won: st.res?.solved, lost: st.res && !st.res.solved }" role="img" :aria-label="$t('puzzles.flag.alt')">
        <PuzzlesCountryFlag :code="target.code" w="min(100%, 400px)" :blur="blur" />
      </div>
      <PuzzlesCountryInput v-if="!st.res" :exclude="st.guesses" @pick="guess" />
    </PuzzlesStage>
    <PuzzlesWorldMap v-if="rows.length" :guesses="st.guesses" :heat="heat" :target="st.res ? target.code : null" />
    <ul v-if="rows.length" ref="listEl" class="list">
      <PuzzlesCountryGuess v-for="r in rows" :key="r.c.code" :c="r.c" :info="r.info" compact :fresh="r.c.code === fresh" />
    </ul>
  </div>
</template>

<style scoped>
.fg { display: flex; flex-direction: column; gap: 12px; width: 100%; min-width: 0; }
.frame { display: grid; place-items: center; width: 100%; padding: 16px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel-2); box-sizing: border-box; }
.frame.won { border-color: var(--ok); }
.frame.lost { border-color: var(--bad); }
.frame :deep(.cflag) { border-radius: 4px; }
.list { display: flex; flex-direction: column; gap: 8px; width: 100%; margin: 0; padding: 0; }
</style>
