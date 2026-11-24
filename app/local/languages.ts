// Languages add-on, in the browser: Anki-style SRS decks (Japanese kana/kanji/Genki, Armenian, Russian).
// Ported from the dashboard's server/utils/lang.ts + langData.ts + api/lang/*. State lives in kv under `lang:`:
//   lang:card:<deck>:<k>  card row      lang:rev:<deck>:<seq>  review row      lang:set:<key>  settings
//   lang:seq  review counter            lang:strokes:<char>  KanjiVG stroke data
// Scheduling is Anki's SM-2: learning steps 1 m / 10 m, graduate at 1 d (Easy 4 d), ease 250 %, lapses relearn at 10 m and
// lose 20 % ease. Days roll over at midnight Berlin. The static data (data/*.json) loads lazily, one chunk per file.
import { defineLocal, LocalError } from './registry'
import { kv } from './store'

type DeckKind = 'kana' | 'kanji' | 'alpha' | 'vocab' | 'grammar'
type DeckDef = { id: string, kind: DeckKind, plain?: boolean }
type LangDef = { id: string, name: string, native: string, tts: string, planned?: boolean, course?: 'genki' | 'pack', decks: DeckDef[] }
type Kanji = { k: string, n: number, s: number, m: string[], on: string[], kun: string[], w: [string, string, string][] }
type Vocab = { id: string, l: number, cat: string, ja: string, r: string, en: string }
type HyItem = { id: string, t: 'l' | 'w', g: number, l: number, f: string }
type Point = { id: string, lesson: number, title: string, summary: string, examples: any[] }
type Card = { k: string, state: string, due: number, ivl: number, ease: number, step: number, reps: number, lapses: number, added: number }
type Row = Card & { deck: string }
type Rev = { deck: string, k: string, ts: number, day: string, rating: number, was: string, ivl: number, secs: number | null, prev: Card | null }

