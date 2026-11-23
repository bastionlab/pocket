<script setup lang="ts">
import { SUDOKU6, SUDOKU9, sudokuAutoNotes, sudokuConflicts, sudokuHintCell, sudokuPuzzle, sudokuTechnique } from '../../utils/puzzles/logic'
import { burst, flash, pulse, shake } from '../../utils/puzzles/fx'
import { gameKey } from '../../utils/puzzles/registry'

/** 9x9 Sudoku, or the 6x6 mini (2x3 boxes) with `mini`: one solution each, three mistakes end the game, hints are bought */
const props = defineProps<{ day: string, mini?: boolean, level?: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
const id = props.mini ? 'sudoku-mini' : 'sudoku'
// Sudoku has levels (the mini does not): easy / medium / hard = about 42 / 34 / 27 givens, each its own puzzle and save
const level = props.mini ? undefined : (['easy', 'hard'].includes(props.level ?? '') ? props.level! : 'medium')
const key = gameKey(id, level)
const GIVENS: Record<string, number> = { easy: 42, medium: 34, hard: 27 }
const sp = props.mini ? SUDOKU6 : SUDOKU9
const N = sp.n, SIZE = N * N
const MAX_ERR = 3, VER = props.mini ? 2 : 3 // (9x9: 3 = the givens count depends on the level) VER: saved boards from before the harder puzzles / mistake counter are dropped
const p = sudokuPuzzle(key, props.day, sp, props.mini ? 10 : GIVENS[level!]!)

/** one undo step: [cell, value before, notes before] for every cell the move touched */
type Change = [number, number, number]
type Res = PuzzleResult & { summary: string }
// notes: one bitmask per cell (bit d = digit d pencilled in)
const fresh = () => ({
  v: 0, vals: p.puzzle.slice(), notes: Array.from({ length: SIZE }, () => 0), pencil: false, sel: -1, sec: 0,
  errors: 0, hints: 0, hinted: [] as number[], hist: [] as Change[][], res: null as Res | null,
})
const st = usePuzzleState(key, props.day, fresh)
if (st.v !== VER) Object.assign(st, fresh(), { v: VER })
useFinish(st, emit)
const time = useTimer(st)
/** digits that differ from the solution (red): placed wrong, or a conflict with a given */
const wrong = computed(() => new Set(st.vals.map((v, i) => (v && v !== p.solution[i] ? i : -1)).filter(i => i >= 0)))
const done = computed(() => !!st.res)
const lost = computed(() => !!st.res && !st.res.solved)
const ending = ref(false) // the win / fail animation is playing: the board is already locked
const locked = computed(() => done.value || ending.value)
const complete = () => st.vals.every((v, i) => v === p.solution[i])
const canHint = computed(() => !locked.value && sudokuHintCell(st.vals, p.solution, sp, st.sel) >= 0)

const rowOf = (i: number) => Math.floor(i / N)
const colOf = (i: number) => i % N
const boxOf = (i: number) => Math.floor(rowOf(i) / sp.br) * (N / sp.bc) + Math.floor(colOf(i) / sp.bc)
const PEERS = Array.from({ length: SIZE }, (_, i) => Array.from({ length: SIZE }, (_, j) => j).filter(j => j !== i && (rowOf(i) === rowOf(j) || colOf(i) === colOf(j) || boxOf(i) === boxOf(j))))
const isPeer = (a: number, b: number) => a !== b && PEERS[a].includes(b)
const cellsOf = (pred: (j: number) => boolean) => Array.from({ length: SIZE }, (_, j) => j).filter(pred)

const selVal = computed(() => (st.sel >= 0 ? st.vals[st.sel] : 0))
const placed = computed(() => {
  const c = Array.from({ length: N + 1 }, () => 0)
  for (const v of st.vals) if (v) c[v]++
  return c
})
const left = (d: number) => N - placed.value[d]
const canUndo = computed(() => st.hist.length > 0 && !locked.value)
const lastPut = ref(-1)
// per-device options (localStorage, not part of the saved board): live conflicts (default on) and digit-first input
const OPT_CONF = 'puzzles:sudoku:conflicts', OPT_DIGIT = 'puzzles:sudoku:digitfirst'
const showConflicts = ref(true)
const digitFirst = ref(false)
const arm = ref(0) // the digit armed on the pad in digit-first mode
const showSol = ref(false) // after a loss: the solution drawn over the board (never saved)
const explain = ref<number[]>([]) // cells the last hint's one-liner is about
onMounted(() => {
  try { showConflicts.value = localStorage.getItem(OPT_CONF) !== '0'; digitFirst.value = localStorage.getItem(OPT_DIGIT) === '1' } catch { /* private mode */ }
})
function setOpt(key: string, on: boolean) { try { localStorage.setItem(key, on ? '1' : '0') } catch { /* private mode */ } }
function toggleConflicts() { showConflicts.value = !showConflicts.value; setOpt(OPT_CONF, showConflicts.value) }
function toggleDigitFirst() { digitFirst.value = !digitFirst.value; arm.value = 0; setOpt(OPT_DIGIT, digitFirst.value) }
/** repeats in a row / column / box right now; a highlight only, the mistake counter still goes by the solution */
const conflicts = computed(() => (showConflicts.value && !showSol.value ? sudokuConflicts(st.vals, sp) : new Set<number>()))
const hlDigit = computed(() => (digitFirst.value && arm.value ? arm.value : selVal.value))
/** what a cell shows: the solution over wrong / empty cells while "Show solution" is on */
const dv = (i: number) => (showSol.value && lost.value ? p.solution[i]! : st.vals[i]!)
const isSol = (i: number) => showSol.value && lost.value && st.vals[i] !== p.solution[i]
/** the one-line note under the board: a wrong digit, a hint, the end of the game */
const note = ref('')
let noteTimer: ReturnType<typeof setTimeout> | undefined
const noteTone = ref<'ok' | 'bad'>('bad')
function say(m: string, ms = 2600, cells: number[] = [], tone: 'ok' | 'bad' = 'bad') { note.value = m; noteTone.value = tone; explain.value = cells; clearTimeout(noteTimer); noteTimer = setTimeout(() => { note.value = ''; explain.value = [] }, ms) }
onBeforeUnmount(() => clearTimeout(noteTimer))
const msg = computed(() => (lost.value ? t('puzzles.grid.outOfMistakes') : note.value))

// --- animation helpers (timers are cleared on unmount) ---
const boardEl = ref<HTMLElement>()
const timers: ReturnType<typeof setTimeout>[] = []
const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)) }
onBeforeUnmount(() => timers.forEach(clearTimeout))
const cellEl = (i: number) => boardEl.value?.children[i] as HTMLElement | undefined
/** a quick pulse running across `cells`, then a small burst at the last one */
function wave(cells: number[], gap = 45) {
  cells.forEach((c, k) => later(() => { const e = cellEl(c); if (e) pulse(e) }, k * gap))
  later(() => { const e = cellEl(cells[cells.length - 1]); if (e) burst(e, { color: '--ok', count: 10, spread: 46 }) }, cells.length * gap)
}
/** the rows, columns and boxes this move just completed */
function lineWaves(i: number) {
  const groups = [cellsOf(j => rowOf(j) === rowOf(i)), cellsOf(j => colOf(j) === colOf(i)), cellsOf(j => boxOf(j) === boxOf(i))]
  groups.filter(g => g.every(j => st.vals[j] === p.solution[j])).forEach((g, k) => later(() => wave(g), k * 140))
}

