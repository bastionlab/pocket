<script setup lang="ts">
import { connectionsHint, connectionsPuzzle } from '../../utils/puzzles/words'
import { burst, pulse, shake as fxShake } from '../../utils/puzzles/fx'

const props = defineProps<{ day: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const p = connectionsPuzzle(props.day)
const MAX_MISTAKES = 4
const st = usePuzzleState('connections', props.day, () => ({ found: [] as number[], picked: [] as string[], mistakes: 0, log: [] as number[][], tried: [] as string[], order: [] as string[], hinted: [] as number[], res: null as PuzzleResult | null }))
useFinish(st, emit)
const { t } = usePuzzleI18n()
const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const { note, tone, say } = usePuzzleNote()
const busy = ref(false) // a group is moving into place / the answers are being revealed
const jump = ref<string[]>([]) // the four tiles that are bouncing
const boardEl = ref<HTMLElement | null>(null)
const timers: ReturnType<typeof setTimeout>[] = []
const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, calm ? Math.min(ms, 60) : ms)) }
onBeforeUnmount(() => timers.forEach(clearTimeout))

/** groups revealed after a loss (already all there when a lost game is reloaded) */
const rest = () => [0, 1, 2, 3].filter(g => !st.found.includes(g))
const extra = ref<number[]>(st.res && !st.res.solved ? rest() : [])
const shown = computed(() => [...st.found, ...extra.value])
const base = computed(() => (st.order.length === 16 ? st.order : p.order))
const left = computed(() => base.value.filter(w => !shown.value.some(g => p.groups[g].words.includes(w))))
const over = computed(() => !!st.res)
const seg = (w: string) => Math.max(...w.split(' ').map(s => s.length))

function toggle(w: string) {
  if (over.value || busy.value) return
  const i = st.picked.indexOf(w)
  if (i >= 0) st.picked.splice(i, 1)
  else if (st.picked.length < 4) st.picked.push(w)
  else return
  navigator.vibrate?.(10)
}
function shuffle() {
  if (over.value || busy.value) return
  const a = [...left.value]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  st.order = [...shown.value.flatMap(g => p.groups[g].words), ...a]
}
function finish(won: boolean) {
  st.res = {
    solved: won,
    attempts: st.log.length,
    score: won ? MAX_MISTAKES - st.mistakes : 0,
    summary: won ? (st.mistakes ? t('puzzles.connections.summaryWin', { n: st.mistakes }, st.mistakes) : t('puzzles.connections.summaryClean')) : t('puzzles.connections.summaryLoss', { k: st.found.length }),
    detail: { mistakes: st.mistakes, hints: st.hinted.length },
  }
}
const nextHint = computed(() => connectionsHint(p.groups, st.found, '', st.hinted))
/** bought hint: three tiles of one group still to find are selected for you */
function onHint() {
  if (over.value || busy.value) return
  const h = connectionsHint(p.groups, st.found, `${props.day}:${st.hinted.length}`, st.hinted)
  if (!h) return
  st.hinted.push(h.g)
  st.picked = [...h.words]
  nextTick(() => h.words.forEach(w => { const el = boardEl.value?.querySelector<HTMLElement>(`[data-w="${CSS.escape(w)}"]`); if (el) { pulse(el); burst(el, { color: '--accent', count: 6, spread: 30 }) } }))
}
function submit() {
  if (over.value || busy.value || st.picked.length !== 4) return
  const key = [...st.picked].sort().join('|')
  if (st.tried.includes(key)) return say(t('puzzles.connections.again'))
  st.tried.push(key)
  const hits = p.groups.map(g => st.picked.filter(w => g.words.includes(w)).length)
  const gi = hits.findIndex(h => h === 4)
  st.log.push(st.picked.map(w => p.groups.findIndex(g => g.words.includes(w))))
  if (gi >= 0) {
    busy.value = true
    jump.value = [...st.picked]
    navigator.vibrate?.([10, 30, 10])
    nextTick(() => boardEl.value?.querySelectorAll<HTMLElement>('.tile.jump').forEach((el, i) => setTimeout(() => burst(el, { color: '--ok', count: 6, spread: 38 }), i * 70)))
    later(() => {
      st.found.push(gi)
      st.picked = []
      jump.value = []
      busy.value = false
      if (st.found.length === 4) finish(true)
    }, 650)
    return
  }
  st.mistakes++
  navigator.vibrate?.(30)
  boardEl.value?.querySelectorAll<HTMLElement>('.tile.on').forEach(fxShake)
  if (st.mistakes >= MAX_MISTAKES) {
    busy.value = true
    st.picked = []
    finish(false)
    const r = rest()
    r.forEach((g, k) => later(() => { extra.value = [...extra.value, g]; if (k === r.length - 1) busy.value = false }, 800 + k * 800))
  } else say(hits.includes(3) ? t('puzzles.connections.oneAway') : t('puzzles.connections.nope'), hits.includes(3) ? 'warn' : 'bad', 2200)
}

