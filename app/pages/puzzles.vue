<script setup lang="ts">
import { DEFAULT_LEVEL, KINDS, PUZZLE_GAMES, gameKey, gameMeta, isDay, isSeed, randomDay, randomSeed, shiftDay, type Kind } from '../utils/puzzles/registry'
import { confetti, pulse } from '../utils/puzzles/fx'

useHead({ title: 'Puzzles · Bastion' })
/**
 * Puzzles: a home grid of daily games (grouped by kind, with today's progress); /puzzles?g=<id>[&day=YYYY-MM-DD] opens
 * one, /puzzles?g=<id>&r=<seed> a random one (day = `r-<seed>`: no server call, no coins, no streak). The puzzle is generated here from (game id + day), the result goes to /api/puzzles/result when the game ends and
 * the server answers with the coins it paid. A finished game opens the finish popup (FinishModal). "Today" is the
 * server's day so every device agrees; an in-progress game is kept in localStorage per game + day.
 */
const { t, te } = usePuzzleI18n()
const { toast } = useToast()
const route = useRoute(), router = useRouter()
const { coins, refresh: refreshCoins } = usePuzzleCoins()

interface Game { id: string, name: string, kind: Kind, levels?: string[], today: { solved: boolean, attempts: number, score: number, level?: string } | null, streak: number, best: number }
interface Hist { day: string, solved: boolean, attempts: number, score: number, detail: { summary?: string } }
interface Reward { earned: number, bonus: number, streak: number }
const overview = ref<{ today: string, games: Game[] } | null>(null)
const hist = ref<Hist[] | null>(null)
const error = ref('')
const mounted = ref(false)

async function load() {
  try { overview.value = await refreshCoins(); error.value = ''; readStarted() } catch (e: any) { error.value = e?.data?.statusMessage || e?.message || t('puzzles.loadError') }
}
let histKey = '' // the game key `hist` was asked for (a level change that loadHist already covers is not reloaded)
async function loadHist() {
  if (!g.value) { hist.value = null; return }
  if (random.value) { hist.value = []; return } // random games keep nothing on the server
  const k = histKey = gk.value
  let h: Hist[] = []
  try { h = await $fetch('/api/puzzles/history', { query: { game: k } }) } catch { /* shown as empty */ }
  if (histKey === k) hist.value = h // an answer for a level the player already left is dropped
}

const g = computed(() => (typeof route.query.g === 'string' && gameMeta(route.query.g) ? route.query.g : ''))
const meta = computed(() => gameMeta(g.value))

// --- difficulty levels (registry `levels`): the chosen level is remembered per game; the shown puzzle, its saved board,
// result and history all use the game KEY (`queens` = medium, `queens:hard`), see utils/puzzles/registry.ts ---
const levels = computed(() => meta.value?.levels ?? [])
const level = ref(DEFAULT_LEVEL)
const lvKey = (id: string) => `puzzles:level:${id}`
function readLevel() {
  let v: string | null = null
  try { v = localStorage.getItem(lvKey(g.value)) } catch { /* blocked */ }
  level.value = v && levels.value.includes(v) ? v : levels.value.includes(DEFAULT_LEVEL) ? DEFAULT_LEVEL : levels.value[0] ?? DEFAULT_LEVEL
}
const gk = computed(() => gameKey(g.value, levels.value.length ? level.value : undefined))
const levelName = (l?: string) => (l ? t(`puzzles.levels.${l}`) : '')
function setLevel(l: string) {
  if (l === level.value) return
  level.value = l
  try { localStorage.setItem(lvKey(g.value), l) } catch { /* blocked */ }
}
const today = computed(() => overview.value?.today ?? '')
const seed = computed(() => (isSeed(route.query.r) ? route.query.r : ''))
const random = computed(() => !!g.value && !!seed.value)
const day = computed(() => (random.value ? randomDay(seed.value) : isDay(route.query.day) && route.query.day <= today.value ? route.query.day : today.value))
const info = computed(() => overview.value?.games.find(x => x.id === g.value))
/** the card line: the older games keep it in i18n, the newer ones in the registry */
const hintOf = (id: string) => (te(`puzzles.games.${id}.hint`) ? t(`puzzles.games.${id}.hint`) : gameMeta(id)?.hint ?? '')

// --- the coins chip (header, overview + game): counts to the new balance ---
const chip = ref<HTMLElement | null>(null)
const chipCoins = ref(0)
let chipReady = false, chipRaf = 0
function chipTo(n: number) {
  cancelAnimationFrame(chipRaf)
  const from = chipCoins.value
  if (from === n) return
  if (!chipReady || matchMedia('(prefers-reduced-motion: reduce)').matches) { chipCoins.value = n; return }
  const t0 = performance.now()
  const tick = (now: number) => {
    const k = Math.min(1, (now - t0) / 600)
    chipCoins.value = Math.round(from + (n - from) * (1 - (1 - k) ** 3))
    if (k < 1) chipRaf = requestAnimationFrame(tick)
  }
  chipRaf = requestAnimationFrame(tick)
  if (chip.value) pulse(chip.value)
}
watch(coins, chipTo)
onBeforeUnmount(() => cancelAnimationFrame(chipRaf))

// --- the home grid ---
const total = computed(() => overview.value?.games.length ?? PUZZLE_GAMES.length)
const games = computed(() => overview.value?.games ?? [])
const doneToday = computed(() => games.value.filter(x => x.today).length)
const bestOverall = computed(() => Math.max(0, ...games.value.map(x => x.best)))
const sections = computed(() => KINDS.map((k) => {
  const list = games.value.filter(x => x.kind === k)
  return { kind: k, list, done: list.filter(x => x.today).length }
}).filter(s => s.list.length))
// games with a started, unfinished board for today (localStorage: read on the client, refreshed when the grid is shown)
const started = ref<Set<string>>(new Set())
function readStarted() {
  const d = overview.value?.today
  started.value = new Set(d ? PUZZLE_GAMES.filter(x => (x.levels?.length ? x.levels : [DEFAULT_LEVEL]).some(l => startedPuzzleState(gameKey(x.id, x.levels?.length ? l : undefined), d))).map(x => x.id) : [])
}
const live = (x: Game) => !x.today && started.value.has(x.id)
const state = (x: Game) => (!x.today ? '' : x.today.solved ? 'ok' : 'bad')
function pill(x: Game) {
  if (!x.today) return live(x) ? { text: t('puzzles.pill.progress'), cls: 'accent' } : { text: t('puzzles.pill.none'), cls: '' }
  if (!x.today.solved) return { text: t('puzzles.pill.failed'), cls: 'bad' }
  if (x.today.level) return { text: t('puzzles.pill.solvedLevel', { level: levelName(x.today.level) }), cls: 'ok' }
  return { text: t('puzzles.pill.solved'), cls: 'ok' }
}

