<script setup lang="ts">
import { LADDER_SLACK, ladderNext, ladderPath, ladderPuzzle, isLadderWord } from '../../utils/puzzles/words'
import { burst, pulse, shake as fxShake } from '../../utils/puzzles/fx'

const props = defineProps<{ day: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
const p = ladderPuzzle(props.day)
const MAX = p.par + LADDER_SLACK // more steps than this and the ladder is lost
const ABC = [...'abcdefghijklmnopqrstuvwxyz']
// steps = the words after the start, sel = the letter position being changed, ghost = a bought hint (the word it was bought for + the next word)
const st = usePuzzleState('word-ladder', props.day, () => ({ steps: [] as string[], sel: -1, ghost: null as { from: string, next: string } | null, res: null as PuzzleResult | null }))
useFinish(st, emit)
const { note, tone, say } = usePuzzleNote()
const tilesEl = ref<HTMLElement | null>(null)
const live = ref(false)

const cur = computed(() => st.steps[st.steps.length - 1] ?? p.start)
const path = computed(() => [p.start, ...st.steps])
const won = computed(() => st.res?.solved === true)
const lost = computed(() => !!st.res && !st.res.solved)
const over = computed(() => !!st.res)
const shortest = computed(() => (st.res ? ladderPath(p.start, p.target) : []))
const ghost = computed(() => (st.ghost && st.ghost.from === cur.value && !over.value ? st.ghost.next : ''))
/** the letter of `ghost` that differs from the current word (marked on the chip) */
const ghostAt = computed(() => (ghost.value ? [...ghost.value].findIndex((c, i) => c !== cur.value[i]) : -1))
const left = computed(() => MAX - st.steps.length)

/** the line under the board: how it ended, or what to do next (a rejected word shows for a moment instead) */
const line = computed(() => {
  if (won.value) return { m: t('puzzles.ladder.summaryWin', { n: st.steps.length, par: p.par }), t: 'ok' as const }
  if (lost.value) return { m: t('puzzles.ladder.summaryLoss', { par: p.par }), t: 'bad' as const }
  return { m: st.sel < 0 ? t('puzzles.ladder.tap') : t('puzzles.ladder.pickFor', { n: st.sel + 1 }), t: undefined }
})
const stats = computed(() => [
  { label: t('puzzles.ladder.stepsLabel'), value: `${st.steps.length}/${MAX}`, tone: !over.value && left.value <= 2 ? 'warn' as const : undefined },
  { label: t('puzzles.ladder.parLabel'), value: p.par },
])
const diff = (w: string, prev: string) => [...w].map((c, i) => c !== prev[i])
const prevOf = (k: number) => (k === 0 ? p.start : st.steps[k - 1]!)

function reject(msg: string) {
  say(msg)
  if (tilesEl.value) fxShake(tilesEl.value)
  navigator.vibrate?.(20)
}
function pick(i: number) {
  if (over.value) return
  st.sel = st.sel === i ? -1 : i
  navigator.vibrate?.(10)
}
function put(l: string) {
  if (over.value || st.sel < 0) return
  if (l === cur.value[st.sel]) return
  const w = cur.value.slice(0, st.sel) + l + cur.value.slice(st.sel + 1)
  if (!isLadderWord(w)) return reject(t('puzzles.ladder.unknown'))
  st.steps.push(w)
  st.sel = -1
  const n = st.steps.length
  const els = tilesEl.value
  if (w === p.target) {
    live.value = true
    navigator.vibrate?.([10, 40, 10])
    st.res = {
      solved: true,
      attempts: n,
      score: Math.max(1, 10 - Math.max(0, n - p.par)),
      summary: t('puzzles.ladder.summaryWin', { n, par: p.par }),
      detail: { path: path.value.join(' > '), par: p.par },
    }
    nextTick(() => {
      if (!els) return
      els.querySelectorAll<HTMLElement>('.big').forEach((c, i) => setTimeout(() => burst(c, { color: '--ok', count: 8, spread: 50 }), i * 70))
      pulse(els)
    })
  } else if (n >= MAX) {
    st.res = {
      solved: false,
      attempts: n,
      score: 0,
      summary: t('puzzles.ladder.summaryLoss', { par: p.par }),
      detail: { path: path.value.join(' > '), par: p.par },
    }
    if (els) fxShake(els)
  } else if (els) pulse(els)
}
function undo() {
  if (over.value || !st.steps.length) return
  st.steps.pop()
  st.sel = -1
}
function onHint() {
  if (over.value) return
  const next = ladderNext(cur.value, p.target)
  if (!next) return
  st.ghost = { from: cur.value, next }
}

function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test((e.target as HTMLElement)?.tagName || '')) return
  if (over.value) return
  const n = p.start.length
  if (e.key === 'ArrowLeft') { e.preventDefault(); st.sel = st.sel <= 0 ? n - 1 : st.sel - 1 }
  else if (e.key === 'ArrowRight') { e.preventDefault(); st.sel = st.sel < 0 || st.sel >= n - 1 ? 0 : st.sel + 1 }
  else if (e.key === 'Escape') st.sel = -1
  else if (e.key === 'Backspace') { e.preventDefault(); undo() }
  else if (/^[1-4]$/.test(e.key) && Number(e.key) <= n) st.sel = Number(e.key) - 1
  else if (/^[a-z]$/i.test(e.key) && st.sel >= 0) put(e.key.toLowerCase())
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="wl" :style="{ '--n': p.start.length }">
    <PuzzlesStage :stats="stats" :msg="note || line.m" :tone="note ? tone : line.t">
      <template #actions>
        <PuzzlesHintButton game="word-ladder" :day="day" :disabled="over || !!ghost" @bought="onHint" />
      </template>

      <div class="goal" :class="{ hit: won }">
        <span class="lab">{{ $t('puzzles.ladder.target') }}</span>
        <span class="tiles"><span v-for="(c, i) in p.target" :key="i" class="t aim" :style="{ '--i': i }">{{ c }}</span></span>
      </div>

      <div class="cur">
        <div ref="tilesEl" class="tiles now" role="group" :aria-label="$t('puzzles.ladder.current')">
          <template v-for="(c, i) in cur" :key="i">
            <button class="t big" :class="{ sel: st.sel === i, ok: won, hop: live }" :style="{ '--i': i }" :disabled="over" :aria-pressed="st.sel === i" :aria-label="$t('puzzles.ladder.letter', { l: c.toUpperCase(), n: i + 1 })" @click="pick(i)">{{ c }}</button>
          </template>
        </div>
        <p class="tryw" :class="{ on: !!ghost }" aria-live="polite">
          <template v-if="ghost">{{ $t('puzzles.ladder.try') }}<span class="gw"><b v-for="(c, i) in ghost" :key="i" :class="{ chg: i === ghostAt }">{{ c }}</b></span></template>
        </p>
      </div>

      <div class="pick" :class="{ off: over || st.sel < 0 }" role="group" :aria-label="$t('puzzles.ladder.picker')">
        <button v-for="l in ABC" :key="l" class="pk" :disabled="over || st.sel < 0" :aria-label="l" @mousedown.prevent @click="put(l)">{{ l }}</button>
      </div>

      <template #tools>
        <PuzzlesTool icon="undo-2" :label="$t('puzzles.ladder.undo')" :disabled="over || !st.steps.length" @click="undo" />
        <ol class="trail" :aria-label="$t('puzzles.ladder.chain')">
          <li v-for="(w, k) in path" :key="k" :class="{ now: k === path.length - 1 && !over }">
            <span class="w"><b v-for="(c, i) in w" :key="i" :class="{ chg: k > 0 && diff(w, prevOf(k - 1))[i] }">{{ c }}</b></span>
          </li>
        </ol>
        <p v-if="over" class="opt">
          <span class="lab">{{ $t('puzzles.ladder.shortest', { n: p.par }) }}</span>
          <span class="route"><span v-for="(w, k) in shortest" :key="k" class="rw">{{ w }}</span></span>
        </p>
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
/* the frame is <PuzzlesStage>; the word tiles and the letter picker are sized from the stage width */
.wl { container: wl / inline-size; width: 100%; }
.goal { display: flex; align-items: center; justify-content: center; gap: 10px; }
.lab { font-size: 11.5px; color: var(--muted); }
.tiles { display: flex; justify-content: center; gap: 6px; }
.t { display: grid; place-items: center; width: 34px; height: 34px; padding: 0; border: 2px solid var(--line-2); border-radius: 8px; background: var(--panel-2); color: var(--text); font: inherit; font-size: 18px; font-weight: 700; line-height: 1; text-transform: uppercase; }
.t.aim { border: 2px dashed var(--accent); background: transparent; color: var(--accent); }
.goal.hit .t.aim { border-style: solid; border-color: transparent; background: var(--pz-c3); color: var(--pz-ink); }
.cur { width: 100%; display: grid; justify-items: center; gap: 4px; }
.tiles.now { container-type: inline-size; display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 10px; width: min(100%, calc(var(--n) * 88px + (var(--n) - 1) * 10px)); }
.t.big { width: 100%; height: auto; aspect-ratio: 1; border-radius: 12px; font-size: clamp(26px, calc(46cqw / var(--n)), 54px); cursor: pointer; -webkit-tap-highlight-color: transparent; }
.t.big.sel { border-color: var(--accent); background: var(--accent-soft); color: var(--accent); }
.t.big.ok { border-color: transparent; background: var(--pz-c3); color: var(--pz-ink); }
.t.big:disabled { cursor: default; opacity: 1; }
.t.big:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.tryw { margin: 0; min-height: 30px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; color: var(--muted); opacity: 0; }
.tryw.on { opacity: 1; }
.gw { display: inline-flex; gap: 3px; padding: 3px 6px; border: 1px dashed var(--accent); border-radius: 6px; color: var(--accent); }
.gw b { font-size: 14px; text-transform: uppercase; opacity: .75; }
.gw b.chg { opacity: 1; text-decoration: underline; }
.pick { width: 100%; display: grid; grid-template-columns: repeat(9, minmax(0, 1fr)); gap: 5px; }
@container wl (min-width: 460px) { .pick { grid-template-columns: repeat(13, minmax(0, 1fr)); } }
.pick.off { opacity: .45; }
.pk { height: 44px; padding: 0; border: 0; border-radius: 7px; background: color-mix(in oklab, var(--text) 15%, var(--panel)); color: var(--text); font: inherit; font-size: 16px; font-weight: 700; text-transform: uppercase; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.pk:disabled { cursor: default; }
.pk:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
.trail { flex: 1 1 100%; list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
.trail li { padding: 4px 9px; border: 1px solid var(--line-2); border-radius: 6px; background: var(--panel-2); }
.trail li.now { border-color: var(--accent); }
.w { display: inline-flex; gap: 2px; font-size: 14px; text-transform: uppercase; }
.w b { font-weight: 600; color: var(--muted); }
.w b.chg { color: var(--accent); font-weight: 800; }
.opt { flex: 1 1 100%; margin: 0; display: grid; gap: 6px; justify-items: center; }
.route { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; }
.rw { padding: 4px 9px; border: 1px solid var(--ok); border-radius: 6px; color: var(--ok); font-size: 14px; font-weight: 600; text-transform: uppercase; }
@media (pointer: coarse) { .t.aim { width: 32px; height: 32px; } }
@media (prefers-reduced-motion: no-preference) {
  .t.big { transition: transform var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out); }
  .t.big:active:not(:disabled) { transform: scale(.94); }
  .t.big.hop { animation: wl-hop .5s var(--ease-out) backwards; animation-delay: calc(var(--i) * 80ms); }
  .tryw { transition: opacity var(--dur) var(--ease-out); }
  .pk { transition: transform var(--dur-fast) var(--ease-out); }
  .pk:active:not(:disabled) { transform: scale(.92); }
  .trail li:last-child { animation: wl-pop .16s var(--ease-out); }
}
@media (hover: hover) { .pk:hover:not(:disabled) { background: color-mix(in oklab, var(--text) 24%, var(--panel)); } }
@keyframes wl-pop { from { transform: scale(.85); } }
@keyframes wl-hop { 0% { transform: translateY(0); } 40% { transform: translateY(-9px); } 100% { transform: translateY(0); } }
</style>
