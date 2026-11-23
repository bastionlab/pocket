/**
 * Higher or Lower: search terms with APPROXIMATE worldwide Google searches per month, rounded hard (these are rough
 * orders of magnitude from general knowledge, not an export). A term is only here when its order against terms that
 * differ by 1.4x or more is one the author is fairly sure of; the daily sequence never puts closer ones side by side.
 * Format: `name=volume` (k / m / b suffix), one group per theme, comma or newline separated.
 */
const RAW = `
youtube=1.2b, facebook=900m, whatsapp=550m, chatgpt=500m, instagram=370m, amazon=250m, netflix=150m, tiktok=135m,
twitter=120m, google maps=110m, wikipedia=80m, telegram=70m, spotify=60m, temu=60m, linkedin=55m, reddit=55m,
walmart=55m, ebay=50m, pinterest=45m, snapchat=45m, paypal=40m, shein=40m, discord=35m, zoom=35m, uber=35m,
twitch=30m, aliexpress=30m, github=25m, alibaba=20m, airbnb=18m, skype=15m, slack=12m, duolingo=12m, tinder=10m,
dropbox=10m, notion=8m, stack overflow=8m, shazam=6m, trello=3m, evernote=2m, myspace=1.2m, tumblr=3m, vimeo=3m,
iphone=180m, samsung=150m, microsoft=100m, playstation=45m, xbox=40m, nintendo=15m, nvidia=25m, intel=15m, linux=15m,
raspberry pi=3m, tesla=60m, toyota=45m, bmw=40m, mercedes=40m, honda=45m, ferrari=18m, porsche=15m, lamborghini=10m,
volkswagen=15m, nike=50m, adidas=40m, puma=10m, gucci=12m, louis vuitton=12m, rolex=18m, ikea=40m, lego=25m,
zara=20m, uniqlo=4m, mcdonalds=70m, starbucks=30m, kfc=30m, burger king=20m, pizza hut=10m, dominos=15m,
coca cola=20m, pepsi=10m, red bull=8m, nutella=5m, oreo=5m, heineken=3m, guinness=3m, costco=25m, aldi=8m, lidl=10m,
lionel messi=12m, ronaldo=20m, cristiano ronaldo=8m, neymar=5m, mbappe=4m, haaland=2m, lebron james=5m,
michael jordan=3m, kobe bryant=3m, taylor swift=9m, beyonce=4m, rihanna=3m, justin bieber=6m, ariana grande=5m,
billie eilish=4m, eminem=3m, bts=20m, blackpink=8m, elon musk=12m, bill gates=3m, jeff bezos=1.5m,
mark zuckerberg=2m, donald trump=25m, joe biden=10m, barack obama=3m, putin=6m, angela merkel=1m, king charles=2m,
queen elizabeth=3m, michael jackson=6m, marilyn monroe=1.5m, albert einstein=5m, leonardo da vinci=2m, mozart=3m,
beethoven=3m, shakespeare=3m, napoleon=2m, cleopatra=1.5m, kim kardashian=4m, kylie jenner=3m, selena gomez=4m,
dwayne johnson=3m, tom cruise=3m, brad pitt=2m, keanu reeves=3m, johnny depp=3m, emma watson=1.5m, mrbeast=8m,
gordon ramsay=2m, stephen hawking=1m, maradona=2m, serena williams=1.5m, roger federer=2m, rafael nadal=2m,
lewis hamilton=3m, max verstappen=3m, conor mcgregor=2m, mike tyson=3m, muhammad ali=2m, usain bolt=1.5m,
tiger woods=1.5m, michael phelps=0.8m,
india=30m, china=22m, uk=25m, usa=40m, japan=12m, russia=14m, germany=9m, france=9m, brazil=10m, canada=12m,
australia=11m, italy=8m, spain=7m, mexico=7m, turkey=8m, egypt=5m, south korea=4m, thailand=4m, indonesia=4m,
argentina=4m, greece=3m, portugal=3m, poland=2.5m, switzerland=2m, sweden=2m, norway=1.5m, finland=1m, ireland=3m,
vietnam=2.5m, nigeria=3m, south africa=4m, ukraine=4m, israel=5m, iran=3m, iceland=1.2m, peru=2m, cuba=2m,
morocco=2m, kenya=1.2m, nepal=1.5m, mongolia=0.6m, luxembourg=0.5m, malta=0.7m, bhutan=0.4m, monaco=0.4m,
new york=15m, london=20m, paris=15m, tokyo=10m, dubai=25m, rome=6m, berlin=5m, barcelona=7m, amsterdam=5m,
istanbul=9m, bangkok=6m, singapore=10m, sydney=7m, los angeles=15m, las vegas=12m, miami=12m, chicago=10m,
san francisco=6m, moscow=8m, mumbai=10m, delhi=12m, beijing=5m, shanghai=5m, hong kong=10m, cairo=3m, venice=3m,
prague=2m, vienna=3m, lisbon=2m, madrid=5m, munich=2.5m, hamburg=2m, zurich=1.5m, oslo=1m, helsinki=0.7m,
reykjavik=0.4m, bali=8m, hawaii=8m, mount everest=2m, niagara falls=2m, grand canyon=2m, eiffel tower=3m,
great wall of china=1m, taj mahal=3m, colosseum=1.5m, statue of liberty=1.5m, big ben=1.5m, machu picchu=1.5m,
disneyland=10m, disney world=8m, legoland=1.2m, universal studios=5m,
pizza=50m, burger=15m, sushi=15m, pasta=8m, tacos=8m, ramen=6m, chocolate=15m, ice cream=20m, pancakes=3m,
croissant=2m, lasagna=3m, paella=1m, kimchi=1.5m, hummus=1.5m, falafel=1.2m, bratwurst=0.4m, pretzel=1.5m,
banana=10m, avocado=8m, mango=8m, watermelon=5m, pineapple=5m, bacon=5m, donut=3m, waffle=2m, cheesecake=5m,
tiramisu=3m, baklava=1.2m, biryani=8m, butter chicken=1.5m, tofu=3m, spaghetti=3m, nachos=2m, kebab=3m,
fried chicken=5m, french fries=3m, popcorn=5m, beer=20m, whiskey=5m, vodka=5m, tequila=3m, champagne=3m,
world cup=50m, olympics=20m, super bowl=15m, premier league=30m, champions league=25m, nba=70m, nfl=60m,
formula 1=20m, wimbledon=3m, tour de france=3m, ufc=40m, wwe=40m, ipl=60m, la liga=8m, bundesliga=5m, serie a=5m,
real madrid=30m, manchester united=25m, liverpool=20m, arsenal=15m, juventus=8m, bayern munich=5m, psg=8m,
lakers=5m, yankees=2m, chess=15m, yoga=20m, marathon=5m, tennis=25m,
minecraft=100m, roblox=110m, fortnite=60m, gta=40m, pokemon=40m, pokemon go=8m, zelda=8m, call of duty=15m,
fifa=25m, among us=10m, candy crush=6m, wordle=8m, sudoku=20m, tetris=5m, pac man=3m, league of legends=18m,
valorant=18m, dota 2=5m, counter strike=8m, apex legends=6m, overwatch=5m, world of warcraft=5m, genshin impact=20m,
elden ring=5m, cyberpunk 2077=3m, the witcher=3m, stardew valley=2m, animal crossing=4m, skyrim=3m, fallout=6m,
the sims=6m, monopoly=5m, rubiks cube=3m,
harry potter=15m, star wars=15m, marvel=30m, avengers=8m, batman=15m, spider man=20m, the simpsons=5m,
game of thrones=8m, breaking bad=3m, stranger things=10m, squid game=10m, lord of the rings=3m, titanic=5m,
disney plus=20m, pixar=2m, barbie=10m, oppenheimer=5m, naruto=20m, one piece=40m, dragon ball=15m,
attack on titan=8m, demon slayer=8m, spongebob=8m, peppa pig=6m, bluey=6m, mickey mouse=3m, hello kitty=5m,
minions=3m, shrek=3m,
bitcoin=100m, ethereum=25m, dogecoin=15m, black friday=30m, christmas=100m, halloween=60m, easter=50m,
valentines day=15m, thanksgiving=25m, ramadan=40m, diwali=10m, eurovision=10m, oscars=15m, grammys=5m,
met gala=3m, coachella=3m, comic con=3m, burning man=1.5m, tomorrowland=1m, oktoberfest=3m,
lion=15m, tiger=12m, elephant=10m, panda=10m, giraffe=3m, penguin=5m, shark=10m, dolphin=5m, whale=3m,
octopus=3m, kangaroo=2m, koala=1.5m, wolf=8m, dinosaur=8m, unicorn=5m
`

