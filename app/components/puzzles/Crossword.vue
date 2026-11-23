<script setup lang="ts">
import { crossword7For, crosswordFor, type CwSlot } from '../../utils/puzzles/crossword'
import { advanceFrom, allLocked, backFrom, clearable, firstFree, hintTarget, lockedCells, sanitize, slotRight, targetCell, wrongSlots } from '../../utils/puzzles/crosswordPlay'
import { fnv1a } from '../../utils/puzzles/rng'
import { gameKey } from '../../utils/puzzles/registry'
import { pulse, shake } from '../../utils/puzzles/fx'

/**
 * The crossword board, shared by the 5x5 Mini Crossword (`size` 5, id crossword-mini) and the 7x7 Crossword (default,
 * levels). A word is judged when its last square is filled: right = it locks, wrong = it shakes and is cleared again.
 */
const props = withDefaults(defineProps<{ day: string, size?: number, level?: string }>(), { size: 7, level: undefined })
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
const mini = props.size === 5
const key = mini ? 'crossword-mini' : gameKey('crossword', props.level)
const pz = mini ? crosswordFor(props.day) : crossword7For(props.day, props.level)
const N = pz.size
const sig = String(fnv1a(pz.solution.join('')))
const st = usePuzzleState(key, props.day, () => ({
  letters: Array(N * N).fill('') as string[], sel: -1, dir: 'across' as 'across' | 'down', revealed: [] as number[], hints: 0, sec: 0, sig: '', res: null as PuzzleResult | null,
}))
useFinish(st, emit)
const clock = useTimer(st)
const cellsEl = ref<HTMLElement | null>(null)
const sure = ref(false)

const slots = computed<CwSlot[]>(() => [...pz.across, ...pz.down])
const black = (i: number) => !pz.solution[i]
const slotOf = (cell: number, dir: 'across' | 'down') => (dir === 'across' ? pz.across : pz.down).find(s => s.cells.includes(cell))

// a board saved for another grid (the word bank grew, or a save from before `sig`) cannot be shown: start it over, or just show the solution when it was finished
if (st.sig !== sig) {
  st.letters = st.res ? [...pz.solution] : Array(N * N).fill('')
  st.revealed = []
  st.sel = -1
  st.sig = sig
}
// a reload keeps the locks (they follow from the letters) but never a wrong word
if (!st.res) st.letters = sanitize(pz.solution, slots.value, st.letters, st.revealed)
const first = pz.solution.findIndex(x => x)
if (st.sel < 0 || black(st.sel)) st.sel = first
const cur = computed(() => slotOf(st.sel, st.dir) || slotOf(st.sel, st.dir === 'across' ? 'down' : 'across')!)
const over = computed(() => !!st.res)
const locked = computed(() => lockedCells(pz.solution, slots.value, st.letters, st.revealed))
const doneSlots = computed(() => new Set(slots.value.filter(s => slotRight(pz.solution, st.letters, s))))
/** squares of a wrong word during the short beat before they are cleared: no input there */
const pending = ref(new Set<number>())
const msg = ref('')
const msgTone = ref<'ok' | 'warn' | undefined>(undefined)
const stats = computed(() => [
  { label: t('puzzles.crossword.time'), value: clock.value },
  { label: t('puzzles.crossword.words'), value: `${doneSlots.value.size}/${slots.value.length}`, tone: over.value && st.res?.solved ? 'ok' as const : undefined },
])

const timers = new Set<ReturnType<typeof setTimeout>>()
const later = (fn: () => void, ms: number) => { const id = setTimeout(() => { timers.delete(id); fn() }, ms); timers.add(id) }
onBeforeUnmount(() => { timers.forEach(clearTimeout); window.removeEventListener('keydown', arrow) })
let msgTimer: ReturnType<typeof setTimeout> | undefined
function say(text: string, tone?: 'ok' | 'warn') {
  msg.value = text; msgTone.value = tone
  clearTimeout(msgTimer)
  msgTimer = setTimeout(() => { msg.value = '' }, 2400)
}
onBeforeUnmount(() => clearTimeout(msgTimer))