/** a finished game (also after a reload) keeps the verdict on screen */
const endNote = computed(() => (!st.res ? '' : st.res.solved ? (st.mistakes ? t('puzzles.connections.summaryWin', { n: st.mistakes }, st.mistakes) : t('puzzles.connections.summaryClean')) : t('puzzles.connections.summaryLoss', { k: st.found.length })))
const stats = computed(() => [
  { label: t('puzzles.connections.groups'), value: `${st.found.length}/4` },
  { label: t('puzzles.connections.mistakes'), value: `${st.mistakes}/${MAX_MISTAKES}`, tone: st.mistakes >= MAX_MISTAKES - 1 ? 'bad' as const : undefined },
])

function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || /input|textarea|select/i.test((e.target as HTMLElement)?.tagName || '')) return
  if (e.key === 'Enter' && !(e.target as HTMLElement)?.closest?.('button')) { e.preventDefault(); if (!e.repeat) submit() }
  else if (e.key === 'Escape' && !busy.value && !over.value) st.picked = []
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="cn">
    <PuzzlesStage :stats="stats" :msg="note || endNote" :tone="note ? tone : st.res?.solved ? 'ok' : 'bad'">
      <template #actions>
        <PuzzlesHintButton game="connections" :day="day" :disabled="over || busy || !nextHint" @bought="onHint" />
      </template>

      <div ref="boardEl" class="board">
        <div v-for="g in shown" :key="g" class="bar" :class="`c${g}`">
          <b>{{ p.groups[g].name }}</b>
          <span>{{ p.groups[g].words.join(', ') }}</span>
        </div>
        <TransitionGroup tag="div" name="cn" class="grid" role="group" :aria-label="$t('puzzles.connections.board')">
          <button v-for="w in left" :key="w" class="tile" :data-w="w" :class="{ on: st.picked.includes(w), jump: jump.includes(w) }" :style="{ '--len': seg(w), '--i': Math.max(0, jump.indexOf(w)) }" :aria-pressed="st.picked.includes(w)" :disabled="over" @mousedown.prevent @click="toggle(w)">{{ w }}</button>
        </TransitionGroup>
      </div>

      <template #tools>
        <PuzzlesTool icon="refresh-cw" :label="$t('puzzles.connections.shuffle')" :disabled="over || busy" @click="shuffle" />
        <PuzzlesTool icon="x" :label="$t('puzzles.clear')" :disabled="over || busy || !st.picked.length" @click="st.picked = []" />
        <button class="btn primary go" :disabled="over || busy || st.picked.length !== 4" @click="submit">{{ $t('puzzles.submit') }}</button>
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
/* the frame is <PuzzlesStage>; the four groups use the shared palette (ink on solid colour), tiles are sized from the stage width */
.cn { --gap: 8px; --c0: var(--pz-c3); --c1: var(--pz-c12); --c2: var(--pz-c2); --c3: var(--pz-c4); container-type: inline-size; width: 100%; }
.board { width: 100%; display: flex; flex-direction: column; gap: var(--gap); }
.bar { --th: clamp(54px, 14cqw, 76px); height: var(--th); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; padding: 0 12px; border-radius: var(--radius-sm); color: var(--pz-ink); text-align: center; overflow: hidden; }
.bar b { font-size: 14.5px; text-transform: uppercase; letter-spacing: .02em; }
.bar span { max-width: 100%; font-size: 13px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bar.c0 { background: var(--c0); }
.bar.c1 { background: var(--c1); }
.bar.c2 { background: var(--c2); }
.bar.c3 { background: var(--c3); }
.grid { container-type: inline-size; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--gap); }
.tile { height: clamp(54px, 14cqw, 76px); min-width: 0; padding: 0 3px; display: grid; place-items: center; border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--panel-2); color: var(--text); font: inherit; font-size: clamp(9px, min(4.4cqw, calc(26cqw / var(--len))), 18px); font-weight: 700; text-align: center; text-transform: uppercase; line-height: 1.1; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.tile.on { background: var(--text); border-color: var(--text); color: var(--bg); }
.tile:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.tile:disabled { cursor: default; }
.go { min-height: 40px; min-width: 110px; }
@media (pointer: coarse) { .go { min-height: 44px; } }
@media (prefers-reduced-motion: no-preference) {
  .tile { transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
  .tile:active:not(:disabled) { transform: scale(.95); }
  .tile.jump { animation: cn-jump .5s var(--ease-out); animation-delay: calc(var(--i) * 70ms); }
  .cn-move { transition: transform .4s var(--ease-out); }
  .bar { animation: cn-in .35s var(--ease-out); }
}
@media (hover: hover) { .tile:hover:not(:disabled):not(.on) { background: color-mix(in oklab, var(--text) 14%, var(--panel)); } }
.cn-leave-active { display: none; transition: none; }
@keyframes cn-jump { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(-10px); } 70% { transform: translateY(2px); } }
@keyframes cn-in { from { opacity: 0; transform: scale(.94); } }
</style>
