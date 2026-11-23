<script setup lang="ts">
import { capitalQuiz } from '../../utils/puzzles/geo'
import { burst, shake } from '../../utils/puzzles/fx'

const props = defineProps<{ day: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const qs = capitalQuiz(props.day)
const PASS = 4
/** `cut` = per question the two wrong options a bought hint removed */
const st = usePuzzleState('capital-quiz', props.day, () => ({ i: 0, picked: '', right: 0, log: [] as boolean[], picks: [] as string[], cut: {} as Record<number, string[]>, res: null as PuzzleResult | null }))
useFinish(st, emit)
const lastQ = computed(() => st.i + 1 >= qs.length)
const q = computed(() => qs[Math.min(st.i, qs.length - 1)]!)
const done = computed(() => !!st.res)
const gone = computed(() => st.cut?.[st.i] ?? [])
const optEls = ref<HTMLElement[]>([])
const nextEl = ref<HTMLElement>()
/** on a phone the Next button can sit below the fold: bring it into view after an answer */
const reveal = () => nextTick(() => nextEl.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))

function pick(o: string) {
  if (st.picked || st.res || gone.value.includes(o)) return
  st.picked = o
  const ok = o === q.value.answer
  st.log.push(ok)
  st.picks = [...(st.picks ?? []), o]
  if (ok) st.right++
  const el = optEls.value.find(e => e?.dataset.o === o)
  if (el) { if (ok) burst(el, { color: '--ok', count: 16, spread: 80 }); else shake(el) }
  reveal()
}
/** a bought hint: two wrong options go away */
function onHint() {
  if (st.picked || gone.value.length) return
  const wrong = q.value.options.filter(o => o !== q.value.answer)
  st.cut = { ...(st.cut ?? {}), [st.i]: wrong.slice(0, 2) }
}
function next() {
  if (!st.picked) return
  if (st.i + 1 >= qs.length) {
    const summary = `Capital quiz ${st.right}/${qs.length}`
    st.res = { solved: st.right >= PASS, attempts: st.right, score: st.right, summary, detail: { share: summary } }
    return
  }
  st.i++
  st.picked = ''
}

/** 1-4 pick an answer, Enter / Space go on */
function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || done.value) return
  const el = e.target as HTMLElement | null
  if (el && /^(input|textarea|select)$/i.test(el.tagName)) return
  const n = Number(e.key)
  if (n >= 1 && n <= q.value.options.length) { pick(q.value.options[n - 1]!); return }
  if (e.key === 'Enter' && st.picked && el?.tagName !== 'BUTTON') { e.preventDefault(); next() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="cq">
    <PuzzlesStage
      :stats="[{ label: $t('puzzles.geo2.round'), value: `${Math.min(st.i + 1, qs.length)}/${qs.length}` }, { label: $t('puzzles.geo2.right'), value: st.right, tone: st.right ? 'ok' : undefined }]"
      :msg="st.picked ? (st.picked === q.answer ? $t('puzzles.geo.right') : $t('puzzles.geo.notQuite', { a: q.answer })) : ''" :tone="st.picked === q.answer ? 'ok' : 'bad'"
    >
      <template #actions>
        <PuzzlesHintButton game="capital-quiz" :day="day" :label="$t('puzzles.geo.cutTwo')" :disabled="done || !!st.picked || gone.length > 0" @bought="onHint" />
      </template>
      <PuzzlesCountryDots :n="qs.length" :i="done ? qs.length : st.i" :log="st.log" />
      <div class="card">
        <PuzzlesCountryFlag :code="q.code" w="min(100%, 200px)" />
        <p class="ask">{{ $t('puzzles.quiz.capitalOf', { c: q.country }) }}</p>
      </div>
      <div class="opts">
        <button
          v-for="(o, k) in q.options" :key="o" :ref="(el) => { if (el) optEls[k] = el as HTMLElement }" type="button" class="opt" :data-o="o"
          :class="{ g: st.picked && o === q.answer, bad: st.picked === o && o !== q.answer, dim: (st.picked && o !== q.answer && st.picked !== o) || gone.includes(o), cut: gone.includes(o) }"
          :disabled="!!st.picked || gone.includes(o)" @click="pick(o)"
        >
          <kbd aria-hidden="true">{{ k + 1 }}</kbd>
          <span class="tx">{{ o }}</span>
          <Icon v-if="st.picked && o === q.answer" name="check" :size="18" class="mk" />
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
.cq { width: 100%; min-width: 0; }
.card { display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; box-sizing: border-box; padding: 18px 14px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel-2); text-align: center; }
.ask { margin: 0; font-size: 17px; font-weight: 600; line-height: 1.35; }
.opts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; width: 100%; }
.opt { position: relative; display: flex; align-items: center; gap: 8px; min-height: 56px; padding: 6px 12px; border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--panel-2); color: var(--text); font: inherit; font-size: 14px; text-align: left; cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), opacity var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
.opt:hover:not(:disabled) { border-color: var(--accent); }
.opt:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.opt:active:not(:disabled) { transform: scale(.98); }
.opt:disabled { cursor: default; }
.opt.g { background: var(--ok-soft); border-color: var(--ok); color: var(--ok); }
.opt.bad { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }
.opt.dim { opacity: .55; }
.opt.cut { opacity: .25; text-decoration: line-through; }
.tx { flex: 1; min-width: 0; overflow-wrap: anywhere; }
kbd { display: none; flex: none; min-width: 20px; height: 20px; place-items: center; border: 1px solid var(--line-2); border-radius: 4px; color: var(--muted); font: inherit; font-size: 11px; }
@media (hover: hover) and (pointer: fine) { kbd { display: grid; } }
.mk { flex: none; }
.next { scroll-margin-bottom: calc(var(--tabbar, 0px) + 16px); min-height: 46px; min-width: 160px; font-size: 14px; }
@media (prefers-reduced-motion: reduce) {
  .opt { transition: none; }
  .opt:active:not(:disabled) { transform: none; }
}
</style>
