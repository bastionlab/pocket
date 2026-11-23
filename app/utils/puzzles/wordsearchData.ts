/**
 * Word Search themes: a name and 20+ words (4-10 letters, plain A-Z). A day picks one theme; the generator then takes
 * the words that fit the level. Lists are written by hand, English only, nothing offensive.
 */
const T = `
Animals: zebra tiger rabbit monkey donkey giraffe camel otter koala panda lemur badger beaver weasel walrus lizard hamster leopard buffalo gorilla
Countries: spain italy france brazil canada norway sweden poland greece turkey mexico japan egypt kenya peru chile india china ireland portugal germany
Kitchen: spoon fork knife whisk ladle teapot kettle blender toaster grater colander skillet oven plate bowl mixer peeler saucepan cutlery freezer
Space: planet comet galaxy orbit rocket saturn meteor nebula eclipse cosmos lunar solar pulsar quasar probe shuttle asteroid gravity apollo capsule
Sports: tennis soccer hockey rugby boxing cricket skiing rowing diving surfing archery fencing karate cycling bowling golf judo sailing netball curling
Fruits: apple banana cherry grape lemon mango melon peach pear plum orange papaya guava lychee apricot coconut kiwi berry currant tangerine
Vegetables: carrot potato onion leek radish celery cabbage pepper turnip spinach lettuce pumpkin beetroot garlic parsnip cucumber broccoli aubergine fennel kale
Weather: rain snow hail storm drizzle breeze thunder cloud lightning sunny frost mist blizzard rainbow gale humid monsoon shower tornado climate
Ocean: whale dolphin shark octopus coral reef tide wave seal squid lobster oyster anchor harbour jellyfish seaweed island shore current starfish
Music: piano violin guitar flute drums harp cello trumpet melody rhythm chord tempo opera choir concert singer lyrics bass tune album
Garden: flower shovel rake trowel hedge lawn soil seed compost shed fence bench pond greenhouse tulip rose daisy mower blossom weed
Weekend: picnic movie hiking cinema coffee brunch market bakery museum stroll garden cooking reading puzzle skating camping fishing cycling dancing concert
Jobs: doctor nurse teacher farmer baker pilot lawyer artist driver plumber painter tailor miner chef sailor writer actor dentist builder barber
Clothes: shirt jacket scarf sweater skirt jeans coat dress gloves boots socks shorts hoodie pyjamas apron sandals helmet tights blouse trousers
Tools: hammer saw drill wrench pliers chisel ladder shovel tape screwdriver spanner level file clamp axe mallet sander vice toolbox nails
Home: sofa table chair carpet curtain pillow blanket shelf mirror lamp window door stairs kitchen bedroom garage attic cellar balcony cushion
Nature: forest river mountain valley meadow canyon glacier desert island jungle waterfall volcano lake cliff swamp prairie cave tundra hill beach
Birds: eagle robin sparrow owl crow swan parrot falcon pigeon heron stork ostrich pelican penguin finch raven turkey seagull peacock flamingo
Colours: yellow purple orange green scarlet crimson indigo violet silver golden amber ivory maroon turquoise magenta coral beige olive azure
Travel: ticket flight hotel luggage passport airport train harbour tourist map journey cruise voyage hostel visa suitcase compass taxi station
Science: atom energy gravity magnet laser planet cell oxygen carbon proton neutron lab theory formula element molecule physics biology fossil
School: pencil eraser ruler notebook teacher lesson homework desk exam library student chalk board class grammar history algebra backpack recess
Food: bread cheese butter pasta pizza salad soup rice noodle burger cookie cereal honey pancake waffle sausage omelette sandwich curry yoghurt
Games: chess poker puzzle domino bingo cards dice checkers ludo darts bridge scrabble monopoly marbles riddle trivia solitaire charades
Fantasy: dragon wizard castle knight sword goblin elf magic spell troll giant unicorn potion quest kingdom phoenix legend dwarf witch
Transport: train truck bicycle tram ferry subway scooter airplane rocket tractor taxi bus canoe sailboat metro trailer jeep van helicopter
City: street bridge tower market square museum library station park hotel church school office plaza harbour fountain theatre cafe avenue
Festival: parade lantern fireworks costume music dance banner balloon candle feast carnival ribbon confetti party drums stage gifts crowd cheer
Camping: tent campfire sleeping lantern compass trail backpack marshmallow forest stove firewood hiking canoe boots map flask rope fishing creek
Insects: ant bee wasp beetle moth cricket flea butterfly dragonfly ladybird mosquito hornet cicada grasshopper termite firefly aphid locust gnat mantis
Dinosaurs: raptor fossil jurassic triassic tyrannosaurus stegosaurus extinct reptile skeleton herbivore carnivore claw tail scales egg giant nest museum bones
`

export interface WsTheme { name: string, words: string[] }
/** themes with their usable words (upper case, a-z only, 4-10 letters, no repeats) */
export const WS_THEMES: WsTheme[] = T.trim().split('\n').map((l) => {
  const i = l.indexOf(':')
  const words = [...new Set(l.slice(i + 1).trim().split(/\s+/).map(w => w.toUpperCase()).filter(w => /^[A-Z]{4,10}$/.test(w)))]
  return { name: l.slice(0, i), words }
})