// --- data registry ---
const FILES = import.meta.glob('./data/*.json') as Record<string, () => Promise<{ default: any }>>
const fileNames = Object.keys(FILES).map(p => p.replace(/^\.\/data\//, '').replace(/\.json$/, ''))
const hasGrammar = (lang: string) => fileNames.some(f => f.startsWith(`${lang}-grammar`))
const ja = (kind: DeckKind): DeckDef => ({ id: `ja-${kind}`, kind })
const LANG_DEFS: LangDef[] = [
  { id: 'ja', name: 'Japanese', native: '日本語', tts: 'ja', course: 'genki', decks: [ja('kana'), ja('kanji'), ja('vocab'), ja('grammar')] },
  { id: 'hy', name: 'Armenian', native: 'Հայերեն', tts: 'hy', course: 'pack', decks: [
    { id: 'hy-alpha', kind: 'alpha' }, { id: 'hy-vocab', kind: 'vocab', plain: true }, ...(hasGrammar('hy') ? [{ id: 'hy-grammar', kind: 'grammar' as const }] : []),
  ] },
  { id: 'ru', name: 'Russian', native: 'Русский', tts: 'ru', course: 'pack', decks: [
    { id: 'ru-alpha', kind: 'alpha' }, { id: 'ru-vocab', kind: 'vocab', plain: true }, ...(hasGrammar('ru') ? [{ id: 'ru-grammar', kind: 'grammar' as const }] : []),
  ] },
]
const isPlain = (def: DeckDef) => def.kind === 'kana' || def.kind === 'kanji' || def.kind === 'alpha' || !!def.plain
const defOf = new Map<string, { lang: LangDef, def: DeckDef }>()
for (const lang of LANG_DEFS) for (const def of lang.decks) defOf.set(def.id, { lang, def })
const deckDef = (deck: string) => defOf.get(deck)
const deckOrThrow = (deck: unknown) => {
  const d = defOf.get(String(deck))
  if (!d || d.lang.planned) throw new LocalError(400, `unknown deck: ${String(deck).slice(0, 20)}`)
  return d
}
const effLesson = (l: number) => Math.max(l, 1) // lesson 0 (greetings) counts as part of lesson 1

const fileCache = new Map<string, Promise<any[]>>()
const file = (name: string): Promise<any[]> => {
  if (!fileCache.has(name)) { const f = FILES[`./data/${name}.json`]; fileCache.set(name, f ? f().then(m => m.default) : Promise.resolve([])) }
  return fileCache.get(name)!
}
const ITEMS = new Map<string, any[]>()
const BY = new Map<string, Map<string, any>>()
async function loadItems(deck: string): Promise<any[]> {
  if (ITEMS.has(deck)) return ITEMS.get(deck)!
  const { lang, def } = defOf.get(deck)!
  const face = (x: any) => x.hy ?? x.ru
  let items: any[] = []
  if (def.kind === 'kana') items = lang.id === 'ja' ? (await file('kanji')).filter((x: Kanji) => x.n >= 6) : []
  else if (def.kind === 'kanji') items = lang.id === 'ja' ? (await file('kanji')).filter((x: Kanji) => x.n <= 5) : []
  else if (def.kind === 'alpha') items = (await file(`${lang.id}-alpha`)).map(x => ({ ...x, l: 0, f: face(x) }))
  else if (def.kind === 'vocab') { const v = await file(`${lang.id}-vocab`); items = lang.course === 'pack' ? v.map(x => ({ ...x, l: x.g, f: face(x) })) : v }
  else {
    const seen = new Set<string>(), out: Point[] = []
    for (const f of fileNames.filter(f => f.startsWith(`${lang.id}-grammar`)).sort())
      for (const p of await file(f)) if (p?.id && !seen.has(p.id)) { seen.add(p.id); out.push({ ...p, examples: (p.examples ?? []).map((e: any) => ({ ...e, t: e.t ?? e.ja })) }) }
    items = out.sort((a, b) => effLesson(a.lesson) - effLesson(b.lesson)) // stable: file order inside a lesson
  }
  ITEMS.set(deck, items)
  BY.set(deck, new Map(items.map(x => [def.kind === 'kana' || def.kind === 'kanji' ? x.k : x.id, x])))
  return items
}
const itemOf = (deck: string, base: string) => BY.get(deck)?.get(base)
async function loadLang(lang: string) { await Promise.all((LANG_DEFS.find(l => l.id === lang)?.decks ?? []).map(d => loadItems(d.id))) }
const maxLesson = (lang: string) => Math.max(1, ...(LANG_DEFS.find(l => l.id === lang)?.decks ?? []).flatMap(d => (d.kind === 'vocab' || d.kind === 'grammar' ? (ITEMS.get(d.id) ?? []).map(x => effLesson(x.l ?? x.lesson)) : [])))
const publicLangs = () => LANG_DEFS.map(l => ({ id: l.id, name: l.name, native: l.native, planned: !!l.planned, course: l.course ?? 'genki', decks: l.decks, maxLesson: l.planned ? 0 : maxLesson(l.id) }))

/** can this language be read out here? Armenian needs a hy voice in the browser; the others just try */
async function speechOk(code: string) {
  if (code !== 'hy') return true
  if (typeof speechSynthesis === 'undefined') return false
  let v = speechSynthesis.getVoices()
  if (!v.length) await new Promise<void>((r) => { speechSynthesis.addEventListener('voiceschanged', () => r(), { once: true }); setTimeout(r, 800) })
  v = speechSynthesis.getVoices()
  return v.some(x => x.lang.toLowerCase().startsWith('hy'))
}

// --- storage ---
const LEARN = [60, 600] // seconds
const RELEARN = [600]
const LEARN_AHEAD = 20 * 60 // like Anki: with nothing else left, learning cards due within 20 min come early
const MAX_IVL = 36500
const now = () => Date.now() / 1000
const berlinDay = (t: number) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(t)
const studyDay = (t = now()) => berlinDay(t * 1000)
const dayNum = (d: string) => Math.floor(Date.parse(`${d}T12:00:00Z`) / 86_400_000)

const readSetting = async (key: string) => (await kv.get(`lang:set:${key}`)) ?? null
const writeSetting = (key: string, v: unknown) => kv.set(`lang:set:${key}`, v)
const cardKey = (deck: string, k: string) => `lang:card:${deck}:${k}`
const revKey = (deck: string, n: number) => `lang:rev:${deck}:${String(n).padStart(10, '0')}`
const getCard = (deck: string, k: string) => kv.get<Row>(cardKey(deck, k))
const allCards = async (deck: string) => (await kv.list<Row>(`lang:card:${deck}:`)).map(x => x.value)
const allRevs = async (deck: string) => (await kv.list<Rev & { id: number }>(`lang:rev:${deck}:`)).map(x => x.value)
const fresh = (k: string): Card => ({ k, state: 'new', due: 0, ivl: 0, ease: 2.5, step: 0, reps: 0, lapses: 0, added: now() })
const cardOnly = (c: Card): Card => ({ k: c.k, state: c.state, due: c.due, ivl: c.ivl, ease: c.ease, step: c.step, reps: c.reps, lapses: c.lapses, added: c.added })
async function nextSeq() { const n = ((await kv.get<number>('lang:seq')) ?? 0) + 1; await kv.set('lang:seq', n); return n }

// --- settings ---
type DeckSettings = { newPerDay: number, writing?: boolean, levels?: number[], furigana?: 'after' | 'always', production?: boolean }
const DEFAULTS: Record<DeckKind, DeckSettings> = {
  kana: { newPerDay: 10, writing: true, levels: [6, 7] }, // levels 6 / 7 = hiragana / katakana; none = deck off
  kanji: { newPerDay: 10, writing: true, levels: [5, 4, 3, 2, 1] },
  alpha: { newPerDay: 10, writing: true },
  vocab: { newPerDay: 15, furigana: 'after', production: true },
  grammar: { newPerDay: 2 },
}
const DECK_DEFAULTS: Record<string, Partial<DeckSettings>> = { 'hy-vocab': { newPerDay: 10 }, 'ru-vocab': { newPerDay: 10 } }

async function getSettings(deck: string): Promise<DeckSettings> {
  const kind = deckOrThrow(deck).def.kind
  return { ...DEFAULTS[kind], ...DECK_DEFAULTS[deck], ...((await readSetting(`deck:${deck}`)) ?? {}) }
}
async function putSettings(deck: string, p: Partial<DeckSettings>) {
  const kind = deckOrThrow(deck).def.kind
  const cur = await getSettings(deck)
  if (p.newPerDay != null) cur.newPerDay = Math.max(0, Math.min(100, Math.round(Number(p.newPerDay) || 0)))
  if ((kind === 'kana' || kind === 'kanji' || kind === 'alpha') && p.writing != null) cur.writing = !!p.writing
  if ((kind === 'kana' || kind === 'kanji') && p.levels) {
    const ok = kind === 'kana' ? [6, 7] : [5, 4, 3, 2, 1]
    const l = [...new Set(p.levels.map(Number).filter(n => ok.includes(n)))].sort((a, b) => b - a)
    if (l.length || kind === 'kana') cur.levels = l
  }
  if (kind === 'vocab') {
    if (deck === 'ja-vocab' && (p.furigana === 'after' || p.furigana === 'always')) cur.furigana = p.furigana
    if (p.production != null) cur.production = !!p.production
  }
  await writeSetting(`deck:${deck}`, cur)
  return cur
}
async function getLangLesson(lang: string) {
  await loadLang(lang)
  return Math.max(1, Math.min(maxLesson(lang), Math.round(Number((await readSetting(`lang:${lang}`))?.lesson) || 1)))
}
async function putLangLesson(lang: string, n: number) {
  if (!LANG_DEFS.some(l => l.id === lang && !l.planned)) throw new LocalError(400, 'unknown language')
  await loadLang(lang)
  const v = Math.max(1, Math.min(maxLesson(lang), Math.round(Number(n) || 1)))
  await writeSetting(`lang:${lang}`, { lesson: v })
  return v
}
// --- language packs: the data chunks of a language are fetched once ("Download"), the flag lives in kv as lang:pack:<id> = { at, bytes } ---
/** approximate download size of a language's data files (the JSON in ./data, before compression) */
export const PACK_INFO: Record<string, { bytes: number, size: string }> = {
  ja: { bytes: 1_252_000, size: 'about 1.3 MB' },
  ru: { bytes: 291_000, size: 'about 0.3 MB' },
  hy: { bytes: 235_000, size: 'about 0.2 MB' },
}
const packFiles = (id: string) => fileNames.filter(f => f.startsWith(`${id}-`) || (id === 'ja' && f === 'kanji'))
/** fetch every data chunk of a language one by one (the service worker keeps them for offline), then mark the pack as downloaded */
export async function downloadPack(id: string, onProgress?: (n: number, total: number) => void) {
  const L = LANG_DEFS.find(l => l.id === id && !l.planned)
  if (!L) throw new LocalError(400, 'unknown language')
  const files = packFiles(id)
  onProgress?.(0, files.length)
  for (let i = 0; i < files.length; i++) { await file(files[i]!); onProgress?.(i + 1, files.length) }
  await kv.set(`lang:pack:${id}`, { at: Math.floor(Date.now() / 1000), bytes: PACK_INFO[id]?.bytes ?? 0 })
  await kv.del(`lang:pack-removed:${id}`)
}
/** downloaded languages in registry order; progress from before packs existed counts as a downloaded pack (migrated silently) */
async function getLanguages(): Promise<string[]> {
  const out: string[] = []
  for (const l of LANG_DEFS) {
    if (l.planned) continue
    let pack = await kv.get(`lang:pack:${l.id}`)
    if (!pack && !(await kv.get(`lang:pack-removed:${l.id}`)) && (await kv.list(`lang:card:${l.id}-`)).length + (await kv.list(`lang:rev:${l.id}-`)).length) {
      pack = { at: Math.floor(Date.now() / 1000), bytes: PACK_INFO[l.id]?.bytes ?? 0 }
      await kv.set(`lang:pack:${l.id}`, pack)
    }
    if (pack) out.push(l.id)
  }
  return out
}
/** remove a pack: hides the language, the learning progress stays in kv so adding it again restores it */
async function removePack(id: string) {
  if (!LANG_DEFS.some(l => l.id === id && !l.planned)) throw new LocalError(400, 'unknown language')
  await kv.del(`lang:pack:${id}`)
  await kv.set(`lang:pack-removed:${id}`, 1) // stops the silent migration from bringing it back
  return getLanguages()
}

// --- scheduling ---
const W = 'w:', VP = 'vp:', V = 'v:', G = 'g:'

/** the card key → [what it is made of, the sibling key, is it the write / production card] */
function parts(deck: string, k: string) {
  const def = deckDef(deck)!.def
  if (def.kind === 'grammar') { const base = k.startsWith(G) ? k.slice(G.length) : k; return { base, read: G + base, sib: '', write: false } }
  if (isPlain(def)) { const w = k.startsWith(W); const base = w ? k.slice(W.length) : k; return { base, read: base, sib: W + base, write: w } }
  const w = k.startsWith(VP); const base = k.slice(w ? VP.length : V.length); return { base, read: V + base, sib: VP + base, write: w }
}

function fuzz(ivl: number) {
  if (ivl < 3) return ivl
  const d = Math.max(1, Math.round(ivl * 0.05))
  return ivl - d + Math.floor(Math.random() * (2 * d + 1))
}
const clampIvl = (n: number) => Math.min(MAX_IVL, Math.max(1, Math.round(n)))

/** what each button would do: the card after the answer */
function schedule(c: Card, rating: number, t = now()): Card {
  const n = { ...c, reps: c.reps + 1 }
  const steps = c.state === 'relearning' ? RELEARN : LEARN
  const review = (ivl: number) => Object.assign(n, { state: 'review', step: 0, ivl, due: t + ivl * 86400 })

  if (c.state === 'new' || c.state === 'learning' || c.state === 'relearning') {
    const step = c.state === 'new' ? 0 : c.step
    if (rating === 1) return Object.assign(n, { state: c.state === 'new' ? 'learning' : c.state, step: 0, due: t + steps[0]! })
    if (rating === 2) {
      const wait = step === 0 && steps.length > 1 ? (steps[0]! + steps[1]!) / 2 : steps[step]!
      return Object.assign(n, { state: c.state === 'new' ? 'learning' : c.state, step, due: t + wait })
    }
    if (rating === 3 && step + 1 < steps.length) return Object.assign(n, { state: c.state === 'new' ? 'learning' : c.state, step: step + 1, due: t + steps[step + 1]! })
    if (c.state === 'relearning') return review(rating === 4 ? c.ivl + 1 : c.ivl)
    return review(rating === 4 ? 4 : 1)
  }

  // review
  const late = Math.max(0, dayNum(studyDay(t)) - dayNum(studyDay(c.due)))
  if (rating === 1) {
    return Object.assign(n, { state: 'relearning', step: 0, lapses: c.lapses + 1, ease: Math.max(1.3, c.ease - 0.2), ivl: 1, due: t + RELEARN[0]! })
  }
  const hard = clampIvl(Math.max(c.ivl + 1, c.ivl * 1.2))
  if (rating === 2) { n.ease = Math.max(1.3, c.ease - 0.15); return review(fuzz(hard)) }
  const good = clampIvl(Math.max(hard + 1, (c.ivl + late / 2) * c.ease))
  if (rating === 3) return review(fuzz(good))
  n.ease = c.ease + 0.15
  return review(fuzz(clampIvl(Math.max(good + 1, (c.ivl + late) * c.ease * 1.3))))
}

/** the label under each answer button: "1m", "10m", "4d", "2.1mo" */
function span(c: Card, t: number) {
  const s = c.due - t
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  const d = c.ivl || Math.round(s / 86400)
  if (d < 30) return `${d}d`
  if (d < 365) return `${(d / 30).toFixed(1).replace(/\.0$/, '')}mo`
  return `${(d / 365).toFixed(1).replace(/\.0$/, '')}y`
}

// --- the queue ---
type Data = { cards: Row[], revs: Rev[] }
const loadData = async (deck: string): Promise<Data> => { const [cards, revs] = await Promise.all([allCards(deck), allRevs(deck)]); return { cards, revs } }

async function counts(deck: string, t = now(), data?: Data) {
  await loadItems(deck)
  const kind = deckOrThrow(deck).def.kind, lang = deck.split('-')[0]!
  const day = studyDay(t), s = await getSettings(deck), lesson = await getLangLesson(lang)
  const items = ITEMS.get(deck)!
  const { cards, revs } = data ?? await loadData(deck)
  const seen = new Set(cards.map(c => c.k))
  // the reading card has graduated → its write / production card opens up
  const graduated = new Set(cards.filter(c => c.state === 'review' && !parts(deck, c.k).write).map(c => parts(deck, c.k).base))
  let read: string[] = [], write: string[] = [], suggest: any[] = []
  if (kind === 'kana' || kind === 'kanji') {
    read = items.filter((x: Kanji) => s.levels!.includes(x.n) && !seen.has(x.k)).map((x: Kanji) => x.k)
    write = s.writing ? items.filter((x: Kanji) => graduated.has(x.k) && !seen.has(W + x.k)).map((x: Kanji) => W + x.k) : []
  } else if (kind === 'alpha') { // always available: the letters come before the word packs
    read = items.filter((x: HyItem) => !seen.has(x.id)).map((x: HyItem) => x.id)
    write = s.writing ? items.filter((x: HyItem) => graduated.has(x.id) && !seen.has(W + x.id)).map((x: HyItem) => W + x.id) : []
  } else if (kind === 'vocab') {
    const plain = isPlain(deckOrThrow(deck).def), rk = (id: string) => (plain ? id : V + id), wk = (id: string) => (plain ? W + id : VP + id)
    read = items.filter((x: Vocab) => effLesson(x.l) <= lesson && !seen.has(rk(x.id))).map((x: Vocab) => rk(x.id))
    write = s.production ? items.filter((x: Vocab) => graduated.has(x.id) && !seen.has(wk(x.id))).map((x: Vocab) => wk(x.id)) : []
  }
  const newDone = revs.filter(r => r.day === day && r.was === 'new').length
  const reviewedToday = revs.filter(r => r.day === day && r.was === 'review').length
  // grammar draws no new cards: newPerDay is how many points are suggested (learned = marked by the owner)
  if (kind === 'grammar') {
    const left = Math.max(0, s.newPerDay - newDone)
    suggest = items.filter((x: Point) => effLesson(x.lesson) <= lesson && !seen.has(G + x.id)).slice(0, left)
      .map((x: Point) => ({ id: x.id, title: x.title, lesson: x.lesson }))
  }
  const writeOn = kind === 'vocab' ? !!s.production : kind === 'grammar' ? true : !!s.writing
  const writeOk = (c: Row) => writeOn || !parts(deck, c.k).write
  const learning = cards.filter(c => c.state === 'learning' || c.state === 'relearning')
  const due = cards.filter(c => c.state === 'review' && studyDay(c.due) <= day && writeOk(c))
  const newLeft = Math.min(read.length + write.length, Math.max(0, s.newPerDay - newDone))
  return {
    kind, day, s, lesson, cards, seen, read, write, suggest, newDone, newLeft, due, reviewedToday,
    learnNow: learning.filter(c => c.due <= t && writeOk(c)),
    learnToday: learning.filter(c => studyDay(c.due) <= day && writeOk(c)),
  }
}

/** Anki's order: learning cards that are due, then reviews (with new cards spread among them), then learn-ahead */
async function nextCard(deck: string, t = now(), skip = '') {
  const q = await counts(deck, t)
  const pick = (list: Row[]) => list.filter(c => c.k !== skip).sort((a, b) => a.due - b.due)[0]
  let card: Card | undefined = pick(q.learnNow)
  if (!card) {
    const rev = pick(q.due)
    // one new card every few reviews while both are left, so new cards don't all wait until the end
    const every = q.newLeft ? Math.max(1, Math.floor(q.due.length / q.newLeft)) : 0
    // new reading and new write cards take turns
    const read = q.read.find(k => k !== skip), write = q.write.find(k => k !== skip)
    const nw = !q.newLeft ? undefined : (q.newDone % 2 === 1 && write) || read || write
    if (nw && (!rev || (every && q.reviewedToday % (every + 1) === every))) card = fresh(nw)
    else card = rev
  }
  if (!card) card = pick(q.learnToday.filter(c => c.due <= t + LEARN_AHEAD))
  // the only card left is the one just answered: show it again rather than pretend we're done
  if (!card && skip) { const c = await getCard(deck, skip); if (c && c.state !== 'review' && c.due <= t + LEARN_AHEAD) card = c }

  const summary = {
    new: q.kind === 'grammar' ? 0 : q.newLeft,
    learn: q.learnToday.length,
    review: q.due.length,
    // nothing to show yet but more learning steps later today
    wait: card || !q.learnToday.length ? 0 : Math.max(0, Math.round(Math.min(...q.learnToday.map(c => c.due)) - t)) || 0,
  }
  if (!card) return { card: null, ...summary }
  return { ...payload(deck, card, t, q.seen), ...summary }
}

/** a word to write instead of the lone kanji: every kanji in it must already have a card */
function wordFor(deck: string, k: string, reps: number, seen: Set<string>) {
  if (reps % 3 !== 2) return null
  // kanji cards: its kanji must be known (kana are given); kana cards: every kana in the word must be known
  const x = itemOf(deck, k) as Kanji, kana = x.n >= 6
  const ok = x.w.filter(([form]) => form.length > 1 && [...form].every(c => c === k || !(kana || /[一-鿿々]/.test(c)) || seen.has(c)))
  return ok.length ? ok[Math.floor(reps / 3) % ok.length]! : null
}

function payload(deck: string, card: Card, t: number, seen: Set<string>) {
  const kind = deckOrThrow(deck).def.kind, p = parts(deck, card.k)
  const item = itemOf(deck, p.base)
  const base = { ...item, id: card.k, lang: deck.split('-')[0], deckKind: kind, state: card.state, ivl: card.ivl, reps: card.reps, lapses: card.lapses }
  const out = kind === 'grammar'
    ? { ...base, kind: 'grammar' }
    : kind === 'vocab'
      ? { ...base, kind: p.write ? 'prod' : 'read' }
      : kind === 'alpha'
        ? { ...base, kind: p.write ? 'write' : 'read' }
        : { ...base, kind: p.write ? 'write' : 'read', word: p.write ? wordFor(deck, p.base, card.reps, seen) : null }
  return { card: out, buttons: [1, 2, 3, 4].map(r => span(schedule(card, r, t), t)) }
}

async function known(deck: string, k: string) {
  await loadItems(deck)
  const def = deckOrThrow(deck).def, kind = def.kind
  if (!itemOf(deck, parts(deck, k).base)) throw new LocalError(404, 'no such card')
  // the key must be one of this deck's own forms (a Genki vocab key keeps its v: / vp: prefix, a grammar key g:)
  if ((kind === 'vocab' && !isPlain(def) && !k.startsWith(V) && !k.startsWith(VP)) || (kind === 'grammar' && !k.startsWith(G))) throw new LocalError(404, 'no such card')
}

/** a card with no row yet may only be created if the queue could offer it */
async function offered(deck: string, k: string) {
  const kind = deckOrThrow(deck).def.kind
  const no = () => { throw new LocalError(409, 'that card is not available yet') }
  if (kind === 'grammar') no()
  if (kind !== 'vocab') return
  const p = parts(deck, k), x = itemOf(deck, p.base) as Vocab
  if (p.write) { if ((await getCard(deck, p.read))?.state !== 'review') no() }
  else if (effLesson(x.l) > (await getLangLesson(deck.split('-')[0]!))) no()
}

async function answer(deck: string, k: string, rating: number, secs: number | null) {
  await known(deck, k)
  if (![1, 2, 3, 4].includes(rating)) throw new LocalError(400, 'rating is 1 to 4')
  const t = now()
  const before = await getCard(deck, k)
  if (!before) await offered(deck, k)
  const c = before ?? fresh(k)
  const n = schedule(c, rating, t)
  await kv.set(cardKey(deck, k), { ...n, deck })
  const id = await nextSeq()
  await kv.set(revKey(deck, id), { id, deck, k, ts: t, day: studyDay(t), rating, was: c.state, ivl: n.ivl, secs, prev: before ? cardOnly(before) : null })
  return nextCard(deck, t, k)
}

/** Anki's undo: the deck's last answer is taken back and its card comes up again */
async function undo(deck: string) {
  deckOrThrow(deck)
  const revs = await kv.list<Rev>(`lang:rev:${deck}:`)
  const last = revs[revs.length - 1]
  if (!last) throw new LocalError(400, 'nothing to undo')
  const r = last.value
  if (r.prev) await kv.set(cardKey(deck, r.k), { ...r.prev, deck })
  else await kv.del(cardKey(deck, r.k))
  await kv.del(last.key)
  await loadItems(deck)
  const c = (await getCard(deck, r.k)) ?? fresh(r.k)
  const t = now()
  const seen = new Set((await allCards(deck)).map(x => x.k))
  return { ...(await nextCard(deck, t)), ...payload(deck, c, t, seen) }
}

/** back to new (the history stays for the heatmap); both of a kanji's / word's cards */
async function forget(deck: string, k: string) {
  await loadItems(deck)
  const p = parts(deck, k)
  if (!itemOf(deck, p.base)) throw new LocalError(404, 'no such card')
  await kv.del(cardKey(deck, p.read))
  if (p.sib) await kv.del(cardKey(deck, p.sib))
  return { ok: true }
}

/** Grammar: the owner marks a point learned → its card starts (first review tomorrow); counts toward today's suggestions */
async function grammarLearn(id: string, lang = 'ja') {
  const deck = `${lang}-grammar`, k = G + id
  deckOrThrow(deck)
  await loadItems(deck)
  if (!itemOf(deck, id)) throw new LocalError(404, 'no such grammar point')
  if (await getCard(deck, k)) return { ok: true }
  const item = itemOf(deck, id) as Point
  if (effLesson(item.lesson) > (await getLangLesson(lang))) throw new LocalError(409, `Reach lesson ${effLesson(item.lesson)} first`)
  const t = now()
  await kv.set(cardKey(deck, k), { deck, k, state: 'review', due: t + 86400, ivl: 1, ease: 2.5, step: 0, reps: 1, lapses: 0, added: t })
  const sid = await nextSeq()
  await kv.set(revKey(deck, sid), { id: sid, deck, k, ts: t, day: studyDay(t), rating: 3, was: 'new', ivl: 1, secs: null, prev: null })
  return { ok: true }
}

// --- progress ---
const status = (c: Card) => (c.state === 'review' ? (c.ivl >= 21 ? 3 : 2) : 1) // 0 new, 1 learning, 2 young (< 21 d), 3 mature

async function langOverview(langId: string) {
  const L = LANG_DEFS.find(l => l.id === langId)
  if (!L || L.planned) throw new LocalError(400, 'unknown language')
  await loadLang(L.id)
  const t = now(), day = studyDay(t), lesson = await getLangLesson(L.id)
  const decks: Record<string, any> = {}, levels: Record<string, any[]> = {}, state: Record<string, Record<string, number>> = {}, settings: Record<string, DeckSettings> = {}
  const forecast = Array.from({ length: 14 }, () => 0)
  const allRev: Rev[] = []
  for (const { id, kind } of L.decks) {
    const data = await loadData(id)
    allRev.push(...data.revs)
    const q = await counts(id, t, data), items = ITEMS.get(id)!
    settings[id] = q.s
    const st: Record<string, number> = {}
    for (const c of q.cards) {
      const p = parts(id, c.k)
      if (c.state === 'review') forecast[Math.max(0, Math.min(13, dayNum(studyDay(c.due)) - dayNum(day)))]!++
      if (p.write) continue
      st[p.base] = status(c)
    }
    state[id] = st
    const written = q.cards.filter(c => parts(id, c.k).write && c.state === 'review').length
    decks[id] = {
      kind, new: kind === 'grammar' ? q.suggest.length : q.newLeft, learn: q.learnToday.length, review: q.due.length,
      total: items.length, seen: Object.keys(st).length, mature: Object.values(st).filter(x => x === 3).length, written,
      ...(kind === 'grammar' ? { suggest: q.suggest } : {}),
    }
    if (kind === 'kana' || kind === 'kanji') {
      const lv = (kind === 'kana' ? [6, 7] : [5, 4, 3, 2, 1]).map(n => ({ n, total: 0, seen: 0, mature: 0 }))
      for (const x of items as Kanji[]) lv.find(l => l.n === x.n)!.total++
      for (const [k, s] of Object.entries(st)) { const row = lv.find(r => r.n === (itemOf(id, k) as Kanji | undefined)?.n); if (row) { row.seen++; if (s === 3) row.mature++ } }
      levels[id] = lv
    }
  }
  // Genki lesson progress: words introduced (their reading card exists) and grammar points learned, of the current lesson
  const vId = `${L.id}-vocab`, gId = `${L.id}-grammar`
  const inLesson = (deck: string, key: (x: any) => number) => (ITEMS.get(deck) ?? []).filter(x => effLesson(key(x)) === lesson)
  const vw = inLesson(vId, (x: Vocab) => x.l), gp = inLesson(gId, (x: Point) => x.lesson)
  const lessonInfo = {
    n: lesson, max: maxLesson(L.id),
    words: { introduced: vw.filter((x: Vocab) => state[vId]?.[x.id] != null).length, total: vw.length },
    grammar: { learned: gp.filter((x: Point) => state[gId]?.[x.id] != null).length, total: gp.length },
  }
  // activity across the language's decks
  const byDay = new Map<string, { day: string, n: number, ok: number, secs: number }>()
  for (const r of allRev) {
    const d = byDay.get(r.day) ?? { day: r.day, n: 0, ok: 0, secs: 0 }
    d.n++; if (r.rating > 1) d.ok++; d.secs += r.secs ?? 0
    byDay.set(r.day, d)
  }
  const days = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))
  const since = dayNum(day) - 182
  const heat: Record<string, number> = {}
  for (const d of days) if (dayNum(d.day) >= since) heat[d.day] = d.n
  let streak = 0
  for (let d = dayNum(day) - (heat[day] ? 0 : 1); ; d--) {
    const s = new Date(d * 86_400_000).toISOString().slice(0, 10)
    if (!byDay.has(s)) break
    streak++
  }
  const month = allRev.filter(r => r.was === 'review' && r.ts > t - 30 * 86400)
  const monthOk = month.filter(r => r.rating > 1).length
  const today = byDay.get(day)
  const speech: Record<string, boolean> = {}
  for (const l of LANG_DEFS) speech[l.id] = await speechOk(l.id)
  return {
    languages: publicLangs().map(l => ({ ...l, speech: speech[l.id] })), enabled: await getLanguages(), due: await dueByLang(t),
    lang: L.id, day, lesson: lessonInfo, settings: { lesson, decks: settings },
    decks, levels, status: state, heat, streak, forecast,
    retention: month.length ? Math.round((100 * monthOk) / month.length) : null,
    today: { reviews: today?.n ?? 0, mins: Math.round((today?.secs ?? 0) / 60) },
    total: { reviews: days.reduce((s, d) => s + d.n, 0) },
  }
}

