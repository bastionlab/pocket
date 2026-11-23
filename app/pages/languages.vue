<script setup lang="ts">
/**
 * Languages: pick a language at the top (only the ones switched on in Settings → Languages I learn; one language = just its
 * title), then its decks as page tabs. Each deck has its own daily queue (Study opens
 * the review screen over the page; ?study=<deck> keeps it in the URL so the phone's back button closes it).
 */
const t = langT
useHead({ title: `${t('lang.title')} · Bastion` })

const PICK = 'bastion:lang' // the language on screen, per device
const route = useRoute(), router = useRouter()
const lang = useState<string>('lang:pick', () => 'ja')
onMounted(() => {
  const v = typeof route.query.l === 'string' && /^[a-z]{2,3}$/.test(route.query.l) ? route.query.l : localStorage.getItem(PICK) // ?l=hy (the old /armenian link)
  if (v && v !== lang.value) lang.value = v
})
function pickLang(id: string) { lang.value = id; localStorage.setItem(PICK, id) }

const o = ref<any>(null)
const error = ref('')
const speech = useLangSpeech()
async function load() {
  const asked = lang.value
  try {
    const r = await $fetch<any>('/api/lang', { query: { l: asked } })
    if (asked !== lang.value) return // switched meanwhile: that load is on its way
    // the language on screen is not one the owner learns (any more): fall back to the first one that is
    if (!r.enabled.includes(lang.value)) { lang.value = r.enabled[0]; return }
    o.value = r; error.value = ''
    speech.value = r.languages.find((l: any) => l.id === lang.value)?.speech !== false
  } catch (e: any) { error.value = e?.data?.statusMessage || e?.statusMessage || e?.message }
}
usePoll(load, 60_000)
watch(lang, () => { o.value = null; load() })

const enabled = computed<any[]>(() => (o.value?.languages ?? []).filter((l: any) => o.value.enabled.includes(l.id)))
const course = computed(() => o.value?.languages.find((l: any) => l.id === lang.value)?.course ?? 'genki')
/** "Genki lesson 3" for Japanese, "Lesson 3" for a course without a book */
const lessonTitle = (n: number) => (course.value === 'genki' ? t('lang.genkiLesson', { n }) : t('lang.lessonN', { n }))
const go = (q: Record<string, any>) => router.push({ query: { ...route.query, ...q } })
function back(key: string | string[]) { if (window.history.state?.back) router.back(); else router.replace({ query: { ...route.query, ...Object.fromEntries([key].flat().map(k => [k, undefined])) } }) }

const deckIds = computed<{ id: string, kind: string }[]>(() => o.value?.languages.find((l: any) => l.id === lang.value)?.decks ?? [])
const idOf = (kind: string) => deckIds.value.find(d => d.kind === kind)?.id ?? ''
const studying = computed(() => (typeof route.query.study === 'string' && o.value?.decks[route.query.study] ? route.query.study : ''))
const infoK = computed(() => (typeof route.query.k === 'string' ? route.query.k : ''))
const infoDeck = computed(() => (typeof route.query.d === 'string' ? route.query.d : ''))
const infoV = computed(() => (typeof route.query.v === 'string' ? route.query.v : ''))
/** the word sheet's deck: the Alphabet tab opens letters (?d=), the vocabulary tab its words */
const infoVDeck = computed(() => (infoDeck.value && infoDeck.value.endsWith('-alpha') ? infoDeck.value : idOf('vocab')))
const study = (deck: string) => go({ study: deck })
function closeStudy() { back('study'); load() }

// sections as tabs (?s=…)
const tab = usePageTab('today')
const tabs = computed(() => [
  { key: 'today', label: t('lang.tabs.today') },
  ...deckIds.value.map(d => ({ key: d.kind, label: t(`lang.tabs.${d.kind}`) })),
  { key: 'settings', label: t('lang.tabs.settings') },
])
const active = computed(() => (tabs.value.some(x => x.key === tab.value) ? tab.value : 'today'))

