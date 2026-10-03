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
`);

export const DECKS: DeckDef[] = [
  { id: 'party', name: 'Party Mix', emoji: '🎉', blurb: 'Everyday chaos. Works with No-Go Zone.', cards: PARTY },
  { id: 'movies', name: 'Screen Time', emoji: '🍿', blurb: 'Movies, shows, characters.', cards: MOVIES },
  { id: 'food', name: 'Snack Attack', emoji: '🌮', blurb: 'Things you eat at 2am.', cards: FOOD },
  { id: 'animals', name: 'Zoo-ish', emoji: '🦒', blurb: 'Creatures great and weird.', cards: ANIMALS },
  { id: 'spicy', name: 'Group Chat', emoji: '🌶️', blurb: 'Internet brain & dating lore.', cards: SPICY },
  { id: 'work', name: 'Office Hours', emoji: '💼', blurb: 'For coworkers who need this.', cards: WORK },
];

export const DECK_BY_ID: Record<string, DeckDef> = Object.fromEntries(DECKS.map((d) => [d.id, d]));