function result(solved: boolean): Res {
  const clock = `${Math.floor(st.sec / 60)}:${String(st.sec % 60).padStart(2, '0')}`
  const name = props.mini ? 'Mini Sudoku' : 'Sudoku'
  const filled = st.vals.filter((v, i) => v && v === p.solution[i]).length
  return {
    solved, attempts: Math.max(1, Math.ceil(st.sec / 60)), score: solved ? st.sec : 0,
    summary: solved ? t('puzzles.sudoku.sumSolved', { time: clock, m: st.errors, h: st.hints }) : t('puzzles.sudoku.sumFailed', { n: filled, total: SIZE }),
    detail: { share: `${shareHead(name, props.day, solved ? '' : 'X')}\n${clock}, ${st.errors} of ${MAX_ERR} mistakes${st.hints ? `, ${st.hints} hints` : ''}` },
  }
}
/** the whole grid is right: a wave across it, then the result (the shell adds confetti) */
function win() {
  if (ending.value || st.res) return
  ending.value = true
  const r = result(true)
  navigator.vibrate?.([20, 40, 20])
  const order = Array.from({ length: SIZE }, (_, k) => k).sort((a, b) => rowOf(a) + colOf(a) - rowOf(b) - colOf(b))
  order.forEach(c => later(() => { const e = cellEl(c); if (e) pulse(e) }, (rowOf(c) + colOf(c)) * 42))
  ;[0, 1, 2].forEach(k => later(() => { const e = cellEl(order[Math.floor(SIZE * (0.25 + k * 0.25))]); if (e) burst(e, { color: '--ok', count: 14, spread: 60 }) }, 150 + k * 220))
  later(() => { st.res = r }, 900)
}
function fail() {
  if (ending.value || st.res) return
  ending.value = true
  const r = result(false)
  navigator.vibrate?.([30, 40, 60])
  if (boardEl.value) shake(boardEl.value)
  later(() => { st.res = r }, 650)
}
/** a digit that is not the solution's: counts at once, the cell stays red until it is changed or erased */
function mistake(i: number) {
  st.errors++
  say(t('puzzles.grid.wrongDigit', { n: st.errors, max: MAX_ERR }))
  const e = cellEl(i)
  if (e) { shake(e); flash(e, '--bad') }
  navigator.vibrate?.([30, 30, 30])
  if (st.errors >= MAX_ERR) fail()
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  // reloaded in the middle of the closing animation: finish at once
  if (!st.res && complete()) st.res = result(true)
  else if (!st.res && st.errors >= MAX_ERR) st.res = result(false)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function commit(ch: Change[]) {
  if (!ch.length) return
  st.hist.push(ch)
  if (st.hist.length > 300) st.hist.shift()
}
/** write a digit into a cell and, when it is right, drop that digit from the notes of its row, column and box */
function place(i: number, d: number, ch: Change[]) {
  ch.push([i, st.vals[i], st.notes[i]])
  st.vals[i] = d; st.notes[i] = 0
  if (!d || d !== p.solution[i]) return
  for (const j of PEERS[i]) {
    if (!(st.notes[j] & (1 << d))) continue
    ch.push([j, st.vals[j], st.notes[j]])
    st.notes[j] &= ~(1 << d)
  }
}

function pick(i: number) {
  st.sel = i
  if (digitFirst.value && arm.value && !p.puzzle[i]) put(arm.value)
}
/** the number pad: digit-first arms the digit (tap again to disarm), else it goes into the selected cell */
function padTap(d: number) {
  if (!digitFirst.value) return put(d)
  arm.value = arm.value === d ? 0 : d
}
watch(() => placed.value, () => { if (arm.value && left(arm.value) <= 0) arm.value = 0 })
function put(d: number) {
  if (locked.value || st.sel < 0 || p.puzzle[st.sel]) return
  const i = st.sel, ch: Change[] = []
  if (st.pencil) {
    if (st.vals[i]) return
    ch.push([i, 0, st.notes[i]])
    st.notes[i] ^= 1 << d
  } else if (st.vals[i] === d) {
    place(i, 0, ch)
  } else {
    place(i, d, ch)
    lastPut.value = i
  }
  navigator.vibrate?.(8)
  commit(ch)
  if (st.pencil || !st.vals[i]) return
  if (st.vals[i] !== p.solution[i]) mistake(i)
  else afterRight(i)
}
function afterRight(i: number) {
  if (complete()) win()
  else lineWaves(i)
}
function erase() {
  const i = st.sel
  if (locked.value || i < 0 || p.puzzle[i] || (!st.vals[i] && !st.notes[i])) return
  const ch: Change[] = []
  place(i, 0, ch)
  commit(ch)
}
function undo() {
  const ch = st.hist.pop()
  if (!ch || locked.value) return
  for (let k = ch.length - 1; k >= 0; k--) { st.vals[ch[k][0]] = ch[k][1]; st.notes[ch[k][0]] = ch[k][2] }
  st.sel = ch[0][0]
}
/** fill every empty cell's notes with its candidates (one undo step) */
function autoNotes() {
  if (locked.value) return
  const nn = sudokuAutoNotes(st.vals, sp), ch: Change[] = []
  nn.forEach((m, i) => { if (!st.vals[i] && st.notes[i] !== m) { ch.push([i, 0, st.notes[i]]); st.notes[i] = m } })
  commit(ch)
  navigator.vibrate?.(8)
}
/** bought: fills a correct digit (never a mistake); says which simple technique finds it when there is one */
function hint() {
  if (locked.value) return
  let tech = wrong.value.size ? null : sudokuTechnique(st.vals, sp, st.sel)
  if (tech && tech.digit !== p.solution[tech.cell]) tech = null
  const i = tech ? tech.cell : sudokuHintCell(st.vals, p.solution, sp, st.sel)
  if (i < 0) return
  say(tech ? t(`puzzles.sudoku.tech.${tech.kind}`, { d: tech.digit }) : t('puzzles.sudoku.tech.fill'), 5200, tech ? tech.cells : [], 'ok')
  const ch: Change[] = []
  place(i, p.solution[i], ch)
  commit(ch)
  st.sel = i; st.hints++; lastPut.value = i
  if (!st.hinted.includes(i)) st.hinted.push(i)
  navigator.vibrate?.(10)
  const e = cellEl(i)
  if (e) burst(e, { color: '--ok', count: 8, spread: 36 })
  afterRight(i)
}
const togglePencil = () => { st.pencil = !st.pencil }

function move(dx: number, dy: number) {
  if (st.sel < 0) { st.sel = Math.floor(SIZE / 2); return }
  const x = colOf(st.sel) + dx, y = rowOf(st.sel) + dy
  if (x >= 0 && x < N && y >= 0 && y < N) st.sel = y * N + x
}
function onKey(e: KeyboardEvent) {
  const tg = e.target as HTMLElement | null
  if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName))) return
  if (e.altKey) return
  if ((e.ctrlKey || e.metaKey)) {
    if (e.key.toLowerCase() === 'z') { undo(); e.preventDefault() }
    return
  }
  const k = e.key
  if (/^[1-9]$/.test(k) && +k <= N) padTap(+k)
  else if (k === 'Backspace' || k === 'Delete' || k === '0') erase()
  else if (k === 'n' || k === 'N') togglePencil()
  else if (k === 'u' || k === 'U') undo()
  else if (k === 'a' || k === 'A') autoNotes()
  else if (k === 'Escape') st.sel = -1
  else if (k.startsWith('Arrow')) {
    move(k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0, k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0)
    e.preventDefault()
  } else return
}