// --- Today ---
const KIND_ICON: Record<string, string> = { kana: 'pencil', kanji: 'kanji', alpha: 'languages', vocab: 'book', grammar: 'file-text' }
const heat = computed(() => {
  if (!o.value) return []
  const today = Date.parse(`${o.value.day}T12:00:00Z`)
  const wd = (new Date(today).getUTCDay() + 6) % 7
  const start = today - (25 * 7 + wd) * 86_400_000
  const cells: { d: string, n: number, l: number }[] = []
  for (let ts = start; ts <= today; ts += 86_400_000) {
    const d = new Date(ts).toISOString().slice(0, 10), n = o.value.heat[d] ?? 0
    cells.push({ d, n, l: !n ? 0 : n < 15 ? 1 : n < 40 ? 2 : n < 80 ? 3 : 4 })
  }
  return cells
})
const fmtDay = (d: string) => langDate(`${d}T12:00:00Z`, { day: 'numeric', month: 'short' })
const fmax = computed(() => Math.max(1, ...(o.value?.forecast ?? [])))
const dueOf = (id: string) => { const d = o.value.decks[id]; return d.kind === 'grammar' ? d.learn + d.review : d.new + d.learn + d.review }

// --- lesson + settings ---
async function post(body: Record<string, any>) {
  try { await $fetch('/api/lang/action', { method: 'POST', body: { lang: lang.value, ...body } }); await load() } catch (e: any) { error.value = e?.data?.statusMessage || e?.message }
}
const stepLesson = (delta: number) => post({ action: 'lesson', delta })
const setDeck = (deck: string, body: Record<string, any>) => {
  Object.assign(o.value.settings.decks[deck], body) // flips at once; load() brings the server's answer
  return post({ action: 'settings', deck, ...body })
}
function toggleLevel(deck: string, n: number) {
  const l = o.value.settings.decks[deck].levels as number[]
  setDeck(deck, { levels: l.includes(n) ? l.filter(x => x !== n) : [...l, n] })
}
const lvName2 = (n: number) => lvName(n)
/** Settings → Languages I learn */
const toggleLang = (id: string) => {
  const on = o.value.enabled as string[]
  const next = on.includes(id) ? on.filter(x => x !== id) : [...on, id]
  if (!next.length) return
  o.value.enabled = next // flips at once; load() brings the server's answer
  if (!next.includes(lang.value)) pickLang(next[0]!)
  return post({ action: 'languages', languages: next })
}
const LIMITS = [0, 1, 2, 3, 5, 10, 15, 20, 30]
const limitsFor = (cur: number) => [...new Set([...LIMITS, cur])].sort((a, b) => a - b)
</script>

