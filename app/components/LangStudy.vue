<script setup lang="ts">
import { lvName, isKana } from '../utils/lang'
/**
 * The review screen of any deck. Kana / kanji reading cards: the character → Show answer → Again / Hard / Good / Easy (new ones
 * get a guided trace). Write cards: meaning (or a whole word) → write it on the pad from memory → the misses suggest the rating.
 * Vocabulary: word → meaning, or meaning → word (production). Grammar: three exercises of the point, the score picks the rating.
 * Armenian and Russian: letters and words read like kana cards (the letter / word → answer with transliteration); their write cards are
 * LangScriptWrite (trace pad for a letter, on-screen / hardware keyboard for a word) and the check suggests the rating.
 * Keys: space = show / the suggested rating, 1–4, z = undo
 */
const props = defineProps<{ deck: string, furigana?: 'after' | 'always' }>()
const emit = defineEmits<{ close: [], changed: [] }>()
const t = langT

const q = ref<any>(null)
const shown = ref(false)
const busy = ref(false)
const error = ref('')
const savedOffline = ref(false)
/** ids answered while offline (queued): the cached queue may offer them again, so they are not shown twice */
const queuedIds = ref(new Set<string>())
const strokes = ref(false)
const tracing = ref(false)
const reviewed = ref(0)
const result = ref<{ mistakes: number, hints: number, gaveUp?: boolean } | null>(null)
const pad = ref<any>()
const spad = ref<any>()
const sres = ref<{ ok: boolean, typed: string, cov?: number, hint: boolean, sugg: number } | null>(null)
let t0 = Date.now()
const LABELS = computed(() => [t('lang.again'), t('lang.hard'), t('lang.good'), t('lang.easy')])

const card = computed(() => q.value?.card)
const blocked = computed(() => !!card.value && queuedIds.value.has(card.value.id))
const kind = computed<string>(() => card.value?.kind ?? '')
/** Armenian / Russian letters and words (their grammar cards are the same exercises as Japanese ones) */
const sc = computed(() => isScript(card.value?.lang) && kind.value !== 'grammar')
const scWrite = computed(() => sc.value && (kind.value === 'write' || kind.value === 'prod'))
const writing = computed(() => kind.value === 'write' && !sc.value)
const inputCard = computed(() => writing.value || scWrite.value)
const scText = (c: any) => (c.t === 'l' ? c.id.replace(/^w:/, '') : c.f)
const scGroup = computed(() => (card.value?.t === 'l' ? t('lang.tabs.alpha') : t('lang.packN', { n: effLesson(card.value?.l ?? 1) })))
const vocab = computed(() => kind.value === 'read' && !!card.value?.ja || kind.value === 'prod')
const grammar = computed(() => kind.value === 'grammar')
const readings = (c: any) => [...c.kun.map((r: string) => r.replace(/[.-]/g, '')), ...c.on.map(kata)].slice(0, 4).join('、')
const word = computed<[string, string, string] | null>(() => (writing.value ? card.value.word : null))
/** grammar: the exercises asked this time (3 at random), fixed per card shown */
const asked = ref<any[]>([])
const nextUrl = () => $fetch<any>('/api/lang/next', { query: { deck: props.deck } })

