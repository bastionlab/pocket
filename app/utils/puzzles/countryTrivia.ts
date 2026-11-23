import { COUNTRIES, CONTINENTS, byCode, distanceKm, fmtPopExact, type Country } from './countries'
import { rngFor, type Rng } from './rng'

/**
 * Country Shape journey: after the silhouette the day's country is asked about in multiple-choice rounds (flag, population,
 * capital, export, import, currency or language, neighbour or continent). Pure logic, no network.
 *
 * Trade goods are the usual top product groups of recent years (OEC / World Bank style), named in plain words. Only facts I am
 * sure of are in the table; a country without a row is never the day's country. `also` = goods that are important too but
 * not in the top three: they are never used as a wrong option, so a wrong option is never secretly right.
 */
const TABLE = `
US|US dollar|English|Refined petroleum,Crude oil,Petroleum gas|Cars,Phones,Computers|9834|CA MX|Aircraft,Medicines,Machinery,Corn,Soybeans,Gold,Semiconductors,Electronics,Chemicals,Coal|The US has the largest economy in the world by nominal GDP.
CN|Renminbi (yuan)|Mandarin Chinese|Phones,Computers,Machinery|Crude oil,Semiconductors,Iron ore|9597|RU IN KP MN KZ KG TJ AF PK NP BT MM LA VN|Electronics,Clothing,Textiles,Plastics,Steel,Soybeans,Coal,Petroleum gas,Copper,Cars|China uses a single time zone for the whole country.
IN|Indian rupee|Hindi,English|Refined petroleum,Diamonds,Medicines|Crude oil,Gold,Coal|3287|PK CN NP BT BD MM|Rice,Textiles,Clothing,Phones,Cars,Petroleum gas,Machinery,Chemicals|India has 22 officially recognised languages.
BR|Brazilian real|Portuguese|Soybeans,Iron ore,Crude oil|Refined petroleum,Car parts,Chemicals|8516|AR UY PY BO PE CO VE|Coffee,Beef,Meat,Sugar,Corn,Cars,Aircraft,Cotton,Timber,Paper,Steel,Machinery,Medicines|Brazil is the world's largest coffee producer.
RU|Russian rouble|Russian|Crude oil,Refined petroleum,Petroleum gas|Machinery,Cars,Medicines|17098|NO FI EE LV LT PL BY UA GE AZ KZ CN MN KP|Coal,Wheat,Gold,Steel,Aluminium,Fertilizers,Diamonds,Timber,Electronics,Phones,Computers,Chemicals|Russia spans 11 time zones.
JP|Japanese yen|Japanese|Cars,Car parts,Machinery|Crude oil,Petroleum gas,Coal|378||Semiconductors,Electronics,Steel,Plastics,Medicines,Phones,Computers,Refined petroleum,Chemicals|Japan consists of around 6,800 islands.
DE|Euro|German|Cars,Machinery,Medicines|Cars,Car parts,Petroleum gas|358|DK PL CZ AT CH FR LU BE NL|Aircraft,Electronics,Computers,Phones,Crude oil,Chemicals,Plastics,Steel,Refined petroleum,Machinery|Germany borders nine other countries.
GB|Pound sterling|English|Gold,Cars,Medicines|Cars,Gold,Petroleum gas|244|IE|Crude oil,Machinery,Aircraft,Refined petroleum,Computers,Phones,Diamonds,Chemicals|The UK has no single written constitution.
FR|Euro|French|Aircraft,Medicines,Cars|Cars,Crude oil,Petroleum gas|644|BE LU DE CH IT ES AD MC|Wine,Machinery,Cosmetics,Chemicals,Electronics,Refined petroleum,Phones,Computers,Plastics|France is the most visited country in the world.
IT|Euro|Italian|Medicines,Cars,Machinery|Crude oil,Petroleum gas,Cars|301|FR CH AT SI SM VA|Wine,Clothing,Furniture,Jewellery,Refined petroleum,Electronics,Chemicals,Plastics,Steel,Medicines|Two independent states lie inside Italy: San Marino and the Vatican.
ES|Euro|Spanish|Cars,Meat,Refined petroleum|Crude oil,Cars,Petroleum gas|506|PT FR AD|Fruit,Vegetables,Wine,Medicines,Machinery,Fish,Olive oil,Electronics,Chemicals,Plastics|Spain is the world's biggest producer of olive oil.
CA|Canadian dollar|English,French|Crude oil,Cars,Gold|Cars,Car parts,Machinery|9985|US|Refined petroleum,Petroleum gas,Coal,Timber,Aircraft,Wheat,Aluminium,Phones,Computers,Electronics,Medicines,Plastics|Canada has the longest coastline of any country.
AU|Australian dollar|English|Iron ore,Coal,Petroleum gas|Cars,Refined petroleum,Phones|7692||Gold,Wheat,Beef,Meat,Wine,Copper,Aluminium,Machinery,Computers,Medicines,Crude oil|Australia is the world's largest producer of iron ore.
MX|Mexican peso|Spanish|Cars,Computers,Car parts|Car parts,Refined petroleum,Electronics|1964|US GT BZ|Crude oil,Phones,Machinery,Semiconductors,Beer,Vegetables,Fruit,Plastics,Steel,Medicines,Chemicals|Mexico City stands on the site of the Aztec capital Tenochtitlan.
AR|Argentine peso|Spanish|Soybeans,Corn,Cars|Cars,Car parts,Petroleum gas|2780|CL BO PY BR UY|Beef,Meat,Wheat,Gold,Wine,Machinery,Chemicals,Phones,Crude oil,Refined petroleum,Medicines,Plastics|Aconcagua in Argentina is the highest mountain in the Americas.
CO|Colombian peso|Spanish|Crude oil,Coal,Coffee|Refined petroleum,Phones,Medicines|1142|VE BR PE EC PA|Gold,Flowers,Bananas,Cars,Machinery,Chemicals,Plastics,Computers,Corn,Wheat|Colombia has coasts on both the Pacific and the Caribbean.
PE|Peruvian sol|Spanish,Quechua|Copper,Gold,Fruit|Refined petroleum,Cars,Phones|1285|EC CO BR BO CL|Fish,Zinc,Crude oil,Petroleum gas,Coffee,Machinery,Wheat,Corn,Chemicals,Plastics,Computers|Machu Picchu was built by the Inca in the 15th century.
CL|Chilean peso|Spanish|Copper,Fruit,Fish|Refined petroleum,Cars,Crude oil|756|PE BO AR|Wine,Timber,Paper,Gold,Machinery,Phones,Chemicals,Plastics,Meat,Computers,Iron ore|Chile is the world's largest copper producer.
EC|US dollar|Spanish|Crude oil,Shrimp,Bananas|Refined petroleum,Cars,Medicines|284|CO PE|Fish,Flowers,Cocoa,Machinery,Chemicals,Plastics,Phones,Computers,Coffee,Gold|Ecuador uses the US dollar as its currency.
BO|Boliviano|Spanish,Quechua,Aymara|Gold,Natural gas,Soybeans|Refined petroleum,Cars,Machinery|1099|BR PY AR CL PE|Zinc,Crude oil,Petroleum gas,Silver,Tin,Chemicals,Plastics,Phones,Computers,Wheat,Medicines|Bolivia has two capital cities, La Paz and Sucre.
UY|Uruguayan peso|Spanish|Beef,Soybeans,Paper|Crude oil,Cars,Phones|176|AR BR|Dairy,Meat,Wheat,Rice,Timber,Machinery,Chemicals,Plastics,Medicines,Computers,Electronics,Refined petroleum|Uruguay was the first country to fully legalise cannabis, in 2013.
PY|Guarani|Spanish,Guarani|Soybeans,Beef,Electricity|Refined petroleum,Cars,Machinery|407|BO BR AR|Meat,Corn,Wheat,Chemicals,Plastics,Phones,Computers,Medicines,Crude oil,Electronics|Paraguay makes almost all of its electricity from hydropower.
PL|Polish zloty|Polish|Car parts,Machinery,Furniture|Crude oil,Car parts,Machinery|313|DE CZ SK UA BY LT RU|Cars,Computers,Electronics,Meat,Phones,Chemicals,Plastics,Steel,Petroleum gas,Coal,Refined petroleum|Marie Curie was born in Warsaw.
UA|Hryvnia|Ukrainian|Corn,Wheat,Sunflower oil|Cars,Refined petroleum,Medicines|604|PL SK HU RO MD BY RU|Iron ore,Steel,Machinery,Electricity,Petroleum gas,Coal,Chemicals,Plastics,Phones,Computers|Ukraine is one of the biggest exporters of sunflower oil.
RO|Romanian leu|Romanian|Cars,Car parts,Machinery|Cars,Medicines,Car parts|238|UA MD HU RS BG|Electronics,Computers,Phones,Timber,Furniture,Crude oil,Petroleum gas,Chemicals,Plastics,Refined petroleum,Steel|Romania's Palace of the Parliament is one of the largest administrative buildings in the world.
NL|Euro|Dutch|Refined petroleum,Machinery,Flowers|Crude oil,Computers,Petroleum gas|42|BE DE|Medicines,Chemicals,Cars,Electronics,Phones,Dairy,Vegetables,Fruit,Meat,Plastics,Semiconductors|About a quarter of the Netherlands lies below sea level.
BE|Euro|Dutch,French,German|Cars,Medicines,Refined petroleum|Cars,Crude oil,Medicines|31|NL DE LU FR|Chemicals,Machinery,Diamonds,Plastics,Petroleum gas,Electronics,Phones,Computers,Steel,Aircraft|Belgium has three official languages.
GR|Euro|Greek|Refined petroleum,Medicines,Olive oil|Crude oil,Refined petroleum,Cars|132|AL MK BG TR|Fruit,Aluminium,Fish,Cotton,Machinery,Chemicals,Plastics,Petroleum gas,Electronics,Phones|Greece has more than 200 inhabited islands.
PT|Euro|Portuguese|Refined petroleum,Car parts,Cork|Crude oil,Cars,Petroleum gas|92|ES|Cars,Clothing,Textiles,Wine,Paper,Timber,Machinery,Electronics,Chemicals,Plastics,Fish|Portugal is the world's largest producer of cork.
SE|Swedish krona|Swedish|Cars,Medicines,Paper|Crude oil,Cars,Refined petroleum|450|NO FI|Machinery,Timber,Steel,Iron ore,Telecom equipment,Phones,Electronics,Computers,Chemicals,Plastics,Petroleum gas|Sweden has not been at war since 1814.
CZ|Czech koruna|Czech|Cars,Car parts,Machinery|Car parts,Computers,Crude oil|79|DE PL SK AT|Electronics,Phones,Steel,Plastics,Petroleum gas,Chemicals,Medicines,Furniture,Refined petroleum|Czechia is among the countries that drink the most beer per person.
HU|Hungarian forint|Hungarian|Cars,Car parts,Computers|Car parts,Cars,Petroleum gas|93|AT SK UA RO RS HR SI|Machinery,Electronics,Phones,Medicines,Crude oil,Chemicals,Plastics,Refined petroleum,Semiconductors|Budapest is split by the Danube into Buda and Pest.
AT|Euro|German|Machinery,Cars,Medicines|Cars,Medicines,Petroleum gas|84|DE CZ SK HU SI IT CH LI|Steel,Paper,Electronics,Chemicals,Plastics,Timber,Crude oil,Phones,Computers,Refined petroleum|The Vienna zoo (1752) is the oldest zoo in the world.
CH|Swiss franc|German,French,Italian,Romansh|Gold,Medicines,Watches|Gold,Medicines,Cars|41|DE FR IT AT LI|Machinery,Jewellery,Chemicals,Electronics,Plastics,Phones,Computers,Diamonds,Refined petroleum,Petroleum gas|Switzerland has four national languages.
DK|Danish krone|Danish|Medicines,Meat,Machinery|Cars,Medicines,Computers|43|DE|Fish,Furniture,Electronics,Chemicals,Plastics,Phones,Refined petroleum,Crude oil,Petroleum gas,Dairy,Clothing|LEGO comes from Denmark.
FI|Euro|Finnish,Swedish|Paper,Refined petroleum,Machinery|Crude oil,Cars,Machinery|338|SE NO RU|Timber,Steel,Electronics,Phones,Computers,Chemicals,Plastics,Petroleum gas,Medicines|Finland has nearly 200,000 lakes.
NO|Norwegian krone|Norwegian|Crude oil,Petroleum gas,Fish|Cars,Machinery,Phones|385|SE FI RU|Aluminium,Ships,Metals,Chemicals,Electronics,Computers,Plastics,Steel,Refined petroleum,Medicines|Norway's sovereign wealth fund is among the largest in the world.
NZ|New Zealand dollar|English,Maori|Dairy,Meat,Timber|Cars,Refined petroleum,Machinery|268||Fruit,Wine,Fish,Wool,Crude oil,Phones,Computers,Electronics,Aluminium,Chemicals,Plastics,Medicines|New Zealand was the first country to give women the vote, in 1893.
TR|Turkish lira|Turkish|Cars,Clothing,Machinery|Gold,Petroleum gas,Refined petroleum|784|GR BG GE AM AZ IR IQ SY|Car parts,Textiles,Steel,Electronics,Crude oil,Chemicals,Plastics,Phones,Computers,Medicines,Fruit,Vegetables|Istanbul lies on two continents.
SA|Saudi riyal|Arabic|Crude oil,Refined petroleum,Plastics|Cars,Phones,Machinery|2150|JO IQ KW QA AE OM YE|Petroleum gas,Chemicals,Gold,Electronics,Computers,Medicines,Aircraft,Steel|Saudi Arabia has no permanent rivers.
AE|UAE dirham|Arabic|Crude oil,Gold,Diamonds|Gold,Diamonds,Phones|84|SA OM|Refined petroleum,Petroleum gas,Jewellery,Cars,Aluminium,Aircraft,Electronics,Computers,Machinery,Plastics|Dubai's Burj Khalifa is the tallest building in the world.
IL|Israeli shekel|Hebrew,Arabic|Diamonds,Semiconductors,Medicines|Diamonds,Crude oil,Cars|22|LB SY JO EG|Machinery,Chemicals,Electronics,Computers,Phones,Plastics,Refined petroleum,Aircraft,Fruit|The Dead Sea shore is the lowest dry land on Earth.
PK|Pakistani rupee|Urdu,English|Textiles,Rice,Clothing|Refined petroleum,Crude oil,Petroleum gas|881|IN CN AF IR|Cotton,Leather,Fruit,Vegetables,Meat,Palm oil,Chemicals,Machinery,Phones,Plastics,Steel,Sugar,Wheat|K2, the second-highest mountain on Earth, is in Pakistan.
BD|Bangladeshi taka|Bengali|Clothing,Textiles,Footwear|Cotton,Refined petroleum,Textiles|148|IN MM|Jute,Fish,Machinery,Rice,Wheat,Palm oil,Chemicals,Plastics,Steel,Phones,Electronics|Bangladesh is one of the most densely populated large countries.
TH|Thai baht|Thai|Cars,Computers,Rubber|Crude oil,Semiconductors,Machinery|513|MM LA KH MY|Car parts,Electronics,Rice,Plastics,Chemicals,Gold,Steel,Sugar,Fruit,Fish,Refined petroleum,Phones|Thailand is the only country in Southeast Asia that was never colonised.
VN|Vietnamese dong|Vietnamese|Phones,Computers,Clothing|Semiconductors,Electronics,Machinery|331|CN LA KH|Footwear,Coffee,Rice,Furniture,Fish,Textiles,Steel,Plastics,Chemicals,Crude oil,Refined petroleum|Vietnam is the world's second-largest coffee exporter.
MY|Malaysian ringgit|Malay|Semiconductors,Refined petroleum,Palm oil|Semiconductors,Refined petroleum,Crude oil|331|TH ID BN|Petroleum gas,Rubber,Electronics,Computers,Machinery,Plastics,Chemicals,Phones,Gold,Steel,Timber|The Petronas Towers in Kuala Lumpur were the tallest buildings in the world from 1998 to 2004.
ID|Indonesian rupiah|Indonesian|Coal,Palm oil,Steel|Refined petroleum,Crude oil,Machinery|1905|MY PG TL|Nickel,Petroleum gas,Rubber,Clothing,Textiles,Footwear,Paper,Cars,Phones,Chemicals,Plastics,Gold,Copper,Electronics|Indonesia has more than 17,000 islands.
PH|Philippine peso|Filipino,English|Semiconductors,Computers,Fruit|Refined petroleum,Semiconductors,Cars|300||Bananas,Electronics,Phones,Machinery,Crude oil,Coal,Plastics,Chemicals,Gold,Copper,Steel|The Philippines has more than 7,000 islands.
KR|South Korean won|Korean|Semiconductors,Cars,Refined petroleum|Crude oil,Petroleum gas,Semiconductors|100|KP|Phones,Electronics,Computers,Ships,Steel,Plastics,Chemicals,Machinery,Car parts,Coal|The Korean alphabet, Hangul, was created in the 15th century.
TW|New Taiwan dollar|Mandarin Chinese|Semiconductors,Computers,Plastics|Semiconductors,Crude oil,Petroleum gas|36||Electronics,Machinery,Steel,Chemicals,Phones,Refined petroleum,Cars,Coal|Taipei 101 was the tallest building in the world from 2004 to 2010.
QA|Qatari riyal|Arabic|Petroleum gas,Crude oil,Refined petroleum|Cars,Gold,Aircraft|12|SA|Plastics,Chemicals,Steel,Machinery,Electronics,Phones,Computers,Jewellery|Qatar hosted the 2022 FIFA World Cup.
EG|Egyptian pound|Arabic|Petroleum gas,Gold,Refined petroleum|Wheat,Refined petroleum,Corn|1002|LY SD IL|Crude oil,Fruit,Vegetables,Fertilizers,Cotton,Textiles,Clothing,Medicines,Cars,Machinery,Phones,Plastics,Steel|The Great Pyramid of Giza is the only one of the Seven Wonders of the Ancient World still standing.
NG|Nigerian naira|English|Crude oil,Petroleum gas,Cocoa|Refined petroleum,Wheat,Cars|924|BJ NE TD CM|Fertilizers,Sesame,Machinery,Chemicals,Plastics,Rice,Phones,Medicines,Steel,Computers,Fish|Nigeria has the largest population in Africa.
ZA|South African rand|Zulu,Xhosa,Afrikaans,English|Platinum,Gold,Coal|Refined petroleum,Crude oil,Cars|1221|NA BW ZW MZ SZ LS|Iron ore,Diamonds,Cars,Car parts,Fruit,Wine,Machinery,Chemicals,Steel,Phones,Computers,Electronics,Plastics,Medicines|South Africa has three capital cities.
ET|Ethiopian birr|Amharic|Coffee,Gold,Flowers|Refined petroleum,Cars,Medicines|1104|ER DJ SO KE SS SD|Sesame,Vegetables,Fruit,Meat,Machinery,Phones,Computers,Fertilizers,Chemicals,Plastics,Steel,Wheat,Textiles,Electronics|Coffee is thought to come from Ethiopia.
KE|Kenyan shilling|Swahili,English|Tea,Flowers,Fruit|Refined petroleum,Palm oil,Cars|580|ET SO SS UG TZ|Coffee,Vegetables,Fish,Machinery,Medicines,Chemicals,Plastics,Phones,Computers,Steel,Wheat,Textiles,Clothing,Electronics|Mount Kenya is the second-highest mountain in Africa.
GH|Ghanaian cedi|English|Gold,Crude oil,Cocoa|Refined petroleum,Cars,Rice|239|CI BF TG|Timber,Fruit,Fish,Machinery,Chemicals,Plastics,Phones,Computers,Steel,Medicines,Electronics,Wheat|Ghana was the first country in sub-Saharan Africa to gain independence, in 1957.
MA|Moroccan dirham|Arabic,Berber|Cars,Fertilizers,Clothing|Refined petroleum,Cars,Wheat|447|DZ|Car parts,Fruit,Vegetables,Fish,Phosphates,Machinery,Textiles,Electronics,Crude oil,Petroleum gas,Chemicals,Plastics,Phones,Computers,Steel|Fez is home to al-Qarawiyyin, one of the oldest universities in the world.
DZ|Algerian dinar|Arabic,Berber|Petroleum gas,Crude oil,Refined petroleum|Wheat,Machinery,Corn|2382|MA TN LY NE ML MR|Cars,Fertilizers,Medicines,Steel,Plastics,Chemicals,Phones,Computers,Electronics,Sugar,Dairy,Meat|Algeria is the largest country in Africa by area.
CI|West African CFA franc|French|Cocoa,Gold,Cashews|Crude oil,Rice,Machinery|322|LR GN ML BF GH|Rubber,Palm oil,Fish,Cotton,Fruit,Bananas,Refined petroleum,Chemicals,Plastics,Cars,Phones,Medicines,Steel,Computers,Electronics|Ivory Coast is the world's largest producer of cocoa.
`

