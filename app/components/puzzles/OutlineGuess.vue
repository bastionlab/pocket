<script setup lang="ts">
import { FACTS_PASS, factsPoints, factsQuiz } from '../../utils/puzzles/geo'
import { burst, shake } from '../../utils/puzzles/fx'

const props = defineProps<{ day: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const qs = factsQuiz(props.day)
const st = usePuzzleState('outline-guess', props.day, () => ({ i: 0, picked: '', right: 0, log: [] as boolean[], picks: [] as string[], used: [] as number[], shown: 1, res: null as PuzzleResult | null }))
useFinish(st, emit)
const lastQ = computed(() => st.i + 1 >= qs.length)
const q = computed(() => qs[Math.min(st.i, qs.length - 1)]!)
const done = computed(() => !!st.res)
const optEls = ref<HTMLElement[]>([])
const nextEl = ref<HTMLElement>()
/** on a phone the Next button can sit below the fold: bring it into view after an answer */
const reveal = () => nextTick(() => nextEl.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
/** facts on show: one to start, one more per tap, all of them once an answer is picked */
const shown = computed(() => (st.picked ? q.value.facts.length : Math.min(st.shown, q.value.facts.length)))
/** points so far: 7 minus the facts used per right answer, nothing for a wrong one */
const points = computed(() => st.log.reduce((s, ok, i) => s + factsPoints(st.used?.[i] ?? 6, ok), 0))
/** what the round is worth right now */
const worth = computed(() => factsPoints(Math.min(st.shown, q.value.facts.length), true))

function more() {
  if (!st.picked && st.shown < q.value.facts.length) st.shown++
}
function pick(o: string) {
  if (st.picked || st.res) return
  st.picked = o
  const ok = o === q.value.name
  st.log.push(ok)
  st.picks = [...(st.picks ?? []), o]
  st.used = [...(st.used ?? []), st.shown]
  if (ok) st.right++
  const el = optEls.value.find(e => e?.dataset.o === o)
  if (el) { if (ok) burst(el, { color: '--ok', count: 16, spread: 80 }); else shake(el) }
  reveal()
}
function next() {
  if (!st.picked) return
  if (st.i + 1 >= qs.length) {
    const total = points.value
    const avg = +((st.used ?? []).reduce((s, n) => s + n, 0) / Math.max(1, st.used?.length ?? 1)).toFixed(1)
    const summary = `Country facts ${total} points, ${avg} facts used on average`
    st.res = { solved: total >= FACTS_PASS, attempts: st.right, score: total, summary, detail: { share: summary, points: total } }
    return
  }
  st.i++
  st.picked = ''
  st.shown = 1
}

/** 1-4 pick an answer, F another fact, Enter goes on */
function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || done.value) return
  const el = e.target as HTMLElement | null
  if (el && /^(input|textarea|select)$/i.test(el.tagName)) return
  const n = Number(e.key)
  if (n >= 1 && n <= q.value.options.length) { pick(q.value.options[n - 1]!); return }
  if (e.key === 'f' || e.key === 'F') { more(); return }
  if (e.key === 'Enter' && st.picked && el?.tagName !== 'BUTTON') { e.preventDefault(); next() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="of">
    <PuzzlesStage
      :stats="[
        { label: $t('puzzles.geo2.round'), value: `${Math.min(st.i + 1, qs.length)}/${qs.length}` },
        { label: $t('puzzles.facts.points'), value: points, tone: points ? 'ok' : undefined },
      ]"
      :msg="st.picked ? (st.picked === q.name ? $t('puzzles.facts.gained', { n: factsPoints(st.used?.[st.i] ?? 6, true) }) : $t('puzzles.geo.notQuite', { a: q.name })) : $t('puzzles.facts.worth', { n: worth })" :tone="st.picked ? (st.picked === q.name ? 'ok' : 'bad') : undefined"
    >
      <template #actions>
        <PuzzlesTool icon="plus" :label="$t('puzzles.geo.moreFact')" :disabled="!!st.picked || done || shown >= q.facts.length" @click="more" />
      </template>
      <PuzzlesCountryDots :n="qs.length" :i="done ? qs.length : st.i" :log="st.log" />
      <p class="ask">
        <template v-if="st.picked"><PuzzlesCountryFlag :code="q.code" :w="28" /> {{ q.name }}</template>
        <template v-else>{{ $t('puzzles.facts.which') }}</template>
      </p>
      <ul class="facts">
        <li v-for="(f, k) in q.facts" :key="f.k" :class="{ on: k < shown, fresh: k === shown - 1 && k > 0 }">
          <span class="lab">{{ $t(`puzzles.geo.fact.${f.k}`) }}</span>
          <b>{{ k < shown ? f.v : '-' }}</b>
        </li>
      </ul>
      <div class="opts">
        <button
          v-for="(o, k) in q.options" :key="o" :ref="(el) => { if (el) optEls[k] = el as HTMLElement }" type="button" class="opt" :data-o="o"
          :class="{ g: st.picked && o === q.name, bad: st.picked === o && o !== q.name, dim: st.picked && o !== q.name && st.picked !== o }" :disabled="!!st.picked" @click="pick(o)"
        >
          <kbd aria-hidden="true">{{ k + 1 }}</kbd>
          <span class="tx">{{ o }}</span>
          <Icon v-if="st.picked && o === q.name" name="check" :size="18" class="mk" />
          <Icon v-else-if="st.picked === o" name="x" :size="18" class="mk" />
        </button>
      </div>
      <template #tools>
        <button ref="nextEl" type="button" class="btn primary next" :disabled="!st.picked || done" @click="next">{{ lastQ ? $t('puzzles.quiz.finish') : $t('puzzles.quiz.next') }}</button>
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
.of { width: 100%; min-width: 0; }
.ask { display: flex; align-items: center; justify-content: center; gap: 8px; min-height: 28px; margin: 0; font-size: 16px; font-weight: 600; text-align: center; }
.facts { display: flex; flex-direction: column; gap: 5px; width: 100%; margin: 0; padding: 0; list-style: none; }
.facts li { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 38px; padding: 6px 12px; border: 1px dashed var(--line-2); border-radius: var(--radius-sm); }
.facts li.on { border-style: solid; border-color: var(--line-2); background: var(--panel-2); }
.lab { font-size: 11px; color: var(--muted); letter-spacing: .03em; text-transform: uppercase; }
.facts b { font-size: 14px; color: var(--faint); font-weight: 600; text-align: right; }
.facts li.on b { color: var(--text); }
.opts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; width: 100%; }
.opt { display: flex; align-items: center; gap: 8px; min-height: 56px; padding: 6px 12px; border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--panel-2); color: var(--text); font: inherit; font-size: 14px; text-align: left; cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), opacity var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
.opt:hover:not(:disabled) { border-color: var(--accent); }
.opt:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.opt:active:not(:disabled) { transform: scale(.98); }
.opt:disabled { cursor: default; }
.opt.g { background: var(--ok-soft); border-color: var(--ok); color: var(--ok); }
.opt.bad { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }
.opt.dim { opacity: .55; }
.tx { flex: 1; min-width: 0; overflow-wrap: anywhere; }
kbd { display: none; flex: none; min-width: 20px; height: 20px; place-items: center; border: 1px solid var(--line-2); border-radius: 4px; color: var(--muted); font: inherit; font-size: 11px; }
@media (hover: hover) and (pointer: fine) { kbd { display: grid; } }
.mk { flex: none; }
.next { scroll-margin-bottom: calc(var(--tabbar, 0px) + 16px); min-height: 46px; min-width: 140px; font-size: 14px; }
@media (prefers-reduced-motion: no-preference) {
  .facts li.fresh { animation: of-in .22s var(--ease-out); }
  @keyframes of-in { from { opacity: 0; transform: translateY(-6px); } }
}
@media (prefers-reduced-motion: reduce) {
  .opt { transition: none; }
  .opt:active:not(:disabled) { transform: none; }
}
</style>