/** the cards waiting today in every language the owner learns (the Today tab's "All languages" line) */
async function dueByLang(t: number) {
  const out: Record<string, number> = {}
  for (const id of await getLanguages()) {
    const L = LANG_DEFS.find(l => l.id === id)!
    let n = 0
    for (const d of L.decks) { const q = await counts(d.id, t); n += q.learnToday.length + q.due.length + (d.kind === 'grammar' ? 0 : q.newLeft) }
    out[id] = n
  }
  return out
}

async function cardInfo(deck: string, k: string) {
  await loadItems(deck)
  const p = parts(deck, k)
  const x = itemOf(deck, p.base)
  if (!x) throw new LocalError(404, 'no such card')
  const info = (c?: Row) => c ? { state: c.state, ivl: c.ivl, ease: Math.round(c.ease * 100), reps: c.reps, lapses: c.lapses, due: c.due } : null
  const keys = [p.read, p.sib || p.read]
  const hist = (await allRevs(deck)).filter(r => keys.includes(r.k)).reverse().slice(0, 20)
    .map(r => ({ ts: r.ts, rating: r.rating, ivl: r.ivl, w: r.k.startsWith('w:') || r.k.startsWith('vp:') ? 1 : 0 }))
  return { ...x, card: info(await getCard(deck, p.read)), write: p.sib ? info(await getCard(deck, p.sib)) : null, history: hist }
}