export interface Trivia {
  currency: string
  languages: string[]
  topExports: string[]
  topImports: string[]
  /** thousand km2 */
  area: number
  /** land neighbours (ISO2) */
  borders: string[]
  /** goods that are important but not top three: never a wrong option */
  also: string[]
  funFact?: string
}

export const TRIVIA: Record<string, Trivia> = {}
for (const line of TABLE.trim().split('\n')) {
  const [code, currency, langs, exp, imp, area, borders, also, ...fun] = line.split('|')
  TRIVIA[code!] = {
    currency: currency!, languages: langs!.split(','), topExports: exp!.split(','), topImports: imp!.split(','), area: +area!,
    borders: borders ? borders.split(' ') : [], also: also ? also.split(',') : [], funFact: fun.join('|') || undefined,
  }
}

export type JourneyLevel = 'easy' | 'medium' | 'hard'
export const JOURNEY_MAX: Record<JourneyLevel, number> = { easy: 6, medium: 5, hard: 4 }
/** saved-state key: the plain one for medium so earlier saves keep working */
export const journeyStateKey = (level: JourneyLevel) => (level === 'medium' ? 'shape-guess' : `shape-guess:${level}`)

/** the best-known countries: the easy level only asks about these */
const EASY = new Set('US CN IN BR RU JP DE GB FR IT ES CA AU MX AR CO PE CL EG NG ZA KE MA TR SA PL NL SE NO GR PT CH AT KR ID TH VN PK NZ UA'.split(' '))

