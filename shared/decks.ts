import type { Card } from './types';

export interface DeckDef {
  id: string;
  name: string;
  emoji: string;
  blurb: string;
  cards: Card[];
}

/** "WORD|nogo,nogo,nogo" — compact authoring format. */
function parse(src: string): Card[] {
  return src
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [word, nogo] = l.split('|');
      return nogo ? { word: word.trim(), nogo: nogo.split(',').map((s) => s.trim()) } : { word: word.trim() };
    });
}

const PARTY = parse(`
Apple|fruit,red,tree
Birthday|cake,candles,party
Volcano|lava,erupt,mountain
Toothbrush|teeth,brush,dentist
Pirate|ship,treasure,parrot
Snowman|snow,carrot,winter
Karaoke|sing,microphone,song
Sunburn|sun,red,beach
Hiccup|breath,water,scare
Umbrella|rain,wet,open
Vampire|blood,bite,Dracula
Ghost|boo,scary,haunted
Pillow fight|bed,sleepover,feathers
Selfie|phone,photo,camera
Treadmill|run,gym,machine
Sandwich|bread,lunch,ham
Ninja|stealth,sword,Japan
Rollercoaster|ride,loop,theme park
Wedding|bride,marry,ring
Lighthouse|ship,light,coast
Bubble wrap|pop,package,plastic
Astronaut|space,moon,rocket
Pizza|cheese,slice,Italy
Dinosaur|extinct,T-rex,fossil
Magician|magic,rabbit,trick
Traffic jam|cars,stuck,road
Waffle|breakfast,syrup,pancake
Escalator|stairs,mall,moving
Alarm clock|wake,morning,ring
Penguin|bird,ice,tuxedo
Haunted house|ghost,scary,Halloween
Fortune cookie|Chinese,message,restaurant
Gym|workout,weights,exercise
Moustache|face,hair,lip
Tattoo|ink,skin,needle
Hammock|swing,relax,trees
Sneeze|nose,bless you,cold
Detective|mystery,clue,Sherlock
Lemonade|lemon,drink,stand
Popcorn|movie,butter,pop
Fireworks|explode,sky,July
Spaghetti|pasta,Italian,noodles
Zombie|undead,brains,walk
Library|books,quiet,borrow
Brain freeze|ice cream,cold,head
Sloth|slow,tree,lazy
Group chat|text,friends,phone
Bowling|pins,ball,strike
Robot|machine,metal,beep
Superhero|cape,powers,save
Camping|tent,outdoors,fire
Cactus|desert,spiky,plant
Mermaid|fish,sea,tail
Jellyfish|sting,ocean,blob
Glitter|sparkle,craft,shiny
Wi-Fi|internet,password,connection
Spa day|massage,relax,facial
Unicorn|horn,horse,magical
Thunderstorm|lightning,rain,loud
Garage sale|yard,sell,old stuff
Lip sync|mouth,song,battle
Dad joke|father,pun,bad
Taco|Mexican,shell,Tuesday
Sushi|fish,rice,Japanese
Juggling|balls,throw,circus
Skateboard|wheels,ride,tricks
Hot tub|water,bubbles,jacuzzi
Marathon|run,26,race
Ice cream truck|music,summer,van
Podcast|listen,episode,audio
Influencer|social media,followers,Instagram
Monday|week,day,weekend
Tickle|laugh,fingers,feet
Pajamas|sleep,bed,clothes
Time machine|travel,past,future
Avocado|guacamole,green,toast
Parachute|jump,plane,sky
Snorkel|swim,mask,underwater
Bigfoot|hairy,legend,forest
Microwave|heat,kitchen,popcorn
Photobomb|picture,ruin,camera
Bagpipes|Scotland,music,instrument
Free sample|costco,taste,store
Lottery|win,ticket,money
Hangover|drink,headache,morning
Bunk bed|sleep,top,ladder
Road trip|car,drive,travel
Puppet|strings,hand,show
Bridesmaid|wedding,dress,bride
Fanny pack|waist,bag,belt
Bed head|hair,morning,messy
Speed bump|slow,road,car
Spelling bee|letters,contest,spell
Snow day|school,cancelled,winter
Mosh pit|concert,crowd,push
Tumbleweed|desert,roll,western
Belly flop|dive,pool,splash
Third wheel|date,couple,awkward
Food coma|eat,full,sleep
Shopping cart|grocery,wheels,push
Lifeguard|pool,beach,whistle
Hide and seek|count,find,game
Paper airplane|fold,fly,throw
Sleepwalking|night,bed,asleep
Thumb war|fingers,wrestle,hand
Pillow|sleep,head,bed
Rubber duck|bath,yellow,squeak
Tooth fairy|teeth,money,pillow
Piñata|candy,stick,party
Trampoline|jump,bounce,backyard
Sandcastle|beach,build,bucket
Sunscreen|sun,lotion,burn
Fire drill|alarm,school,evacuate
Leaf blower|leaves,loud,yard
Car wash|soap,clean,vehicle
Tug of war|rope,pull,team
Scarecrow|crows,field,straw
Kazoo|hum,instrument,buzz
Typo|spelling,mistake,keyboard
Voicemail|phone,message,beep
Autocorrect|phone,typing,wrong
Password|login,secret,forgot
Battery|charge,power,phone
Hiccups|breath,scare,water
Goosebumps|skin,cold,chills
Jet lag|travel,tired,time zone
Pothole|road,hole,car
Parallel parking|car,space,park
Speed dating|minutes,date,single
Blind date|meet,stranger,romance
Snowball fight|throw,winter,cold
Ice skating|rink,blades,winter
Sledding|snow,hill,slide
Campfire|smores,wood,flames
Tent|camping,sleep,zipper
Compass|north,direction,map
Treasure map|X,pirate,dig
Message in a bottle|ocean,letter,glass
Shipwreck|boat,sink,ocean
Quicksand|sink,desert,stuck
Mirror|reflection,glass,look
Wig|hair,fake,head
Eyebrows|face,hair,eyes
Yawn|tired,mouth,sleepy
Wink|eye,flirt,blink
High five|hand,slap,celebrate
Fist bump|knuckles,hand,dap
Group hug|arms,squeeze,everyone
Secret handshake|friends,hand,code
`);

