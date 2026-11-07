export const USERS = {
  daddy: { key: 'daddy', name: 'Daddy', emoji: '🍆', label: 'Daddy 🍆' },
  princess: { key: 'princess', name: 'Princess', emoji: '🍑', label: 'Princess 🍑' },
} as const;

export type UserKey = keyof typeof USERS;

export const RELATIONSHIP_START = new Date(2019, 7, 9); // 08/09/19 -> Aug 9, 2019 (MM/DD/YY)

export interface WordEntry {
  word: string;
  pronunciation: string;
  definition: string;
  example: string;
}

export const WORDS_OF_THE_DAY: WordEntry[] = [
  { word: 'Serendipity', pronunciation: '/ˌser.ənˈdɪp.ə.ti/', definition: 'The occurrence of happy or beneficial events by chance.', example: 'Finding you was pure serendipity — the best kind of accident.' },
  { word: 'Ephemeral', pronunciation: '/ɪˈfem.ər.əl/', definition: 'Lasting for a very short time.', example: 'Our first date felt ephemeral, but the memory lasts forever.' },
  { word: 'Luminescence', pronunciation: '/ˌluː.mɪˈnes.əns/', definition: 'Emission of light by a substance without heat.', example: 'Your smile has a luminescence that lights up my whole day.' },
  { word: 'Resilience', pronunciation: '/rɪˈzɪl.i.əns/', definition: 'The ability to recover quickly from difficulties.', example: 'We grow stronger together — our resilience is our superpower.' },
  { word: 'Aurora', pronunciation: '/əˈrɔːr.ə/', definition: 'A natural light display in the sky, especially near the poles.', example: 'Watching the aurora with you would be a dream come true.' },
  { word: 'Euphoria', pronunciation: '/juːˈfɔːr.i.ə/', definition: 'A feeling of intense excitement and happiness.', example: 'Every time you walk in, I feel euphoria.' },
  { word: 'Solitude', pronunciation: '/ˈsɒl.ɪ.tjuːd/', definition: 'The state of being alone without being lonely.', example: 'Even in solitude, I feel your presence.' },
  { word: 'Harmony', pronunciation: '/ˈhɑːr.mə.ni/', definition: 'A pleasing arrangement of parts in a whole.', example: 'Our lives in harmony — that’s all I ever wanted.' },
  { word: 'Velocity', pronunciation: '/vəˈlɒs.ə.ti/', definition: 'The speed of something in a given direction.', example: 'My heart beats at the velocity of love when you’re near.' },
  { word: 'Mellifluous', pronunciation: '/melˈɪf.lu.əs/', definition: 'Sweet or musical; pleasant to hear.', example: 'Your voice is mellifluous — I could listen forever.' },
  { word: 'Petrichor', pronunciation: '/ˈpet.rɪ.kɔːr/', definition: 'The pleasant smell after rain.', example: 'Petrichor reminds me of our rainy-day cuddles.' },
  { word: 'Sonder', pronunciation: '/ˈsɒn.dər/', definition: 'The realization that each passerby has a life as vivid as your own.', example: 'Sonder makes me grateful our stories intertwined.' },
  { word: 'Vellichor', pronunciation: '/ˈvel.ɪ.kɔːr/', definition: 'The strange wistfulness of used bookshops.', example: 'Vellichor and you — my two favorite cozy things.' },
  { word: 'Chrysalism', pronunciation: '/ˈkrɪs.ə.lɪ.zəm/', definition: 'The amniotic tranquility of being indoors during a storm.', example: 'Chrysalism with you is my happy place.' },
  { word: 'Eunoia', pronunciation: '/juːˈnɔɪ.ə/', definition: 'Beautiful thinking; a well mind.', example: 'Eunoia is what I feel when I’m with you.' },
  { word: 'Ineffable', pronunciation: '/ɪnˈef.ə.bəl/', definition: 'Too great or beautiful to be expressed in words.', example: 'There is an ineffable quality to the way you love me.' },
  { word: 'Iridescent', pronunciation: '/ˌɪr.ɪˈdes.ənt/', definition: 'Showing luminous colors that change with light.', example: 'Your eyes go iridescent in the morning light.' },
  { word: 'Halcyon', pronunciation: '/ˈhæl.si.ən/', definition: 'Denoting a period of calm, idyllic happiness.', example: 'Our halcyon days are my favorite days.' },
  { word: 'Limerence', pronunciation: '/ˈlɪm.ər.əns/', definition: 'The state of being infatuated with someone.', example: 'Limerence hit me hard the first time you smiled at me.' },
  { word: 'Sonderlust', pronunciation: '/ˈsɒn.də.lʌst/', definition: 'A strong desire to explore new places and meet new people.', example: 'Our sonderlust is just an excuse to explore the world hand in hand.' },
  { word: 'Wanderlust', pronunciation: '/ˈwɒn.də.lʌst/', definition: 'A strong desire to travel and explore the world.', example: 'Wanderlust, but make it wander with you forever.' },
  { word: 'Opaline', pronunciation: '/ˈəʊ.pəl.aɪn/', definition: 'Softly white or milky with a pearly glow.', example: 'The morning light was opaline over our bed.' },
  { word: 'Sereia', pronunciation: '/sɪˈreɪ.ə/', definition: 'A mythical mermaid; a beautiful, enchanting sea creature.', example: 'You should have been a sereia — the ocean would have been jealous.' },
  { word: 'Nefelibata', pronunciation: '/ˌnef.ɪ.lɪˈbɑː.tə/', definition: 'Cloud-chasers; a person who lives in their own imagination.', example: 'We are both nefelibata, living in our own little daydream.' },
  { word: 'Kalokagathia', pronunciation: '/ˌkæl.ə.kəˈɡæθ.i.ə/', definition: 'The harmonious combination of beauty and goodness.', example: 'Kalokagathia — that is exactly what you are to me.' },
  { word: 'Apricity', pronunciation: '/æˈprɪs.ə.ti/', definition: 'The warmth of the sun in winter.', example: 'Apricity, and it reminds me of your warmth.' },
  { word: 'Pistachio', pronunciation: '/pɪˈstɑː.ʃi.əʊ/', definition: 'A nut used in desserts; also a shade of soft green.', example: 'Our pistachio-green kitchen looks better because you cook in it.' },
  { word: 'Vermilion', pronunciation: '/vəˈmɪl.jən/', definition: 'A brilliant red-orange color.', example: 'You turn vermilion when you laugh too hard.' },
  { word: 'Limerence-Free', pronunciation: '/ˈlɪm.ər.əns friː/', definition: 'Not a real word, but our secret word for that first obsession phase.', example: 'Limerence-free now — we just love each other, plain and simple.' },
  { word: 'Aurelia', pronunciation: '/ɔːˈriː.li.ə/', definition: 'The golden hour; also a kind of moon gooseberry flower.', example: 'Aurelia is my favorite time of day — that’s when I love you most.' },
  { word: 'Perichoresis', pronunciation: '/ˌper.ɪ.kəˈrəʊ.sɪs/', definition: 'The mutual indwelling of two things.', example: 'Perichoresis — you live in me and I live in you.' },
  { word: 'Tachys', pronunciation: '/ˈtæk.ɪs/', definition: 'A swift stream of clear water.', example: 'Our love flows like a tachys — clear and constant.' },
  { word: 'Orison', pronunciation: '/ˈɒr.ɪ.zən/', definition: 'A rising to a new and more active life.', example: 'Orison — every day with you feels like a new beginning.' },
  { word: 'Nefelibata', pronunciation: '/ˌnef.ɪ.lɪˈbɑː.tə/', definition: 'One who lives in a state of imagination.', example: 'Two nefelibata, building a whole world in our heads.' },
  { word: 'Quixotic', pronunciation: '/kwɪkˈsɒt.ɪk/', definition: 'Extremely idealistic, impractical, and romantic.', example: 'Our love is so quixotic it makes the movies blush.' },
  { word: 'Reticent', pronunciation: '/ˈret.ɪ.sənt/', definition: 'Not revealing personal thoughts or feelings readily.', example: 'You are reticent until you laugh — then you are an open book.' },
  { word: 'Senescence', pronunciation: '/sɪˈnes.əns/', definition: 'The gradual deterioration of functional characteristics in living things.', example: 'Senescence — we are not getting old, we are getting better.' },
  { word: 'Utmost', pronunciation: '/ˈʌt.məʊst/', definition: 'Of the greatest or highest degree.', example: 'I love you to the utmost — past the end of the universe.' },
  { word: 'Vivid', pronunciation: '/ˈvɪv.ɪd/', definition: 'Producing powerful feelings or strong images.', example: 'Every memory with you is so vivid it feels real.' },
  { word: 'Wistful', pronunciation: '/ˈwɪst.fəl/', definition: 'Sadly longing for something lost.', example: 'I am wistful for yesterday, but excited for tomorrow with you.' },
  { word: 'Yearn', pronunciation: '/jɜːn/', definition: 'To have an intense longing for something.', example: 'I yearn for the days we were new — and I yearn for every other day too.' },
  { word: 'Zephyr', pronunciation: '/ˈzef.ər/', definition: 'A soft, gentle breeze.', example: 'You are my favorite zephyr — soft, warm, and everywhere I breathe.' },
  { word: 'Anchoring', pronunciation: '/ˈæŋ.kər.ɪŋ/', definition: 'The act of providing stability or security.', example: 'You have anchored my world in the best possible way.' },
  { word: 'Bower', pronunciation: '/ˈbaʊ.ər/', definition: 'A pleasant, shady place under a tree or arbor.', example: 'Our bower is wherever we end up — shade and all.' },
  { word: 'Cascara', pronunciation: '/kæsˈkɑː.rə/', definition: 'A type of coffeeberry; also a beautiful color.', example: 'Cascara eyes are my favorite color in the world — yours.' },
  { word: 'Draíocht', pronunciation: '/ˈdriː.xəxt/', definition: 'A work of magic or enchantment (Irish).', example: 'Draíocht — that is what you cast on me from day one.' },
  { word: 'Everlasting', pronunciation: '/ˌev.ərˈlɑː.stɪŋ/', definition: 'Lasting for a very long time or forever.', example: 'Our everlasting thing is that we always choose each other.' },
  { word: 'Fable', pronunciation: '/ˈfeɪ.bəl/', definition: 'A short story that teaches a moral.', example: 'Our story is a fable — with a very happy ending.' },
  { word: 'Gilded', pronunciation: '/ˈɡɪl.dɪd/', definition: 'Covered with gold or a golden color.', example: 'You have a gilded heart — I am lucky to be near it.' },
  { word: 'Hush', pronunciation: '/hʌʃ/', definition: 'To become quiet or still.', example: 'Hush — just stay here with me a little longer.' },
  { word: 'Iridescence', pronunciation: '/ˌɪr.ɪˈdes.əns/', definition: 'The quality of glowing with shifting colors.', example: 'Iridescence is exactly how you look when you are barely awake.' },
  { word: 'Jubilee', pronunciation: '/ˈdʒuː.bɪ.liː/', definition: 'A special anniversary, often celebrated with joy.', example: 'Every year with you is a jubilee.' },
  { word: 'Kindle', pronunciation: '/ˈkɪn.dəl/', definition: 'To arouse or inspire.', example: 'You kindle something in me that nothing else can.' },
  { word: 'Lullaby', pronunciation: '/ˈlʌl.ə.baɪ/', definition: 'A soothing song sung to quiet a child.', example: 'Your sleepy humming is my favorite lullaby.' },
  { word: 'Marvel', pronunciation: '/ˈmɑː.vəl/', definition: 'A wonderful or astonishing person or thing.', example: 'You are my favorite marvel — every single day.' },
  { word: 'Nocturne', pronunciation: '/ˈnɒk.tɜːn/', definition: 'A musical composition inspired by the night.', example: 'Our nights together are the best nocturne ever written.' },
  { word: 'Obsession', pronunciation: '/əbˈseʃ.ən/', definition: 'A persistent preoccupation or fixation.', example: 'My obsession is simple: you, in every lifetime.' },
  { word: 'Penumbra', pronunciation: '/pɪˈnʌm.brə/', definition: 'The partially shaded region during an eclipse.', example: 'We orbit each other in our own penumbra — I would not have it any other way.' },
  { word: 'Quiver', pronunciation: '/ˈkwɪv.ər/', definition: 'A slight, rapid shaking motion; also an arrow case.', example: 'I still get a quiver when you walk into the room.' },
  { word: 'Rhapsody', pronunciation: '/ˈræp.sə.di/', definition: 'An expression of great happiness or delight.', example: 'Our love is a rhapsody — loud, bright, and entirely ours.' },
  { word: 'Sempiternal', pronunciation: '/ˌsem.pɪˈtɜː.nəl/', definition: 'Always existing; eternal.', example: 'Sempiternal — that is what I want us to be.' },
  { word: 'Tranquil', pronunciation: '/ˈtræŋ.kwɪl/', definition: 'Free from agitation or disturbance.', example: 'You are my tranquil place in a loud world.' },
  { word: 'Umbra', pronunciation: '/ˈʌm.brə/', definition: 'The innermost, darkest part of a shadow.', example: 'In your umbra, I finally saw my own light.' },
  { word: 'Verve', pronunciation: '/vɜːv/', definition: 'Vigor and enthusiasm.', example: 'Your verve makes every ordinary day feel like an adventure.' },
  { word: 'Willow', pronunciation: '/ˈwɪl.əʊ/', definition: 'A tree known for its long, drooping branches.', example: 'We willow — bending a little, but never breaking.' },
  { word: 'Xanadu', pronunciation: '/ˈzæn.ə.duː/', definition: 'A place of great beauty and beauty idealized.', example: 'Xanadu is just wherever we end up together.' },
  { word: 'Yonder', pronunciation: '/ˈjɒn.dər/', definition: 'Over there, at a distance.', example: 'Yonder — that is where our next adventure waits for us.' },
  { word: 'Zeal', pronunciation: '/ziːl/', definition: 'Great energy or enthusiasm in pursuit of a cause.', example: 'I love you with zeal — the wholehearted, all-in kind.' },
  { word: 'Aureate', pronunciation: '/ɔː.riːˈeɪt/', definition: 'Golden in color; also splendid or opulent.', example: 'Aureate light, golden mornings, your face. That is the whole list.' },
  { word: 'Belle', pronunciation: '/bel/', definition: 'A beautiful woman; also a bell in French.', example: 'Belle — the whole world hears you, I just hear music.' },
  { word: 'Cadence', pronunciation: '/ˈkeɪ.dəns/', definition: 'The rhythm of spoken or written language.', example: 'The cadence of your laugh is my favorite sound.' },
  { word: 'Dawn', pronunciation: '/dɔːn/', definition: 'The first light of day.', example: 'You are my dawn — every morning gets better.' },
  { word: 'Evermore', pronunciation: '/ˌev.ərˈmɔːr/', definition: 'Always, eternally, from now on.', example: 'Evermore, darling. That was always the plan.' },
  { word: 'Fable', pronunciation: '/ˈfeɪ.bəl/', definition: 'A traditional story, often with a moral.', example: 'We are the fable kids will be told about one day.' },
];