/** the grammar page: every point with how its card is doing */
async function langGrammar(langId: string) {
  const deck = `${langId}-grammar`
  deckOrThrow(deck)
  const points = await loadItems(deck)
  const st: Record<string, any> = {}
  for (const c of await allCards(deck)) st[parts(deck, c.k).base] = { state: c.state, ivl: c.ivl, due: c.due, mature: c.ivl >= 21 }
  return { lesson: await getLangLesson(langId), points, status: st }
}

// --- routes ---
/** which languages are downloaded (no data is loaded: the picker and a first visit use this) */
defineLocal('GET', '/api/lang/packs', async () => ({
  languages: LANG_DEFS.filter(l => !l.planned).map(l => ({ id: l.id, name: l.name, native: l.native })),
  downloaded: await getLanguages(),
}))

defineLocal('GET', '/api/lang', ({ query }) => langOverview(String(query.l ?? 'ja').slice(0, 8)))

defineLocal('GET', '/api/lang/next', async ({ query }) => nextCard(deckOrThrow(query.deck).def.id))

defineLocal('GET', '/api/lang/card', ({ query }) => cardInfo(deckOrThrow(query.deck).def.id, String(query.k ?? '').slice(0, 64)))

defineLocal('GET', '/api/lang/grammar', ({ query }) => langGrammar(String(query.l ?? 'ja').slice(0, 8)))