// --- one game ---
const comps: Record<string, any> = {
  'wordle': resolveComponent('PuzzlesWordle'), 'anagram': resolveComponent('PuzzlesAnagram'), 'hangman': resolveComponent('PuzzlesHangman'),
  'word-ladder': resolveComponent('PuzzlesWordLadder'), 'connections': resolveComponent('PuzzlesConnections'), 'spelling-bee': resolveComponent('PuzzlesSpellingBee'),
  'quordle': resolveComponent('PuzzlesQuordle'), 'crossword-mini': resolveComponent('PuzzlesCrosswordMini'), 'crossword': resolveComponent('PuzzlesCrossword'),
  'word-trail': resolveComponent('PuzzlesWordTrail'),
  'word-search': resolveComponent('PuzzlesWordSearch'),
  'sudoku-mini': resolveComponent('PuzzlesSudokuMini'), 'sudoku': resolveComponent('PuzzlesSudoku'), 'minesweeper': resolveComponent('PuzzlesMinesweeper'),
  'nonogram': resolveComponent('PuzzlesNonogram'), 'lights-out': resolveComponent('PuzzlesLightsOut'), 'mastermind': resolveComponent('PuzzlesMastermind'),
  'higher-lower': resolveComponent('PuzzlesHigherLower'), 'math-24': resolveComponent('PuzzlesMath24'), 'sliding-3x3': resolveComponent('PuzzlesSliding'),
  'takuzu': resolveComponent('PuzzlesTakuzu'), 'memory-match': resolveComponent('PuzzlesMemoryMatch'),
  'bridges': resolveComponent('PuzzlesBridges'), 'queens': resolveComponent('PuzzlesQueens'),
  'country-wordle': resolveComponent('PuzzlesCountryWordle'),
  'flaggle': resolveComponent('PuzzlesFlaggle'), 'capital-quiz': resolveComponent('PuzzlesCapitalQuiz'), 'outline-guess': resolveComponent('PuzzlesOutlineGuess'),
  'shape-guess': resolveComponent('PuzzlesShapeGuess'),
  'quiz-knowledge': resolveComponent('PuzzlesQuizKnowledge'), 'quiz-science': resolveComponent('PuzzlesQuizScience'),
  'quiz-history': resolveComponent('PuzzlesQuizHistory'), 'quiz-travel': resolveComponent('PuzzlesQuizTravel'),
}
const res = ref<PuzzleResult | null>(null)
const playable = ref(true)
const replay = ref(false) // "Play again" was pressed: the saved result is old news until the new round ends
const nonce = ref(0) // remounts the game
let startedAt = 0
// when the current board was (re)mounted: a sync watcher fires before the render, so a game that is restored from a
// saved finish (it emits on mount) is told apart from one that was just played, also on level / day switches
let mountedAt = Date.now()
watch([gk, day, nonce, playable], () => { mountedAt = Date.now() }, { flush: 'sync' })
const serverRes = computed(() => hist.value?.find(r => r.day === day.value) ?? null)
const solved = computed(() => res.value?.solved ?? serverRes.value?.solved ?? false)
const summary = computed(() => res.value?.summary ?? serverRes.value?.detail?.summary ?? '')
const finished = computed(() => !!res.value || (!!serverRes.value && !replay.value))

// the finish popup: opens by itself ~600 ms after a game ends for the first time (so the board's own finish animation
// is seen), or at once when the day was played elsewhere; the header's Result button reopens it
const popup = ref(false)
const reward = ref<(Reward & { key: string }) | null>(null) // what this session earned for (game, day)
const shownReward = computed(() => (reward.value && reward.value.key === `${gk.value}:${day.value}` ? reward.value : null))
let popTimer: ReturnType<typeof setTimeout> | undefined
function cancelPop() { clearTimeout(popTimer); popup.value = false }
function openPopup(party = false) {
  popup.value = true
  if (party && solved.value) confetti()
}

/** played on another device and nothing local to resume: show the saved result instead of a fresh board */
function prepare() {
  cancelPop()
  res.value = null
  replay.value = false
  startedAt = Date.now()
  playable.value = !serverRes.value || hasPuzzleState(gk.value, day.value)
  if (!playable.value) openPopup()
}
watch(g, async () => { hist.value = null; cancelPop(); readLevel(); await loadHist(); prepare(); readHow(); if (!g.value) readStarted() })
watch(level, async () => { if (!g.value || histKey === gk.value) return; hist.value = null; cancelPop(); await loadHist(); prepare() })
watch(day, () => { if (hist.value) prepare() })
watch(random, async (r) => {
  if (!g.value) return
  hist.value = r ? [] : null // leaving random mode re-reads the real history (the day watcher's prepare() runs on it below)
  if (!r) { await loadHist(); prepare() }
})

async function onFinish(r: PuzzleResult) {
  res.value = r
  const fresh = Date.now() - mountedAt > 800 // a game that was already finished emits on mount: no popup for that
  if (random.value) { // random: nothing is sent, nothing is paid; only a local tally
    if (fresh) { countRandom(g.value, r.solved); await new Promise(ok => setTimeout(ok, 600)); openPopup(true) }
    return
  }
  const old = serverRes.value
  const same = !!old && old.solved === r.solved && old.attempts === r.attempts && old.score === r.score
  let earned: Reward | null = null
  if (fresh || !same) {
    const wait = fresh ? new Promise(ok => setTimeout(ok, 600)) : Promise.resolve()
    try {
      const out: any = await $fetch('/api/puzzles/result', { method: 'POST', body: { game: gk.value, day: day.value, solved: r.solved, attempts: r.attempts, score: r.score, detail: { ...r.detail, ...(r.summary ? { summary: r.summary } : {}) }, ...(fresh ? {} : { restore: true }) } })
      if (out?.earned > 0) earned = { earned: out.earned, bonus: out.bonus ?? 0, streak: out.streak ?? 0 }
      if (earned) reward.value = { ...earned, key: `${gk.value}:${day.value}` }
      await wait
      if (fresh || earned) openPopup(true)
      if (typeof out?.coins === 'number') coins.value = out.coins
      await Promise.all([load(), loadHist()])
    } catch (e: any) {
      toast(`${t('puzzles.result.saveFailed')}: ${e?.data?.statusMessage || e?.message || ''}`, { tone: 'bad' })
      await wait
      if (fresh) openPopup(true)
    }
  }
}

