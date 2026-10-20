// a cat bingo card: 24 squares and a free middle, dealt from the round's seed and the player's session
// id, so everyone gets a different card that survives a reload; a win is a full row, column or diagonal

// cats on screen, cat things in the show, and the room's own cat
export const TROPES = [
  'A cat appears',
  'Cat ears on a character',
  'Someone says "nya"',
  'Catgirl',
  'Talking cat',
  'A cat steals food',
  'Cat napping in the sun',
  'Fish on screen',
  'Someone feeds a cat',
  'Cat in a box',
  'Lucky cat statue',
  'Black cat crosses the path',
  'A :3 face',
  'Tail swish',
  'Cat knocks something over',
  'Ball of yarn',
  'Whiskers on a face',
  'Cat café',
  'Glowing eyes in the dark',
  'Bell on a collar',
  'Someone gets scratched',
  'Paw prints',
  'A cat hisses',
  'Someone pets a cat',
  'Cat mascot character',
  'Cat-shaped food',
  'Someone curls up like a cat',
  'Someone sneezes',
  'Stray cat in the rain',
  'Cat on a roof',
  'Cat stares at nothing',
  'Taiyaki or fish snack',
  'Someone acts like a cat',
  'Cat chases something',
  'Cat on a lap',
  'Big cat yawn',
  'A kitten!',
  'Someone says "meow" in chat',
  'Tuna gets fed',
  'Tuna chases her yarn',
  'Someone plays a hiss',
  'Tuna falls asleep',
] as const

export const FREE = 12 // the middle square
export const SIZE = 5

// a small seeded PRNG (mulberry32) over a string hash: the same seed deals the same card
function rng(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
  let a = (h << 13) | (h >>> 19)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function deal(seed: string, player: string): string[] {
  const next = rng(seed + ':' + player)
  const deck = [...TROPES]
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  const card: string[] = deck.slice(0, SIZE * SIZE - 1)
  card.splice(FREE, 0, '')
  return card
}

// the rows, columns and diagonals, as square indexes
export const LINES: number[][] = [
  ...Array.from({ length: SIZE }, (_, r) => Array.from({ length: SIZE }, (_, c) => r * SIZE + c)),
  ...Array.from({ length: SIZE }, (_, c) => Array.from({ length: SIZE }, (_, r) => r * SIZE + c)),
  Array.from({ length: SIZE }, (_, i) => i * (SIZE + 1)),
  Array.from({ length: SIZE }, (_, i) => (i + 1) * (SIZE - 1)),
]

// the free middle always counts as marked
export const isBingo = (marked: ReadonlySet<number>) => LINES.some((l) => l.every((i) => i === FREE || marked.has(i)))