/** a deck's static data: the browse grids and lists work on it in the page */
defineLocal('GET', '/api/lang/deck', async ({ query }) => {
  const { def } = deckOrThrow(query.deck)
  const items = await loadItems(def.id)
  // grammar is read through /api/lang/grammar (with the learned state); here only its outline
  if (def.kind === 'grammar') return items.map((p: any) => ({ id: p.id, lesson: p.lesson, title: p.title, summary: p.summary }))
  return items
})

const ACTIONS = ['answer', 'undo', 'forget', 'settings', 'grammar-learn', 'lesson', 'remove-pack']
defineLocal('POST', '/api/lang/action', async ({ body }) => {
  body = body ?? {}
  const action = String(body.action ?? '').slice(0, 20)
  if (!ACTIONS.includes(action)) throw new LocalError(400, `unknown action: ${action}`)
  if (action === 'lesson') {
    const lang = String(body.lang ?? 'ja').slice(0, 8)
    await loadLang(lang)
    return { lesson: await putLangLesson(lang, body.delta != null ? (await getLangLesson(lang)) + Math.round(Number(body.delta) || 0) : Number(body.lesson)) }
  }
  if (action === 'remove-pack') return { languages: await removePack(String(body.id ?? '').slice(0, 8)) }
  if (action === 'grammar-learn') return grammarLearn(String(body.k ?? '').replace(/^g:/, '').slice(0, 60), String(body.lang ?? 'ja').slice(0, 8))
  const deck = deckOrThrow(body.deck).def.id
  if (action === 'undo') return undo(deck)
  if (action === 'settings') {
    return putSettings(deck, {
      ...(body.newPerDay != null ? { newPerDay: Number(body.newPerDay) || 0 } : {}),
      ...(Array.isArray(body.levels) ? { levels: body.levels.slice(0, 7) } : {}),
      ...(body.writing != null ? { writing: body.writing === true } : {}),
      ...(body.furigana != null ? { furigana: body.furigana === 'always' ? 'always' : 'after' } : {}),
      ...(body.production != null ? { production: body.production === true } : {}),
    })
  }
  // a card key: the kanji / kana (`w:` + it for the write card), `v:<id>` / `vp:<id>` for vocabulary, `g:<id>` for grammar
  const k = String(body.k ?? '').slice(0, 64)
  if (action === 'forget') return forget(deck, k)
  const secs = Number(body.secs)
  return answer(deck, k, Math.round(Number(body.rating)), secs > 0 && secs < 3600 ? Math.round(secs * 10) / 10 : null)
})

