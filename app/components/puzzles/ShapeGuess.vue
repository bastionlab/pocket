<script setup lang="ts">
import { CONTINENTS, byCode, fmtPopExact } from '../../utils/puzzles/countries'
import { compareGuess, shapeTarget } from '../../utils/puzzles/geo'
import { SHAPES } from '../../utils/puzzles/shapes'
import { JOURNEY_MAX, TRIVIA, journeyAngle, journeyStages, journeyStateKey, journeyTarget, type JourneyLevel } from '../../utils/puzzles/countryTrivia'
import { burst, shake } from '../../utils/puzzles/fx'

/**
 * Country Shape as a journey. Stage 1: name today's country from its silhouette (tries per level, a hint or two). Then,
 * solved or not, the country is asked about in multiple-choice rounds (flag, population, capital, export, import, currency or
 * language, neighbour or continent) and ends in a profile card. Level: easy = the 40 best known + the continent shown + 6 tries,
 * medium = 5 tries, hard = 4 tries and the silhouette is turned.
 *
 * Score (higher is better) = shape points (MAX + 1 - tries when named, else 0) + trivia answers right; `attempts` = shape tries.
 * `solved` = the shape was named OR at least TRIVIA_PASS of the trivia rounds were right, so a player who does not know the
 * outline but knows the country still gets credit.
 *
 * A medium board saved before the journey existed (no `go` field) stays the old shape-only game for that day.
 */
const props = defineProps<{ day: string, level?: JourneyLevel }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const level: JourneyLevel = props.level ?? 'medium'
const MAX = JOURNEY_MAX[level]
const TRIVIA_PASS = 4
const key = journeyStateKey(level)
const legacy = (() => {
  try { const raw = localStorage.getItem(`puzzles:${key}:${props.day}`); return !!raw && !('go' in JSON.parse(raw)) } catch { return false }
})()
const target = legacy ? shapeTarget(props.day, Object.keys(SHAPES)) : journeyTarget(props.day, level, Object.keys(SHAPES))
const shape = SHAPES[target.code]!
const info = TRIVIA[target.code]
const stages = legacy ? [] : journeyStages(target.code, props.day)
const angle = level === 'hard' && !legacy ? journeyAngle(props.day) : 0
const vb = { cx: shape.w / 2, cy: shape.h / 2, r: Math.hypot(shape.w, shape.h) / 2 }

/**
 * `hints` = bought so far: 1 = the continent, 2 = also the first letter (easy shows the continent from the start).
 * `over` = the shape round ended, `won` = it was named, `go` = the player moved on to the questions.
 * `i` = current question, `picked` = its answer id ('-' = skipped), `log` / `picks` = per question right? / answer.
 */
