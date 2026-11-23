/**
 * Connections categories: a name and every word that fits it (as complete as can be). The generator mixes categories whose
 * words overlap on purpose (red herrings) and only keeps a puzzle when exactly one way of sorting the 16 words works.
 */
const T = `
words before ball: base foot snow eye fire hand soft basket meat moth pin hair golf cannon volley dodge
words after fish: star sword cat gold jelly cuttle angel blow dog monk sun lion cray flying silver shell
words before stone: lime sand grave tomb gem mile key flag brim hail cobble whet moon blood birth touch head lode
words before house: green light farm club dog tree glass boat play power ware hot coffee out
words before bird: black blue humming song jail mocking lady love sun thunder early cat
words before light: flash sun moon star spot head day candle lime high search stop traffic
words before box: mail post match tool juke sand lunch ice letter music shoe pill black chat
kinds of bank: river blood piggy food data sand snow west memory
words before book: note text cook scrap hand guide face pass year check
things with a bridge: nose guitar violin ship teeth glasses song cello
things with a head: nail hammer beer coin match cabbage bed pin arrow lettuce spear
things with legs: table chair stool trousers journey race tripod spider piano bed sofa desk
things with teeth: comb saw zip gear fork shark rake key cog
things with a tongue: shoe bell boot flame wagon
things with an eye: needle storm potato hurricane camera peacock cyclone
things with a crown: king queen tooth tree hill pineapple head watch bottle
things with a shell: egg nut turtle taco snail crab oyster tortoise
things with keys: piano map lock laptop typewriter keyboard organ phone ring
things with wings: plane theatre hospital bird angel building bat butterfly
things with a spine: book cactus hedgehog porcupine fish urchin
things with a mouth: river cave bottle volcano jar harbour
things with a face: clock cliff coin card watch mountain dice
things you can break: record news fast promise wind ice bank law habit heart silence code ranks camp spell bread dawn ground
things you can draw: curtain breath blood conclusion gun sword card straw bath picture line lots attention crowd
things you can pitch: tent ball idea camp sale
things you can crack: code joke egg nut whip knuckle safe smile case
things you can strike: match deal pose chord gold oil balance bargain camp
things you can run: race bath errand business risk fever program tap marathon campaign
things you can set: table alarm record trap tone scene sail goal example date course bone mood
things you can catch: cold ball wave bus thief breath fire glimpse fish train plane
things you can pick: lock pocket fruit team nose fight winner flower guitar
things you can cast: vote spell net shadow doubt line mould actor die stone
things you can throw: party tantrum punch ball dice fit shade game javelin switch pot
things you can fire: gun employee rocket clay question arrow cannon
things you can light: candle match fire cigarette lamp fuse stage bonfire
things you can press: button flower shirt suit charge grape olive trousers
things you can hold: hand breath grudge meeting hostage record court tongue office
things you can steal: base show heart glance kiss car thunder scene idea identity
things you can tie: knot score shoe game bow
roman gods: mars venus mercury jupiter saturn neptune pluto apollo vulcan juno ceres diana
chocolate bars: mars galaxy bounty twix snickers wispa flake picnic crunchie kitkat lion yorkie aero toblerone
space words: galaxy comet orbit nebula meteor asteroid quasar eclipse star planet moon pulsar rocket shuttle satellite
cars named after animals: mustang beetle impala bronco cobra viper panda stingray falcon jaguar pinto cougar rabbit
big cats: lion tiger leopard cheetah jaguar puma lynx panther cougar ocelot
snakes: python cobra viper adder mamba boa anaconda asp rattler krait taipan
programming languages: python ruby java swift rust perl julia scala kotlin cobol pascal basic fortran lisp
gemstones: ruby emerald sapphire amber jade topaz opal garnet diamond pearl coral onyx
colours that are also fruits: orange lime lemon peach plum cherry olive apricot raspberry
currencies: dollar pound yen rand real euro peso rupee krone won franc lira dinar baht rouble shilling
poker terms: flush straight pair fold raise call check bluff blind river flop turn ante pot
chess terms: check castle pawn rook bishop knight queen king fork pin skewer gambit mate stalemate
kitchen utensils: fork knife spoon ladle whisk spatula tongs grater peeler
snooker terms: cue break frame pot cushion rack baulk spider pocket
golf scores: birdie eagle bogey par albatross ace
cricket terms: wicket over bail stump duck maiden googly slip gully yorker bouncer innings
tennis terms: love deuce ace set serve volley rally fault let advantage smash lob
birds: eagle robin sparrow owl swan crow parrot falcon duck raven wren finch heron stork albatross condor kiwi
us presidents: bush grant ford carter hoover pierce
poets: keats byron blake frost burns pound gray eliot plath yeats auden
fictional detectives: holmes poirot marple morse columbo rebus maigret
shades of white: ivory cream pearl snow chalk milk lily
dances: tango waltz salsa jive swing twist rumba polka disco foxtrot samba ballet
pasta: penne fusilli farfalle rigatoni orzo macaroni spaghetti linguine tagliatelle ravioli lasagne
knots: reef bowline granny clove sheepshank slip noose square windsor hitch
breads: loaf bun roll bagel baguette pita naan crumpet bap cob
hairstyles: bob bun braid quiff mullet perm plait fringe crop ponytail mohawk
playing card words: ace king queen jack joker trump deck suit
parts of a book: spine cover page chapter index preface jacket binding
parts of a shoe: sole heel tongue lace upper toe insole eyelet
parts of a ship: bow stern deck hull mast keel galley bridge rudder anchor helm sail
parts of a guitar: neck bridge fret string body saddle nut
parts of a castle: moat keep tower drawbridge turret rampart bailey dungeon gate portcullis
kinds of weather: rain snow hail fog wind storm sleet drizzle frost thunder gale mist
rivers: thames nile amazon danube rhine seine volga ganges mersey severn tyne trent clyde congo
music terms: tempo pitch key note scale chord bar rest flat sharp clef treble bass beat
fabrics: cotton silk wool denim linen velvet satin tweed nylon lace felt leather
hats: cap beret fedora bowler trilby beanie bonnet stetson fez turban sombrero
greek letters: alpha beta gamma delta sigma omega theta lambda kappa omicron rho tau phi psi chi eta zeta iota
nato alphabet words: alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey zulu
capital cities: lima paris rome oslo bern cairo delhi madrid athens dublin quito
dog breeds: poodle beagle boxer husky collie corgi pug terrier whippet spaniel pointer setter
boxing punches: jab hook cross uppercut haymaker
fishing gear: rod reel line hook bait lure net
camera words: lens shutter flash zoom focus tripod aperture film frame
computer words: mouse bug virus worm cookie cloud window firewall folder desktop
rodents: mouse rat hamster squirrel beaver gerbil vole capybara
insects: ant bee wasp beetle moth fly cricket flea ladybird termite mantis
wedding words: bride groom ring vow cake bouquet veil toast
kitchen appliances: toaster kettle blender oven fridge mixer cooker microwave freezer
tools: hammer saw drill wrench pliers chisel screwdriver spanner plane level vice file clamp
wines and fortified wines: merlot claret port sherry hock cava champagne rioja
units of measure: inch foot yard mile pound ounce stone ton gram litre pint gallon acre
body parts: knee elbow shin wrist ankle thumb heel palm calf lip hip rib skull
theatre words: stage curtain aisle wing stalls circle box balcony gallery foyer
`
export const CONN_CATEGORIES: { name: string, words: string[] }[] = T.trim().split('\n').map((l) => {
  const i = l.indexOf(':')
  return { name: l.slice(0, i), words: l.slice(i + 1).trim().split(/\s+/) }
})