const MOVIES = parse(`
Titanic
Star Wars
Harry Potter
The Lion King
Jurassic Park
Frozen
Shrek
Toy Story
Finding Nemo
Jaws
The Matrix
Barbie
Spider-Man
Batman
Mean Girls
Home Alone
The Office
Friends
Stranger Things
Game of Thrones
The Simpsons
Breaking Bad
Squid Game
Back to the Future
Ghostbusters
Rocky
E.T.
Pirates of the Caribbean
The Godfather
Mamma Mia
Grease
Top Gun
Indiana Jones
Wednesday
SpongeBob
Scooby-Doo
Gladiator
Inception
Avatar
Lord of the Rings
Mission Impossible
Hunger Games
Twilight
The Avengers
Paddington
James Bond
Godzilla
King Kong
Ratatouille
Up
Jurassic World
The Little Mermaid
Aladdin
Moana
Encanto
Coco
Minions
Despicable Me
Kung Fu Panda
Madagascar
Ice Age
Monsters Inc
The Incredibles
Cars
Zootopia
Inside Out
WALL-E
Spirited Away
Pokémon
Mario Kart
Minecraft
Fortnite
Tetris
Pac-Man
Sonic
Zelda
The Bachelor
Survivor
American Idol
Shark Tank
Great British Bake Off
Love Island
Oprah
Sesame Street
Barney
Teletubbies
Power Rangers
Ninja Turtles
Transformers
Wonder Woman
Superman
Hulk
Iron Man
Thor
Black Panther
Deadpool
Shrek's donkey
Darth Vader
Yoda
Gandalf
Dumbledore
Voldemort
Hermione
Willy Wonka
Mary Poppins
Cinderella
Snow White
Peter Pan
Tinker Bell
Winnie the Pooh
Mickey Mouse
Bugs Bunny
Garfield
Snoopy
Homer Simpson
Rick and Morty
Bluey
Peppa Pig
Paw Patrol
`);