const st = usePuzzleState(key, props.day, () => ({ guesses: [] as string[], hints: 0, over: false, won: false, go: false, i: 0, picked: '', log: [] as boolean[], picks: [] as string[], res: null as PuzzleResult | null }))
useFinish(st, emit)
const { t } = usePuzzleI18n()
const fresh = ref('')
const listEl = ref<HTMLElement>()
const stageEl = ref<HTMLElement>()
const optEls = ref<HTMLElement[]>([])
const nextEl = ref<HTMLElement>()
/** on a phone the Next button can sit below the fold: bring it into view after an answer */
const reveal = () => nextTick(() => nextEl.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
const copied = ref(false)

const phase = computed(() => (st.res ? 'done' : !st.over ? 'shape' : !st.go ? 'reveal' : 'quiz'))
const q = computed(() => stages[Math.min(st.i, stages.length - 1)])
const lastQ = computed(() => st.i + 1 >= stages.length)
const right = computed(() => st.log.filter(Boolean).length)
const shapePts = computed(() => (st.won ? MAX + 1 - st.guesses.length : 0))
const rot = computed(() => (st.over ? 0 : angle))

const rows = computed(() => st.guesses.flatMap((code) => {
  const c = byCode(code)
  return c ? [{ c, info: compareGuess(c, target) }] : []
}).reverse())

/** map colours: the distance tone per guess */
const heat = computed(() => Object.fromEntries(rows.value.map(r => [r.c.code, r.info.kmTone])))

const hintLvl = computed(() => (level === 'easy' ? Math.max(st.hints, 1) : st.hints))
const slots = computed(() => [
  { k: 'cont', v: CONTINENTS[target.cont], on: hintLvl.value >= 1 || st.over },
  { k: 'first', v: target.name[0], on: hintLvl.value >= 2 || st.over },
])
const hintLabel = computed(() => (hintLvl.value === 0 ? 'puzzles.cw.hintCont' : 'puzzles.cw.hintFirst'))
const onHint = () => { st.hints = level === 'easy' ? 2 : st.hints + 1 }

const stats = computed(() => {
  if (phase.value === 'quiz') return [{ label: t('puzzles.geo2.round'), value: `${st.i + 1}/${stages.length}` }, { label: t('puzzles.geo2.right'), value: right.value, tone: right.value ? 'ok' as const : undefined }]
  if (phase.value === 'done') return [{ label: t('puzzles.geo2.score'), value: st.res?.score ?? 0 }, { label: t('puzzles.geo2.right'), value: `${right.value}/${stages.length}` }]
  return [{ label: t('puzzles.geo2.guesses'), value: `${st.guesses.length}/${MAX}`, tone: !st.over && MAX - st.guesses.length === 1 ? 'warn' as const : undefined }]
})
const msg = computed(() => {
  if (phase.value === 'quiz') {
    if (st.picked === '-') return t('puzzles.journey.skipped', { a: label(q.value!.answer) })
    return st.picked ? (st.picked === q.value!.answer ? t('puzzles.journey.right') : t('puzzles.journey.wrong', { a: label(q.value!.answer) })) : ''
  }
  if (phase.value === 'reveal' || (legacy && st.over)) return st.won ? t('puzzles.cw.correct') : t('puzzles.geo2.answer', { a: target.name })
  return phase.value === 'shape' ? '' : undefined
})
const msgTone = computed<'ok' | 'bad' | undefined>(() => {
  if (phase.value === 'quiz') return st.picked && st.picked === q.value!.answer ? 'ok' : 'bad'
  return st.won ? 'ok' : 'bad'
})
const dotLog = computed(() => (st.over ? [st.won, ...st.log] : []))
const dotI = computed(() => (phase.value === 'done' ? stages.length + 1 : st.over ? 1 + st.i : 0))

function endShape(won: boolean) {
  st.over = true
  st.won = won
  if (legacy) {
    const n = st.guesses.length
    const summary = won ? `Country shape ${n}/${MAX}: ${target.name}` : `Country shape, out of guesses: ${target.name}`
    st.res = { solved: won, attempts: n, score: won ? n : 0, summary, detail: { answer: target.name, share: summary } }
  }
}
function guess(code: string) {
  if (st.over || st.guesses.includes(code) || !byCode(code)) return
  st.guesses.push(code)
  fresh.value = code
  const won = code === target.code
  nextTick(() => {
    const el = listEl.value?.firstElementChild as HTMLElement | undefined
    if (won && stageEl.value) burst(stageEl.value, { color: '--ok', count: 26, spread: 120 })
    else if (!won) { if (el) shake(el); if (stageEl.value) shake(stageEl.value) }
  })
  if (won || st.guesses.length >= MAX) endShape(won)
}
const giveUp = () => { if (!st.over) endShape(false) }

function pick(id: string) {
  const cur = q.value
  if (phase.value !== 'quiz' || st.picked || !cur) return
  st.picked = id
  const ok = id === cur.answer
  st.log.push(ok)
  st.picks.push(id)
  const el = optEls.value.find(e => e?.dataset.o === id)
  if (el) { if (ok) burst(el, { color: '--ok', count: 16, spread: 80 }); else shake(el) }
  reveal()
}
function skip() {
  if (phase.value !== 'quiz' || st.picked) return
  st.picked = '-'
  st.log.push(false)
  st.picks.push('-')
  reveal()
}
const SQ_OF = (ok: boolean) => (ok ? SQ.g : SQ.r)
function shareText(solved: boolean, score: number) {
  const tries = st.guesses.length
  const shapeRow = st.won ? SQ.r!.repeat(tries - 1) + SQ.g : SQ.r!.repeat(Math.max(tries, 1))
  const lv = level === 'medium' ? '' : ` (${level})`
  return `${shareHead('Country Shape', props.day, lv.trim())}\nShape ${shapeRow}\nTrivia ${st.log.map(SQ_OF).join('')}\n${solved ? 'Solved' : 'Not solved'}, ${score} points`
}
function next() {
  if (!st.picked) return
  if (lastQ.value) {
    const r = right.value, score = shapePts.value + r, solved = st.won || r >= TRIVIA_PASS
    const summary = `Country journey: shape ${st.won ? `${st.guesses.length}/${MAX}` : 'missed'}, trivia ${r}/${stages.length}`
    st.res = { solved, attempts: Math.max(st.guesses.length, 1), score, summary, detail: { answer: target.name, level, shape: st.won, trivia: r, share: shareText(solved, score) } }
    return
  }
  st.i++
  st.picked = ''
}
async function copy() {
  try { await navigator.clipboard.writeText(st.res?.detail.share ?? ''); copied.value = true; setTimeout(() => { copied.value = false }, 1600) } catch { /* blocked */ }
}
const label = (id: string) => q.value?.options.find(o => o.id === id)?.label ?? id

/** 1-4 pick an answer, Enter / Space go on */
function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || phase.value !== 'quiz') return
  const el = e.target as HTMLElement | null
  if (el && /^(input|textarea|select)$/i.test(el.tagName)) return
  const n = Number(e.key)
  if (n >= 1 && n <= 4 && q.value?.options[n - 1]) { pick(q.value.options[n - 1]!.id); return }
  if (e.key === 'Enter' && st.picked && el?.tagName !== 'BUTTON') { e.preventDefault(); next() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="sg">
    <PuzzlesStage :stats="stats" :msg="msg" :tone="msgTone">
      <template v-if="phase === 'shape'" #actions>
        <PuzzlesHintButton game="shape-guess" :day="day" :label="$t(hintLabel)" :disabled="st.over || hintLvl >= 2" @bought="onHint" />
      </template>
      <PuzzlesCountryDots v-if="!legacy" :n="stages.length + 1" :i="dotI" :log="dotLog" />

      <!-- stage 1 and its reveal -->
      <template v-if="phase === 'shape' || phase === 'reveal' || legacy">
        <div ref="stageEl" class="frame" :class="{ won: st.over && st.won, lost: st.over && !st.won }" role="img" :aria-label="$t('puzzles.shape.alt')">
          <svg class="sil" :viewBox="level === 'hard' && !legacy ? `${vb.cx - vb.r} ${vb.cy - vb.r} ${vb.r * 2} ${vb.r * 2}` : `0 0 ${shape.w} ${shape.h}`" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
            <g class="rot" :style="{ transform: `rotate(${rot}deg)` }"><path :d="shape.d" fill-rule="evenodd" /></g>
          </svg>
          <span class="cap">{{ st.over ? target.name : '' }}</span>
        </div>
        <ul class="slots">
          <li v-for="s in slots" :key="s.k" :class="{ on: s.on }">
            <span class="lab">{{ $t(`puzzles.cw.slot.${s.k}`) }}</span>
            <b>{{ s.on ? s.v : '-' }}</b>
          </li>
        </ul>
        <PuzzlesCountryInput v-if="!st.over" :exclude="st.guesses" @pick="guess" />
      </template>

      <!-- the rounds about the country -->
      <template v-else-if="phase === 'quiz' && q">
        <div class="card">
          <svg class="mini" :viewBox="`0 0 ${shape.w} ${shape.h}`" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><path :d="shape.d" fill-rule="evenodd" /></svg>
          <p class="ask">{{ $t(`puzzles.journey.q.${q.kind}`, { c: target.name }) }}</p>
        </div>
        <div class="opts" :class="{ flags: q.kind === 'flag' }">
          <button
            v-for="(o, k) in q.options" :key="o.id" :ref="(el) => { if (el) optEls[k] = el as HTMLElement }" type="button" class="opt" :data-o="o.id"
            :aria-label="q.kind === 'flag' ? $t('puzzles.journey.flagN', { n: k + 1 }) : undefined"
            :class="{ g: st.picked && o.id === q.answer, bad: st.picked && st.picked !== '-' && st.picked === o.id && o.id !== q.answer, dim: st.picked && o.id !== q.answer && st.picked !== o.id }"
            :disabled="!!st.picked" @click="pick(o.id)"
          >
            <template v-if="q.kind === 'flag'">
              <span class="fl"><PuzzlesCountryFlag :code="o.id" w="min(100%, 128px)" /><span class="flname" :class="{ show: !!st.picked }">{{ o.label }}</span></span>
            </template>
            <template v-else>
              <kbd aria-hidden="true">{{ k + 1 }}</kbd>
              <span class="tx">{{ o.label }}</span>
            </template>
            <Icon v-if="st.picked && o.id === q.answer" name="check" :size="18" class="mk" />
            <Icon v-else-if="st.picked === o.id" name="x" :size="18" class="mk" />
          </button>
        </div>
        <p class="fact muted small">{{ st.picked && q.fact ? $t(`puzzles.journey.fact.${q.fact.k}`, { v: q.fact.v }) : '' }}</p>
      </template>

      <!-- the profile card -->
      <section v-else-if="phase === 'done' && info" class="prof" :aria-label="$t('puzzles.journey.profile')">
      <header class="ph">
        <PuzzlesCountryFlag :code="target.code" :w="72" />
        <div class="pt">
          <h3>{{ target.name }}</h3>
          <span class="muted small">{{ CONTINENTS[target.cont] }}</span>
          <span class="pill" :class="st.won ? 'ok' : 'bad'">{{ st.won ? $t('puzzles.journey.shapeOk', { n: st.guesses.length }) : $t('puzzles.journey.shapeMiss') }}</span>
        </div>
      </header>
      <dl class="facts">
        <div><dt>{{ $t('puzzles.journey.l.capital') }}</dt><dd>{{ target.capital }}</dd></div>
        <div><dt>{{ $t('puzzles.journey.l.pop') }}</dt><dd>{{ fmtPopExact(target.pop) }}</dd></div>
        <div><dt>{{ $t('puzzles.journey.l.area') }}</dt><dd>{{ $t('puzzles.journey.areaVal', { n: info.area.toLocaleString('en') }) }}</dd></div>
        <div><dt>{{ $t('puzzles.journey.l.currency') }}</dt><dd>{{ info.currency }}</dd></div>
        <div class="wide2"><dt>{{ $t('puzzles.journey.l.langs') }}</dt><dd>{{ info.languages.join(', ') }}</dd></div>
      </dl>
      <div class="goods">
        <div>
          <h4>{{ $t('puzzles.journey.l.exports') }}</h4>
          <ol><li v-for="g in info.topExports" :key="g">{{ g }}</li></ol>
        </div>
        <div>
          <h4>{{ $t('puzzles.journey.l.imports') }}</h4>
          <ol><li v-for="g in info.topImports" :key="g">{{ g }}</li></ol>
        </div>
      </div>
      <PuzzlesWorldMap :target="target.code" :collapsible="false" zoomed />
      <p v-if="info.funFact" class="muted small">{{ info.funFact }}</p>
      <footer class="pf">
        <span class="sc"><b class="num">{{ st.res?.score }}</b> {{ $t('puzzles.journey.points', { s: shapePts, t: right, of: stages.length }) }}</span>
        <button type="button" class="btn ghost sm copy" @click="copy">{{ copied ? $t('puzzles.journey.copied') : $t('puzzles.journey.copy') }}</button>
      </footer>
    </section>

      <template #tools>
        <template v-if="phase === 'shape'">
          <PuzzlesTool v-if="!legacy" icon="flag" :label="$t('puzzles.journey.giveUp')" @click="giveUp" />
        </template>
        <button v-else-if="phase === 'reveal'" type="button" class="btn primary next" @click="st.go = true">{{ $t('puzzles.journey.continue') }}</button>
        <template v-else-if="phase === 'quiz'">
          <PuzzlesTool icon="chevron-right" :label="$t('puzzles.journey.skip')" :disabled="!!st.picked" @click="skip" />
          <button ref="nextEl" type="button" class="btn primary next" :disabled="!st.picked" @click="next">{{ lastQ ? $t('puzzles.quiz.finish') : $t('puzzles.quiz.next') }}</button>
        </template>
      </template>
    </PuzzlesStage>
    <PuzzlesWorldMap v-if="rows.length && (phase === 'shape' || phase === 'reveal' || legacy)" :guesses="st.guesses" :heat="heat" :target="st.over ? target.code : null" />
    <ul v-if="rows.length && (phase === 'shape' || phase === 'reveal' || legacy)" ref="listEl" class="list">
      <PuzzlesCountryGuess v-for="r in rows" :key="r.c.code" :c="r.c" :info="r.info" :fresh="r.c.code === fresh && !st.over" />
    </ul>
  </div>
</template>

<style scoped>
.sg { display: flex; flex-direction: column; gap: 12px; width: 100%; min-width: 0; }
.frame { position: relative; display: block; width: 100%; max-width: 460px; aspect-ratio: 4 / 3; padding: 14px 14px 32px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel-2); box-sizing: border-box; }
@media (max-width: 640px) { .frame { max-width: min(460px, max(240px, calc((100dvh - var(--tabbar, 0px) - 520px) * 4 / 3))); } } /* phone: shape + guess row + Give up end above the tab bar */
.frame.won { border-color: var(--ok); }
.frame.lost { border-color: var(--bad); }
.sil { position: absolute; inset: 14px 14px 32px; width: calc(100% - 28px); height: calc(100% - 46px); display: block; }
.sil path, .mini path { fill: var(--text); }
.rot { transform-box: fill-box; transform-origin: center; }
.won .sil path { fill: var(--ok); }
.lost .sil path { fill: var(--bad); }
.cap { position: absolute; left: 0; right: 0; bottom: 8px; min-height: 16px; font-size: 13px; font-weight: 600; text-align: center; line-height: 16px; }
.slots { display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr); gap: 8px; width: 100%; margin: 0; padding: 0; list-style: none; }
.slots li { display: flex; flex-direction: column; gap: 3px; justify-content: center; min-height: 48px; padding: 6px 12px; border: 1px dashed var(--line-2); border-radius: var(--radius-sm); min-width: 0; }
.slots li.on { border-style: solid; border-color: var(--accent); background: var(--accent-soft); }
.lab { font-size: 11px; line-height: 1; color: var(--muted); letter-spacing: .03em; text-transform: uppercase; }
.slots b { font-size: 14px; color: var(--faint); font-weight: 600; overflow-wrap: anywhere; }
.slots li.on b { color: var(--text); }
.list { display: flex; flex-direction: column; gap: 8px; width: 100%; margin: 0; padding: 0; }