function cls(i: number) {
  const v = st.vals[i]
  return {
    given: !!p.puzzle[i], sel: st.sel === i, peer: st.sel >= 0 && isPeer(st.sel, i), same: !!hlDigit.value && v === hlDigit.value && st.sel !== i && !showSol.value,
    bad: wrong.value.has(i) && !showSol.value, conflict: conflicts.value.has(i), explain: explain.value.includes(i), sol: isSol(i), hint: !!v && st.hinted.includes(i) && v === p.solution[i], fresh: lastPut.value === i,
    rr: (colOf(i) + 1) % sp.bc === 0 && colOf(i) < N - 1, rb: (rowOf(i) + 1) % sp.br === 0 && rowOf(i) < N - 1, lc: colOf(i) === N - 1, lr: rowOf(i) === N - 1,
  }
}
</script>

<template>
  <div class="sd" :class="{ won: done && !lost, lost, mini }" :style="{ '--n': N }">
    <PuzzlesStage
      :stats="[{ label: $t('puzzles.grid.time'), value: time }]"
      :msg="msg" :tone="lost ? 'bad' : noteTone"
    >
      <template #actions>
        <div class="sd-miss" role="img" :aria-label="$t('puzzles.sudoku.mistakes', { n: st.errors, max: MAX_ERR })">
          <span class="sd-miss-l">{{ $t('puzzles.grid.mistakes') }}</span>
          <span class="sd-pips"><i v-for="k in MAX_ERR" :key="k" :class="{ on: k <= st.errors, last: st.errors >= MAX_ERR - 1 }" /></span>
        </div>
        <PuzzlesHintButton :game="key" :day="day" :disabled="!canHint" @bought="hint" />
      </template>

      <div ref="boardEl" class="sd-board" role="group" :aria-label="$t('puzzles.grid.sudokuBoard')">
        <button
          v-for="(v, i) in st.vals" :key="i" type="button" class="sd-cell" :class="cls(i)"
          :aria-label="$t('puzzles.sudoku.cell', { r: rowOf(i) + 1, c: colOf(i) + 1, v: v || $t('puzzles.sudoku.blank') })" :aria-pressed="st.sel === i" @click="pick(i)"
        >
          <span v-if="dv(i)" :key="dv(i)" class="sd-v">{{ dv(i) }}</span>
          <span v-else-if="st.notes[i]" class="sd-notes">
            <i v-for="d in N" :key="d" :class="{ hl: d === hlDigit }">{{ st.notes[i] & (1 << d) ? d : '' }}</i>
          </span>
        </button>
      </div>

      <div class="sd-pad">
        <button
          v-for="d in N" :key="d" type="button" class="sd-key" :class="{ on: st.pencil && !digitFirst && st.sel >= 0 && !!(st.notes[st.sel] & (1 << d)), match: digitFirst ? arm === d : (!st.pencil && selVal === d) }"
          :disabled="locked || left(d) <= 0" :aria-label="`${d}, ${$t('puzzles.sudoku.left', { n: Math.max(0, left(d)) })}`" @click="padTap(d)"
        >
          <b>{{ d }}</b><small>{{ left(d) > 0 ? left(d) : '' }}</small>
        </button>
      </div>

      <template #tools>
        <PuzzlesTool icon="undo-2" icon-only :label="$t('puzzles.sudoku.undo')" :disabled="!canUndo" @click="undo" />
        <PuzzlesTool icon="x" icon-only :label="$t('puzzles.erase')" :disabled="locked" @click="erase" />
        <PuzzlesTool icon="pencil" :label="$t('puzzles.sudoku.notes')" :on="st.pencil" :disabled="locked" @click="togglePencil" />
        <PuzzlesTool icon="sparkles" :label="$t('puzzles.sudoku.autoNotes')" :disabled="locked" @click="autoNotes" />
        <PuzzlesTool v-if="lost" :icon="showSol ? 'eye-off' : 'eye'" :label="showSol ? $t('puzzles.sudoku.hideSolution') : $t('puzzles.sudoku.showSolution')" :on="showSol" @click="showSol = !showSol" />
        <details class="sd-more">
          <summary>{{ $t('puzzles.sudoku.options') }}</summary>
          <div class="sd-opts">
            <button type="button" class="chip" :class="{ on: digitFirst }" :aria-pressed="digitFirst" @click="toggleDigitFirst">{{ $t('puzzles.sudoku.digitFirst') }}</button>
            <button type="button" class="chip" :class="{ on: showConflicts }" :aria-pressed="showConflicts" @click="toggleConflicts">{{ $t('puzzles.sudoku.conflicts') }}</button>
          </div>
          <ul class="sd-keys small muted">
            <li><kbd>1</kbd>-<kbd>{{ N }}</kbd> {{ $t('puzzles.sudoku.kDigit') }}</li>
            <li><kbd>N</kbd> {{ $t('puzzles.sudoku.kNotes') }}</li>
            <li><kbd>A</kbd> {{ $t('puzzles.sudoku.kAuto') }}</li>
            <li><kbd>U</kbd> / <kbd>Ctrl</kbd>+<kbd>Z</kbd> {{ $t('puzzles.sudoku.undo') }}</li>
            <li><kbd>Backspace</kbd> {{ $t('puzzles.erase') }}</li>
            <li><kbd>Arrows</kbd> {{ $t('puzzles.sudoku.kMove') }}, <kbd>Esc</kbd> {{ $t('puzzles.sudoku.kDeselect') }}</li>
          </ul>
        </details>
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
/* the frame (stats bar, tools, width) is <PuzzlesStage>; the board and the number pad are Sudoku's */
.sd {
  --sd-peer: color-mix(in srgb, var(--accent) 7%, transparent);
  --sd-same: color-mix(in srgb, var(--accent) 18%, transparent);
  --sd-edge: var(--muted);
  width: 100%; user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent;
}