function take(r: any) {
  q.value = r; shown.value = false; strokes.value = false; result.value = null; sres.value = null; t0 = Date.now(); error.value = ''
  tracing.value = false
  const ex: any[] = r?.card?.kind === 'grammar' ? [...(r.card.exercises ?? [])] : []
  for (let i = ex.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ex[i], ex[j]] = [ex[j], ex[i]] }
  asked.value = ex.slice(0, 3)
}
onMounted(async () => { try { take(await nextUrl()) } catch (e: any) { error.value = e?.data?.statusMessage || e?.message } })
async function post(body: Record<string, any>) {
  if (busy.value) return
  if (body.action === 'undo' && typeof navigator !== 'undefined' && !navigator.onLine) { error.value = t('lang.undoOffline'); return }
  busy.value = true
  try {
    const r = await $fetch<any>('/api/lang/action', { method: 'POST', body: { deck: props.deck, ...body } })
    if (r?.queued) { // offline: the worker keeps the answer and sends it later
      if (body.action === 'undo') { error.value = t('lang.undoOffline'); return }
      // the next card comes from the cached queue, so it may repeat the one just answered: those are held back
      if (body.action === 'answer' && body.k) queuedIds.value.add(body.k)
      take(await nextUrl().catch(() => q.value))
      savedOffline.value = true
    } else { take(r); savedOffline.value = false; queuedIds.value.clear() }
    emit('changed'); return true
  }
  catch (e: any) { error.value = e?.data?.statusMessage || e?.message }
  finally { busy.value = false }
}
// brief edge flash on the answer: red = Again, amber = Hard, green = Good/Easy
const flash = ref(''), flashN = ref(0)
let flashT: any
function flashed(r: number) { flash.value = r === 1 ? 'bad' : r === 2 ? 'warn' : 'ok'; flashN.value++; clearTimeout(flashT); flashT = setTimeout(() => (flash.value = ''), 500) }
onUnmounted(() => clearTimeout(flashT))
async function rate(r: number) {
  if (!shown.value || !card.value) return
  flashed(r)
  if (await post({ action: 'answer', k: card.value.id, rating: r, secs: Math.min(60, (Date.now() - t0) / 1000) })) reviewed.value++
}
async function undo() { if (await post({ action: 'undo' })) reviewed.value = Math.max(0, reviewed.value - 1) }

// --- grammar: the exercise score is the rating ---
async function practiced(r: { right: number, total: number }) {
  const wrong = r.total - r.right, rating = wrong === 0 ? 3 : wrong === 1 ? 2 : 1
  flashed(rating)
  if (await post({ action: 'answer', k: card.value.id, rating, secs: Math.min(120, (Date.now() - t0) / 1000) })) reviewed.value++
}

// --- writing ---
function written(r: { mistakes: number, hints: number }) { result.value = r; setTimeout(() => (shown.value = true), 300) }
function giveUp() { pad.value?.reveal(); result.value = { mistakes: 0, hints: 0, gaveUp: true }; shown.value = true }
// Armenian / Russian: Check scores the trace / the typed word; a hint caps the suggestion at Good (done in LangScriptWrite)
function schecked(r: { ok: boolean, typed: string, cov?: number, hint: boolean, sugg: number }) { sres.value = r; shown.value = true }
function scGiveUp() { sres.value = { ok: false, typed: '', hint: !!spad.value?.hinted, sugg: 1 }; shown.value = true }
const sverdict = computed(() => {
  const r = sres.value
  if (!r) return ''
  const pct = r.cov === undefined ? '' : ` · ${Math.round(r.cov * 100)}%`
  return (r.typed.trim() ? (r.ok ? t('lang.hy.correct') : t('lang.hy.notQuite')) : (r.ok ? t('lang.hy.nice') : t('lang.hy.tryAgain'))) + pct
})
/** per character: does it match the answer at the same place (positional diff, enough for short words) */
const sdiff = computed(() => {
  const r = sres.value
  if (!r || r.ok || !r.typed.trim() || card.value?.t !== 'w') return []
  const lg = card.value.lang, a = [...scriptNorm(lg, scriptAnswer(card.value))]
  return [...scriptNorm(lg, r.typed)].map((ch, i) => ({ ch, bad: ch !== a[i] }))
})
/** misses per kanji → rating: clean = Good, a slip or two = Hard, more (or a shown stroke too many) = Again */
const suggested = computed(() => {
  const r = result.value
  if (scWrite.value) return sres.value?.sugg ?? 3
  if (!writing.value) return 3
  if (!r || r.gaveUp) return 1
  const n = word.value ? [...word.value[0]].filter(c => /[一-鿿ぁ-ゟァ-ヶ]/.test(c) && (isKana(card.value.n) || /[一-鿿]/.test(c))).length : 1
  const bad = (r.mistakes + 2 * r.hints) / n
  return bad === 0 ? 3 : bad <= 2 ? 2 : 1
})

// which counter the card on screen comes out of (underlined, like Anki)
const from = computed(() => { const s = card.value?.state; return s === 'new' ? 'new' : s === 'review' ? 'review' : s ? 'learn' : '' })