function playAgain() {
  resetPuzzleState(gk.value, day.value)
  cancelPop()
  res.value = null
  replay.value = true
  playable.value = true
  startedAt = Date.now()
  nonce.value++
  scrollTo(0, 0)
}

function go(q: Record<string, string | undefined>) { cancelPop(); router.push({ path: '/puzzles', query: q }); scrollTo(0, 0) }
const goDay = (d: string) => go({ g: g.value, day: d === today.value ? undefined : d })
const goRandom = (id = g.value) => go({ g: id, r: randomSeed() })
const randomGame = () => goRandom(PUZZLE_GAMES[Math.floor(Math.random() * PUZZLE_GAMES.length)]!.id)

// --- random mode bookkeeping (localStorage only): the seeds played lately (older ones are pruned along with their saved
// boards: keys `puzzles:<game key>:r-<seed>[:started]`) and per game how many random puzzles were played / solved ---
const SEEDS = 'puzzles:rand:seeds', TALLY = 'puzzles:rand:stats', KEEP_SEEDS = 20
const tally = ref<Record<string, { p: number, s: number }>>({})
function readTally() { try { tally.value = JSON.parse(localStorage.getItem(TALLY) || '{}') || {} } catch { tally.value = {} } }
function countRandom(id: string, solvedIt: boolean) {
  const c = tally.value[id] ?? { p: 0, s: 0 }
  tally.value = { ...tally.value, [id]: { p: c.p + 1, s: c.s + (solvedIt ? 1 : 0) } }
  try { localStorage.setItem(TALLY, JSON.stringify(tally.value)) } catch { /* blocked */ }
}
function touchSeed(sd: string) {
  try {
    const list: string[] = (JSON.parse(localStorage.getItem(SEEDS) || '[]') as string[]).filter(x => x !== sd)
    list.push(sd)
    for (const old of list.splice(0, Math.max(0, list.length - KEEP_SEEDS))) {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i)
        if (k && k.startsWith('puzzles:') && (k.endsWith(`:r-${old}`) || k.endsWith(`:r-${old}:started`))) localStorage.removeItem(k)
      }
    }
    localStorage.setItem(SEEDS, JSON.stringify(list))
  } catch { /* blocked */ }
}
watch(seed, (sd) => { if (sd && import.meta.client) touchSeed(sd) })
const rnd = computed(() => tally.value[g.value] ?? { p: 0, s: 0 })