.sd-board {
  container-type: inline-size; display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); width: 100%; box-sizing: border-box;
  border: 2px solid var(--sd-edge); border-radius: var(--radius-sm); overflow: hidden; background: var(--panel); touch-action: manipulation;
}
.sd-cell {
  position: relative; aspect-ratio: 1; min-width: 0; min-height: 0; padding: 0; overflow: hidden; display: grid; place-items: center;
  border: 0; border-right: 1px solid var(--line-2); border-bottom: 1px solid var(--line-2); border-radius: 0;
  background: transparent; color: var(--accent); font: inherit; cursor: pointer;
  font-size: calc(100cqw / var(--n) * .56); line-height: 1;
}
.sd-cell.rr { border-right: 2px solid var(--sd-edge); }
.sd-cell.rb { border-bottom: 2px solid var(--sd-edge); }
.sd-cell.lc { border-right-width: 0; }
.sd-cell.lr { border-bottom-width: 0; }
.sd-cell.peer { background: var(--sd-peer); }
.sd-cell.same { background: var(--sd-same); }
.sd-cell.sel { background: var(--accent-soft); box-shadow: inset 0 0 0 2px var(--accent); z-index: 1; }
.sd-cell.given { color: var(--text); font-weight: 700; }
.sd-cell.hint { color: var(--ok); }
.sd-cell.explain { background: color-mix(in srgb, var(--ok) 16%, transparent); }
.sd-cell.conflict { color: var(--bad); background: color-mix(in srgb, var(--bad) 10%, transparent); }
.sd-cell.bad { background: var(--bad-soft); color: var(--bad); }
.sd-cell.sol { color: var(--ok); font-style: italic; background: color-mix(in srgb, var(--ok) 10%, transparent); }
.sd-cell:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.sd-v { display: block; }
.lost .sd-board { border-color: var(--bad); }

