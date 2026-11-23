<script setup lang="ts">
import type { QuizQ } from '../../utils/puzzles/quizTypes'
import { QUIZ_MAX, QUIZ_PASS, QUIZ_POINTS, QUIZ_TIME, QUIZ_TIMEOUT, pickQuiz, quizHintDrop, quizMissed, quizOptions, quizRemaining, quizRow } from '../../utils/puzzles/quiz'
import { burst, pulse, shake } from '../../utils/puzzles/fx'
import { isRandomDay } from '../../utils/puzzles/registry'

const props = defineProps<{ game: string, questions: QuizQ[], day: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()

const qs = pickQuiz(props.game, props.questions, props.day)
const total = qs.length
const opts = qs.map((q, i) => quizOptions(props.game, props.day, i, q))
const rights = opts.map(x => x.right)

// Timed is a per-device preference (localStorage); a day's quiz keeps the mode it was started in (st.timed)
const TIMED_KEY = 'puzzles:quiz:timed'
const pref = ref(false)
try { pref.value = localStorage.getItem(TIMED_KEY) === '1' } catch { /* blocked */ }

// picks[i] = the option index tapped for question i (-1 = out of time); hints[i] = the two options a bought hint took away (saved, so a reload keeps them)
// t0 / tq = when question tq was shown (ms epoch), so a reload does not give the clock back
const st = usePuzzleState(props.game, props.day, () => ({ i: 0, picks: [] as number[], hints: {} as Record<string, number[]>, timed: false, t0: 0, tq: -1, res: null as (PuzzleResult & { summary?: string }) | null }))
if (!st.res && !st.picks.length && st.i === 0) st.timed = pref.value
useFinish(st, emit)

// "Play missed again": a local practice round over the missed questions (no result, no coins, never saved)
const prac = reactive({ on: false, idx: [] as number[], i: 0, picks: [] as number[], t0: 0, tq: -1, fin: false })
type Run = { i: number, picks: number[], t0: number, tq: number }
const run = computed<Run>(() => (prac.on ? prac : st))
const n = computed(() => (prac.on ? prac.idx.length : total))
const cur = computed(() => Math.min(run.value.i, n.value - 1))
const qi = computed(() => (prac.on ? prac.idx[cur.value]! : cur.value))
const q = computed(() => qs[qi.value]!)
const o = computed(() => opts[qi.value]!)
const pickAt = computed(() => run.value.picks[cur.value])
const answered = computed(() => pickAt.value !== undefined)
const gone = computed<number[]>(() => (prac.on ? [] : st.hints[cur.value] ?? []))
const done = computed(() => (prac.on ? prac.fin : !!st.res))
const timed = computed(() => (prac.on ? pref.value : st.timed))
const isRight = (k: number) => st.picks[k] === rights[k]
const points = computed(() => st.picks.reduce((s, p, k) => s + (p === rights[k] ? QUIZ_POINTS[qs[k]!.level] : 0), 0))
const rightCount = computed(() => st.picks.filter((p, k) => p === rights[k]).length)
const res_ok = computed(() => points.value >= QUIZ_PASS)
const last = computed(() => cur.value === n.value - 1)
const levelName = (l: 1 | 2 | 3) => t(`puzzles.qz.level${l}`)

// what the finished list shows: the day's 8 questions, or the practice round's
const rows = computed(() => (prac.on ? prac.idx.map((k, p) => ({ k, pick: prac.picks[p] })) : qs.map((_, k) => ({ k, pick: st.picks[k] }))).map(r => ({ ...r, ok: r.pick === rights[r.k] })))
const missed = computed(() => (prac.on ? rows.value.filter(r => !r.ok).map(r => r.k) : quizMissed(st.picks, rights)))
const said = (r: { k: number, pick: number | undefined }) => (r.pick === undefined || r.pick === QUIZ_TIMEOUT ? t('puzzles.qz.timeUp') : t('puzzles.qz.yours', { a: opts[r.k]!.opts[r.pick] }))

// per-topic streak + best from the overview the shell already loads (refreshed a moment after the result was posted)
const { refresh } = usePuzzleCoins()
const streak = ref<{ streak: number, best: number } | null>(null)
watch(done, (d) => {
  if (!d || prac.on || isRandomDay(props.day)) return
  setTimeout(() => { refresh().then((ov) => { const g = ov?.games.find((x: { id: string }) => x.id === props.game); if (g) streak.value = { streak: g.streak ?? 0, best: g.best ?? 0 } }).catch(() => {}) }, 1200)
}, { immediate: true })

const btns: (HTMLElement | null)[] = []
const nextEl = ref<HTMLElement | null>(null)

// --- timed mode ---
const now = ref(Date.now())
const left = computed(() => quizRemaining(run.value.t0, now.value))
const secs = computed(() => Math.ceil(left.value / 1000))
const frac = computed(() => left.value / (QUIZ_TIME * 1000))
function arm() {
  if (timed.value && !done.value && !answered.value && run.value.tq !== cur.value) { now.value = Date.now(); run.value.tq = cur.value; run.value.t0 = now.value }
}
watch(() => [cur.value, timed.value, done.value, answered.value, prac.on], arm, { immediate: true })
let tick: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  tick = setInterval(() => {
    if (!timed.value || done.value || answered.value || document.visibilityState !== 'visible') return
    now.value = Date.now()
    if (quizRemaining(run.value.t0, now.value) <= 0) pick(QUIZ_TIMEOUT)
  }, 250)
})
onBeforeUnmount(() => clearInterval(tick))
function setTimed() {
  if (st.picks.length || done.value) return
  pref.value = !pref.value
  st.timed = pref.value
  try { localStorage.setItem(TIMED_KEY, pref.value ? '1' : '0') } catch { /* blocked */ }
}

