// word banks for the word games (generated from the system dictionary + hand-picked lists; no network at runtime)
const sp = (s: string) => s.trim().split(/\s+/)

/** Anagram sets: `word/alt/alt`, the alternates are other real words made of the same letters (also accepted) */
export const ANAGRAM_6 = sp(`
bamboo cactus mosaic nectar/canter/recant/trance orchid velvet whisky zodiac tundra quartz plasma
vortex goblin muffin mantle/lament/mantel/mental meadow pledge locust/clouts jigsaw hermit
glider/girdle fabric ethics/itches cobalt cipher bishop beacon amulet alpaca bureau canyon
cavern/craven cloven cuckoo dagger/ragged fathom feline fossil gadget/tagged gallon gospel hazard
hollow impact jersey kernel lagoon legend magnet mingle muscle nugget oyster/storey/tyroes palace
pastry plunge quiver ripple sequin/quines shrimp sphinx talent/latent thrash
tinsel/enlist/inlets/listen/silent trophy tumble unveil vacuum vessel/selves voyage walrus willow
wobble yonder zephyr anthem armada bandit barrel bazaar beaver blazer botany bonnet brazen cannon
carbon casket cherub chisel/chiles cinder clover cobweb cradle dismal escape/peaces falcon fiasco
frigid garlic goblet gravel gutter hamlet jargon jovial kennel lavish mallet matrix mentor
mirage/gamier molten mortar muzzle napkin noodle nutmeg oblong ocelot origin outlaw oxygen paddle
pebble pillar plague pulpit radish riddle scroll shovel/hovels sprout/stupor stucco summit
tablet/battle throne/hornet thrive trench turnip vellum violet walnut wicker wombat yogurt zigzag
zombie
`)
export const ANAGRAM_7 = sp(`
abandon acrobat anthill balcony bandage biscuit blossom bracket cabaret caravan caution/auction
chimera cracker crystal culprit dolphin dungeon eclipse emerald fantasy fiddler flannel
gallery/allergy/largely/regally gazelle glacier gourmet harmony hostage insight jackpot journey
kingdom lantern lobster/bolster mammoth mansion mineral/manlier monarch mystery nostril obscure
orchard outcast pageant paradox pelican phantom pilgrim plunder pyramid quantum rainbow reptile
scepter/respect/specter sparrow stealth sunbeam tangent trellis/stiller/tillers trumpet tsunami
uniform unicorn vampire verdict village voltage warfare whistle jasmine kestrel lullaby maestro
mustard nirvana oatmeal raccoon unravel vanilla yoghurt zealous almanac cabbage fortune gondola
hamster iceberg jukebox karaoke lacquer magenta/magnate narwhal opossum parasol rhubarb sorcery
thicket upgrade venture
`)
export const ANAGRAM_8 = sp(`
abstract backpack bluebell bookworm broccoli calendar carnival catapult champion chestnut cinnamon
crossbow daffodil dinosaur discover/divorces elephant envelope evidence firework fountain graphite
hospital inventor keyboard lavender lifetime magnetic mountain mushroom notebook operatic paradise
pendulum porridge sapphire scorpion skeleton sunlight/hustling telegram treasure/austerer umbrella
universe vineyard wardrobe wildlife wrestler zeppelin alphabet birthday blizzard cardigan daylight
eruption festival gladness hardship illusion jamboree kangaroo lemonade mandolin nonsense overcoat
pheasant quagmire raindrop sandwich tropical volcanic woodland/download yearbook zucchini anteater
dumpling elevator flagpole gargoyle hawthorn isolated jealousy kindling landmark midnight
nightcap/patching obsidian seafarer upstairs
`)