export interface SearchTerm { name: string, vol: number }

const MULT: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9 }

export const SEARCH_TERMS: SearchTerm[] = RAW.split(/[,\n]/).map(s => s.trim()).filter(Boolean).map((s) => {
  const [name, v] = s.split('=')
  const m = /^([\d.]+)([kmb])$/.exec(v!.trim())!
  return { name: name!.trim(), vol: Math.round(Number(m[1]) * MULT[m[2]!]!) }
})

const ACRONYMS = new Set(['uk', 'usa', 'nba', 'nfl', 'ufc', 'wwe', 'ipl', 'bts', 'psg', 'gta', 'fifa', 'bmw', 'kfc', 'ikea', 'lego', 'psg'])
const SMALL = new Set(['of', 'the', 'de', 'and'])
const SPECIAL: Record<string, string> = {
  'youtube': 'YouTube', 'tiktok': 'TikTok', 'whatsapp': 'WhatsApp', 'chatgpt': 'ChatGPT', 'linkedin': 'LinkedIn', 'github': 'GitHub',
  'paypal': 'PayPal', 'ebay': 'eBay', 'iphone': 'iPhone', 'aliexpress': 'AliExpress', 'airbnb': 'Airbnb', 'mcdonalds': 'McDonald\'s',
  'mrbeast': 'MrBeast', 'mbappe': 'Mbappé', 'pokemon': 'Pokémon', 'pokemon go': 'Pokémon Go', 'coca cola': 'Coca-Cola',
  'spider man': 'Spider-Man', 'pac man': 'Pac-Man', 'valentines day': 'Valentine\'s Day', 'rubiks cube': 'Rubik\'s Cube',
  'dominos': 'Domino\'s', 'hong kong': 'Hong Kong', 'ps5': 'PS5', 'dota 2': 'Dota 2', 'nvidia': 'NVIDIA', 'linux': 'Linux',
}
/** the term as a person writes it (the data is lower case) */
export function termLabel(name: string): string {
  if (SPECIAL[name]) return SPECIAL[name]
  return name.split(' ').map((w, k) => (ACRONYMS.has(w) ? w.toUpperCase() : k > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1))).join(' ')
}