const FOOD = parse(`
Croissant
Burrito
Pancakes
Ramen
Cheesecake
Hot dog
French fries
Guacamole
Nachos
Meatball
Dumpling
Pretzel
Corn dog
Milkshake
Smoothie
Brownie
Cupcake
Donut
Kale
Broccoli
Garlic bread
Lasagna
Mac and cheese
Peanut butter
Pickle
Popsicle
Barbecue
Bacon
Omelette
Cereal
Fondue
Hot sauce
Gummy bears
Cotton candy
S'mores
Kombucha
Espresso
Bubble tea
Watermelon
Coconut
Burger
Cinnamon roll
Chicken nuggets
Lobster
Oyster
Tofu
Quesadilla
Churro
Fortune cookie
Jelly beans
Spring rolls
Pad thai
Curry
Biryani
Falafel
Hummus
Kebab
Gyro
Paella
Tiramisu
Crème brûlée
Baguette
Bagel
Pretzel bites
Cheese pizza
Pepperoni
Calzone
Meatloaf
Pot roast
Mashed potatoes
Gravy
Stuffing
Cranberry sauce
Pumpkin pie
Apple pie
Banana split
Sundae
Waffle cone
Frozen yogurt
Energy drink
Lemon
Lime
Mango
Pineapple
Strawberry
Blueberry
Cherry
Grapes
Peach
Corn on the cob
Baked beans
Coleslaw
Potato salad
Ketchup
Mustard
Mayonnaise
Sriracha
Salsa
Sour cream
Trail mix
Granola bar
Instant noodles
Microwave popcorn
Cheese puffs
Beef jerky
Breakfast burrito
Eggs Benedict
French toast
Avocado toast
`);

const ANIMALS = parse(`
Giraffe
Octopus
Kangaroo
Flamingo
Hedgehog
Platypus
Chameleon
Peacock
Llama
Raccoon
Panda
Koala
Narwhal
Shark
Owl
Squirrel
Goldfish
Hamster
Bulldog
Butterfly
Mosquito
Hippo
Crocodile
Gorilla
Zebra
Porcupine
Seal
Walrus
Skunk
Bat
Turtle
Parrot
Pigeon
Lobster
Snail
Bee
Goat
Pig
Cheetah
Moose
Beaver
Otter
Ostrich
Camel
Alpaca
Wolf
Fox
Polar bear
Tarantula
Hummingbird
Elephant
Lion
Tiger
Monkey
Dolphin
Whale
Jellyfish
Starfish
Crab
Seahorse
Eel
Stingray
Pufferfish
Clownfish
Sea turtle
Frog
Toad
Lizard
Snake
Iguana
Gecko
Rooster
Chicken
Duck
Goose
Swan
Eagle
Vulture
Woodpecker
Crow
Bunny
Guinea pig
Ferret
Chihuahua
Poodle
Golden retriever
Cat
Kitten
Puppy
Donkey
Horse
Pony
Unicorn
Dragon
Yeti
Loch Ness Monster
Mammoth
T-rex
Ladybug
Spider
Ant
Cockroach
Caterpillar
Firefly
Dragonfly
Grasshopper
Worm
Slug
Bear
`);

const SPICY = parse(`
Situationship
Ghosting
Red flag
Ick
Rizz
Main character
Touch grass
Doomscrolling
Brunch
Ex
Tinder
Hangry
Beer pong
Walk of shame
Cringe
Meme
Vibe check
Side eye
Group project
Bucket list
Overthinking
Plot twist
Mid
Karen
Gaslighting
Humblebrag
FOMO
Netflix and chill
Bachelor party
Wingman
Spill the tea
Clapback
Sugar daddy
Love language
Day drinking
Slide into DMs
Rent free
Delulu
Hot girl walk
Ugly crying
Soft launch
Situation room
Unhinged
Era
Slay
No cap
Bestie
Petty
Brat summer
Parasocial
Gatekeeping
Doom spending
Quiet quitting
Lowkey
Highkey
Seen-zoned
Breadcrumbing
Love bombing
Hard launch
Roman Empire
Girl dinner
Beige flag
Ate and left no crumbs
Touch base
Thirst trap
Glow up
Catfish
Stan
Simp
Hot take
Rizzler
Skibidi
Clout
Vibes
Ghost
Left on read
Main quest
Side quest
NPC
`);