// the header's day picker
const dayShort = computed(() => (day.value ? fmtDate(`${day.value}T12:00:00`, { day: 'numeric', month: 'short' }) : ''))
const dayFull = computed(() => (day.value ? fmtDate(`${day.value}T12:00:00`, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : ''))
const daySub = computed(() => (day.value === today.value ? t('puzzles.day.today') : fmtDate(`${day.value}T12:00:00`, { weekday: 'short' })))

// the next game that has no result today (after this one in the list, wrapping round)
const nextGame = computed(() => {
  const gs = games.value
  const k = gs.findIndex(x => x.id === g.value)
  for (let n = 1; n < gs.length; n++) { const x = gs[(k + n) % gs.length]!; if (!x.today) return x }
  return null
})

// a few more games for the side column (PC): the unplayed ones after this one first
const more = computed(() => {
  const gs = games.value, k = gs.findIndex(x => x.id === g.value)
  const rest = gs.map((_, n) => gs[(k + 1 + n) % gs.length]!).filter(x => x.id !== g.value)
  return [...rest.filter(x => !x.today), ...rest.filter(x => x.today)].slice(0, 5)
})

// --- stats: played / win rate from the last 30 results the server keeps, streaks from the overview ---
const statsOpen = ref(false) // phones: the stats panel under the game is folded; on PC it is always open (CSS)
const stats = computed(() => {
  const h = hist.value ?? []
  const wins = h.filter(r => r.solved).length
  return [
    { k: 'played', v: String(h.length) },
    { k: 'winRate', v: h.length ? `${Math.round((wins / h.length) * 100)}%` : '–' },
    { k: 'streak', v: String(info.value?.streak ?? 0) },
    { k: 'best', v: String(info.value?.best ?? 0) },
  ]
})
const dots = computed(() => Array.from({ length: 30 }, (_, k) => {
  const d = shiftDay(today.value, k - 29)
  const r = hist.value?.find(x => x.day === d)
  return { d, cls: r ? (r.solved ? 'ok' : 'bad') : '', here: d === day.value }
}))
const dotsSolved = computed(() => dots.value.filter(x => x.cls === 'ok').length)

// "How to play": one collapsible for every game that has text (`puzzles.how.<id>`). Open the first time a game is seen on PC,
// folded on phones; what the player toggles is remembered per game.
const howOpen = ref(false)
const hasHow = computed(() => !!g.value && te(`puzzles.how.${g.value}`))
function readHow() {
  if (!g.value) return
  const k = `puzzles:how:${g.value}`
  try {
    const v = localStorage.getItem(k)
    howOpen.value = v === null ? matchMedia('(min-width: 1140px)').matches : v === 'o' // first visit: open beside the board on PC, folded on phones
    if (v === null) localStorage.setItem(k, howOpen.value ? 'o' : '1')
  } catch { howOpen.value = false }
}
function onHow(e: Event) {
  howOpen.value = (e.target as HTMLDetailsElement).open
  try { localStorage.setItem(`puzzles:how:${g.value}`, howOpen.value ? 'o' : '1') } catch { /* blocked */ }
}

onMounted(async () => {
  mounted.value = true
  readTally()
  if (seed.value) touchSeed(seed.value)
  chipCoins.value = coins.value
  await load()
  chipReady = true
  chipCoins.value = coins.value
  if (g.value) { readLevel(); await loadHist(); prepare(); readHow() }
})
</script>

<template>
  <div class="pz">
    <p v-if="error" class="errbox">{{ error }} <button class="lnk" @click="load">{{ t('puzzles.retry') }}</button></p>

    <!-- the home grid -->
    <template v-if="!g">
      <Skeleton v-if="!overview" kind="cards" :n="6" />
      <template v-else>
        <section class="pz-prog" aria-live="polite">
          <div class="pz-ptop">
            <b>{{ t('puzzles.progress', { n: doneToday, total }) }}</b>
            <span ref="chip" class="pz-coins" role="status" :aria-label="t('puzzles.coins.label', { n: coins })"><Icon name="hand-coins" :size="16" /><b class="num">{{ chipCoins }}</b></span>
          </div>
          <div class="pz-strip" :style="{ '--n': total }" role="img" :aria-label="t('puzzles.progress', { n: doneToday, total })">
            <i v-for="x in games" :key="x.id" :class="state(x)" />
          </div>
          <div class="pz-pact">
            <button class="btn sm pz-rg" @click="randomGame"><Icon name="refresh-cw" :size="15" />{{ t('puzzles.random.game') }}</button>
            <span v-if="bestOverall" class="pill accent"><Icon name="flame" :size="12" />{{ t('puzzles.bestStreak', { n: bestOverall }) }}</span>
          </div>
        </section>
        <section v-for="s in sections" :key="s.kind" class="pz-sect">
          <h2 class="sec pz-sh">{{ t(`puzzles.kinds.${s.kind}`) }}<span class="faint small">{{ t('puzzles.sectionDone', { n: s.done, total: s.list.length }) }}</span></h2>
          <div class="pz-cards">
            <NuxtLink v-for="x in s.list" :key="x.id" :to="{ path: '/puzzles', query: { g: x.id } }" class="pz-card">
              <span class="pz-ic" :class="state(x)"><Icon :name="gameMeta(x.id)!.icon" :size="20" /></span>
              <span class="pz-ct">
                <b>{{ x.name }}</b>
                <span class="muted small">{{ hintOf(x.id) }}</span>
              </span>
              <span class="pz-pills">
                <span class="pill" :class="pill(x).cls">{{ pill(x).text }}</span>
                <span v-if="x.streak" class="pill accent"><Icon name="flame" :size="12" />{{ t('puzzles.pill.streak', { n: x.streak }) }}</span>
              </span>
            </NuxtLink>
          </div>
        </section>
      </template>
    </template>

    <!-- one game -->
    <div v-else class="pz-game" :class="{ fit: meta!.fit }" :style="{ '--pz-max': `${meta!.max ?? 560}px` }">
      <header class="pz-head">
        <NuxtLink to="/puzzles" class="pz-ib back" :aria-label="t('puzzles.all')"><Icon name="arrow-left" :size="18" /><span class="pz-bl">{{ t('puzzles.all') }}</span></NuxtLink>
        <div class="pz-hname"><Icon :name="meta!.icon" :size="16" /><b>{{ meta!.name }}</b></div>
        <button v-if="random" class="pz-date now rnd" :aria-label="`${t('puzzles.random.label')}. ${t('puzzles.random.back')}`" @click="go({ g })">
          <b>{{ t('puzzles.random.label') }}</b><small>{{ t('puzzles.random.back') }}</small>
        </button>
        <div v-else-if="overview" class="pz-day" role="group" :aria-label="t('puzzles.day.label')">
          <button class="pz-ib" :aria-label="t('puzzles.day.prev')" @click="goDay(shiftDay(day, -1))"><Icon name="chevron-left" :size="18" /></button>
          <button class="pz-date" :class="{ now: day === today }" :aria-label="day === today ? dayFull : `${dayFull}. ${t('puzzles.day.goToday')}`" @click="day !== today && goDay(today)">
            <b class="num">{{ dayShort }}</b><small>{{ daySub }}</small>
          </button>
          <button class="pz-ib" :disabled="day >= today" :aria-label="t('puzzles.day.next')" @click="goDay(shiftDay(day, 1))"><Icon name="chevron-right" :size="18" /></button>
        </div>
        <button v-if="finished && !popup" class="pz-ib" :aria-label="t('puzzles.result.title')" @click="openPopup()"><Icon :name="solved ? 'trophy' : 'circle-x'" :size="18" /></button>
        <button class="pz-ib rndbtn" :aria-label="random ? t('puzzles.random.another') : t('puzzles.random.play')" @click="goRandom()"><Icon name="refresh-cw" :size="18" /><span class="pz-bl">{{ random ? t('puzzles.random.another') : t('puzzles.random.label') }}</span></button>
        <span ref="chip" class="pz-coins" role="status" :aria-label="t('puzzles.coins.label', { n: coins })"><Icon name="hand-coins" :size="16" /><b class="num">{{ chipCoins }}</b></span>
      </header>

      <Skeleton v-if="!mounted || !overview || !hist" kind="cards" :n="2" />
      <div v-else class="pz-gm">
        <details v-if="hasHow" :key="g" class="pz-how" :open="howOpen" @toggle="onHow">
          <summary><span class="pz-hn"><Icon :name="meta!.icon" :size="16" /><b>{{ meta!.name }}</b></span><span class="pz-hl">{{ t('puzzles.how.title') }}</span></summary>
          <p>{{ t(`puzzles.how.${g}`) }}</p>
        </details>

        <div class="pz-main">
          <div v-if="levels.length" class="pz-lv" role="group" :aria-label="t('puzzles.levels.label')">
            <div class="seg">
              <button v-for="l in levels" :key="l" type="button" :class="{ on: level === l }" :aria-pressed="level === l" @click="setLevel(l)">{{ levelName(l) }}</button>
            </div>
          </div>
          <component :is="comps[g]" v-if="playable" :key="`${gk}:${day}:${nonce}`" :day="day" :level="levels.length ? level : undefined" @finish="onFinish" />
          <p v-else class="muted pz-played">{{ t('puzzles.result.played') }}</p>
        </div>

        <aside class="pz-side">
          <section class="pz-stats" :aria-label="t('puzzles.stats.title')">
            <button class="pz-sh2" :aria-expanded="statsOpen" @click="statsOpen = !statsOpen"><b>{{ random ? t('puzzles.random.stats') : t('puzzles.stats.title') }}</b><Icon name="chevron-down" :size="16" /></button>
            <div class="pz-sbody" :class="{ shut: !statsOpen }">
              <template v-if="random">
                <div class="pz-sg two">
                  <div class="pz-stat"><b class="num">{{ rnd.p }}</b><span>{{ t('puzzles.stats.played') }}</span></div>
                  <div class="pz-stat"><b class="num">{{ rnd.s }}</b><span>{{ t('puzzles.stats.solved') }}</span></div>
                </div>
                <p class="pz-legend small faint">{{ t('puzzles.random.noCoins') }}</p>
              </template>
              <template v-else>
                <div class="pz-sg">
                  <div v-for="x in stats" :key="x.k" class="pz-stat"><b class="num">{{ x.v }}</b><span>{{ t(`puzzles.stats.${x.k}`) }}</span></div>
                </div>
                <div class="pz-dots" role="img" :aria-label="t('puzzles.stats.dots', { n: dotsSolved })">
                  <i v-for="x in dots" :key="x.d" :class="[x.cls, { here: x.here }]" />
                </div>
                <p class="pz-legend small faint">
                  <span><i class="dot ok" />{{ t('puzzles.stats.solved') }}</span><span><i class="dot bad" />{{ t('puzzles.stats.failed') }}</span><span><i class="dot" />{{ t('puzzles.stats.none') }}</span>
                </p>
                <p v-if="rnd.p" class="pz-legend small faint">{{ t('puzzles.random.tally', { p: rnd.p, s: rnd.s }) }}</p>
              </template>
            </div>
          </section>
          <section v-if="more.length" class="pz-more" :aria-label="t('puzzles.random.more')">
            <h3 class="pz-sh2 static"><b>{{ t('puzzles.random.more') }}</b></h3>
            <NuxtLink v-for="x in more" :key="x.id" :to="{ path: '/puzzles', query: { g: x.id } }" class="pz-mrow">
              <span class="pz-mic" :class="state(x)"><Icon :name="gameMeta(x.id)!.icon" :size="16" /></span>
              <span class="pz-mn">{{ x.name }}</span>
              <span class="pill" :class="pill(x).cls">{{ pill(x).text }}</span>
            </NuxtLink>
          </section>
        </aside>
      </div>

      <PuzzlesFinishModal
        v-if="mounted && overview && hist"
        :open="popup" :solved="solved" :name="levels.length ? `${meta!.name} - ${levelName(level)}` : meta!.name" :date="random ? t('puzzles.random.label') : dayFull" :summary="summary"
        :earned="shownReward?.earned" :bonus="shownReward?.bonus" :streak="shownReward?.streak" :coins="coins" :has-next="!!nextGame" :random="random"
        @close="popup = false" @next="nextGame && go({ g: nextGame.id })" @all="go({})" @replay="playAgain" @random="popup = false; goRandom()" @today="go({ g })"
      />
    </div>
  </div>
</template>

<style>
/* shared by every game component (classes are pz-*, so nothing leaks into the rest of the app) */
.pz {
  /* region / category palette for the games (Queens regions, Connections groups, Mastermind pegs, Memory pairs ...): 12 hues
     spread so neighbours differ, one lightness + chroma so none is muddy. `--pz-cN` is the solid colour (ink on it: `--pz-ink`),
     `--pz-cN-soft` the same hue mixed into the skin's own panel (a calm fill that keeps `--text` readable in dark AND light skins) */
  --pz-c1: oklch(.76 .15 25); --pz-c1-soft: color-mix(in oklab, var(--pz-c1) 62%, var(--panel));
  --pz-c2: oklch(.76 .15 255); --pz-c2-soft: color-mix(in oklab, var(--pz-c2) 62%, var(--panel));
  --pz-c3: oklch(.76 .15 150); --pz-c3-soft: color-mix(in oklab, var(--pz-c3) 62%, var(--panel));
  --pz-c4: oklch(.76 .15 320); --pz-c4-soft: color-mix(in oklab, var(--pz-c4) 62%, var(--panel));
  --pz-c5: oklch(.76 .15 55); --pz-c5-soft: color-mix(in oklab, var(--pz-c5) 62%, var(--panel));
  --pz-c6: oklch(.76 .15 200); --pz-c6-soft: color-mix(in oklab, var(--pz-c6) 62%, var(--panel));
  --pz-c7: oklch(.76 .15 355); --pz-c7-soft: color-mix(in oklab, var(--pz-c7) 62%, var(--panel));
  --pz-c8: oklch(.76 .15 285); --pz-c8-soft: color-mix(in oklab, var(--pz-c8) 62%, var(--panel));
  --pz-c9: oklch(.76 .15 125); --pz-c9-soft: color-mix(in oklab, var(--pz-c9) 62%, var(--panel));
  --pz-c10: oklch(.76 .15 95); --pz-c10-soft: color-mix(in oklab, var(--pz-c10) 62%, var(--panel));
  --pz-c11: oklch(.76 .15 175); --pz-c11-soft: color-mix(in oklab, var(--pz-c11) 62%, var(--panel));
  --pz-c12: oklch(.76 .15 75); --pz-c12-soft: color-mix(in oklab, var(--pz-c12) 62%, var(--panel));
  --pz-ink: oklch(.22 .03 265);
  max-width: 980px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px;
}
.pz:has(.pz-cards) { gap: 4px; }

/* home: progress strip, then one section per kind */
.pz-prog { display: flex; flex-direction: column; gap: 12px; padding: 14px 16px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); margin-bottom: 6px; }
.pz-ptop { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.pz-ptop b { font-size: 15px; font-weight: 600; }
.pz-strip { display: grid; grid-template-columns: repeat(var(--n, 30), minmax(0, 1fr)); gap: 3px; }
.pz-strip i { height: 8px; border-radius: 3px; background: var(--track); }
.pz-strip i.ok { background: var(--ok); }
.pz-strip i.bad { background: var(--bad); }
.pz-pact { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.pz-rg { min-height: 36px; padding: 0 14px; }
@media (max-width: 640px) { .pz-rg { flex: 1; justify-content: center; min-height: 40px; } }
.pz-coins { display: inline-flex; align-items: center; gap: 5px; height: 32px; padding: 0 10px; border: 1px solid var(--line); border-radius: 16px; background: var(--panel-2); color: var(--warn); flex: none; }
.pz-coins b { min-width: 2ch; font-size: 14px; font-weight: 700; color: var(--text); text-align: right; }
.pz-head .pz-coins { margin-left: auto; }
.pz-sh { margin: 18px 0 8px; }
.pz-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); grid-auto-rows: 1fr; gap: 10px; }
.pz-card {
  display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 12px 14px; min-height: 72px;
  border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); color: inherit; text-decoration: none;
  transition: border-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
}
@media (hover: hover) { .pz-card:hover { border-color: var(--line-2); text-decoration: none; } }
.pz-card:active { transform: scale(.985); }
.pz-card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.pz-ct { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.pz-ct b { font-size: 14.5px; font-weight: 600; }
.pz-ct .small { display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height: 1.35; }
.pz-pills { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.pz-ic { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 10px; background: var(--panel-2); color: var(--muted); flex: none; }
.pz-ic.ok { background: var(--ok-soft); color: var(--ok); }
.pz-ic.bad { background: var(--bad-soft); color: var(--bad); }

/* one game: sticky slim header, stats, play card (the finish popup is FinishModal.vue) */
.pz-head { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; gap: 6px; padding: 6px 0; background: var(--bg); border-bottom: 1px solid var(--line); }
.pz-ib { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-width: 40px; height: 40px; padding: 0; border: 1px solid transparent; border-radius: var(--radius-sm); background: none; color: var(--muted); font: inherit; font-size: 13px; text-decoration: none; cursor: pointer; flex: none; transition: background-color var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
@media (hover: hover) { .pz-ib:hover:not(:disabled) { background: var(--panel-2); color: var(--text); text-decoration: none; } }
.pz-ib:active:not(:disabled) { transform: scale(.94); }
.pz-ib:disabled { opacity: .35; cursor: default; }
.pz-ib:focus-visible, .pz-date:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.pz-ib.on { background: var(--accent-soft); color: var(--accent); }
.pz-bl { display: none; }
.pz-hname { display: none; align-items: center; gap: 8px; min-width: 0; flex: 1; color: var(--text); }
.pz-hname b { font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pz-day { display: flex; align-items: center; margin: 0 auto; }
.pz-date { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 76px; height: 40px; padding: 0 6px; border: 0; border-radius: var(--radius-sm); background: none; color: var(--text); font: inherit; line-height: 1.15; cursor: pointer; }
.pz-date.now { cursor: default; }
.pz-date b { font-size: 14px; font-weight: 600; }
.pz-date small { font-size: 11px; color: var(--faint); }
.pz-date.now small { color: var(--accent); }
@media (max-width: 420px) {
  .pz-head { gap: 2px; }
  .pz-head .pz-ib { min-width: 38px; }
  .pz-head .pz-coins { padding: 0 8px; margin-left: 2px; }
  .pz-date { min-width: 64px; }
}
@media (min-width: 521px) {
  .pz-bl { display: inline; }
  .pz-ib.back, .pz-ib.rndbtn { padding: 0 10px 0 8px; }
  .pz-hname { display: flex; }
  .pz-day { margin: 0; }
}
.pz-date.rnd { cursor: pointer; margin: 0 auto; }
@media (min-width: 521px) { .pz-date.rnd { margin: 0; } }

/* the game view: header, then How to play / the play column (level seg + the game) / the side panels. One column on phones
   (how, play, side); from 1140px two: play column (--pz-w wide) left, how + stats + more games in 300px on the right */
.pz-game { --pz-fit: 100000px; --pz-w: min(var(--pz-max, 560px), var(--pz-fit)); width: 100%; max-width: var(--pz-w); margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }
@media (min-width: 641px) { .pz-game.fit { --pz-fit: max(300px, calc(100dvh - var(--pz-chrome, 330px) - var(--tabbar, 0px))); } } /* a fit board never needs page scroll on PC */
.pz-gm { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.pz-main { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.pz-side { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
@media (min-width: 1140px) {
  .pz-game { max-width: calc(var(--pz-w) + 332px); }
  .pz-gm { display: grid; grid-template-columns: minmax(0, var(--pz-w)) 300px; grid-template-rows: auto 1fr; grid-template-areas: "main how" "main side"; column-gap: 32px; row-gap: 12px; align-items: start; }
  .pz-main { grid-area: main; }
  .pz-how { grid-area: how; }
  .pz-side { grid-area: side; }
  .pz-hn { display: none !important; }
}
.pz-lv { display: flex; }
.pz-lv .seg { width: 100%; }
.pz-lv .seg > button { flex: 1; min-width: 0; min-height: 40px; padding: 0 10px; font-size: 13.5px; }
.pz-played { margin: 0; text-align: center; padding: 28px 0; border: 1px dashed var(--line-2); border-radius: var(--radius); }

.pz-how { border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); font-size: 13px; color: var(--muted); }
.pz-how summary { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 0 14px; cursor: pointer; font-weight: 600; color: var(--text); list-style: none; }
.pz-how summary::-webkit-details-marker { display: none; }
.pz-hn { display: inline-flex; align-items: center; gap: 8px; min-width: 0; }
.pz-hl { margin-left: auto; font-weight: 500; color: var(--muted); }
@media (min-width: 1140px) { .pz-hl { margin-left: 0; font-weight: 600; color: var(--text); } .pz-how summary::after { margin-left: auto; } }
.pz-how summary::after { content: ''; width: 7px; height: 7px; margin-left: 4px; border-right: 1.75px solid var(--faint); border-bottom: 1.75px solid var(--faint); transform: rotate(45deg) translateY(-2px); transition: transform var(--dur) var(--ease-out); flex: none; }
.pz-how[open] summary::after { transform: rotate(-135deg); }
.pz-how p { margin: 0; padding: 0 14px 14px; line-height: 1.5; }

.pz-stats, .pz-more { border: 1px solid var(--line); border-radius: var(--radius); background: var(--panel); padding: 0 14px; min-width: 0; }
.pz-sh2 { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 44px; margin: 0; padding: 0; border: 0; background: none; color: var(--text); font: inherit; cursor: pointer; }
.pz-sh2 b { font-size: 13px; font-weight: 600; }
.pz-sh2 svg { color: var(--faint); transition: transform var(--dur) var(--ease-out); }
.pz-sh2[aria-expanded="true"] svg { transform: rotate(180deg); }
.pz-sh2.static { cursor: default; }
.pz-sh2:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.pz-sbody { display: flex; flex-direction: column; gap: 14px; padding: 2px 0 14px; }
.pz-sbody.shut { display: none; }
@media (min-width: 1140px) { .pz-sbody.shut { display: flex; } .pz-sh2:not(.static) { pointer-events: none; } .pz-sh2:not(.static) svg { display: none; } }
@media (max-width: 1139px) { .pz-more { display: none; } }
.pz-more { padding-bottom: 8px; }
.pz-mrow { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; align-items: center; gap: 10px; min-height: 40px; margin: 0 -8px; padding: 0 8px; border-radius: var(--radius-sm); color: var(--text); font-size: 13.5px; text-decoration: none; transition: background-color var(--dur-fast) var(--ease-out); }
@media (hover: hover) { .pz-mrow:hover { background: var(--panel-2); text-decoration: none; } }
.pz-mrow:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
.pz-mn { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pz-mic { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; background: var(--panel-2); color: var(--muted); }
.pz-mic.ok { background: var(--ok-soft); color: var(--ok); }
.pz-mic.bad { background: var(--bad-soft); color: var(--bad); }

.pz-sg { display: grid; grid-template-columns: repeat(4, auto); justify-content: space-between; gap: 8px; }
.pz-sg.two { grid-template-columns: repeat(2, max-content); justify-content: start; column-gap: 36px; }
.pz-stat b { display: block; font-size: 20px; font-weight: 700; line-height: 1.2; }
.pz-stat span { font-size: 11.5px; color: var(--muted); white-space: nowrap; }
.pz-dots { display: grid; grid-template-columns: repeat(15, minmax(0, 1fr)); gap: 5px; }
.pz-dots i { aspect-ratio: 1; max-width: 22px; justify-self: center; width: 100%; border-radius: 50%; border: 1.5px solid var(--line-2); box-sizing: border-box; }
.pz-dots i.ok { background: var(--ok); border-color: var(--ok); }
.pz-dots i.bad { background: var(--bad); border-color: var(--bad); }
.pz-dots i.here { outline: 2px solid var(--accent); outline-offset: 2px; }
.pz-legend { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 14px; margin: 0; }
.pz-legend span { display: inline-flex; align-items: center; gap: 6px; }
.pz-legend .dot { box-shadow: none; }

/* the shared game frame (<PuzzlesStage> / <PuzzlesTool>): stats bar, board, message line, tools; all as wide as the play column */
.pzs { display: flex; flex-direction: column; gap: 10px; width: 100%; min-width: 0; }
.pzs-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; height: 48px; }
.pzs-stats { display: flex; align-items: center; gap: 22px; min-width: 0; }
.pzs-stat { display: flex; flex-direction: column; gap: 1px; min-width: 3.4ch; }
.pzs-lbl { font-size: 11.5px; line-height: 1.2; color: var(--muted); }
.pzs-val { font-size: 20px; line-height: 1.2; font-weight: 700; font-variant-numeric: tabular-nums; }
.pzs-stat.ok .pzs-val { color: var(--ok); }
.pzs-stat.warn .pzs-val { color: var(--warn); }
.pzs-stat.bad .pzs-val { color: var(--bad); }
.pzs-act { display: flex; align-items: center; gap: 8px; margin-left: auto; flex: none; }
.pzs-board { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; min-width: 0; }
.pzs-msg { height: 22px; margin: 0; font-size: 13px; line-height: 22px; text-align: center; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pzs-msg.ok { color: var(--ok); } .pzs-msg.warn { color: var(--warn); } .pzs-msg.bad { color: var(--bad); }
.pzs-tools { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; }
.btn.ghost.pzs-tool { min-height: 40px; padding: 0 14px; gap: 7px; border: 1px solid var(--line-2); background: var(--panel-2); color: var(--text); font-size: 13.5px; }
.btn.ghost.pzs-tool.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.btn.ghost.pzs-tool:disabled { opacity: .5; cursor: default; }
.btn.ghost.pzs-tool.ico { padding: 0; width: 40px; justify-content: center; }
@media (pointer: coarse) { .btn.ghost.pzs-tool { min-height: 44px; } .btn.ghost.pzs-tool.ico { width: 44px; } }
.pz-sq { width: 100%; aspect-ratio: 1; }

.pz-stack { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; }
.pz-stack.wide > * { max-width: 100%; }
.pz-msg { margin: 0; color: var(--muted); font-size: 13px; text-align: center; }
.pz-ask { margin: 0; font-size: 16px; font-weight: 600; text-align: center; }
.pz-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.pz-actions .btn { min-height: 38px; }
.pz-chips, .pz-hints { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin: 0; padding: 0; list-style: none; }
.pz-hints.col { flex-direction: column; align-items: center; }
.pz-big { font-size: 34px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; text-align: center; }
.pz-big.sm { font-size: 64px; letter-spacing: 0; line-height: 1.1; }
.pz-flag { font-size: 110px; line-height: 1.1; }
.pz-word { min-height: 40px; font-size: 26px; font-weight: 600; letter-spacing: .15em; text-transform: uppercase; }

/* square grids: wordle, sudoku, minesweeper, lights out, ... */
.pz-grid { --cell: 56px; --gap: 6px; display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); gap: var(--gap); width: min(100%, calc(var(--n) * var(--cell) + (var(--n) - 1) * var(--gap))); }
.pz-grid.dense { --cell: 42px; --gap: 3px; }
.pz-grid.sudoku { --gap: 2px; }
.pz-cell { aspect-ratio: 1; display: grid; place-items: center; min-width: 0; padding: 0; border: 1px solid var(--line-2); border-radius: 6px; background: var(--panel-2); color: var(--text); font: inherit; font-size: 20px; font-weight: 600; text-transform: uppercase; transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
button.pz-cell { cursor: pointer; }
button.pz-cell:active:not(:disabled) { transform: scale(.94); }
.pz-cell.sm { width: 44px; height: 44px; aspect-ratio: auto; }
.pz-cell.g { background: var(--ok-soft); border-color: var(--ok); color: var(--ok); }
.pz-cell.y { background: var(--warn-soft); border-color: var(--warn); color: var(--warn); }
.pz-cell.x { background: var(--track); border-color: var(--track); color: var(--muted); }
.pz-cell.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.pz-cell.bad { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }
.pz-cell.dim { color: var(--faint); }
.pz-cell.given { background: var(--panel); color: var(--text); font-weight: 800; }
.pz-grid.sudoku .pz-cell:not(.given) { color: var(--accent); }
.pz-grid.sudoku .pz-cell { border-radius: 3px; }
.pz-grid.sudoku .pz-cell.rr { border-right: 2px solid var(--faint); }
.pz-grid.sudoku .pz-cell.rb { border-bottom: 2px solid var(--faint); }
.pz-grid.sudoku .pz-cell.sel { outline: 2px solid var(--accent); outline-offset: -2px; }
.pz-grid.sudoku .pz-cell.bad { color: var(--bad); }
.pz-cell.tile { font-size: 24px; }
.pz-cell.blank { background: transparent; border-style: dashed; }
.pz-cell.open { background: var(--bg); border-color: var(--line); font-size: 17px; }
.pz-cell.open[data-n="1"] { color: var(--accent); }
.pz-cell.open[data-n="2"] { color: var(--ok); }
.pz-cell.open[data-n="3"] { color: var(--bad); }
.pz-cell.open[data-n="4"], .pz-cell.open[data-n="5"], .pz-cell.open[data-n="6"] { color: var(--warn); }
.pz-cell.flagged { color: var(--warn); }
.pz-cell.shown { background: var(--bad-soft); }
.pz-mine { width: 12px; height: 12px; border-radius: 50%; background: var(--bad); }

/* keyboard, digit pad */
.pz-kb { width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 6px; }
.pz-kbrow { display: flex; gap: 5px; justify-content: center; }
.pz-key { flex: 1 1 0; min-width: 0; height: 46px; padding: 0; border: 1px solid var(--line-2); border-radius: 6px; background: var(--panel-2); color: var(--text); font: inherit; font-size: 15px; font-weight: 600; text-transform: uppercase; cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
.pz-key.wide { flex: 1.6 1 0; font-size: 12px; }
.pz-key:active:not(:disabled) { transform: scale(.94); }
.pz-key:disabled { opacity: .5; cursor: default; }
.pz-key.g { background: var(--ok-soft); border-color: var(--ok); color: var(--ok); }
.pz-key.y { background: var(--warn-soft); border-color: var(--warn); color: var(--warn); }
.pz-key.x { background: var(--track); border-color: var(--track); color: var(--faint); }
.pz-pad { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; width: 100%; max-width: 420px; }
.pz-pad .pz-key { flex: 1 0 38px; max-width: 64px; }
.pz-pad .pz-key.wide { flex: 2 0 76px; max-width: none; }

/* hangman */
.pz-meter { display: flex; gap: 4px; }
.pz-meter i { width: 22px; height: 6px; border-radius: 3px; background: var(--track); }
.pz-meter i.on { background: var(--bad); }
.pz-letters { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; }
.pz-slot { width: 30px; height: 42px; display: grid; place-items: center; border-bottom: 2px solid var(--line-2); font-size: 24px; font-weight: 700; text-transform: uppercase; }

/* word ladder */
.pz-ladder { display: flex; flex-direction: column; gap: 6px; align-items: center; }
.pz-rung { display: flex; gap: 6px; }

/* connections */
.pz-group { width: 100%; padding: 10px 12px; border-radius: var(--radius-sm); display: flex; flex-direction: column; align-items: center; text-align: center; gap: 2px; font-size: 13px; }
.pz-group b { text-transform: uppercase; font-size: 12px; letter-spacing: .04em; }
.pz-group.ok { background: var(--ok-soft); color: var(--ok); }
.pz-group.warn { background: var(--warn-soft); color: var(--warn); }
.pz-group.accent { background: var(--accent-soft); color: var(--accent); }
.pz-group.bad { background: var(--bad-soft); color: var(--bad); }
.pz-group.faint-tone { background: var(--panel-2); color: var(--muted); }
.pz-words { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; width: 100%; }
.pz-tile { min-height: 56px; padding: 4px; border: 1px solid var(--line-2); border-radius: 6px; background: var(--panel-2); color: var(--text); font: inherit; font-size: 13px; font-weight: 600; text-transform: uppercase; overflow-wrap: anywhere; cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
.pz-tile:active { transform: scale(.96); }
.pz-tile.on { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }

/* spelling bee: 2-3-2 hexagons */
.pz-hive { display: grid; grid-template-columns: repeat(6, 1fr); width: 288px; max-width: 100%; row-gap: 4px; }
.pz-hex { grid-column: span 2; aspect-ratio: 1.15; clip-path: polygon(25% 3%, 75% 3%, 100% 50%, 75% 97%, 25% 97%, 0 50%); border: 0; background: var(--panel-2); color: var(--text); font: inherit; font-size: 22px; font-weight: 700; text-transform: uppercase; cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out); }
.pz-hex:active { background: var(--accent-soft); }
.pz-hex.centre { background: var(--accent); color: var(--bg); grid-column: 3 / span 2; grid-row: 2; }
.pz-hex:nth-child(1) { grid-column: 2 / span 2; grid-row: 1; }
.pz-hex:nth-child(2) { grid-column: 4 / span 2; grid-row: 1; }
.pz-hex:nth-child(3) { grid-column: 1 / span 2; grid-row: 2; }
.pz-hex:nth-child(4) { grid-column: 5 / span 2; grid-row: 2; }
.pz-hex:nth-child(5) { grid-column: 2 / span 2; grid-row: 3; }
.pz-hex:nth-child(6) { grid-column: 4 / span 2; grid-row: 3; }

/* nonogram */
.pz-nono { display: grid; grid-template-columns: auto repeat(var(--n), minmax(0, 1fr)); gap: 4px; width: min(100%, 340px); }
.pz-nono .clue { display: flex; gap: 4px; font-size: 12px; color: var(--muted); }
.pz-nono .clue.col { flex-direction: column; justify-content: flex-end; align-items: center; }
.pz-nono .clue.row { justify-content: flex-end; align-items: center; padding-right: 6px; }

/* country games */
.pz-ac { position: relative; width: 100%; }
.pz-ac input { width: 100%; box-sizing: border-box; min-height: 42px; }
.pz-aclist { display: flex; flex-direction: column; margin-top: 4px; border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--panel); overflow: hidden; }
.pz-aclist button { min-height: 40px; padding: 6px 12px; border: 0; border-bottom: 1px solid var(--line); background: transparent; color: var(--text); font: inherit; text-align: left; cursor: pointer; }
.pz-aclist button:last-child { border-bottom: 0; }
.pz-aclist button:active { background: var(--panel-2); }
.pz-cw { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.pz-cwrow { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius-sm); background: var(--panel-2); }
.pz-cwrow.win { border-color: var(--ok); }
.pz-cwrow .nm { width: 100%; font-size: 14px; }
.pz-cwrow .dir { padding: 2px 8px; }
.pz-opts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; width: 100%; }
.pz-opt { min-height: 52px; padding: 6px 10px; border: 1px solid var(--line-2); border-radius: var(--radius-sm); background: var(--panel-2); color: var(--text); font: inherit; font-size: 14px; cursor: pointer; transition: background-color var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out); }
.pz-opt:active:not(:disabled) { transform: scale(.97); }
.pz-opt:disabled { cursor: default; }
.pz-opt.g { background: var(--ok-soft); border-color: var(--ok); color: var(--ok); }
.pz-opt.bad { background: var(--bad-soft); border-color: var(--bad); color: var(--bad); }

@media (pointer: coarse) { .pz-cell.sm { width: 46px; height: 46px; } }
@media (max-width: 380px) { .pz-flag { font-size: 88px; } .pz-opts { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) {
  .pz-card, .pz-ib, .pz-cell, .pz-key, .pz-tile, .pz-hex, .pz-opt { transition: none; }
  .pz-card:active, .pz-ib:active, .pz-cell:active, .pz-key:active, .pz-tile:active, .pz-opt:active { transform: none; }
  .pz-how summary::after { transition: none; }
}

</style>