// --- kanji stroke order: KanjiVG (CC BY-SA 3.0), fetched from the CDN by the browser and kept in kv ---
const NUM = /^-?\d+(\.\d+)?$/
defineLocal('GET', '/api/lang/strokes', async ({ query }) => {
  const k = String(query.k ?? '')
  if (!k || [...k].length !== 1) throw new LocalError(404, 'no such kanji')
  const cached = await kv.get(`lang:strokes:${k}`)
  if (cached) return cached
  const hex = k.codePointAt(0)!.toString(16).padStart(5, '0')
  const get = (url: string) => fetch(url, { signal: AbortSignal.timeout(8000) }).catch(() => null)
  let r = await get(`https://cdn.jsdelivr.net/gh/KanjiVG/kanjivg@master/kanji/${hex}.svg`)
  // jsDelivr refuses a few files, GitHub has them all
  if (!r?.ok) r = await get(`https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${hex}.svg`)
  if (!r?.ok) throw new LocalError(404, 'no stroke order for this kanji (offline?)')
  const svg = await r.text()
  const paths = [...svg.matchAll(/<path[^>]*\sd="([MmCcSsLlHhVvZz0-9.,\s-]+)"/g)].map(m => m[1]!.trim())
  const nums = [...svg.matchAll(/<text[^>]*transform="matrix\(1 0 0 1 ([\d.-]+) ([\d.-]+)\)"[^>]*>(\d+)<\/text>/g)]
    .filter(m => NUM.test(m[1]!) && NUM.test(m[2]!)).map(m => [Number(m[1]), Number(m[2]), Number(m[3])])
  if (!paths.length) throw new LocalError(502, 'unreadable stroke data')
  const out = { paths, nums }
  await kv.set(`lang:strokes:${k}`, out)
  return out
})