const WORK = parse(`
Reply all
Zoom call
Coffee break
Deadline
Performance review
Spreadsheet
Team building
Out of office
Mute button
Printer jam
Promotion
Intern
Water cooler
Standing desk
Casual Friday
Happy hour
Burnout
Elevator pitch
Synergy
Circle back
Commute
Paycheck
Lanyard
Org chart
Brainstorm
Sticky note
PowerPoint
Overtime
Layoff
Hot desk
Inbox zero
Calendar invite
Office plant
Keynote
Quarterly report
Small talk
Microwave fish
Badge
Unpaid leave
Sick day
All hands
Stand-up meeting
KPI
Bandwidth
Deep dive
Low-hanging fruit
Move the needle
Per my last email
Can you hear me now
You’re on mute
Screen share
Fire drill
Offsite
Swag
Free pizza
Birthday cake in the break room
Fridge thief
Printer
Stapler
Whiteboard
Ergonomic chair
Cubicle
Corner office
Boss
Coworker
Resignation letter
Two weeks notice
Job interview
Résumé
LinkedIn
Networking
Raise
Bonus
Expense report
Business trip
Conference room
Name tag
Icebreaker
Secret Santa
`);

const WORLD = parse(`
Eiffel Tower
Statue of Liberty
Great Wall of China
Pyramids
Grand Canyon
Niagara Falls
Mount Everest
Hollywood
Las Vegas
New York City
Paris
London
Tokyo
Hawaii
Disneyland
Times Square
Golden Gate Bridge
Big Ben
Colosseum
Leaning Tower of Pisa
Stonehenge
Amazon rainforest
Sahara Desert
North Pole
Antarctica
Australia
Canada
Mexico
Brazil
Italy
Japan
Egypt
Iceland
Venice
Bermuda Triangle
Airport security
Passport
Suitcase
Road map
Gas station
Motel
Cruise ship
Hostel
Theme park
Tour guide
Souvenir
Postcard
Jet ski
Scuba diving
Hot air balloon
Gondola
Subway
Taxi
Rickshaw
Train station
Lighthouse
Volcano
Glacier
Island
Waterfall
`);

const SPORTS = parse(`
Touchdown
Home run
Slam dunk
Hat trick
Penalty kick
Goalie
Referee
Cheerleader
Mascot
Halftime show
Super Bowl
World Cup
Olympics
Gold medal
Marathon
Relay race
Hurdles
Pole vault
High jump
Javelin
Gymnastics
Cartwheel
Somersault
Surfing
Skateboarding
Snowboarding
Skiing
Boxing
Wrestling
Karate
Yoga
Pilates
Push-up
Sit-up
Jumping jacks
Bowling
Mini golf
Ping pong
Tennis
Badminton
Volleyball
Dodgeball
Frisbee
Kickball
Hopscotch
Jump rope
Chess
Checkers
Monopoly
Uno
Jenga
Twister
Scrabble
Poker
Bingo
Video game
Controller
Cheat code
Rage quit
Victory dance
`);

const MUSIC = parse(`
Beyoncé
Taylor Swift
Elvis
Michael Jackson
The Beatles
Lady Gaga
Drake
Bad Bunny
Rihanna
Bruno Mars
Ed Sheeran
Shakira
Dolly Parton
Madonna
Britney Spears
Moonwalk
Air guitar
Drum solo
Mosh pit
Encore
Boy band
Girl group
Rap battle
Beatbox
DJ
Microphone
Headphones
Vinyl record
Playlist
Concert
Music festival
Opera
Choir
Marching band
Orchestra
Conductor
Piano
Violin
Saxophone
Trumpet
Harmonica
Ukulele
Tambourine
Triangle
Cowbell
Karaoke night
Lullaby
National anthem
Happy Birthday song
Macarena
Chicken dance
Electric slide
Breakdancing
Ballet
Tap dance
Salsa dancing
TikTok dance
Music video
Grammy
Autotune
`);

const FAMILY = parse(`
Teddy bear
Bubble bath
Bedtime story
Night light
Lunchbox
School bus
Recess
Playground
Swing set
Slide
Sandbox
Crayons
Glitter glue
Coloring book
Finger painting
Building blocks
LEGO
Puzzle
Kite
Balloon
Bubbles
Water balloon
Squirt gun
Lemonade stand
Treehouse
Pillow fort
Sleepover
Tooth brushing
Bath time
Nap time
Tantrum
Tickle monster
Peekaboo
Piggyback ride
Freeze tag
Duck duck goose
Musical chairs
Simon says
Red light green light
Hot potato
Ice cream cone
Cupcake
Birthday party
Magic trick
Superhero cape
Princess
Castle
Knight
Dinosaur
Robot
Rocket ship
Alien
Monster under the bed
Dragon
Mermaid
Pirate ship
Fairy
Wizard
Snowman
Rainbow
`);

