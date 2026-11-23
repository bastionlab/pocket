<script setup lang="ts">
import { mastermindCode, mastermindHintPos, mastermindMark, mmSpec } from '../../utils/puzzles/logic'
import { burst, shake } from '../../utils/puzzles/fx'
import { gameKey } from '../../utils/puzzles/registry'

/** Mastermind: easy 4 pegs / 5 colours / 10 tries, medium 5 / 6 / 8, hard 5 / 8 / 10 */
const props = defineProps<{ day: string, level?: string }>()
const emit = defineEmits<{ finish: [r: PuzzleResult] }>()
const { t } = usePuzzleI18n()
const level = ['easy', 'hard'].includes(props.level ?? '') ? props.level! : 'medium'
const key = gameKey('mastermind', level)
const MM = mmSpec(level)
const code = mastermindCode(key, props.day, MM)
// cur = the row being built, one entry per slot (-1 = empty); an older save kept only the filled pegs, so pad it
// hints: the code positions a bought hint has shown (kept so a reload neither charges twice nor loses them)
const st = usePuzzleState(key, props.day, () => ({ guesses: [] as number[][], cur: Array.from({ length: MM.len }, () => -1), hints: [] as number[], res: null as PuzzleResult | null }))
// a save from the 4-peg game: start the board again
if (st.guesses.some(g => g.length !== MM.len)) { st.guesses = []; st.hints = []; st.res = null }
st.cur = Array.from({ length: MM.len }, (_, k) => st.cur[k] ?? -1)
useFinish(st, emit)

const NAMES = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'teal']
// one shape per colour for colour-blind players (24 x 24 box)
const SHAPES = [
  'M12 5a7 7 0 1 0 0 14a7 7 0 1 0 0-14z',
  'M12 4.5 20 19H4z',
  'M5.5 5.5h13v13h-13z',
  'M12 3.5 20.5 12 12 20.5 3.5 12z',
  'M12 3l2.7 5.8 6.3.8-4.6 4.4 1.2 6.3L12 17.2l-5.6 3.1 1.2-6.3L3 9.6l6.3-.8z',
  'M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z',
  'M12 3.5c3 3.5 6.5 6.5 6.5 10a6.5 6.5 0 0 1-13 0c0-3.5 3.5-6.5 6.5-10z', // drop
  'M12 4 19.5 8v8L12 20 4.5 16V8z', // hexagon
]
const marksOn = useSticky('puzzles-mm-marks', false)

const marks = computed(() => st.guesses.map(g => mastermindMark(g, code)))
const sel = ref(-1) // slot picked by tapping it; -1 = the next empty one
const fresh = ref(0) // row that was just submitted (its pegs animate in)
const note = ref('')
const root = ref<HTMLElement | null>(null)
const done = computed(() => !!st.res)
const row = computed(() => st.guesses.length + 1)
const active = computed(() => (st.res ? -1 : sel.value >= 0 ? sel.value : st.cur.indexOf(-1)))
const full = computed(() => st.cur.every(c => c >= 0))
const name = (c: number) => t(`puzzles.mm.colours.${NAMES[c]}`)
const buzz = () => navigator.vibrate?.(10)

function tapSlot(k: number) {
  if (st.res) return
  note.value = ''
  if (active.value === k && st.cur[k] >= 0) { st.cur[k] = -1; sel.value = -1 } else sel.value = k
}
function pick(c: number) {
  const k = active.value
  if (st.res || k < 0) return
  st.cur[k] = c
  sel.value = -1
  note.value = ''
  buzz()
}
function undo() {
  const k = st.cur.findLastIndex(c => c >= 0)
  if (st.res || k < 0) return
  st.cur[k] = -1; sel.value = -1; note.value = ''
}
function clear() {
  if (st.res) return
  st.cur = Array.from({ length: MM.len }, () => -1); sel.value = -1; note.value = ''
}
function submit() {
  if (st.res || !full.value) return
  if (st.guesses.some(g => g.join() === st.cur.join())) {
    note.value = t('puzzles.mm.dupe')
    const el = root.value?.querySelector<HTMLElement>('.mm-row.cur')
    if (el) shake(el)
    navigator.vibrate?.([20, 30, 20])
    return
  }
  st.guesses.push([...st.cur])
  clear()
  buzz()
  const n = st.guesses.length
  fresh.value = n
  const m = mastermindMark(st.guesses[n - 1], code)
  const won = m.exact === MM.len
  // the exact pegs pop as the feedback appears (same stagger as the CSS pop)
  nextTick(() => root.value?.querySelectorAll<HTMLElement>(`.mm-row[data-r="${n}"] .mm-fb i.ex`).forEach((e, k) => setTimeout(() => burst(e, { color: '--ok', count: 7, spread: 26 }), k * 70 + 120)))
  if (won || n >= MM.tries) {
    const h = st.hints.length
    const base = won ? t('puzzles.mm.sumWon', { n, max: MM.tries }) : t('puzzles.mm.sumLost', { c: code.map(name).join(', ') })
    st.res = { solved: won, attempts: n, score: won ? n : 0, summary: h ? `${base} ${t('puzzles.mm.sumHints', { h })}` : base, detail: { code: code.join(''), hints: h } }
  }
}
/** bought: shows one position of the code (preferring one the last guess missed) */
function hint() {
  if (st.res) return
  const k = mastermindHintPos(key, props.day, code, st.hints, st.guesses[st.guesses.length - 1])
  if (k < 0) return
  st.hints.push(k)
  nextTick(() => { const e = root.value?.querySelector<HTMLElement>(`.mm-row.code .peg[data-k="${k}"]`); if (e) burst(e, { color: '--warn', count: 10, spread: 40 }) })
}
const canHint = computed(() => !st.res && st.hints.length < MM.len - 2)