/**
 * the day's country: one that has trivia AND a silhouette (`codes` = the keys of SHAPES, passed in so this file stays light).
 * easy = the 40 best known, medium = 5 million people or more, hard = everything with data
 */
export function journeyTarget(day: string, level: JourneyLevel, codes: readonly string[]): Country {
  const ok = new Set(codes)
  const pool = COUNTRIES.filter(c => TRIVIA[c.code] && ok.has(c.code) && (level === 'easy' ? EASY.has(c.code) : level === 'medium' ? c.pop >= 5 : true))
  return rngFor('shape-journey', day, `:${level}`).pick(pool)
}

/** hard level: the silhouette is turned by this many degrees (never upright) until it is revealed */
export const journeyAngle = (day: string): number => rngFor('shape-rot', day).pick([60, 90, 120, 150, 180, 210, 240, 270, 300])

export type StageKind = 'flag' | 'pop' | 'capital' | 'export' | 'import' | 'currency' | 'language' | 'neighbour' | 'region'
export interface Opt { id: string, label: string }
/** one line shown after the answer: `k` picks the sentence (puzzles.journey.fact.<k>), `v` fills it */
export interface Stage { kind: StageKind, options: Opt[], answer: string, fact?: { k: string, v: string } }

/** flags that get mixed up: a wrong flag option is taken from the target's group first */
const LOOKALIKE = ['NL FR RU', 'AU NZ', 'SE NO FI DK', 'CO EC VE', 'AT PE', 'DE BE', 'AR UY HN', 'EG SY IQ YE', 'IE IT MX', 'ID PL', 'PK TR', 'BR PT', 'CH DK', 'TH CR', 'CL US', 'KR JP', 'VN CN'].map(g => g.split(' '))

