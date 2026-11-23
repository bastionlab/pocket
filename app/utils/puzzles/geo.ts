import { COUNTRIES, CONTINENTS, EASY_POOL, TARGET_POOL, bearing, coastKind, distanceKm, drivingSide, fmtPopExact, isLandlocked, type Country } from './countries'
import { rngFor, type Rng } from './rng'

/** Pure logic of the geography games. */
export type CwLevel = 'easy' | 'medium' | 'hard'
/** Country Wordle: the day's answer. Medium keeps the original seed (and pool), the other levels draw their own */
export const countryWordleTarget = (day: string, level: CwLevel = 'medium'): Country =>
  level === 'medium' ? rngFor('country-wordle', day).pick(TARGET_POOL) : rngFor(`country-wordle:${level}`, day).pick(level === 'easy' ? EASY_POOL : COUNTRIES)
/** guesses allowed per level */
export const CW_MAX: Record<CwLevel, number> = { easy: 8, medium: 6, hard: 6 }
/** saved-state key: the plain one for medium so earlier saves keep working */
export const cwStateKey = (level: CwLevel) => (level === 'medium' ? 'country-wordle' : `country-wordle:${level}`)
export const flaggleTarget = (day: string): Country => rngFor('flaggle', day).pick(TARGET_POOL)
/** Shape Guess: the day's country among the ones that have a silhouette (`codes` = the keys of SHAPES, kept out of here so the data is only loaded by the game) */
export function shapeTarget(day: string, codes: readonly string[]): Country {
  const ok = new Set(codes)
  return rngFor('shape-guess', day).pick(COUNTRIES.filter(c => ok.has(c.code)))
}

export type Tone = 'ok' | 'warn' | 'bad'

/** how a guess relates to the answer: what Country Wordle and Flaggle show per guess row */
export interface GuessInfo {
  same: boolean
  km: number
  /** compass bearing from the guess to the answer (0 = north, 90 = east) */
  deg: number
  kmTone: Tone
  cont: boolean
  /** does the answer have more / fewer people than the guess */
  pop: 'same' | 'higher' | 'lower'
  popTone: Tone
}

/** green within 1,500 km (a neighbour or so), yellow within 4,000 km, red beyond */
export const kmTone = (km: number): Tone => (km <= 1500 ? 'ok' : km <= 4000 ? 'warn' : 'bad')
/** green when both have about as many people (within 1.5x), yellow within 4x, red beyond */
export function popTone(a: number, b: number): Tone {
  const r = Math.max(a, b) / Math.min(a, b)
  return r <= 1.5 ? 'ok' : r <= 4 ? 'warn' : 'bad'
}

export function compareGuess(guess: Country, target: Country): GuessInfo {
  const km = distanceKm(guess, target)
  const same = guess.code === target.code
  return {
    same, km, deg: bearing(guess, target), kmTone: same ? 'ok' : kmTone(km), cont: guess.cont === target.cont,
    pop: guess.pop === target.pop ? 'same' : target.pop > guess.pop ? 'higher' : 'lower', popTone: same ? 'ok' : popTone(guess.pop, target.pop),
  }
}

/** Country Wordle tiles, in display order */
export type CwTile = 'dist' | 'sub' | 'border' | 'pop' | 'area' | 'land'
export const CW_TILES: readonly CwTile[] = ['dist', 'sub', 'border', 'pop', 'area', 'land']
export type CwTone = 'ok' | 'warn' | 'no'
export interface CwInfo {
  same: boolean
  km: number
  deg: number
  tone: Record<CwTile, CwTone>
  /** does the answer have more / fewer people (area) than the guess */
  pop: 'same' | 'higher' | 'lower'
  area: 'same' | 'higher' | 'lower'
  border: boolean
  land: boolean
}
/** green within 1.25x, yellow within 2x */
const ratioTone = (a: number, b: number): CwTone => { const r = Math.max(a, b) / Math.min(a, b); return r <= 1.25 ? 'ok' : r <= 2 ? 'warn' : 'no' }
const cmp = (g: number, t: number): 'same' | 'higher' | 'lower' => (g === t ? 'same' : t > g ? 'higher' : 'lower')

