/** on'yomi are written in katakana, like in every dictionary */
export const kata = (s: string) => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))

/** "ひと.つ" → stem + okurigana, "-び" → suffix marker kept */
export function kun(r: string) {
  const [stem, oku = ''] = r.split('.')
  return { stem: stem!, oku }
}

// 0 new, 1 learning, 2 young, 3 mature (server: overview().status)
export const STATUS = ['New', 'Learning', 'Young', 'Mature'] as const

/** 6 = hiragana, 7 = katakana (the deck's kana cards: romaji as the meaning, no readings) */
export const LEVELS = [5, 4, 3, 2, 1, 6, 7] as const
export const lvName = (n: number) => (n === 6 ? 'Hiragana' : n === 7 ? 'Katakana' : `N${n}`)
export const isKana = (n: number) => n >= 6

export type KanjiCard = { k: string, n: number, s: number, m: string[], on: string[], kun: string[], w: [string, string, string][] }

export type VocabItem = { id: string, l: number, cat: string, ja: string, r: string, ru?: [string, string | null][], en: string }
/** an Armenian / Russian letter or word: `en` is a list; l = word pack (0 for letters); f = the display form (hy / ru field, Russian
 *  with stress marks U+0301) */
export type HyItem = { id: string, t: 'l' | 'w', g: number, l: number, f: string, hy?: string, tr: string, en: string[], cat: string, ex: [string, string, string] | null }
/** the card key of a vocabulary item: Genki words keep their v: prefix, plain decks (Armenian, Russian) use the word itself */
export const vocabKey = (deck: string, id: string) => (deck.startsWith('ja-') ? `v:${id}` : id)
export type Exercise = { type: 'choice' | 'fill' | 'order', q: string, options?: string[], a: number | string | string[], tokens?: string[], why?: string }
export type GrammarPoint = { id: string, lesson: number, title: string, summary: string, explain: string, examples: { t: string, en: string, tr?: string }[], exercises: Exercise[] }

/** a deck's static data: fetched once per app load */
export function useLangDeck<T = KanjiCard>(deck: string) {
  const d = useState<T[] | null>(`lang:deck:${deck}`, () => null)
  if (!d.value && import.meta.client) $fetch<T[]>('/api/lang/deck', { query: { deck } }).then(x => (d.value = x)).catch(() => {})
  return d
}

/** Genki lesson 0 (greetings) counts as part of lesson 1 */
export const effLesson = (l: number) => Math.max(l, 1)

export type Strokes = { paths: string[], nums: number[][] }
/** stroke data per kanji, kept for the app's lifetime so the pad never waits twice for the same kanji */
const STROKES = new Map<string, Strokes>()
const PENDING = new Map<string, Promise<Strokes>>()
export const cachedStrokes = (k: string) => STROKES.get(k) ?? null
/** one retry: an app rebuild briefly answers 502 */
export function loadStrokes(k: string): Promise<Strokes> {
  if (STROKES.has(k)) return Promise.resolve(STROKES.get(k)!)
  if (!PENDING.has(k)) {
    const get = () => $fetch<Strokes>('/api/lang/strokes', { query: { k } })
    PENDING.set(k, get().catch(() => new Promise(r => setTimeout(r, 1500)).then(get))
      .then((d) => { STROKES.set(k, d); return d })
      .finally(() => PENDING.delete(k)))
  }
  return PENDING.get(k)!
}
/** warm the cache for every kanji in a word (the pad moves on without a Loading… between them) */
export const prefetchStrokes = (s: string) => { for (const c of new Set(s)) if (/[一-鿿ぁ-ゟァ-ヿ]/.test(c) && c !== 'ー') loadStrokes(c).catch(() => {}) }

/** the card's main reading as kana to read out: first on-yomi, else first kun-yomi, without the . and - */
export const kjMain = (c: Pick<KanjiCard, 'on' | 'kun'> & { k?: string, n?: number }) => (c.n && c.n >= 6 ? c.k! : (c.on[0] ?? c.kun[0] ?? '')).replace(/[.-]/g, '')

// read-out audio: the browser's own speech synthesis (offline, no server); one clip at a time
type SpeakState = 'idle' | 'load' | 'play' | 'err'
const spk = reactive({ key: '', st: 'idle' as SpeakState })
/** can the language on screen be read out? (the page sets it from /api/lang; false hides the speaker buttons) */
export const useLangSpeech = () => useState<boolean>('lang:speech', () => true)
export const langSpeakState = (text: string): SpeakState => (spk.key === text ? spk.st : 'idle')
/** the voice language of a text, by its script */
const voiceLang = (t: string) => (/[\u0530-\u058F]/.test(t) ? 'hy-AM' : /[\u0400-\u04FF]/.test(t) ? 'ru-RU' : 'ja-JP')
export function langSpeak(text: string) {
  if (!import.meta.client || !text || !('speechSynthesis' in window)) return
  const was = spk.key === text && (spk.st === 'play' || spk.st === 'load')
  speechSynthesis.cancel()
  spk.key = ''; spk.st = 'idle'
  if (was) return
  const lang = voiceLang(text)
  const u = new SpeechSynthesisUtterance(text.normalize('NFC').replace(/\u0301/g, ''))
  u.lang = lang
  const v = speechSynthesis.getVoices().find(x => x.lang.replace('_', '-').toLowerCase() === lang.toLowerCase())
    ?? speechSynthesis.getVoices().find(x => x.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()))
  if (v) u.voice = v
  spk.key = text; spk.st = 'load'
  u.onstart = () => { if (spk.key === text) spk.st = 'play' }
  u.onend = () => { if (spk.key === text) { spk.key = ''; spk.st = 'idle' } }
  u.onerror = () => { if (spk.key === text) { spk.key = ''; spk.st = 'idle' } } // a missing voice is silent, not an error
  speechSynthesis.speak(u)
}