const HOLIDAYS = parse(`
Christmas tree
Santa Claus
Reindeer
Elf on the Shelf
Stocking
Candy cane
Gingerbread house
Ugly sweater
Mistletoe
Snow globe
Hanukkah
Menorah
Dreidel
Kwanzaa
New Year’s Eve
Countdown
Fireworks
Champagne
Resolution
Valentine’s Day
Love letter
Cupid
Chocolate box
Easter egg
Easter bunny
Egg hunt
St. Patrick’s Day
Leprechaun
Pot of gold
Four-leaf clover
Fourth of July
Barbecue
Parade
Halloween
Costume
Trick or treat
Jack-o’-lantern
Haunted house
Candy corn
Witch
Thanksgiving
Turkey
Wishbone
Pumpkin spice
Black Friday
Diwali
Lanterns
Lunar New Year
Red envelope
Dragon dance
Birthday candles
Surprise party
Wedding cake
Baby shower
Graduation
Anniversary
Mother’s Day
Father’s Day
Spring break
Summer vacation
`);

const NERDY = parse(`
Black hole
Gravity
Solar system
Moon landing
Mars rover
Telescope
Microscope
Atom
DNA
Dinosaur fossil
Volcano eruption
Earthquake
Tornado
Hurricane
Rainbow
Lightning
Magnet
Electricity
Battery
Robot vacuum
Artificial intelligence
Smartphone
Wi-Fi password
Bluetooth
Password reset
Spam email
Computer virus
Hacker
Blue screen
Loading bar
Captcha
Emoji
Hashtag
Selfie stick
Drone
Virtual reality
3D printer
Time travel
Teleportation
Invisibility cloak
Lightsaber
Spaceship
Alien abduction
UFO
Crop circles
Bigfoot sighting
Conspiracy theory
Brain
Skeleton
Heartbeat
Sneeze
Vaccine
Dentist
Mad scientist
Lab coat
Periodic table
Pi
Calculator
Einstein
Spreadsheet
`);

export const DECKS: DeckDef[] = [
  { id: 'party', name: 'Party Mix', emoji: '🎉', blurb: 'Everyday chaos. Works with No-Go Zone.', cards: PARTY },
  { id: 'movies', name: 'Screen Time', emoji: '🍿', blurb: 'Movies, shows, characters.', cards: MOVIES },
  { id: 'food', name: 'Snack Attack', emoji: '🌮', blurb: 'Things you eat at 2am.', cards: FOOD },
  { id: 'animals', name: 'Zoo-ish', emoji: '🦒', blurb: 'Creatures great and weird.', cards: ANIMALS },
  { id: 'spicy', name: 'Group Chat', emoji: '🌶️', blurb: 'Internet brain & dating lore.', cards: SPICY },
  { id: 'work', name: 'Office Hours', emoji: '💼', blurb: 'For coworkers who need this.', cards: WORK },
  { id: 'world', name: 'Passport', emoji: '🌍', blurb: 'Places, landmarks, travel chaos.', cards: WORLD },
  { id: 'sports', name: 'Game Day', emoji: '🏆', blurb: 'Sports, board games, gym pain.', cards: SPORTS },
  { id: 'music', name: 'Mixtape', emoji: '🎤', blurb: 'Stars, songs, dance moves.', cards: MUSIC },
  { id: 'family', name: 'Family Night', emoji: '🧸', blurb: 'Kid-friendly. Grandma-approved.', cards: FAMILY },
  { id: 'holidays', name: 'Holiday Mode', emoji: '🎄', blurb: 'Every holiday, all year.', cards: HOLIDAYS },
  { id: 'nerdy', name: 'Big Brain', emoji: '🧪', blurb: 'Science, tech, space, weird stuff.', cards: NERDY },
];

export const DECK_BY_ID: Record<string, DeckDef> = Object.fromEntries(DECKS.map((d) => [d.id, d]));