/** the best-known city that is not the capital: a tempting wrong option */
const FOIL: Record<string, string> = { AU: 'Sydney', TR: 'Istanbul', BR: 'São Paulo', CA: 'Toronto', CH: 'Zurich', NZ: 'Auckland', NG: 'Lagos', MA: 'Casablanca', PK: 'Karachi', IN: 'Mumbai', CN: 'Shanghai', US: 'New York', VN: 'Ho Chi Minh City', SA: 'Jeddah', EC: 'Guayaquil', TH: 'Chiang Mai' }
/** two seats or a disputed capital: no capital round */
const CAPITAL_AMBIGUOUS = new Set('LK IL BO NL ZA CI'.split(' '))
/** overseas or bridge borders that are not in `borders` but must not turn up as "not a neighbour" */
const ODD_NEIGHBOUR: Record<string, string[]> = { FR: ['BR', 'SR', 'NL'], ES: ['MA', 'GB'], GB: ['ES', 'FR'], DK: ['CA', 'SE'], NL: ['FR'], US: ['RU', 'CU'], RU: ['US', 'JP'], CA: ['DK'] }
/** very common second languages: only a wrong option when the right one is also that common */
const GLOBAL_LANG = new Set(['English', 'French', 'Spanish', 'Portuguese', 'Arabic', 'Russian'])