/** what each tile says about a guess: green = same as the answer, yellow = close (within 2,000 km, same continent, within 2x), grey = not */
export function compareCw(g: Country, t: Country): CwInfo {
  const same = g.code === t.code
  const km = distanceKm(g, t)
  const border = same || g.borders.includes(t.code)
  const land = isLandlocked(g) === isLandlocked(t)
  return {
    same, km, deg: bearing(g, t), pop: cmp(g.pop, t.pop), area: cmp(g.area, t.area), border, land,
    tone: {
      dist: same || km <= 1000 ? 'ok' : km < 2000 ? 'warn' : 'no',
      sub: g.sub === t.sub ? 'ok' : g.cont === t.cont ? 'warn' : 'no',
      border: border ? 'ok' : 'no',
      pop: ratioTone(g.pop, t.pop),
      area: ratioTone(g.area, t.area),
      land: land ? 'ok' : 'no',
    },
  }
}

/** the share-text square for a tone */
export const toneSquare = (t: Tone, sq: Record<string, string>) => (t === 'ok' ? sq.g : t === 'warn' ? sq.y : sq.r)

/** pick up to `n` from the pool without repeats, likelier for a higher weight, at most `per` from one continent */
function spread(rng: Rng, pool: readonly Country[], n: number, weight: (c: Country) => number = () => 1, per = 2): Country[] {
  const left = [...pool], out: Country[] = [], seen: Record<string, number> = {}
  while (out.length < n && left.length) {
    const ok = left.filter(c => (seen[c.cont] ?? 0) < per)
    if (!ok.length) break
    let r = rng.next() * ok.reduce((s, c) => s + weight(c), 0)
    let pick = ok[ok.length - 1]!
    for (const c of ok) { r -= weight(c); if (r < 0) { pick = c; break } }
    left.splice(left.indexOf(pick), 1)
    seen[pick.cont] = (seen[pick.cont] ?? 0) + 1
    out.push(pick)
  }
  return out
}

/** countries everybody can place: asked rarely, so the rounds are not won by the big names */
const FAMOUS = new Set('US CN IN RU BR DE GB FR JP IT ES CA AU MX EG GR'.split(' '))
/** medium countries most often, giants and the famous seldom */
const mediumWeight = (c: Country) => (FAMOUS.has(c.code) ? 0.1 : c.pop >= 100 ? 0.35 : c.pop >= 4 && c.pop < 40 ? 1.7 : 1)

/** a capital the owner of the data is not sure to call "the" capital (two seats, disputed): never asked */
const CAPITAL_AMBIGUOUS = new Set('LK IL BO NL'.split(' '))
/** the best-known city that is NOT the capital: a tempting wrong option */
const FOIL: Record<string, string> = {
  AU: 'Sydney', TR: 'Istanbul', BR: 'São Paulo', CA: 'Toronto', CH: 'Zurich', NZ: 'Auckland', ZA: 'Johannesburg', NG: 'Lagos',
  MM: 'Yangon', TZ: 'Dar es Salaam', CI: 'Abidjan', KZ: 'Almaty', MA: 'Casablanca', PK: 'Karachi', IN: 'Mumbai', CN: 'Shanghai',
  US: 'New York', VN: 'Ho Chi Minh City', SA: 'Jeddah', EC: 'Guayaquil', CM: 'Douala', BJ: 'Cotonou', SD: 'Omdurman', MG: 'Toamasina',
}

export interface CapitalQ { country: string, code: string, answer: string, options: string[] }
/**
 * six questions: "Capital of X?" with four capitals to pick from. Mostly lesser-known capitals (the famous ones are rare), and where
 * the biggest city is not the capital it is one of the wrong options (Sydney for Australia). Three options come from the same
 * continent where possible. Countries whose capital carries their name (Singapore, Djibouti) give it away and are skipped.
 */