function select(i: number) {
  if (over.value || black(i)) return
  if (i === st.sel) {
    const o = st.dir === 'across' ? 'down' : 'across'
    if (slotOf(i, o)) st.dir = o
  } else {
    st.sel = i
    if (!slotOf(i, st.dir)) st.dir = st.dir === 'across' ? 'down' : 'across'
  }
}
function goSlot(s: CwSlot) {
  if (over.value) return
  st.dir = s.dir
  st.sel = firstFree(s.cells, locked.value, st.letters)
}
/** the next / previous word that is not locked yet */
function step(d: number) {
  const n = slots.value.length
  const i = slots.value.indexOf(cur.value)
  for (let k = 1; k <= n; k++) {
    const s = slots.value[(i + d * k + n * k) % n]
    if (!doneSlots.value.has(s)) { goSlot(s); return }
  }
}
// a reload with the cursor on a locked word: carry on with the next open one
if (!st.res && doneSlots.value.has(cur.value)) step(1)

/** judge the filled words through a square: right ones lock by themselves, wrong ones shake and are cleared after a beat */
function judge(cell: number): CwSlot[] {
  const through = [slotOf(cell, 'across'), slotOf(cell, 'down')].filter(Boolean) as CwSlot[]
  const wrong = wrongSlots(pz.solution, through, st.letters)
  if (wrong.length) reject(wrong)
  else if (through.some(s => doneSlots.value.has(s))) say(t('puzzles.crossword.locked'), 'ok')
  verify()
  return wrong
}
function reject(list: CwSlot[]) {
  const cells = [...new Set(list.flatMap(s => clearable(s, locked.value)))]
  if (!cells.length) return
  cells.forEach(c => pending.value.add(c))
  pending.value = new Set(pending.value)
  say(t('puzzles.crossword.notRight'), 'warn')
  navigator.vibrate?.(20)
  nextTick(() => cells.forEach((c) => { const el = cellsEl.value?.querySelector<HTMLElement>(`[data-i="${c}"]`); if (el) shake(el) }))
  later(() => {
    // squares a right word locked meanwhile stay
    const keep = lockedCells(pz.solution, slots.value, st.letters, st.revealed)
    for (const c of cells) if (!keep.has(c)) st.letters[c] = ''
    pending.value = new Set([...pending.value].filter(c => !cells.includes(c)))
    const s = list.find(x => x.cells.includes(st.sel)) ?? list[0]
    if (!over.value && list.some(x => x.cells.includes(st.sel))) { st.dir = s.dir; st.sel = firstFree(s.cells, keep, st.letters) }
  }, 500)
}

function key_(l: string) {
  if (over.value || pending.value.has(st.sel)) return
  const c = targetCell(cur.value.cells, st.sel, locked.value)
  if (c < 0) return
  const wasDone = doneSlots.value.has(cur.value)
  st.letters[c] = l.toUpperCase()
  st.sel = c
  const here = cur.value
  const wrong = judge(c)
  if (over.value || wrong.includes(here)) return
  if (doneSlots.value.has(here) && !wasDone) step(1)
  else st.sel = advanceFrom(here.cells, c, locked.value, st.letters)
}
function back() {
  if (over.value) return
  const b = backFrom(cur.value.cells, st.sel, locked.value, st.letters, pending.value)
  st.sel = b.sel
  if (b.clear >= 0) st.letters[b.clear] = ''
}
function arrow(e: KeyboardEvent) {
  if (over.value || e.ctrlKey || e.metaKey || e.altKey) return
  const d: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] }
  if (e.key === 'Tab') { e.preventDefault(); step(e.shiftKey ? -1 : 1); return }
  if (e.key === ' ') { e.preventDefault(); select(st.sel); return }
  const m = d[e.key]
  if (!m) return
  e.preventDefault()
  const dir = m[0] ? 'down' : 'across'
  if (dir !== st.dir) { st.dir = dir; if (slotOf(st.sel, dir)) return }
  let r = Math.floor(st.sel / N) + m[0]
  let c = (st.sel % N) + m[1]
  while (r >= 0 && c >= 0 && r < N && c < N) {
    if (!black(r * N + c)) { st.sel = r * N + c; return }
    r += m[0]; c += m[1]
  }
}
onMounted(() => window.addEventListener('keydown', arrow))