const BANDS: Array<[number, number, string]> = [[0, 5, 'under 5 million'], [5, 15, '5 to 15 million'], [15, 40, '15 to 40 million'], [40, 100, '40 to 100 million'], [100, 300, '100 to 300 million'], [300, Infinity, 'over 300 million']]
const bandOf = (pop: number) => BANDS.findIndex(b => pop >= b[0] && pop < b[1])

const uniq = <T>(a: T[]) => [...new Set(a)]
const GOODS = uniq(Object.values(TRIVIA).flatMap(t => [...t.topExports, ...t.topImports]))
const CURRENCIES = uniq(Object.values(TRIVIA).map(t => t.currency))
const LANGS = uniq(Object.values(TRIVIA).flatMap(t => t.languages))

const plain = (o: string): Opt => ({ id: o, label: o })
const list = (a: string[]) => a.join(', ')

/** the multiple-choice rounds about a country, in play order (7 or 8 of them); same country + day gives the same rounds */
export function journeyStages(code: string, day: string): Stage[] {
  const c = byCode(code)!, t = TRIVIA[code]!
  const rng: Rng = rngFor('shape-stages', day, `:${code}`)
  const out: Stage[] = []
  const take = <T>(a: T[], n: number) => rng.shuffle(a).slice(0, n)

  // flag
  const look = LOOKALIKE.find(g => g.includes(code))?.filter(o => o !== code && byCode(o)) ?? []
  const rest = COUNTRIES.filter(o => o.code !== code && !look.includes(o.code)).map(o => o.code)
  const wrongFlags = [...take(look, 2), ...take(rest, 3)].slice(0, 3)
  out.push({
    kind: 'flag', answer: code, fact: t.funFact ? { k: 'fun', v: t.funFact } : undefined,
    options: rng.shuffle([code, ...wrongFlags]).map(k => ({ id: k, label: byCode(k)!.name })),
  })

  // population: the right band and the three nearest, in ascending order
  const b = bandOf(c.pop)
  const near = take(BANDS.map((_, i) => i).filter(i => i !== b), 5).sort((x, y) => Math.abs(x - b) - Math.abs(y - b)).slice(0, 3)
  out.push({ kind: 'pop', answer: BANDS[b]![2], fact: { k: 'pop', v: fmtPopExact(c.pop) }, options: [b, ...near].sort((x, y) => x - y).map(i => plain(BANDS[i]![2])) })

  // capital
  if (!CAPITAL_AMBIGUOUS.has(code)) {
    const ok = (o: Country) => o.capital !== c.capital && !o.capital.toLowerCase().includes(c.name.toLowerCase())
    const same = rng.shuffle(COUNTRIES.filter(o => o.cont === c.cont && ok(o)))
    const other = rng.shuffle(COUNTRIES.filter(o => o.cont !== c.cont && ok(o)))
    const foil = FOIL[code]
    const wrong = uniq([...(foil && foil !== c.capital ? [foil] : []), ...same.slice(0, 3).map(o => o.capital), ...other.map(o => o.capital)]).slice(0, 3)
    out.push({ kind: 'capital', answer: c.capital, fact: { k: 'area', v: `${t.area >= 100 ? Math.round(t.area).toLocaleString('en') : t.area} thousand km²` }, options: rng.shuffle([c.capital, ...wrong]).map(plain) })
  }

  // exports and imports: the right one is any of the top three, the wrong ones are goods that are in none of this country's lists
  for (const k of ['export', 'import'] as const) {
    const mine = k === 'export' ? t.topExports : t.topImports
    const bad = new Set([...t.topExports, ...t.topImports, ...t.also])
    const right = rng.pick(mine)
    const wrong = take(GOODS.filter(g => !bad.has(g)), 3)
    out.push({ kind: k, answer: right, fact: { k: k === 'export' ? 'exports' : 'imports', v: list(mine) }, options: rng.shuffle([right, ...wrong]).map(plain) })
  }

  // currency or language
  if (rng.next() < 0.5) {
    const right = rng.pick(t.languages)
    const globalRight = GLOBAL_LANG.has(right)
    const wrong = take(LANGS.filter(l => !t.languages.includes(l) && (globalRight || !GLOBAL_LANG.has(l))), 3)
    out.push({ kind: 'language', answer: right, fact: { k: 'languages', v: list(t.languages) }, options: rng.shuffle([right, ...wrong]).map(plain) })
  } else {
    const wrong = take(CURRENCIES.filter(x => x !== t.currency), 3)
    out.push({ kind: 'currency', answer: t.currency, fact: { k: 'currency', v: t.currency }, options: rng.shuffle([t.currency, ...wrong]).map(plain) })
  }

  // a neighbour, or the continent for an island
  const nb = t.borders.filter(x => byCode(x))
  if (nb.length) {
    const right = rng.pick(nb)
    const no = new Set([code, ...t.borders, ...(ODD_NEIGHBOUR[code] ?? [])])
    const far = COUNTRIES.filter(o => !no.has(o.code) && distanceKm(o, c) >= 700)
    const wrong = [...take(far.filter(o => o.cont === c.cont), 2), ...take(far.filter(o => o.cont !== c.cont), 3)].slice(0, 3)
    out.push({ kind: 'neighbour', answer: right, fact: { k: 'borders', v: list(nb.map(x => byCode(x)!.name)) }, options: rng.shuffle([right, ...wrong.map(o => o.code)]).map(k2 => ({ id: k2, label: byCode(k2)!.name })) })
  } else {
    const conts = Object.keys(CONTINENTS)
    const wrong = take(conts.filter(k2 => k2 !== c.cont), 3)
    out.push({ kind: 'region', answer: CONTINENTS[c.cont]!, fact: { k: 'region', v: CONTINENTS[c.cont]! }, options: rng.shuffle([c.cont, ...wrong]).map(k2 => plain(CONTINENTS[k2]!)) })
  }
  return out
}