.card { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; box-sizing: border-box; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel-2); text-align: center; }
.mini { flex: none; width: 120px; height: 90px; }
.ask { margin: 0; font-size: 17px; font-weight: 600; line-height: 1.35; }
.opts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; width: 100%; }
.opt { position: relative; display: flex; align-items: center; gap: 8px; min-height: 56px; padding: 6px 12px; border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--panel-2); color: var(--text); font: inherit; font-size: 14px; text-align: left; cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), opacity var(--dur) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
.opts.flags .opt { justify-content: center; padding: 10px 8px; }
.opt:hover:not(:disabled) { border-color: var(--accent); }
.opt:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.opt:active:not(:disabled) { transform: scale(.98); }
.opt:disabled { cursor: default; }
.opt.g { background: var(--ok-soft); border-color: var(--ok); color: var(--ok); }
.opt.bad { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }
.opt.dim { opacity: .55; }
.tx { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.fl { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%; min-width: 0; }
.flname { min-height: 16px; max-width: 100%; font-size: 12px; line-height: 16px; text-align: center; overflow-wrap: anywhere; opacity: 0; }
.flname.show { opacity: 1; }
kbd { display: none; flex: none; min-width: 20px; height: 20px; place-items: center; border: 1px solid var(--line-2); border-radius: 4px; color: var(--muted); font: inherit; font-size: 11px; }
@media (hover: hover) and (pointer: fine) { kbd { display: grid; } }
.mk { flex: none; }
.opts.flags .mk { position: absolute; top: 6px; right: 6px; }
.fact { margin: 0; width: 100%; min-height: 36px; text-align: center; }
.next { scroll-margin-bottom: calc(var(--tabbar, 0px) + 16px); min-height: 46px; min-width: 140px; font-size: 14px; }

.prof { display: flex; flex-direction: column; gap: 14px; width: 100%; box-sizing: border-box; padding: 14px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel-2); }
.ph { display: flex; align-items: center; gap: 12px; }
.pt { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.pt h3 { margin: 0; font-size: 18px; line-height: 1.2; overflow-wrap: anywhere; }
.facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; margin: 0; }
.facts div { min-width: 0; }
.facts .wide2 { grid-column: 1 / -1; }
dt { font-size: 10px; letter-spacing: .03em; text-transform: uppercase; color: var(--muted); }
dd { margin: 2px 0 0; font-size: 14px; font-weight: 600; overflow-wrap: anywhere; }
.goods { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.goods h4 { margin: 0 0 6px; font-size: 10px; letter-spacing: .03em; text-transform: uppercase; color: var(--muted); font-weight: 400; }
.goods ol { margin: 0; padding-left: 18px; font-size: 14px; }
.goods li { padding: 2px 0; overflow-wrap: anywhere; }
.prof p { margin: 0; }
.pf { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding-top: 10px; border-top: 1px solid var(--line); font-size: 13px; }
.sc b { font-size: 20px; margin-right: 6px; }
.copy { min-height: 40px; min-width: 104px; }
@media (prefers-reduced-motion: no-preference) {
  .pips i { transition: background-color .2s var(--ease-out); }
  .sil { animation: sg-in .6s cubic-bezier(.2, .8, .3, 1) backwards; transform-origin: 50% 50%; }
  .rot { transition: transform .6s cubic-bezier(.2, .8, .3, 1); }
  .flname { transition: opacity .2s var(--ease-out); }
  @keyframes sg-in { from { opacity: 0; transform: scale(.88); } }
}
@media (prefers-reduced-motion: reduce) {
  .opt { transition: none; }
  .opt:active:not(:disabled) { transform: none; }
}
</style>