// waiting for a learning step: count down, then ask again
const left = ref(0)
let tick: any
watch(() => q.value?.wait, (w) => {
  clearInterval(tick)
  left.value = w || 0
  if (!w || q.value?.card) return
  tick = setInterval(async () => {
    if (--left.value > 0) return
    clearInterval(tick)
    take(await nextUrl().catch(() => q.value))
  }, 1000)
}, { immediate: true })
onUnmounted(() => clearInterval(tick))
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.ctrlKey || e.metaKey || e.altKey) return
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'z') undo()
  else if (grammar.value && asked.value.length) return // the exercises take their own taps
  else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    if (shown.value) rate(suggested.value)
    else if (!inputCard.value) shown.value = true
  }
  else if (/^[1-4]$/.test(e.key)) rate(Number(e.key))
  else if (e.key === 'h' && writing.value && !shown.value) pad.value?.hint()
  else if (e.key === 'h' && scWrite.value && !shown.value) spad.value?.toggleHint()
}
onMounted(() => { window.addEventListener('keydown', onKey); document.documentElement.style.overflow = 'hidden' })
onUnmounted(() => { window.removeEventListener('keydown', onKey); document.documentElement.style.overflow = '' })
</script>

<template>
  <div class="study">
    <header>
      <button type="button" class="btn ghost icon" :aria-label="langT('lang.close')" @click="emit('close')"><Icon name="x" :size="16"/></button>
      <div v-if="q" class="counts">
        <span class="c-new" :class="{ on: from === 'new' }">{{ q.new }}</span>
        <span class="c-learn" :class="{ on: from === 'learn' }">{{ q.learn }}</span>
        <span class="c-rev" :class="{ on: from === 'review' }">{{ q.review }}</span>
      </div>
      <div v-else class="counts" />
      <button type="button" class="btn ghost sm" :disabled="busy || !reviewed" @click="undo">{{ langT('lang.undo') }}</button>
    </header>

    <p v-if="error" class="errbox">{{ error }}</p>
    <p v-if="savedOffline" class="small"><span class="pill warn">{{ langT('lang.savedOffline') }}</span></p>

    <span v-if="flash" :key="flashN" class="flash" :class="flash" aria-hidden="true" />

    <main v-if="!q" class="load"><Skeleton kind="lines" :n="3" /></main>
    <Transition v-else name="kcard" mode="out-in">
    <!-- write card: prompt + pad, then the answer -->
    <main v-if="blocked" key="offline" class="load"><p class="small"><span class="pill warn">{{ langT('lang.offlineWait') }}</span></p></main>
    <!-- Armenian / Russian write card: the meaning, then the letter on the pad / the word on the keyboard -->
    <main v-else-if="card && scWrite" :key="card.id + card.reps">
      <div class="meta">
        <span class="pill">{{ scGroup }}</span>
        <span class="pill accent">{{ card.t === 'w' ? langT('lang.writeWord') : langT('lang.hy.writeLetter') }}</span>
        <span v-if="card.state === 'new'" class="pill accent">{{ langT('lang.newPill') }}</span>
      </div>
      <div class="prompt">
        <div v-if="card.t === 'w'" class="mean">{{ card.en.join(', ') }}</div>
        <template v-else><div class="mean">{{ card.tr }}</div><div class="muted small">{{ card.en[0] }}</div></template>
      </div>
      <LangScriptWrite ref="spad" :c="card" :locked="shown" @check="schecked" />
      <template v-if="shown">
        <div v-if="sres" class="verdict hyv" :class="sres.ok ? 'ok' : 'bad'">{{ sverdict }}</div>
        <div v-if="sdiff.length" :lang="card.lang" class="typedd"><span v-for="(d, i) in sdiff" :key="i" :class="{ bad: d.bad }">{{ d.ch }}</span></div>
        <div :lang="card.lang" class="glyph sm">{{ card.f }}</div>
        <LangScriptFace :c="card" />
      </template>
    </main>

    <!-- Armenian / Russian reading card: letter / word → meaning, transliteration -->
    <main v-else-if="card && sc" :key="card.id + card.reps" @click="shown = true">
      <div class="meta"><span class="pill">{{ scGroup }}</span><span v-if="card.state === 'new'" class="pill accent">{{ langT('lang.newPill') }}</span><span v-if="card.lapses >= 4" class="pill warn">{{ langT('lang.leech') }}</span></div>
      <div :lang="card.lang" class="glyph" :class="{ sm: card.t === 'w' }">{{ card.f }}</div>
      <LangSpeak v-if="!shown" class="spk" :text="scText(card)" :size="18" />
      <LangScriptFace v-if="shown" :c="card" />
    </main>

    <main v-else-if="card && writing" :key="card.id + card.reps">
      <div class="meta">
        <span class="pill">{{ lvName(card.n) }}</span>
        <span class="pill accent">{{ word ? langT('lang.writeWord') : langT('lang.write') }}</span>
        <span v-if="card.state === 'new'" class="pill accent">{{ langT('lang.newPill') }}</span>
      </div>
      <div v-if="word" class="prompt">
        <div class="mean">{{ word[2] }}</div>
        <div lang="ja" class="jp muted">{{ word[1] }}</div>
      </div>
      <div v-else class="prompt">
        <div class="mean">{{ card.m.join(', ') }}</div>
        <div lang="ja" class="jp muted">{{ readings(card) }}</div>
      </div>
      <KanjiWrite v-if="word" ref="pad" :form="word[0]" :all="isKana(card.n)" @done="written" />
      <KanjiTrace v-else ref="pad" :k="card.k" @done="written" />
      <template v-if="shown">
        <div class="verdict" :class="['bad', 'warn', 'ok'][suggested - 1]">
          {{ result?.gaveUp ? langT('lang.shown') : result && !result.mistakes && !result.hints ? langT('lang.perfect') : langT('lang.misses', { n: result?.mistakes ?? 0 }) + (result?.hints ? ` · ${langT('lang.hintsShown', { n: result.hints })}` : '') }}
        </div>
        <div lang="ja" class="kanji sm">{{ card.k }}</div>
        <KanjiFace :c="card" />
      </template>
    </main>

    <!-- vocabulary: word → meaning, or meaning → word -->
    <main v-else-if="card && vocab" :key="card.id + card.reps" @click="shown = true">
      <div class="meta">
        <span class="pill">{{ langT('lang.lessonN', { n: effLesson(card.l) }) }}</span>
        <span class="pill">{{ card.cat }}</span>
        <span v-if="kind === 'prod'" class="pill accent">{{ langT('lang.production') }}</span>
        <span v-if="card.state === 'new'" class="pill accent">{{ langT('lang.newPill') }}</span>
        <span v-if="card.lapses >= 4" class="pill warn">{{ langT('lang.leech') }}</span>
      </div>
      <div v-if="kind === 'read'" class="word"><LangRuby :v="card" :ruby="furigana === 'always' || shown" /></div>
      <div v-else class="word en">{{ card.en }}</div>
      <LangSpeak v-if="kind === 'read' && !shown" class="spk" :text="card.r" :size="18" />
      <template v-if="shown">
        <template v-if="kind === 'read'">
          <div class="mean">{{ card.en }}</div>
          <div v-if="card.r !== card.ja" lang="ja" class="jp muted rd">{{ card.r }}</div>
        </template>
        <template v-else>
          <div class="word ans"><LangRuby :v="card" :ruby="true" /></div>
          <div v-if="card.r !== card.ja" lang="ja" class="jp muted rd">{{ card.r }}</div>
        </template>
        <LangSpeak class="spk" :text="card.r" :size="18" @click.stop />
      </template>
    </main>

    <!-- grammar: exercises of the point -->
    <main v-else-if="card && grammar" :key="card.id + card.reps">
      <div class="meta">
        <span class="pill">{{ langT('lang.lessonN', { n: effLesson(card.lesson) }) }}</span>
        <span v-if="card.lapses >= 4" class="pill warn">{{ langT('lang.leech') }}</span>
      </div>
      <div class="prompt">
        <div class="mean">{{ card.title }}</div>
        <div class="muted small">{{ card.summary }}</div>
      </div>
      <LangPractice v-if="asked.length" :key="card.id + card.reps" :exercises="asked" :lang="card.lang" :cta="langT('lang.continue')" @continue="practiced" />
      <template v-else>
        <LangMd :md="card.explain" />
      </template>
    </main>

    <!-- kana / kanji reading card -->
    <main v-else-if="card" :key="card.id + card.reps" @click="shown = true">
      <div class="meta"><span class="pill">{{ lvName(card.n) }}</span><span v-if="card.state === 'new'" class="pill accent">{{ langT('lang.newPill') }}</span><span v-if="card.lapses >= 4" class="pill warn">{{ langT('lang.leech') }}</span></div>
      <div lang="ja" class="kanji">{{ card.k }}</div>
      <LangSpeak v-if="!shown && kjMain(card)" class="spk" :text="kjMain(card)" :size="18" />
      <template v-if="shown">
        <KanjiFace :c="card" />
        <div class="more" @click.stop>
          <KanjiTrace v-if="tracing || card.state === 'new'" :k="card.k" guide />
          <div class="links">
            <button v-if="!tracing && card.state !== 'new'" type="button" class="lnk small" @click="tracing = true">{{ langT('lang.traceIt') }}</button>
            <button v-if="!strokes" type="button" class="lnk small" @click="strokes = true">{{ langT('lang.strokeOrder') }} · {{ card.s }}</button>
          </div>
          <KanjiStrokes v-if="strokes" :k="card.k" />
        </div>
      </template>
    </main>

    <main v-else class="done">
      <template v-if="q.wait">
        <div class="big"><Icon name="clock" :size="40"/></div>
        <b>{{ langT('lang.nextLearning', { time: mmss(left) }) }}</b>
      </template>
      <template v-else>
        <div class="big"><Icon name="circle-check" :size="40"/></div>
        <b>{{ langT('lang.doneToday') }}</b>
        <span class="muted small">{{ langT('lang.reviewedSession', { n: reviewed }) }}</span>
      </template>
      <button type="button" class="btn" @click="emit('close')">{{ langT('lang.close') }}</button>
    </main>
    </Transition>

    <footer v-if="card && !(grammar && asked.length)">
      <div v-if="!shown && writing" class="two">
        <button type="button" class="btn" @click="pad?.hint()">{{ langT('lang.showStroke') }}</button>
        <button type="button" class="btn" @click="giveUp">{{ langT('lang.dontKnow') }}</button>
      </div>
      <div v-else-if="!shown && scWrite" class="three">
        <button type="button" class="btn" :class="{ on: spad?.showHint }" @click="spad?.toggleHint()"><Icon name="eye" :size="16" />{{ langT('lang.hy.hint') }}</button>
        <button type="button" class="btn" @click="scGiveUp">{{ langT('lang.dontKnow') }}</button>
        <button type="button" class="btn primary" :disabled="!spad?.canCheck" @click="spad?.check()">{{ langT('lang.ex.check') }}</button>
      </div>
      <button v-else-if="!shown" type="button" class="btn primary show" @click="shown = true">{{ langT('lang.showAnswer') }}</button>
      <div v-else class="rate">
        <button v-for="(l, i) in LABELS" :key="i" type="button" class="btn" :class="[`r${i + 1}`, { sugg: (writing || (scWrite && sres)) && suggested === i + 1 }]" :disabled="busy" @click="rate(i + 1)">
          <span class="ivl">{{ q.buttons?.[i] }}</span>{{ l }}
        </button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.study { position: fixed; inset: 0; z-index: 60; background: var(--bg); display: flex; flex-direction: column; padding: env(safe-area-inset-top) 0 env(safe-area-inset-bottom); }
header { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-bottom: 1px solid var(--line); max-width: 760px; width: 100%; margin: 0 auto; }
.counts { flex: 1; display: flex; justify-content: center; gap: 16px; font-weight: 650; font-size: 16px; }
.counts span { padding: 0 2px 1px; border-bottom: 2px solid transparent; }
.counts .on { border-bottom-color: currentColor; }
.c-new { color: var(--accent); } .c-learn { color: var(--bad); } .c-rev { color: var(--ok); }
.errbox { margin: 10px auto 0; max-width: 720px; }
main { flex: 1; overflow-y: auto; padding: 18px 16px 24px; display: flex; flex-direction: column; gap: 14px; max-width: 640px; width: 100%; margin: 0 auto; }
.meta { display: flex; gap: 6px; justify-content: center; flex-wrap: wrap; }
.kanji { font-size: 128px; line-height: 1.1; text-align: center; font-weight: 400; font-family: 'Noto Sans JP', 'Noto Sans CJK JP', 'Hiragino Sans', 'Yu Gothic', sans-serif; user-select: none; }
.kanji.sm { font-size: 64px; }
.word { font-size: 44px; line-height: 1.5; text-align: center; font-family: 'Noto Sans JP', 'Noto Sans CJK JP', 'Hiragino Sans', 'Yu Gothic', sans-serif; user-select: none; overflow-wrap: anywhere; padding-top: 18px; }
.word.en { font-family: inherit; font-size: 26px; font-weight: 600; line-height: 1.3; }
.word.ans { font-size: 36px; padding-top: 0; }
.rd { text-align: center; font-size: 18px; }
.spk { align-self: center; min-width: 44px; min-height: 44px; }
.prompt { text-align: center; display: flex; flex-direction: column; gap: 2px; }
.prompt .mean, .mean { font-size: 20px; font-weight: 600; text-align: center; }
.prompt .jp { font-size: 16px; }
.verdict { text-align: center; font-weight: 600; }
.more { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.links { display: flex; gap: 18px; }
.done { align-items: center; justify-content: center; text-align: center; gap: 8px; }
.big { font-size: 48px; }
footer { border-top: 1px solid var(--line); padding: 10px 14px calc(10px + env(safe-area-inset-bottom)); max-width: 760px; width: 100%; margin: 0 auto; }
.show { width: 100%; min-height: 48px; font-size: 15px; }
.two { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.two .btn { min-height: 48px; }
.three { display: grid; grid-template-columns: 1fr 1.4fr 1fr; gap: 8px; }
.three .btn { min-height: 48px; }
.three .btn.on { border-color: var(--accent); color: var(--accent); }
.glyph { font-size: 112px; line-height: 1.15; text-align: center; font-weight: 400; user-select: none; overflow-wrap: anywhere; }
.glyph.sm { font-size: 56px; }
.hyv.ok { color: var(--ok); } .hyv.bad { color: var(--bad); }
.typedd { text-align: center; font-size: 26px; }
.typedd .bad { color: var(--bad); text-decoration: underline; }
.rate { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.rate .btn { flex-direction: column; gap: 0; min-height: 52px; font-size: 13.5px; font-weight: 600; }
.rate .sugg { border-color: currentColor; box-shadow: 0 0 0 1px currentColor inset; }
.ivl { font-size: 11px; font-weight: 400; color: var(--muted); }
.r1 { color: var(--bad); } .r2 { color: var(--warn); } .r3 { color: var(--ok); } .r4 { color: var(--accent); }
.flash { position: absolute; inset: 0; z-index: 2; pointer-events: none; border: 3px solid var(--ok); animation: kflash var(--dur-slow) var(--ease-out) forwards; }
.flash.bad { border-color: var(--bad); } .flash.warn { border-color: var(--warn); }
@keyframes kflash { from { opacity: .7; } to { opacity: 0; } }
.kcard-enter-active { transition: opacity var(--dur) var(--ease-out), transform var(--dur) var(--ease-out); }
.kcard-leave-active { transition: opacity var(--dur-fast) var(--ease-in), transform var(--dur-fast) var(--ease-in); }
.kcard-enter-from { opacity: 0; transform: translateX(16px); }
.kcard-leave-to { opacity: 0; transform: translateX(-16px); }
@media (prefers-reduced-motion: reduce) { .flash { animation: none; opacity: 0; } }
@media (max-width: 640px) { .kanji { font-size: 112px; } .glyph { font-size: 96px; } .glyph.sm { font-size: 48px; } .word { font-size: 38px; } main { padding: 12px 12px 18px; gap: 10px; } }
</style>