export const FACTS_OF_THE_DAY: string[] = [
  'Honey never spoils; archaeologists have found edible honey in ancient tombs.',
  'A day on Venus is longer than a year on Venus.',
  'Octopuses have three hearts and blue blood.',
  'Bananas are berries, but strawberries are not.',
  'The Eiffel Tower can be 15 cm taller during hot summer days.',
  'Sharks existed before trees.',
  'There are more stars in the universe than grains of sand on Earth.',
  'A group of flamingos is called a "flamboyance."',
  'Wombat poop is cube-shaped.',
  'The human brain uses about 20% of the body\u2019s energy.',
  'Hot water can freeze faster than cold water — it\u2019s called the Mpemba effect.',
  'Sea otters hold hands so they don\u2019t float away from each other.',
  'A shrimp\u2019s heart is in its head.',
  'The first oranges weren\u2019t orange — they were green.',
  'Pigeons can tell the difference between Monet and Picasso paintings.',
  'Your nose can remember 50,000 different scents.',
  'Penguins propose to their mates with a pebble.',
  'The Great Wall of China is held together by sticky rice.',
  'Humans share 60% of their DNA with bananas.',
  'There are more possible chess games than atoms in the universe.',
  'A jiffy is an actual unit of time: 1/100th of a second.',
  'Cows have best friends and get stressed when separated.',
  'The first computer programmer was Ada Lovelace, in the 1840s.',
  'Bubble wrap was originally created as wallpaper.',
  'Cleopatra lived closer in time to the iPhone than to the pyramids\u2019 construction.',
  'A group of hedgehogs is called an "array."',
  'Your taste buds have a lifespan of about 10–14 days.',
  'The inventor of Pringles is buried in a Pringles can.',
  'Sloths can hold their breath longer than dolphins.',
  'A snail can sleep for up to three years.',
  'Sound travels 4.3 times faster in water than in air.',
  'There are no mosquitoes that bite humans in Iceland.',
  'The oldest tree in the world is over 5,000 years old.',
  'Woman is the only mammal that voluntarily delays breathing.',
  'Frederick the Great was afraid of cucumbers.',
  'In Switzerland, it\u2019s illegal to own just one guinea pig.',
  'A day on Mercury is two years long on Mercury.',
  'The first oranges were green, not orange.',
  'More people use blue than any other color.',
  'Your brain generates about 20 watts of electrical power — enough to power a lightbulb.',
  'The unicorn is Scotland\u2019s national animal.',
  'The first bird ever to fly was a Archaeopteryx, about 150 million years ago.',
  'Honeybees can recognize human faces.',
  'A single strand of spaghetti is a "spaghetto."',
  'Humans are the only animals that blush.',
  'The first 1GB hard drive weighed over 200 pounds.',
  'Koalas have fingerprints nearly identical to humans.',
  'There\u2019s a species of jellyfish that is biologically immortal.',
  'The word "robot" comes from a Czech word meaning "forced labor."',
  'A cloud can weigh about a million pounds.',
  'Sea otters have the densest fur of any animal: up to a million hairs per square inch.',
  'The first person to survive Niagara Falls in a barrel was a 63-year-old schoolteacher.',
  'Bananas are radioactive (potassium-40), but perfectly safe.',
  'A bolt of lightning is five times hotter than the Sun\u2019s surface.',
  'The first tongue twister was recorded in 1933.',
  'Otters sleep holding hands so they don\u2019t drift apart.',
  'A group of porcupines is called a "quilliam."',
  'The inventor of the Pringles can is buried in one.',
  'Your body produces about 25 million new cells every second.',
  'There are more trees on Earth than stars in the Milky Way.',
  'Mantis shrimp can punch with the force of a bullet.',
  'The first oranges were from Southeast Asia and were green.',
  'Peanuts are one of the ingredients in dynamite.',
  'A duck\u2019s quack doesn\u2019t echo — and scientists still aren\u2019t 100% sure why.',
  'The Earth is not a perfect sphere — it\u2019s slightly squashed at the poles.',
  'You can\u2019t hum while holding your nose closed.',
  'A single lightning bolt can heat the air around it to 30,000°C.',
  'Your DNA is ~99.9% identical to every other human\u2019s.',
  'The first man-made object in space was Sputnik 1, in 1957.',
  'A group of crows is called a "murder."',
  'Hot chocolate was invented to make medicine taste better.',
  'There\u2019s enough DNA in your body to stretch to the Sun and back ~100 times.',
  'Sea cucumbers breathe through their bottoms.',
  'The first kangaroo to be photographed in motion was in 1878.',
  'Octopuses have tasting buds on their arms.',
];

export interface CoverPhoto {
  id: string;
  title: string;
  url: string;
}

export const COVER_PHOTO_POOL: CoverPhoto[] = Array.from({ length: 12 }).map((_, i) => ({
  id: `cover-${i + 1}`,
  title: `Cover ${i + 1}`,
  url: `https://picsum.photos/seed/ilyalways-cover-${i + 1}/800/500`,
}));

export function pickDailyItems<T>(pool: T[], count: number, seed: number): T[] {
  // deterministic daily selection
  const result: T[] = [];
  const n = pool.length;
  if (n === 0) return result;
  for (let i = 0; i < count; i++) {
    const idx = (seed + i * 7) % n;
    // avoid duplicates
    if (!result.includes(pool[idx])) result.push(pool[idx]);
  }
  // fill if duplicates skipped
  let cursor = seed;
  while (result.length < count && result.length < n) {
    const idx = cursor % n;
    if (!result.includes(pool[idx])) result.push(pool[idx]);
    cursor++;
  }
  return result;
}

export function daySeed(date = new Date()): number {
  return date.getFullYear() * 1000 + (date.getMonth() + 1) * 50 + date.getDate();
}

export function todayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}