/** Hangman words, 7 to 10 letters */
export const HANGMAN = sp(`
pharaoh syndrome mnemonic pneumonia rhubarb quarantine lighthouse hemisphere catapult clockwork
crocodile porcupine chameleon flamingo armadillo alligator avalanche crossword gargoyle blueprint
hurricane labyrinth marathon vineyard mysterious astronaut boomerang kangaroo lumberjack moonlight
nightmare parachute peppermint scarecrow snowflake sunflower tambourine trampoline xylophone
zucchini yachtsman bumblebee cathedral dragonfly earthquake harmonica horseshoe jackknife kettledrum
limestone mosquito narwhal obsidian pheasant quagmire raspberry scorpion tarantula volcanic windmill
bookshelf daybreak fireplace gooseberry honeycomb jamboree knuckle lemonade mandolin overcoat
pickaxe rhinoceros spaghetti vegetable waterfall yesterday buccaneer jellyfish quicksand whirlwind
whispering mischief juggernaut pendulum wilderness telescope architect jubilant symphony hologram
gymnasium fabulous enchanted lavender marzipan parliament scoundrel treasure unicycle vagabond
wanderer expedition knapsack ostrich strawberry vengeance wheelchair zeppelin
`)

/** Word ladder: every four-letter word the ladder accepts (one connected network), and the common ones a puzzle starts / ends on */
export const LADDER_WORDS = sp(`
abed abet abut aced aces acid acts adds aged ages aide aids ails aims airs airy alas alit alms aloe
alum amen amid amps anew ante anti ants aped apes apex arch arcs area aria arid arks arms army arts
arty asks asps atom atop atty auks aunt aver avid away awed awes awls awry axed axes axis ayes baas
babe baby back bade bags bail bait bake bald bale balk ball balm band bane bang bank bans barb bard
bare barf bark barn bars base bash bask bass bast bate bath bats baud bawl bays bead beak beam bean
bear beat beau beck beds beef been beep beer bees beet begs bell belt bend bent berg berm best beta
bets bias bibs bide bids bier biff bike bile bilk bill bind bins bird bite bits blab blah bled blew
blip blob bloc blog blot blow blue blur boar boas boat bobs bode body bogs bogy boil bola bold bole
boll bolt bomb bond bone bong bony boob book boom boon boor boos boot bops bore born bosh boss both
bout bowl bows boys brad brag bran bras brat bray bred brew brig brim brow buck buds buff bugs bulb
bulk bull bump bums bung bunk buns bunt buoy burg burn burp burr burs bury bush buss bust busy buts
butt buys buzz byes byte cabs cads cage cagy cake calf calk call calm came camp cams cane cans cant
cape caps card care carp cars cart case cash cask cast cats cave caws cede cell cent chap char chat
chef chem chew chic chid chin chip chit chop chow chug chum cite city clad clam clan clap claw clay
clef clew clip clit clod clog clop clot cloy club clue coal coat coax cobs cock coda code cods coed
cogs coif coil coin coke cola cold colt coma comb come cone conk cook cool coop coos coot cope cops
copy cord core cork corm corn corp cost cosy cote cots coup cove cowl cows cozy crab crag cram crap
craw cray crew crib crop crow cube cubs cuds cued cues cuff cull cult cups curb curd cure curl curs
curt cusp cuss cute cuts cyst czar dabs dado dads daft dais dale dame damn damp dams dank dare dark
darn dart dash data date daub dawn days daze dead deaf deal dean dear debs debt deck deed deem deep
deer deft defy deli dell demo dens dent deny dept desk dewy dial dice died dies diet diff digs dike
dill dime dims dine ding dink dins dint dips dire dirk dirt disc dish disk diss diva dive dock docs
dodo doer does doff dogs dole doll dolt dome done dons doom door dope dopy dork dorm dory dose dote
doth dots dour dove down doze drab drag dram draw dray drew drip drop drub drug drum drys dual dubs
duck duct dude duds duel dues duet duff duke dull duly dumb dump dune dung dunk duns duos dupe dusk
dust duty dyed dyer dyes earl earn ears ease east easy eats eave edit eels eery eked ekes elks ells
elms else emir emit eons eras errs even ever eves ewer ewes exes exit eyed eyes face fact fade fads
fail fain fair fake fall fame fang fans fare farm fart fast fate fats faun fawn faze fear feat feed
feel fees feet fell felt fend fens fern fest feta feud fiat fibs fief fife figs file fill film find
fine fink fins fire firm firs fish fist fits five fizz flab flag flak flan flap flat flaw flax flay
flea fled flee flew flex flip flit floe flog flop flow flub flue flux foal foam foes fogs fogy foil
fold folk fond font food fool foot fops fora ford fore fork form fort foul four fowl foxy frag frat
fray free fret frog from fuel full fume fums fund funk furl furs fury fuse fuss fuze fuzz gabs gads
gaff gage gags gain gait gala gale gall gals game gamy gang gape gaps garb gash gasp gate gave gawk
gaze gear geed geek gees geez geld gels gelt gems gene gent germ gets gibe gift gigs gild gill gilt
gins gird girl girt gist give glad glee glen glib glob glow glue glum glut gnat gnaw gnus goad goal
goat gobs gods goes gold golf gone gong good goof goon goop gore gorp gory gosh gout govt gown grab
grad gram gray grep grew grey grid grim grin grip grit grog grow grub guff gulf gull gulp gums gunk
guns gush gust guts guys gybe gyms gyps hack haft hags hail hair hake hale half hall halo halt hams
hand hang hank hard hare hark harm harp hart hash hasp hate hath hats haul have hawk haws hays haze
hazy head heal heap hear heat heck heed heel heft heir held hell helm help hemp hems hens herb herd
here hero hers hewn hews hick hide hied hies hike hill hilt hind hint hips hire hiss hits hive hoax
hobo hobs hock hods hoed hoes hogs hold hole holy home homy hone honk hood hoof hook hoop hoot hope
hops horn hose host hour hove howl hows hubs hued hues huff huge hugs hula hulk hull hump hums hung
hunk hunt hurl hurt hush husk huts hype hypo iamb ibid ibis iced ices icky idea ides ilks ills imps
inks inky inns ions iris irks item jabs jack jade jags jail jamb jams jape jars jaws jays jazz jeep
jeer jeez jell jerk jest jets jibe jibs jigs jilt jinx jive jobs jock jogs join joke jolt josh jots
jowl joys jugs jump junk jury just jute juts kale keel keen keep kegs kelp kept keys khan kick kids
kill kiln kilo kilt kind king kink kiss kite kith kits knee knew knit knob knot know koan kook labs
lace lack lacy lade lads lady lags laid lain lair lake lama lamb lame lamp lams land lane lank laps
lard lark lase lash lass last late lath laud lava lawn laws lays laze lazy lead leaf leak lean leap
leas leek leer lees left legs leis lend lens lent less lest lets lewd lice lick lids lied lief lien
lies lieu life lift like lilt lily limb lime limn limo limp limy line link lint lion lips lira lire
lisp list lite live load loaf loam loan lobe lobs lock loco lode loft loge logo logs loin loll lone
long look loom loon loop loot lope lops lord lore lorn lose loss lost lots loud lout love lows lube
luck lugs lull lump lung lure lurk lush lust lute lyre mace made maid mail maim main make male mall
malt mama mane mans many maps mare mark mars mart mash mask mass mast mate math mats matt maul maws
maze mead meal mean meat meek meet meld melt meme memo mend menu mere mesa mesh mess meta mete mewl
mews mica mice mien miff mike mild mile milk mill mime mind mine mini mink mint minx mire miss mist
mite mitt moan moat mobs mock mode mods mold mole moll molt moms monk mono mood moon moor moos moot
mope mops more morn moss most mote moth move mown mows much muck muff mugs mule mull mung murk muse
mush musk muss must mute mutt myth nabs nail name nape naps narc nark nary nave navy nays near neat
neck need neon nerd nest nets news newt next nibs nice nick nine nips nits node nods none nook noon
nope norm nose nosh nosy note noun nubs nude nuke null numb nuns nuts oafs oaks oars oath oats obit
odds odes offs oils oily oink omen omit ones only onus oops ooze open opts opus orbs orcs ores ouch
ours oust outs oven over owed owes owls owns oxen pace pack pact pads page paid pail pain pair pale
pall palm pals pane pang pans pant papa paps pare park pars part pass past pate path pats pave pawl
pawn paws pays peak peal pear peas peat peck pecs peed peek peel peep peer pees pegs pelt pend pens
pent peon peps perk perm pert peso pest pets pews pica pick pied pier pies pigs pike pile pill pimp
pine ping pink pins pint pipe pips pita pith pits pity pixy plan play plea pled plod plop plot plow
ploy plug plum plus pock pods poem poet poke poky pole poll polo pomp pond pone pony pooh pool poop
poor pope pops pore pork port pose posh post posy pots pour pout pram pray prey prig prim prod prof
prom prop pros prow pubs puck puff pugs puke pull pulp puma pump punk puns punt puny pupa pups pure
purl purr push puss puts putt pyre quad quay quid quip quit quiz race rack racy raft raga rage rags
raid rail rain raja rake ramp rams rang rank rant raps rapt rare rash rasp rate rats rave rays raze
razz read real ream reap rear redo reds reed reef reek reel refs rein rend rent reps rest revs ribs
rice rich rick ride rids rife riff rift rigs rile rill rime rims rind ring rink riot ripe rips rise
risk rite road roam roan roar robe robs rock rode rods roes roil role roll romp rood roof rook room
root rope rose rosy rote rots rout rove rows rube rubs ruby rude rued rues ruff rugs ruin rule rump
rums rune rung runs runt ruse rush rusk rust ruts sack sacs safe saga sage sago sags said sail sake
saki sale salt same sand sane sang sank sans saps sari sash sass sate save sawn saws says scab scad
scag scam scan scar scat scow scud scum seal seam sear seas seat secs sect seed seek seem seen seep
seer sees self sell send sent serf sets sewn sews shad shag shah sham shat shed shim shin ship shod
shoe shoo shop shot show shun shut sick side sift silk sill silo silt sine sing sink sins sips sire
sirs site sits size skew skid skim skin skip skis skit slab slag slam slap slat slaw slay sled slew
slid slim slip slit slob sloe slog slop slot slow slue slug slum slur smit smog smug smut snag snap
snip snit snob snot snow snub snug soak soap soar sobs sock soda sods sofa soft soil sold sole solo
some song sons soon soot sops sore sort sots soul soup sour sown sows soya spam span spar spat spay
spec sped spew spin spit spot spry spud spun spur stab stag star stat stay stem step stew stir stop
stow stub stud stun subs such suck suds sued sues suet suit sulk sumo sump sums sung sunk suns sups
sure surf swab swag swam swan swap swat sway swig swim swum tabs tabu tack taco tact tads tags tail
take talc tale talk tall tame tamp tams tang tank tans tape taps tare taro tarp tars tart task tats
taut teak teal team tear teas teat teed teem teen tees tell temp tend tens tent term tern test text
than that thaw thee them then they thin this thud thug thus tick tics tide tidy tied tier ties tiff
tike tile till tilt time tine ting tins tint tiny tipi tips tire tiro toad toed toes toga togs toil
toke told toll tomb tome toms tone tong tons took tool toot tops tore torn tort toss tote tots tour
tout town tows toys tram trap tray tree trek trig trim trio trip trod trot true tsar tuba tube tubs
tuck tugs tuna tune turf turn tush tusk twee twig twin twit tyke type typo umps unit urea vain vale
vamp vane vans vape vary vase vast vats veal veep veer veil vein veld vend vent verb very vest veto
vets vial vibe vice vied vies view vile vine visa vise viva vole volt vote vows wack wade wadi waft
wage wags waif wail wait wake wale walk wall wand wane want ward ware warm warn warp wars wart wary
wash wasp watt wave wavy waxy ways weak weal wean wear webs weds weed week weep weft weir weld well
welt wend wens went wept were west wets wham what when whet whew whey whim whip whir whit whiz whoa
whom wick wide wife wigs wild wile will wilt wily wimp wind wine wing wink wino wins wipe wire wiry
wise wish wisp wist with wits wive woes woke woks wolf womb wont wood woof wool woos word wore work
worm worn wove wows wrap wren writ wuss yack yams yank yaps yard yarn yawl yawn yaws year yeas yell
yelp yens yest yews yips yock yoga yogi yoke yolk yore your yowl yuck yuks yule zany zaps zeal zero
zest zeta zinc zing zips zits zone zoom zoos
`)
/** real words the first list leaves out (also accepted, and usable on a shortest path) */
export const LADDER_MORE = sp(`
able ably ache achy acme acne acre adze aeon afar agar agog ague ahem ahoy ajar akin ales alga ally
also alto amok ankh anon apps apse aqua aura auto avow axle axon cons crud crux each ebbs echo ecru
eddy edge edgy eggs egos emus ends envy epic ergo espy etch euro evil exam expo foci glop grok guru
gyro high hymn ibex icon idle idly idol iffy imam inch info into iota iron isle itch jinn judo kiwi
levy liar loci luau lynx mayo meow myna nigh noel nova obey oboe odor ogle ogre ohms okay okra
once onto onyx opal oral oval ovum sere semi sigh sign spas stye sync taxi tech thou thru tofu tuft
tutu twos tyro ugly ulna undo unto upon urge urns used user uses void wads whys yaks yeah yeti zebu
`)
export const LADDER_COMMON = sp(`
acid aged area army away baby back ball band bank base bath bear beat beef beer bell belt bend best
bike bill bird bite blow blue boat body bold bolt bomb bond bone book boom boot bore born boss both
bowl bulk bull burn bush busy cake call calm camp card care cart case cash cast cave cell chat chip
city clay club coal coat code coin cold come cook cool cope copy cord core corn cost crew crop dark
data date dawn dead deal dear deck deep deer desk dial diet dirt dish disk dive dock door dose down
draw drop drum duck dusk dust duty earn ease east easy else even ever exit face fact fail fair fall
farm fast fate fear feed feel feet fell file fill film find fine fire firm fish five flag flat flow
folk food fool foot fork form fort four free from fuel full fund gain game gate gear gift girl give
glad goal goat gold golf good grab gray grew grin grip grow gulf hair half hall hand hang hard harm
hate have head heal hear heat heel held hell help herb here hero hide hill hint hire hold hole holy
home hood hook hope horn host hour huge hunt hurt idea item jail join joke jump jury just keen keep
kick kill kind king kiss knee knew knot know lack lady lake lamp land lane last late lawn lazy lead
leaf lean left lend less life lift like lime line link lion list live load loan lock long look lord
lose loss lost loud love luck lump lung made mail main make male mall many mark mask mass mate math
meal mean meat meet melt menu mere mild milk mill mind mine miss mist mode mold monk mood moon more
most move much must myth nail name near neat neck need nest news next nice nine node none noon nose
note only open oven over pace pack page paid pain pair pale palm park part pass past path peak pear
peel pick pile pine pink pipe plan play plot plug plus poem poet pole poll pond pool poor port pose
post pour pray pull pump pure push quit race rail rain rank rare rate read real rear rent rest rice
rich ride ring rise risk road rock role roll roof room root rope rose rule rush safe sail sake sale
salt same sand save seal seat seed seek seem self sell send sent shed ship shoe shop shot show shut
sick side silk sing sink site size skin skip slip slow snow soap sock soft soil sold sole some song
soon sort soul soup sour spin spot star stay stem step stir stop such suit sure swim tail take tale
talk tall tank tape task team tear tell tend tent term test text than that them then thin this thus
tide tidy tile till time tiny tire toad told toll tone took tool tore torn tour town trap tray tree
trim trip true tube tune turn twin type unit vain vary vast vest view vote wage wait wake walk wall
want warm warn wash wave weak wear week well went were west what when whom wide wife wild will wind
wine wing wipe wire wise wish with wolf wood wool word wore work worm worn wrap yard yarn year yell
your zero zone
`)
