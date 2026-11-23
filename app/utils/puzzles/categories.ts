/** Connections categories: a name and its words. Words are unique within a category; a puzzle never mixes two categories that share a word. */
const T = `
fruits: apple banana cherry grape lemon mango melon peach pear plum
planets: mars venus saturn jupiter mercury neptune uranus earth
chess pieces: king queen bishop knight rook pawn
units of time: second minute hour day week month year decade century
colours: red blue green yellow purple pink brown black white
metals: iron copper gold silver zinc tin lead nickel
dog breeds: poodle beagle boxer husky collie corgi pug terrier
musical instruments: piano violin flute drum guitar harp cello trumpet
shapes: circle square triangle oval hexagon cube cone sphere
body parts: elbow knee ankle wrist shoulder thumb heel palm
car brands: ford honda toyota audi volvo fiat tesla mazda
cheeses: cheddar brie gouda feta swiss mozzarella parmesan edam
currencies: dollar euro pound yen peso franc rupee krone
card games: poker bridge rummy snap hearts whist blackjack
dances: waltz tango salsa ballet polka disco rumba swing
weather: rain snow hail fog wind storm sleet drizzle
trees: oak pine maple birch elm cedar willow beech
flowers: rose tulip daisy lily orchid poppy lotus iris
birds: eagle robin sparrow owl crow swan parrot falcon
fish: salmon trout tuna cod shark bass perch carp
insects: ant bee wasp beetle moth fly cricket flea
vegetables: carrot potato onion leek pea beet radish celery
spices: pepper cumin clove ginger saffron nutmeg paprika
big cats: lion tiger leopard cheetah jaguar puma lynx panther
kitchen items: spoon fork knife whisk ladle pan pot grater
tools: hammer saw drill wrench pliers chisel screwdriver
school subjects: maths history art music biology physics chemistry
shoes: boot sandal sneaker loafer slipper clog
clothing: shirt jacket scarf sweater skirt jeans coat vest
greek letters: alpha beta gamma delta sigma omega theta lambda
board games: monopoly risk cluedo scrabble catan checkers ludo
sea animals: whale dolphin octopus squid seal turtle crab starfish
greek gods: zeus hera apollo athena ares hermes
gases: oxygen helium neon argon hydrogen nitrogen radon xenon
rivers: nile amazon danube rhine thames volga ganges seine
mountains: everest alps andes rockies fuji etna kilimanjaro
european capitals: paris rome berlin madrid lisbon vienna oslo dublin
fabrics: cotton silk wool linen denim velvet nylon leather
gems: ruby emerald diamond opal sapphire topaz pearl amber
sports: tennis rugby golf hockey boxing judo skiing rowing
`
export const CATEGORIES: { name: string, words: string[] }[] = T.trim().split('\n').map((l) => {
  const [name, rest] = l.split(': ')
  return { name, words: rest.split(' ') }
})