const pegs = (r: number): number[] => st.guesses[r - 1] ?? (r === row.value && !st.res ? st.cur : Array.from({ length: MM.len }, () => -1))
function rowLabel(r: number) {
  const m = marks.value[r - 1]
  return t('puzzles.mm.row', { n: r, c: pegs(r).map(name).join(', '), e: m.exact, p: m.partial })
}
const fbDots = (r: number) => {
  const m = marks.value[r - 1]
  return Array.from({ length: MM.len }, (_, k) => (k < m.exact ? 'ex' : k < m.exact + m.partial ? 'pa' : ''))
}

// desktop: 1-8 (as many as the level has colours) place a colour, Backspace undoes, Enter submits
function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  const el = e.target as HTMLElement | null
  if (el?.closest('input, textarea, select, [contenteditable]')) return
  if (/^[1-8]$/.test(e.key) && Number(e.key) <= MM.colours) pick(Number(e.key) - 1)
  else if (e.key === 'Backspace') undo()
  else if (e.key === 'Enter' && !el?.closest('button, a')) submit()
}
/** phone: the board is sized from the window (above the tab bar) so the current row, palette and Submit are all on screen;
 * earlier rows scroll inside the board and the current row is kept in view */
function fitBoard() {
  const r = root.value, b = r?.querySelector<HTMLElement>('.mm-board'), go = r?.querySelector<HTMLElement>('.mm-go')
  if (!r || !b || !go) return
  if (!matchMedia('(max-width: 640px)').matches) { r.style.removeProperty('--mm-bh'); return }
  const br = b.getBoundingClientRect()
  const below = go.getBoundingClientRect().bottom - br.bottom
  r.style.setProperty('--mm-bh', `max(150px, calc(100dvh - var(--tabbar, 0px) - ${Math.round(br.top + scrollY + below + 10)}px))`)
}
function keepCur() {
  const b = root.value?.querySelector<HTMLElement>('.mm-board'), c = b?.querySelector<HTMLElement>('.mm-row.cur')
  if (!b || !c) return
  const bb = b.getBoundingClientRect(), cb = c.getBoundingClientRect()
  if (cb.bottom > bb.bottom) b.scrollTop += cb.bottom - bb.bottom + 2
  else if (cb.top < bb.top) b.scrollTop -= bb.top - cb.top + 2
}
watch(row, () => nextTick(keepCur))
onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', fitBoard)
  nextTick(() => { fitBoard(); keepCur() })
  setTimeout(() => { fitBoard(); keepCur() }, 400) // the shell lays out the header / level seg after mount
})
onBeforeUnmount(() => { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', fitBoard) })
</script>

<template>
  <div ref="root" class="mm" :class="{ marks: marksOn }" :style="{ '--len': MM.len, '--cols': MM.colours }">
    <PuzzlesStage
      :stats="[{ label: $t('puzzles.mm.tries'), value: `${Math.min(row, MM.tries)}/${MM.tries}`, tone: st.res ? (st.res.solved ? 'ok' : 'bad') : undefined }]"
      :msg="note || (st.res ? (st.res.solved ? $t('puzzles.mm.won', { n: st.res.attempts }) : $t('puzzles.mm.lost')) : '')" :tone="note ? 'warn' : st.res?.solved ? 'ok' : st.res ? 'bad' : undefined"
    >
      <template #actions>
        <PuzzlesHintButton :game="key" :day="day" :disabled="!canHint" @bought="hint" />
      </template>

      <div class="mm-board" role="group" :aria-label="$t('puzzles.mm.board')">
        <div class="mm-row code" :class="{ open: done }" :aria-label="done ? $t('puzzles.mm.codeLabel', { c: code.map(name).join(', ') }) : $t('puzzles.mm.hidden')" role="img">
          <span class="mm-n" />
          <span v-for="(c, k) in code" :key="k" class="peg" :data-k="k" :class="done ? 'rev' : st.hints.includes(k) ? 'tip' : 'hide'" :style="{ '--pc': `var(--mm-${c})`, '--i': k }">
            <template v-if="done || st.hints.includes(k)"><svg v-if="marksOn" class="mk" viewBox="0 0 24 24" aria-hidden="true"><path :d="SHAPES[c]" /></svg></template>
            <template v-else>?</template>
          </span>
          <span class="mm-fb" />
        </div>
        <div class="mm-sep" />
        <div
          v-for="r in MM.tries" :key="r" class="mm-row" :data-r="r"
          :class="{ cur: r === row && !done, win: st.res?.solved && r === st.guesses.length, fresh: fresh === r }"
          :role="marks[r - 1] ? 'img' : undefined" :aria-label="marks[r - 1] ? rowLabel(r) : undefined"
        >
          <span class="mm-n">{{ r }}</span>
          <template v-if="r === row && !done">
            <button
              v-for="(c, k) in st.cur" :key="k" class="peg slot" :class="{ empty: c < 0, on: active === k }"
              :style="c >= 0 ? { '--pc': `var(--mm-${c})` } : undefined"
              :aria-label="$t('puzzles.mm.slot', { n: k + 1 }) + ', ' + (c >= 0 ? name(c) : $t('puzzles.mm.empty'))" :aria-pressed="active === k"
              @click="tapSlot(k)"
            >
              <svg v-if="marksOn && c >= 0" class="mk" viewBox="0 0 24 24" aria-hidden="true"><path :d="SHAPES[c]" /></svg>
            </button>
          </template>
          <template v-else>
            <span v-for="(c, k) in pegs(r)" :key="k" class="peg" :class="{ empty: c < 0 }" :style="{ ...(c >= 0 ? { '--pc': `var(--mm-${c})` } : {}), '--i': k }" aria-hidden="true">
              <svg v-if="marksOn && c >= 0" class="mk" viewBox="0 0 24 24"><path :d="SHAPES[c]" /></svg>
            </span>
          </template>
          <span class="mm-fb" aria-hidden="true">
            <i v-for="(d, k) in (marks[r - 1] ? fbDots(r) : [])" :key="k" :class="d" :style="{ '--i': k }" />
            <template v-if="!marks[r - 1]"><i v-for="k in MM.len" :key="k" /></template>
          </span>
        </div>
      </div>

      <div class="mm-pal" role="group" :aria-label="$t('puzzles.mm.palette')">
        <button v-for="c in MM.colours" :key="c" class="peg pick" :style="{ '--pc': `var(--mm-${c - 1})` }" :disabled="done" :aria-label="name(c - 1)" @click="pick(c - 1)">
          <svg v-if="marksOn" class="mk" viewBox="0 0 24 24" aria-hidden="true"><path :d="SHAPES[c - 1]" /></svg>
          <kbd class="mm-kbd" aria-hidden="true">{{ c }}</kbd>
        </button>
      </div>

      <button type="button" class="btn primary mm-go" :disabled="done || !full" @click="submit">{{ $t('puzzles.submit') }}</button>

      <p class="mm-key">
        <span class="mm-fb sample"><i class="ex" /></span>{{ $t('puzzles.mm.exact') }}
        <span class="mm-fb sample"><i class="pa" /></span>{{ $t('puzzles.mm.partial') }}
      </p>

      <template #tools>
        <PuzzlesTool icon="undo-2" :label="$t('puzzles.mm.undo')" :disabled="done || st.cur.every(c => c < 0)" @click="undo" />
        <PuzzlesTool icon="rotate-ccw" :label="$t('puzzles.clear')" :disabled="done || st.cur.every(c => c < 0)" @click="clear" />
        <PuzzlesTool icon="eye" :label="$t('puzzles.mm.shapes')" :on="marksOn" @click="marksOn = !marksOn" />
      </template>
    </PuzzlesStage>
  </div>
</template>

<style scoped>
.mm {
  /* the eight code colours (hard uses all, medium the first six, easy five) come from the shared palette; the shape inside each
     one (the Shapes tool) keeps them apart for colour-blind players */
  --mm-0: var(--pz-c1); --mm-1: var(--pz-c5); --mm-2: var(--pz-c10); --mm-3: var(--pz-c3);
  --mm-4: var(--pz-c2); --mm-5: var(--pz-c4); --mm-6: var(--pz-c7); --mm-7: var(--pz-c6);
  --mm-ink: var(--pz-ink);
  width: 100%;
}
.mm-board { container-type: inline-size; display: flex; flex-direction: column; gap: 4px; width: 100%; align-items: center; }
.mm-row {
  --peg: clamp(30px, calc((100cqw - 104px) / var(--len)), 40px);
  display: grid; grid-template-columns: 20px repeat(var(--len), var(--peg)) 40px; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 3px 0; box-sizing: border-box; border: 1px solid transparent; border-radius: var(--radius-sm);
}
.mm-row.cur { background: var(--panel-2); border-color: var(--line-2); }
.mm-n { font-size: 11.5px; color: var(--faint); text-align: center; font-variant-numeric: tabular-nums; }
.mm-row.cur .mm-n { color: var(--accent); font-weight: 600; }
.mm-sep { width: 100%; height: 1px; background: var(--line); margin: 2px 0 3px; }

.peg {
  position: relative; display: grid; place-items: center; width: var(--peg, 40px); height: var(--peg, 40px); padding: 0; box-sizing: border-box;
  border: 0; border-radius: 50%; background: var(--pc); color: var(--mm-ink); font: inherit; font-size: 17px; font-weight: 700;
  box-shadow: inset 0 -3px 0 rgb(0 0 0 / .12);
}
.peg.empty { background: var(--track); box-shadow: inset 0 0 0 1px var(--line-2); }
.peg.tip { box-shadow: inset 0 -3px 0 rgb(0 0 0 / .12), 0 0 0 2px var(--warn); }
.peg.hide { background: var(--panel-2); box-shadow: inset 0 0 0 1px var(--line-2); color: var(--faint); }
.mk { width: 58%; height: 58%; fill: var(--mm-ink); opacity: .82; pointer-events: none; }
button.peg { cursor: pointer; transition: transform var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out); }
button.peg:active:not(:disabled) { transform: scale(.92); }
button.peg:disabled { opacity: .4; cursor: default; }
button.peg:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.peg.slot.on { box-shadow: 0 0 0 2px var(--panel-2), 0 0 0 4px var(--accent); }
.peg.slot.empty.on { background: var(--accent-soft); }
@media (hover: hover) { button.peg.pick:hover:not(:disabled) { transform: translateY(-2px); } }

/* feedback: small pegs in 3 columns, exact = filled, wrong place = ring, rest = dim */
.mm-fb { display: grid; grid-template-columns: repeat(3, 11px); gap: 4px; justify-content: center; }
.mm-fb i { width: 11px; height: 11px; box-sizing: border-box; border-radius: 50%; background: var(--track); }
.mm-fb i.ex { background: var(--text); }
.mm-fb i.pa { background: transparent; border: 2px solid var(--text); }
.mm-fb.sample { display: inline-grid; grid-template-columns: 11px; margin: 0 6px 0 0; vertical-align: -2px; }
.mm-key { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 4px; margin: 0; font-size: 12px; color: var(--faint); }
.mm-key .mm-fb.sample:nth-of-type(2) { margin-left: 14px; }

.mm-pal { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 8px; width: 100%; padding-top: 4px; }
.peg.pick { width: 100%; height: auto; max-width: 52px; aspect-ratio: 1; justify-self: center; }
.mm-kbd { position: absolute; right: -2px; bottom: -2px; display: none; min-width: 15px; height: 15px; padding: 0 3px; box-sizing: border-box; border-radius: 4px; background: var(--panel); border: 1px solid var(--line-2); color: var(--muted); font: inherit; font-size: 10px; font-weight: 600; line-height: 13px; text-align: center; }
@media (hover: hover) and (pointer: fine) { .mm-kbd { display: block; } }
.mm-go { width: 100%; justify-content: center; min-height: 44px; }
@media (max-width: 640px) { .mm-row { --peg: clamp(28px, calc((100cqw - 104px) / var(--len)), 36px); } .mm-board { max-height: var(--mm-bh, none); overflow-y: auto; overscroll-behavior: contain; } }
@media (min-width: 641px) { .mm-row { --peg: clamp(28px, calc((100cqw - 104px) / var(--len)), 34px); padding: 2px 0; } .peg.pick { max-width: 46px; } }
@media (min-width: 641px) and (max-height: 800px) { .mm-row { --peg: 28px; } }

/* motion: transform + opacity only, and only when the player allows it */
@media (prefers-reduced-motion: no-preference) {
  .mm-row.fresh .mm-fb i { animation: mm-pop 220ms var(--ease-out) both; animation-delay: calc(var(--i) * 70ms + 80ms); }
  .mm-row.win .peg { animation: mm-hop 520ms var(--ease-out) both; animation-delay: calc(var(--i) * 70ms + 120ms); }
  .peg.rev { animation: mm-pop 320ms var(--ease-out) both; animation-delay: calc(var(--i) * 80ms); }
}
@keyframes mm-pop { from { transform: scale(.4); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes mm-hop { 0%, 100% { transform: none; } 40% { transform: translateY(-8px); } }
</style>