<template>
  <div class="lg">
    <p v-if="error" class="errbox">{{ error }}</p>
    <Skeleton v-if="!o" kind="cards" :n="4" />
    <template v-else>
      <div v-if="enabled.length > 1" class="langs" role="group" :aria-label="langT('lang.title')">
        <button v-for="l in enabled" :key="l.id" type="button" class="chip" :class="{ on: lang === l.id }" @click="pickLang(l.id)">{{ l.name }}</button>
      </div>
      <h2 v-else class="ltitle">{{ enabled[0]?.name }}</h2>

      <PageTabs :model-value="active" :tabs="tabs" @update:model-value="tab = $event" />

      <!-- Today -->
      <template v-if="active === 'today'">
        <div v-if="enabled.length > 1" class="all" role="group" :aria-label="langT('lang.allLanguages')">
          <span class="faint small">{{ langT('lang.allLanguages') }}</span>
          <button v-for="l in enabled" :key="l.id" type="button" class="lnk" :class="{ cur: l.id === lang }" @click="pickLang(l.id)">
            {{ l.name }} <b class="num" :class="{ zero: !o.due[l.id] }">{{ o.due[l.id] ?? 0 }}</b>
          </button>
        </div>
        <div class="decks">
          <Panel v-for="d in deckIds" :key="d.id" class="dk">
            <div class="dk-top">
              <Icon :name="KIND_ICON[d.kind] ?? 'book'" :size="18" />
              <b>{{ langT(`lang.tabs.${d.kind}`) }}</b>
              <span v-if="o.decks[d.id].kind === 'grammar'" class="faint small push">{{ langT('lang.suggestedN', { n: o.decks[d.id].new }) }}</span>
            </div>
            <div class="nums">
              <div><b class="c-new">{{ o.decks[d.id].new }}</b><span>{{ d.kind === 'grammar' ? langT('lang.suggested') : langT('lang.new') }}</span></div>
              <div><b class="c-learn">{{ o.decks[d.id].learn }}</b><span>{{ langT('lang.learning') }}</span></div>
              <div><b class="c-rev">{{ o.decks[d.id].review }}</b><span>{{ langT('lang.toReview') }}</span></div>
            </div>
            <ul v-if="d.kind === 'grammar' && o.decks[d.id].suggest?.length" class="sug">
              <li v-for="p in o.decks[d.id].suggest" :key="p.id"><button type="button" class="lnk" @click="go({ s: 'grammar', p: p.id })">{{ p.title }}</button></li>
            </ul>
            <button v-if="dueOf(d.id)" type="button" class="btn primary st" @click="study(d.id)">{{ langT('lang.study') }}</button>
            <button v-else-if="d.kind === 'grammar' && o.decks[d.id].new" type="button" class="btn st" @click="go({ s: 'grammar' })">{{ langT('lang.tabs.grammar') }}</button>
            <span v-else class="muted small st-done">{{ o.decks[d.id].seen || o.decks[d.id].total ? langT('lang.doneToday') : '' }}</span>
          </Panel>
        </div>

        <Panel v-if="idOf('vocab')" :title="lessonTitle(o.lesson.n)" class="lesson">
          <div class="prog">
            <div class="pr"><span class="muted small">{{ langT('lang.words') }}</span>
              <div class="bar"><i :style="{ width: `${o.lesson.words.total ? (100 * o.lesson.words.introduced) / o.lesson.words.total : 0}%` }" /></div>
              <span class="num small muted">{{ o.lesson.words.introduced }}<span class="faint">/{{ o.lesson.words.total }}</span></span></div>
            <div v-if="idOf('grammar')" class="pr"><span class="muted small">{{ langT('lang.tabs.grammar') }}</span>
              <div class="bar"><i :style="{ width: `${o.lesson.grammar.total ? (100 * o.lesson.grammar.learned) / o.lesson.grammar.total : 0}%` }" /></div>
              <span class="num small muted">{{ o.lesson.grammar.learned }}<span class="faint">/{{ o.lesson.grammar.total }}</span></span></div>
          </div>
          <div class="lessonbtns">
            <button type="button" class="btn sm" :disabled="o.lesson.n <= 1" @click="stepLesson(-1)">{{ langT('lang.prevLesson') }}</button>
            <button type="button" class="btn sm primary" :disabled="o.lesson.n >= o.lesson.max" @click="stepLesson(1)">{{ langT('lang.nextLesson') }}</button>
          </div>
        </Panel>

        <div class="stats">
          <div><b>{{ o.streak }}</b><span>{{ langT('lang.days') }}</span></div>
          <div><b>{{ o.today.reviews }}</b><span>{{ langT('lang.today') }}{{ o.today.mins ? ` · ${langT('lang.minutes', { n: o.today.mins })}` : '' }}</span></div>
          <div><b>{{ o.retention == null ? '–' : `${o.retention}%` }}</b><span>{{ langT('lang.retention') }}</span></div>
        </div>

        <div class="grid cols-2 two">
          <Panel :title="langT('lang.activity')" :id="`${lang}-heat`" :sub="langT('lang.weeks26')">
            <div class="scroll-x">
              <div class="heat"><i v-for="c in heat" :key="c.d" :class="`l${c.l}`" :title="`${fmtDay(c.d)}: ${c.n}`" /></div>
            </div>
            <div class="faint small">{{ langT('lang.reviewsInAll', { n: o.total.reviews }) }}</div>
          </Panel>
          <Panel :title="langT('lang.comingUp')" :id="`${lang}-forecast`" :sub="langT('lang.days14')">
            <div class="fc">
              <div v-for="(n, i) in o.forecast" :key="i" class="col" :title="`${n}`">
                <span class="faint">{{ n || '' }}</span>
                <i :style="{ height: `${(100 * n) / fmax}%` }" :class="{ today: i === 0 }" />
              </div>
            </div>
          </Panel>
        </div>
      </template>

      <LangCharDeck v-else-if="active === 'kana' || active === 'kanji'" :key="active" :deck="idOf(active)" :o="o" @study="study(idOf(active))" @info="go({ k: $event, d: idOf(active) })" />

      <LangAlphaTab v-else-if="active === 'alpha'" :key="idOf('alpha')" :deck="idOf('alpha')" :o="o" @study="study(idOf('alpha'))" @info="go({ v: $event, d: idOf('alpha') })" />

      <LangVocabTab v-else-if="active === 'vocab'" :key="idOf('vocab')" :deck="idOf('vocab')" :o="o" @study="study(idOf('vocab'))" @info="go({ v: $event, d: undefined })" />

      <template v-else-if="active === 'grammar'">
        <LangDeckHero :c="o.decks[idOf('grammar')]" grammar :next-up="o.forecast[1]" @study="study(idOf('grammar'))" />
        <LangGrammar :lang="lang" :lesson="o.lesson.n" @changed="load" />
      </template>

      <!-- Settings -->
      <template v-else-if="active === 'settings'">
        <Panel :title="langT('lang.langsLearn')" id="lang-set-languages">
          <div class="chips">
            <button v-for="l in o.languages" :key="l.id" type="button" class="chip" :class="{ on: o.enabled.includes(l.id) && !l.planned }" :disabled="l.planned" :aria-pressed="o.enabled.includes(l.id)" @click="toggleLang(l.id)">
              {{ l.name }}<span v-if="l.planned" class="soon">{{ langT('lang.planned') }}</span>
            </button>
          </div>
        </Panel>
        <Panel :title="lessonTitle(o.lesson.n)" :id="`${lang}-set-lesson`" v-if="idOf('vocab') || idOf('grammar')" class="setp">
          <div class="set">
            <span class="muted small">{{ langT('lang.currentLesson') }}</span>
            <div class="stepper">
              <button type="button" class="btn sm" :disabled="o.lesson.n <= 1" @click="stepLesson(-1)">{{ langT('lang.prevLesson') }}</button>
              <b class="num">{{ o.lesson.n }}</b>
              <button type="button" class="btn sm" :disabled="o.lesson.n >= o.lesson.max" @click="stepLesson(1)">{{ langT('lang.nextLesson') }}</button>
            </div>
          </div>
        </Panel>
        <Panel v-for="d in deckIds" :key="d.id" :title="langT(`lang.tabs.${d.kind}`)" :id="`${d.id}-settings`" class="setp">
          <div class="set">
            <span class="muted small">{{ d.kind === 'grammar' ? langT('lang.suggestPerDay') : langT('lang.newPerDay') }}</span>
            <div class="seg">
              <button v-for="n in limitsFor(o.settings.decks[d.id].newPerDay)" :key="n" type="button" :class="{ on: o.settings.decks[d.id].newPerDay === n }" @click="setDeck(d.id, { newPerDay: n })">{{ n }}</button>
            </div>
          </div>
          <div v-if="d.kind === 'kana' || d.kind === 'kanji' || d.kind === 'alpha'" class="set">
            <span class="muted small">{{ langT('lang.writingCards') }}</span>
            <div class="seg">
              <button type="button" :class="{ on: o.settings.decks[d.id].writing }" @click="setDeck(d.id, { writing: true })">{{ langT('lang.on') }}</button>
              <button type="button" :class="{ on: !o.settings.decks[d.id].writing }" @click="setDeck(d.id, { writing: false })">{{ langT('lang.off') }}</button>
            </div>
          </div>
          <div v-if="d.kind === 'kana' || d.kind === 'kanji'" class="set">
            <span class="muted small">{{ langT('lang.newFrom') }}</span>
            <div class="chips">
              <button v-for="l in o.levels[d.id]" :key="l.n" type="button" class="chip" :class="{ on: o.settings.decks[d.id].levels.includes(l.n) }" @click="toggleLevel(d.id, l.n)">{{ lvName2(l.n) }}</button>
            </div>
          </div>
          <div v-if="d.id === 'ja-vocab'" class="set">
            <span class="muted small">{{ langT('lang.furigana') }}</span>
            <div class="seg">
              <button type="button" :class="{ on: o.settings.decks[d.id].furigana === 'after' }" @click="setDeck(d.id, { furigana: 'after' })">{{ langT('lang.furiAfter') }}</button>
              <button type="button" :class="{ on: o.settings.decks[d.id].furigana === 'always' }" @click="setDeck(d.id, { furigana: 'always' })">{{ langT('lang.furiAlways') }}</button>
            </div>
          </div>
          <div v-if="d.kind === 'vocab'" class="set">
            <span class="muted small">{{ langT('lang.productionCards') }}</span>
            <div class="seg">
              <button type="button" :class="{ on: o.settings.decks[d.id].production }" @click="setDeck(d.id, { production: true })">{{ langT('lang.on') }}</button>
              <button type="button" :class="{ on: !o.settings.decks[d.id].production }" @click="setDeck(d.id, { production: false })">{{ langT('lang.off') }}</button>
            </div>
          </div>
        </Panel>
        <p v-if="lang === 'ja'" class="faint small credit">{{ langT('lang.credits') }}</p>
      </template>
    </template>

    <Transition name="kfade">
      <LangStudy v-if="studying" :key="studying" :deck="studying" :furigana="o.settings.decks[studying]?.furigana" @close="closeStudy" />
    </Transition>
    <Transition name="sheet"><KanjiInfo v-if="infoK && infoDeck" :k="infoK" :deck="infoDeck" @close="back('k')" @changed="load" /></Transition>
    <Transition name="sheet"><LangVocabInfo v-if="infoV" :id="infoV" :deck="infoVDeck" @close="back(['v', 'd'])" @changed="load" /></Transition>
  </div>