function pick(k: number) {
  if (done.value || answered.value || gone.value.includes(k)) return
  run.value.picks[cur.value] = k
  const el = btns[k]
  const ok = k === o.value.right
  if (el) {
    if (ok) burst(el, { color: '--ok', count: 8 + QUIZ_POINTS[q.value.level] * 4 })
    else { shake(el); const r = btns[o.value.right]; if (r) pulse(r) }
  } else if (k === QUIZ_TIMEOUT) { const r = btns[o.value.right]; if (r) pulse(r) }
  navigator.vibrate?.(ok ? 10 : [20, 40, 20])
  nextTick(() => nextEl.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })) // phone: Next never ends up under the tab bar
}

function next() {
  if (done.value || !answered.value) return
  if (!last.value) { run.value.i = cur.value + 1; return }
  if (prac.on) { prac.fin = true; return }
  const pts = points.value
  const right = rightCount.value
  const summary = t(st.timed ? 'puzzles.qz.summaryTimed' : 'puzzles.qz.summary', { pts, max: QUIZ_MAX, right, total })
  const squares = quizRow(st.picks, rights, { ok: SQ.g, bad: SQ.r, late: SQ.y })
  const head = shareHead(props.game, props.day, `${pts}/${QUIZ_MAX}${st.timed ? ` ${t('puzzles.qz.timedShare', { s: QUIZ_TIME })}` : ''}`)
  st.res = { solved: pts >= QUIZ_PASS, attempts: right, score: pts, summary, detail: { share: `${head}\n${squares}`, timed: st.timed } }
}

function replay() {
  const idx = missed.value.slice()
  if (!idx.length) return
  Object.assign(prac, { on: true, idx, i: 0, picks: [], t0: 0, tq: -1, fin: false })
}
function backToResult() { prac.on = false }

function onBought() {
  if (answered.value || done.value || prac.on || gone.value.length) return
  st.hints[cur.value] = quizHintDrop(props.game, props.day, cur.value, o.value.right)
}