.sd-notes { display: grid; grid-template-columns: repeat(3, 1fr); width: 100%; height: 100%; padding: 6%; box-sizing: border-box; align-content: stretch; }
.mini .sd-notes { grid-template-rows: repeat(2, 1fr); padding: 10%; }
.sd-notes i { display: grid; place-items: center; font-style: normal; font-size: calc(100cqw / var(--n) * .25); line-height: 1; color: var(--muted); }
.sd-notes i.hl { color: var(--accent); font-weight: 700; }

.sd-miss { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; margin-right: 8px; }
.sd-miss-l { font-size: 11px; line-height: 1; color: var(--muted); }
.sd-pips { display: flex; gap: 5px; }
.sd-pips i { width: 11px; height: 11px; border-radius: 50%; border: 1.5px solid var(--line-2); box-sizing: border-box; }
.sd-pips i.on { background: var(--warn); border-color: var(--warn); }
.sd-pips i.on.last { background: var(--bad); border-color: var(--bad); }
.sd-more { flex-basis: 100%; text-align: center; }
.sd-more summary { display: inline-block; cursor: pointer; font-size: 12.5px; color: var(--muted); padding: 4px 8px; }
.sd-opts { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; margin: 4px 0 8px; }
.sd-keys { list-style: none; margin: 0; padding: 0; display: grid; gap: 3px; }
.sd-keys kbd { font: inherit; font-size: 11.5px; padding: 0 5px; border: 1px solid var(--line-2); border-radius: 4px; background: var(--panel-2); color: var(--text); }
.sd-pad { display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: 5px; width: 100%; }
.sd-key {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 52px; padding: 0;
  border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--panel-2); color: var(--text); font: inherit; cursor: pointer; touch-action: manipulation;
}
.sd-key b { font-size: 20px; font-weight: 600; line-height: 1; }
.sd-key small { height: 11px; font-size: 10.5px; line-height: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
.sd-key.on, .sd-key.match { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.sd-key:disabled { opacity: .3; cursor: default; }
@media (min-width: 641px) and (pointer: fine) { .sd-key { min-height: 46px; flex-direction: row; gap: 5px; } .sd-key small { height: auto; } }

@media (hover: hover) {
  .sd-cell:hover:not(.sel) { background: var(--sd-same); }
  .sd-key:hover:not(:disabled) { border-color: var(--accent); }
}
@media (prefers-reduced-motion: no-preference) {
  .sd-key { transition: transform var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out); }
  .sd-key:active:not(:disabled) { transform: scale(.94); }
  .sd-cell.fresh .sd-v { animation: sd-pop var(--dur) var(--ease-spring); }
}
@keyframes sd-pop { from { transform: scale(.55); opacity: 0; } to { transform: scale(1); opacity: 1; } }
</style>