</template>

<style>
/* Russian text: a stack with Cyrillic and a combining acute that sits on the vowel (the stress marks U+0301 of the display forms) */
[lang="ru"] { font-family: system-ui, 'Noto Sans', 'Roboto', 'Segoe UI', 'DejaVu Sans', sans-serif; font-feature-settings: 'ccmp' 1, 'mark' 1, 'mkmk' 1; text-rendering: optimizeLegibility; }
</style>

<style scoped>
.lg { max-width: 860px; margin: 0 auto; }
.errbox { margin: 0 0 12px; }
.langs { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 12px; }
.langs .chip { display: inline-flex; align-items: center; gap: 8px; min-height: 36px; }
.ltitle { margin: 0 0 12px; font-size: 18px; font-weight: 650; }
.all { display: flex; align-items: center; gap: 4px 14px; flex-wrap: wrap; margin-bottom: 12px; }
.all .lnk { min-height: 32px; }
.all .lnk.cur { font-weight: 650; }
.all .num { color: var(--accent); margin-left: 2px; }
.all .num.zero { color: var(--faint); font-weight: 400; }
.langs .chip:disabled { opacity: .55; cursor: default; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chips .chip { display: inline-flex; align-items: center; gap: 8px; min-height: 36px; }
.chips .chip:disabled { opacity: .55; cursor: default; }
.soon { font-size: 11px; color: var(--muted); }
.decks { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-bottom: 14px; }
.dk-top { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.dk-top .push { margin-left: auto; }
.nums { display: flex; gap: 20px; margin-bottom: 12px; }
.nums > div { display: flex; flex-direction: column; }
.nums b { font-size: 24px; font-weight: 650; line-height: 1.1; }
.nums span { font-size: 12px; color: var(--muted); }
.c-new { color: var(--accent); } .c-learn { color: var(--bad); } .c-rev { color: var(--ok); }
.sug { list-style: none; margin: -2px 0 12px; padding: 0; display: flex; flex-direction: column; gap: 2px; }
.sug .lnk { text-align: left; min-height: 28px; }
.st { width: 100%; min-height: 44px; }
.st-done { display: block; min-height: 44px; line-height: 44px; }
.lesson { margin-bottom: 14px; }
.prog { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.pr { display: grid; grid-template-columns: 72px 1fr 64px; gap: 10px; align-items: center; }
.bar { position: relative; height: 8px; border-radius: 8px; background: var(--track); overflow: hidden; }
.bar i { position: absolute; left: 0; top: 0; bottom: 0; background: var(--accent); border-radius: 8px; }
.num { text-align: right; }
.lessonbtns { display: flex; gap: 8px; justify-content: flex-end; }
.stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 0 0 14px; }
.stats > div { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); padding: 10px 14px; display: flex; flex-direction: column; min-width: 0; }
.stats b { font-size: 20px; font-weight: 650; }
.stats span { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.heat { display: grid; grid-template-rows: repeat(7, 11px); grid-auto-flow: column; grid-auto-columns: 11px; gap: 3px; margin-bottom: 8px; width: max-content; }
.heat i { border-radius: 2px; background: var(--track); }
.heat .l1 { background: var(--ok); opacity: .3; } .heat .l2 { background: var(--ok); opacity: .55; }
.heat .l3 { background: var(--ok); opacity: .8; } .heat .l4 { background: var(--ok); }
.fc { display: grid; grid-template-columns: repeat(14, minmax(0, 1fr)); gap: 3px; height: 90px; align-items: end; margin-bottom: 8px; }
.col { display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; font-size: 10px; gap: 2px; }
.col i { width: 100%; min-height: 2px; background: var(--ok); opacity: .7; border-radius: 3px 3px 0 0; }
.col i.today { opacity: 1; }
.set { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.set .chips { display: flex; flex-wrap: wrap; gap: 6px; }
.set > span { min-width: 140px; }
.stepper { display: flex; align-items: center; gap: 10px; }
.stepper b { min-width: 2ch; text-align: center; }
.setp { margin-top: 12px; }
.credit { margin-top: 14px; }
@media (max-width: 640px) {
  .decks { grid-template-columns: minmax(0, 1fr); }
  .lessonbtns .btn { flex: 1; min-height: 40px; }
}
.kfade-enter-active { transition: opacity var(--dur) var(--ease-out); }
.kfade-leave-active { transition: opacity var(--dur-fast) var(--ease-in); }
.kfade-enter-from, .kfade-leave-to { opacity: 0; }
</style>