export function capitalQuiz(day: string): CapitalQ[] {
  const rng = rngFor('capital-quiz', day)
  const asked = TARGET_POOL.filter(c => !CAPITAL_AMBIGUOUS.has(c.code) && !c.capital.toLowerCase().startsWith(c.name.toLowerCase()) && !c.name.toLowerCase().startsWith(c.capital.toLowerCase()))
  return spread(rng, asked, 6, c => (FAMOUS.has(c.code) ? 0.12 : 1)).map((c) => {
    const ok = (o: Country) => o.capital !== c.capital && !o.capital.toLowerCase().includes(c.name.toLowerCase())
    const same = rng.shuffle(COUNTRIES.filter(o => o.cont === c.cont && ok(o)))
    const other = rng.shuffle(COUNTRIES.filter(o => o.cont !== c.cont && ok(o)))
    const pool = [...new Set([...same, ...other].map(o => o.capital))]
    const foil = FOIL[c.code]
    const wrong = [...(foil && foil !== c.capital ? [foil] : []), ...pool].slice(0, 3)
    return { country: c.name, code: c.code, answer: c.capital, options: rng.shuffle([c.capital, ...wrong]) }
  })
}

export type FactKey = 'cont' | 'pop' | 'coast' | 'drive' | 'lang' | 'cap'
export interface Fact { k: FactKey, v: string }

/** what is known about a country, vaguest first (the last one nearly gives it away); the population reads like a real figure */
export function factsOf(c: Country): Fact[] {
  const kind = coastKind(c)
  return [
    { k: 'cont', v: CONTINENTS[c.cont] },
    { k: 'pop', v: fmtPopExact(c.pop) },
    { k: 'coast', v: kind === 'landlocked' ? 'Landlocked' : kind === 'island' ? 'Island nation' : 'Has a sea coast' },
    { k: 'drive', v: drivingSide(c) === 'left' ? 'Left' : 'Right' },
    { k: 'lang', v: c.lang },
    { k: 'cap', v: c.capital[0] },
  ]
}

/** how many of the five "category" facts two countries share (population aside) */
const alike = (a: Country, b: Country) => {
  const fa = factsOf(a), fb = factsOf(b)
  return fa.filter((f, i) => i !== 1 && f.v === fb[i]!.v).length
}
/** could this country still be the answer once every fact is known: same in all categories and a population within a quarter */
const consistent = (a: Country, b: Country) => alike(a, b) === 5 && Math.max(a.pop, b.pop) / Math.min(a.pop, b.pop) <= 1.25

export interface FactsRound { code: string, name: string, facts: Fact[], options: string[] }
/**
 * five rounds: facts one by one and four countries. Targets lean to medium-sized countries (not the giants). The wrong ones
 * look a lot like the right one (same continent, similar size, as many shared facts as possible) but none of them is
 * consistent with all six facts, so the full list always points at exactly one of the four.
 */
export function factsQuiz(day: string): FactsRound[] {
  const rng = rngFor('outline-guess', day)
  return spread(rng, TARGET_POOL, 5, mediumWeight).map((c) => {
    const ratio = (o: Country) => Math.max(o.pop, c.pop) / Math.min(o.pop, c.pop)
    const score = (o: Country) => alike(c, o) + (ratio(o) < 3 ? 1 : 0) + (o.cont === c.cont ? 1 : 0) + rng.next() * 2.5
    const wrong = TARGET_POOL.filter(o => o.code !== c.code && !consistent(c, o)).map(o => ({ o, s: score(o) })).sort((a, b) => b.s - a.s).slice(0, 3)
    return { code: c.code, name: c.name, facts: factsOf(c), options: rng.shuffle([c.name, ...wrong.map(w => w.o.name)]) }
  })
}

/** points for a right answer after `used` facts: 6 for the first fact alone down to 1 with all six; a wrong answer scores 0 */
export const factsPoints = (used: number, right: boolean) => (right ? Math.max(0, 7 - used) : 0)
/** the day counts as solved from this many points (of 30) */
export const FACTS_PASS = 15