function verify() {
  if (st.res || !allLocked(pz.solution, slots.value, st.letters)) return
  st.res = { solved: true, attempts: st.hints, score: st.sec, summary: t('puzzles.crossword.summary', { time: clock.value }), detail: { sec: st.sec, hints: st.hints, size: N, ...(props.level ? { level: props.level } : {}) } }
  navigator.vibrate?.([10, 30, 10])
  nextTick(() => cellsEl.value?.querySelectorAll<HTMLElement>('.c:not(.blk)').forEach((el) => {
    setTimeout(() => pulse(el), (Number(el.dataset.r) + Number(el.dataset.c)) * 70)
  }))
}
let sureTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(sureTimer))
function giveUp() {
  if (!sure.value) { sure.value = true; clearTimeout(sureTimer); sureTimer = setTimeout(() => { sure.value = false }, 3000); return }
  sure.value = false
  pz.solution.forEach((x, i) => { st.letters[i] = x })
  pending.value = new Set()
  st.res = { solved: false, attempts: st.hints, score: 0, summary: t('puzzles.crossword.gaveUp'), detail: { sec: st.sec, hints: st.hints, size: N, ...(props.level ? { level: props.level } : {}) } }
}
/** a hint writes the right letter and locks it */
function reveal(cells: number[]) {
  for (const c of cells) { st.letters[c] = pz.solution[c]; if (!st.revealed.includes(c)) st.revealed.push(c); pending.value.delete(c) }
  pending.value = new Set(pending.value)
  st.hints++
  for (const c of cells) judge(c)
  if (!over.value && doneSlots.value.has(cur.value)) step(1)
}
const hintCell = computed(() => (over.value ? -1 : hintTarget(cur.value.cells, st.sel, locked.value, st.letters, pz.solution)))
const canWord = computed(() => !over.value && !doneSlots.value.has(cur.value))
const pos = (i: number) => ({ r: Math.floor(i / N), c: i % N })
const inWord = (i: number) => cur.value.cells.includes(i)

// beside the clue lists when the stage is wide enough (a 7x7 board on PC), under the keyboard otherwise
const rootEl = ref<HTMLElement | null>(null)
const wide = ref(false)
let ro: ResizeObserver | undefined
onMounted(() => {
  if (mini || !rootEl.value || typeof ResizeObserver === 'undefined') return
  ro = new ResizeObserver(([e]) => { wide.value = e.contentRect.width >= 500 })
  ro.observe(rootEl.value)
})
onBeforeUnmount(() => ro?.disconnect())
</script>