function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement | null)?.closest('input, textarea, select')) return
  if (e.key >= '1' && e.key <= '4') { pick(Number(e.key) - 1); return }
  if (e.key === 'ArrowRight' && answered.value && !done.value) { e.preventDefault(); next(); return }
  // on the Next button itself Enter is already its click
  if (e.key === 'Enter' && answered.value && !done.value && !(e.target as HTMLElement | null)?.closest('.qz-next')) { e.preventDefault(); next() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// after Next the old focus would sit on a re-labelled button: keep it on the card instead
watch(cur, () => { if (document.activeElement instanceof HTMLElement && document.activeElement.closest('.qz-opt')) document.activeElement.blur() })

const stats = computed(() => {
  if (prac.on) {
    return [
      { label: t('puzzles.qz.questionLabel'), value: done.value ? `${n.value}/${n.value}` : `${cur.value + 1}/${n.value}` },
      { label: t('puzzles.qz.rightLabel'), value: `${rows.value.filter(r => r.ok).length}/${n.value}`, tone: done.value && !missed.value.length ? 'ok' as const : undefined },
    ]
  }
  const base = [
    { label: t('puzzles.qz.questionLabel'), value: done.value ? `${total}/${total}` : `${cur.value + 1}/${total}` },
    { label: t('puzzles.qz.pointsLabel'), value: `${points.value}/${QUIZ_MAX}`, tone: done.value ? (res_ok.value ? 'ok' as const : 'warn' as const) : undefined },
  ]
  if (done.value && streak.value) base.push({ label: t('puzzles.qz.streakLabel'), value: String(streak.value.streak) }, { label: t('puzzles.qz.bestLabel'), value: String(streak.value.best) })
  return base
})
const msg = computed(() => {
  if (!done.value) return undefined
  if (prac.on) return missed.value.length ? t('puzzles.qz.practiceLeft', { n: missed.value.length }) : t('puzzles.qz.practiceClear')
  return t(st.timed ? 'puzzles.qz.summaryTimed' : 'puzzles.qz.summary', { pts: points.value, max: QUIZ_MAX, right: rightCount.value, total })
})
</script>

<template>
  <div class="qz">
    <PuzzlesStage :stats="stats" :msg="msg" :tone="prac.on ? (missed.length ? 'warn' : 'ok') : (res_ok ? 'ok' : 'warn')">
      <template v-if="!done && !prac.on" #actions>
        <PuzzlesHintButton :game="game" :day="day" :disabled="answered || gone.length > 0" @bought="onBought" />
      </template>

      <div v-if="!prac.on" class="qz-strip" role="list" :aria-label="$t('puzzles.qz.progress')">
        <span
          v-for="(_, k) in qs" :key="k" class="qz-seg" role="listitem"
          :class="{ ok: st.picks[k] !== undefined && isRight(k), bad: st.picks[k] !== undefined && !isRight(k), cur: !done && k === cur }"
        />
      </div>
      <div v-else class="qz-prac"><span class="pill accent">{{ $t('puzzles.qz.practice') }}</span><span class="muted small">{{ $t('puzzles.qz.practiceNote') }}</span></div>

      <template v-if="!done">
        <div v-if="timed" class="qz-time" :class="{ low: secs <= 5 && !answered }" role="timer" :aria-label="$t('puzzles.qz.timedLabel', { s: QUIZ_TIME })">
          <span class="qz-bar" aria-hidden="true"><span class="qz-fill" :style="{ transform: `scaleX(${frac})` }" /></span>
          <span class="qz-secs num" aria-hidden="true">{{ secs }}{{ $t('puzzles.qz.secUnit') }}</span>
        </div>
        <section :key="`${prac.on}-${cur}`" class="qz-card">
          <div class="qz-qbox">
            <div class="qz-tags">
              <span class="pill" :class="{ ok: q.level === 1, warn: q.level === 2, bad: q.level === 3 }">{{ levelName(q.level) }}</span>
              <span class="qz-worth num">+{{ QUIZ_POINTS[q.level] }}</span>
            </div>
            <h2 class="qz-q">{{ q.q }}</h2>
          </div>
          <div class="qz-opts" role="group" :aria-label="$t('puzzles.qz.answers')">
            <button
              v-for="(a, k) in o.opts" :key="k" :ref="(el) => { btns[k] = el as HTMLElement | null }" type="button" class="qz-opt"
              :class="{ right: answered && k === o.right, wrong: answered && pickAt === k && k !== o.right, dim: answered && k !== o.right && pickAt !== k, gone: gone.includes(k) }"
              :aria-disabled="answered || gone.includes(k)" :tabindex="gone.includes(k) ? -1 : 0" @click="pick(k)"
            >
              <span class="qz-key num" aria-hidden="true">{{ k + 1 }}</span>
              <span class="qz-txt">{{ a }}</span>
              <Icon v-if="answered && k === o.right" class="qz-mark" name="check" :size="18" />
              <Icon v-else-if="answered && pickAt === k" class="qz-mark" name="x" :size="18" />
            </button>
          </div>
          <p class="qz-note" :class="{ on: answered }" role="status" aria-live="assertive">
            <template v-if="answered">
              <b :class="pickAt === o.right ? 'ok' : 'bad'">{{ pickAt === o.right ? $t('puzzles.qz.correct', { n: QUIZ_POINTS[q.level] }) : pickAt === QUIZ_TIMEOUT ? $t('puzzles.qz.timeUpAnswer', { a: q.a }) : $t('puzzles.qz.wrongAnswer', { a: q.a }) }}</b>
              <span v-if="q.note"> {{ q.note }}</span>
            </template>
          </p>
        </section>
      </template>

      <div v-else class="qz-rev">
        <div class="qz-revh">
          <div class="qz-revt"><b>{{ $t('puzzles.qz.review') }}</b><span class="muted small">{{ missed.length ? $t('puzzles.qz.missed', { n: missed.length }) : $t('puzzles.qz.noMiss') }}</span></div>
          <div class="qz-reva">
            <button v-if="prac.on" type="button" class="btn sm ghost" @click="backToResult">{{ $t('puzzles.qz.backToResult') }}</button>
            <button v-if="missed.length" type="button" class="btn sm primary" @click="replay"><Icon name="rotate-ccw" :size="16" />{{ $t('puzzles.qz.playMissed') }}</button>
          </div>
        </div>
        <ol class="qz-list">
          <li v-for="r in rows" :key="r.k" class="qz-row" :class="r.ok ? 'ok' : 'bad'">
            <Icon class="qz-rmark" :name="r.ok ? 'check' : 'x'" :size="18" />
            <div class="qz-rbody">
              <b>{{ qs[r.k]!.q }}</b>
              <span class="qz-ra">{{ qs[r.k]!.a }}</span>
              <template v-if="!r.ok">
                <span class="qz-rw">{{ said(r) }}</span>
                <span v-if="qs[r.k]!.note" class="qz-rn">{{ qs[r.k]!.note }}</span>
              </template>
            </div>
            <span class="qz-rpts num">{{ r.ok ? `+${QUIZ_POINTS[qs[r.k]!.level]}` : '0' }}</span>
          </li>
        </ol>
      </div>

      <template v-if="!done" #tools>
        <button ref="nextEl" type="button" class="btn primary qz-next" :disabled="!answered" @click="next">
          {{ last ? $t('puzzles.qz.finish') : $t('puzzles.qz.next') }}<Icon name="chevron-right" :size="18" />
        </button>
        <PuzzlesTool v-if="!prac.on" icon="timer" :label="$t('puzzles.qz.timed')" :on="st.timed" :disabled="st.picks.length > 0" @click="setTimed" />
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
.qz { width: 100%; container-type: inline-size; }
:deep(.pzs-board) { align-items: stretch; }

.qz-strip { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); gap: 5px; width: 100%; }
.qz-seg { height: 6px; border-radius: 3px; background: var(--track); transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
.qz-seg.cur { background: var(--accent); }
.qz-seg.ok { background: var(--ok); }
.qz-seg.bad { background: var(--bad); }

.qz-card { display: flex; flex-direction: column; gap: 12px; width: 100%; }
.qz-qbox { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border: 1px solid var(--line-2); border-radius: var(--radius); background: var(--panel); }
.qz-tags { display: flex; align-items: center; gap: 8px; }
.qz-worth { font-size: 12.5px; color: var(--muted); }
.qz-q { margin: 0; min-height: 4.2em; font-size: 18px; line-height: 1.4; font-weight: 600; letter-spacing: 0; overflow-wrap: anywhere; }

.qz-opts { display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
.qz-opt { position: relative; display: flex; align-items: center; gap: 10px; width: 100%; min-height: 56px; padding: 10px 12px; border: 1px solid var(--line-2); border-radius: var(--radius); background: var(--panel-2); color: var(--text); font: inherit; font-size: 15px; line-height: 1.3; text-align: left; cursor: pointer; transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out); }
@media (hover: hover) { .qz-opt:hover:not([aria-disabled="true"]) { border-color: var(--accent); } }
.qz-opt:active:not([aria-disabled="true"]) { transform: scale(.98); }
.qz-opt:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.qz-opt[aria-disabled="true"] { cursor: default; }
.qz-key { flex: none; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 6px; background: var(--track); color: var(--muted); font-size: 12.5px; font-weight: 600; }
.qz-txt { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.qz-mark { flex: none; }
.qz-opt.right { border-color: var(--ok); background: var(--ok-soft); color: var(--ok); }
.qz-opt.right .qz-key { background: var(--ok); color: var(--bg); }
.qz-opt.wrong { border-color: var(--bad); background: var(--bad-soft); color: var(--bad); }
.qz-opt.wrong .qz-key { background: var(--bad); color: var(--bg); }
.qz-opt.dim { opacity: .55; }
.qz-opt.gone { opacity: .3; text-decoration: line-through; }

.qz-note { margin: 0; min-height: 3.9em; font-size: 13.5px; line-height: 1.45; color: var(--muted); opacity: 0; transition: opacity var(--dur-fast) var(--ease-out); }
.qz-note.on { opacity: 1; }
.qz-note b.ok { color: var(--ok); }
.qz-note b.bad { color: var(--bad); }

.qz-next { scroll-margin-bottom: calc(var(--tabbar, 0px) + 16px); min-height: 44px; min-width: 160px; justify-content: center; }


.qz-prac { display: flex; align-items: center; gap: 8px; }
.qz-time { display: flex; align-items: center; gap: 10px; width: 100%; }
.qz-bar { flex: 1; height: 6px; border-radius: 3px; background: var(--track); overflow: hidden; }
.qz-fill { display: block; width: 100%; height: 100%; background: var(--accent); transform-origin: left center; }
.qz-time.low .qz-fill { background: var(--bad); }
.qz-secs { flex: none; min-width: 2.6em; text-align: right; font-size: 13px; font-weight: 600; color: var(--muted); }
.qz-time.low .qz-secs { color: var(--bad); }

.qz-rev { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.qz-revh { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; }
.qz-revt { display: flex; align-items: baseline; gap: 10px; }
.qz-reva { display: flex; flex-wrap: wrap; gap: 8px; }
.qz-rn { color: var(--muted); }

.qz-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; width: 100%; }
.qz-row { color: var(--text); display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border: 1px solid var(--line-2); border-left-width: 3px; border-radius: var(--radius); background: var(--panel-2); font-size: 13.5px; line-height: 1.4; }
.qz-row.ok { border-left-color: var(--ok); }
.qz-row.bad { border-left-color: var(--bad); }
.qz-rmark { flex: none; margin-top: 1px; }
.qz-row.ok .qz-rmark { color: var(--ok); }
.qz-row.bad .qz-rmark { color: var(--bad); }
.qz-rbody { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; overflow-wrap: anywhere; }
.qz-rbody b { font-weight: 600; }
.qz-ra { color: var(--ok); }
.qz-rw { color: var(--bad); }
.qz-rpts { flex: none; color: var(--muted); font-size: 12.5px; }

/* wide play column (PC): the four answers in a 2 x 2 grid, taller and a touch larger */
@container (min-width: 520px) {
  .qz-opts { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .qz-opt { min-height: 72px; padding: 12px 14px; font-size: 15.5px; }
  .qz-qbox { padding: 18px 20px; }
  .qz-q { min-height: 3.6em; font-size: 20px; }
  .qz-note { min-height: 3em; }
}

@media (prefers-reduced-motion: no-preference) {
  .qz-fill { transition: transform 260ms linear, background-color var(--dur-fast) var(--ease-out); }
  .qz-card { animation: qz-in 240ms var(--ease-out); }
  .qz-seg.ok, .qz-seg.bad { animation: qz-seg 260ms var(--ease-out); }
}
@keyframes qz-in { from { transform: translateX(18px); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes qz-seg { 40% { transform: scaleY(2); } }
</style>