<template>
  <div ref="rootEl" class="cw" :style="{ '--cn': N }">
    <PuzzlesStage :stats="stats" :msg="msg" :tone="msgTone">
      <template #actions>
        <PuzzlesHintButton :game="key" :day="day" :label="$t('puzzles.crossword.revealLetter')" :disabled="hintCell < 0" @bought="reveal([hintCell])" />
      </template>

      <div class="top" :class="{ side: wide }">
        <div class="gridw">
          <div ref="cellsEl" class="grid" role="grid" :aria-label="$t('puzzles.crossword.grid')">
            <template v-for="(x, i) in pz.solution" :key="i">
              <div v-if="!x" class="c blk" />
              <button
                v-else class="c" :class="{ sel: i === st.sel, word: inWord(i), lock: locked.has(i) && !over, rev: st.revealed.includes(i), ok: over && !!st.res?.solved }"
                :data-i="i" :data-r="pos(i).r" :data-c="pos(i).c" role="gridcell" :aria-label="st.letters[i] || $t('puzzles.crossword.empty')" @click="select(i)"
              >
                <i v-if="pz.numbers[i]" class="n">{{ pz.numbers[i] }}</i>
                <span class="l">{{ st.letters[i] }}</span>
              </button>
            </template>
          </div>
        </div>
        <div v-if="wide" class="sidelists"><div class="sl-in"><PuzzlesCrosswordClues :across="pz.across" :down="pz.down" :cur="cur" :done="doneSlots" class="col" follow @go="goSlot" /></div></div>
      </div>
      <div class="bar">
        <button class="btn sm ghost arr" :aria-label="$t('puzzles.crossword.prev')" @click="step(-1)"><Icon name="chevron-left" :size="18" /></button>
        <p class="clue"><b class="num">{{ cur.n }}{{ cur.dir === 'across' ? 'A' : 'D' }}</b> {{ cur.clue }}</p>
        <button class="btn sm ghost arr" :aria-label="$t('puzzles.crossword.next')" @click="step(1)"><Icon name="chevron-right" :size="18" /></button>
      </div>

      <template #tools>
        <PuzzlesKeyboard class="cw-kb" :disabled="over" @key="key_" @back="back" @enter="step(1)" />
        <PuzzlesHintButton :game="key" :day="day" :label="$t('puzzles.crossword.revealWord')" :disabled="!canWord" @bought="reveal(cur.cells.filter(c => !locked.has(c)))" />
        <PuzzlesTool icon="flag" :label="sure ? $t('puzzles.crossword.sure') : $t('puzzles.crossword.giveUp')" :disabled="over" @click="giveUp" />
        <PuzzlesCrosswordClues v-if="!wide" class="cw-lists" :across="pz.across" :down="pz.down" :cur="cur" :done="doneSlots" @go="goSlot" />
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
/* the frame is <PuzzlesStage>; the grid is as wide as the stage allows, but never so tall that the keyboard leaves the window */
.cw { width: 100%; }
.cw-kb { flex: 1 1 100%; }
.cw-lists { flex: 1 1 100%; margin-top: 4px; }
.top { width: 100%; display: flex; justify-content: center; }
.gridw { width: min(100%, max(calc(var(--cn) * 40px + 14px), calc(100dvh - 520px))); container-type: inline-size; }
@media (max-width: 640px) { .gridw { width: min(100%, max(calc(var(--cn) * 40px + 14px), calc(100dvh - var(--tabbar, 0px) - 455px))); } } /* phone: grid + clue + keyboard end above the tab bar, cells stay 40px or more */
.top.side { display: grid; grid-template-columns: minmax(0, 11fr) minmax(0, 9fr); gap: 14px; align-items: start; }
.top.side .gridw { width: 100%; }
.sidelists { position: relative; align-self: stretch; min-height: 0; }
.sl-in { position: absolute; inset: 0; overflow-y: auto; overscroll-behavior: contain; }
.grid { display: grid; grid-template-columns: repeat(var(--cn), minmax(0, 1fr)); gap: 2px; padding: 2px; background: var(--line-2); border: 1px solid var(--line-2); border-radius: var(--radius-sm); overflow: hidden; }
.c { position: relative; aspect-ratio: 1; min-width: 0; padding: 0; border: 0; border-radius: 0; background: var(--panel); color: var(--text); font: inherit; display: grid; place-items: center; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.c.blk { background: color-mix(in oklab, black 88%, var(--panel)); cursor: default; }
.c.word { background: color-mix(in oklab, var(--accent) 24%, var(--panel)); }
.c.lock { background: var(--pz-c3-soft); cursor: default; }
.c.sel { background: color-mix(in oklab, var(--accent) 45%, var(--panel)); }
.c.lock.sel { background: color-mix(in oklab, var(--pz-c3) 45%, var(--panel)); }
.c.ok { background: var(--pz-c3-soft); }
.c.rev .l { color: var(--accent); }
.c:focus-visible { outline: 2px solid var(--accent); outline-offset: -3px; }
.n { position: absolute; top: 2px; left: 3px; font-size: max(9px, calc(16cqw / var(--cn))); font-style: normal; line-height: 1; color: var(--muted); }
.l { font-size: calc(50cqw / var(--cn)); font-weight: 700; line-height: 1; }
.bar { width: 100%; display: flex; align-items: center; gap: 6px; background: var(--accent-soft); border-radius: var(--radius-sm); padding: 3px; }
.arr { min-width: 40px; min-height: 40px; }
.clue { flex: 1; margin: 0; font-size: 14.5px; line-height: 1.3; text-align: center; }
.clue b { color: var(--accent); margin-right: 4px; }
@media (hover: hover) { .c:not(.blk):hover:not(.sel):not(.lock) { background: color-mix(in oklab, var(--accent) 12%, var(--panel)); } }
</style>
