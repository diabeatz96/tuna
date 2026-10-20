// Tuna's personality: what she says about what happens, what she does when nothing does, her moods
// by the clock and the calendar, and how chatty she is. Pure functions of the time, the room and a
// random number, so they can be tested.
import type { Talk } from '@/state/app'
import type { CueKind } from '@/state/bus'

export type Say =
  | Exclude<CueKind, 'chat'>
  | 'fed'
  | 'pet'
  | 'ball'
  | 'caught'
  | 'laser'
  | 'laser_gone'
  | 'box'
  | 'hat'
  | 'hat_off'
  | 'hungry'
  | 'wake'
  | 'grump'
  | 'zoomies'
  | 'pumpkin'
  | 'idle'
  | 'night'
  | 'halloween'
  | 'winter'
  | 'hover'

// her lines; {name} is someone's name
export const LINES: Record<Say, string[]> = {
  join: [
    'hi {name}!',
    '{name}! mrrp!',
    'welcome, {name} ♪',
    "{name}'s here!",
    'oh! {name}!',
    'yay, {name} came',
    '{name}! sit with me',
    'mrrow, hi {name}',
    'look who it is: {name}',
    '*happy tail* {name}!',
  ],
  leave: [
    'bye {name}…',
    'see you, {name}',
    'nooo, {name}…',
    'come back soon, {name}',
    'bye bye {name} ♪',
    "i'll keep {name}'s spot warm",
    'mrrp… bye {name}',
    'take care, {name}',
  ],
  mention: [
    'you called?',
    'mrrp?',
    "that's me!",
    'did someone say fish?',
    'hm? me?',
    '*ears perk up*',
    'yes hello',
    'i heard that',
    'talking about me? ♪',
    'mew?',
  ],
  play: ["ooh, it's on!", 'shh, watching', 'here we go!', 'eyes on the screen', 'popcorn time', 'ok ok shhh'],
  pause: [
    'huh?',
    'snack break?',
    'bathroom break!',
    'pause! nya',
    'wait, why?',
    'stretch break ♪',
    'what happened?',
    'i was watching that…',
    'pause means pets?',
  ],
  ready: ["i'm ready!", 'ready ready ready', 'paws ready ♪', 'tail ready!', 'born ready'],
  go: ['here we go!', 'nya! it starts!', 'showtime ♪', 'lights off!', 'shhh, it begins'],
  show: [
    'ooh, something new!',
    "what's this?",
    'new show!',
    'what are we watching?',
    'is this one good?',
    '*sniff* new!',
  ],
  rate: ['rate it! ★', 'how was it?', 'stars please ★', 'i give it 5 fish', 'was it good?'],
  bingo: ['BINGO! nya~', '{name} wins!', 'yay {name}!', '{name} got it!!', 'wow, {name}!', 'bingo bingo ♪'],
  fed: [
    'nom nom nom',
    'purrfect',
    'more fish?',
    'yum!',
    'fishy ♥',
    'thank u',
    '*crunch crunch*',
    'best fish ever',
    'chef kiss',
  ],
  pet: [
    'purrr ♥',
    '♥ ♥',
    'more pets pls',
    'hehe',
    'right there ♥',
    '*slow blink*',
    'mrrrr ♥',
    'ok one more',
    '*leans in*',
  ],
  ball: ['!!!', 'mine!', 'yarn!!', 'GET IT', 'ooh ooh ooh'],
  caught: ['got it!', 'gotcha!', 'again!', 'i win!', 'easy.', 'did you see that?'],
  laser: ['THE DOT', '!!!!', 'red dot!!', "it's back!", 'i will catch it'],
  laser_gone: ['where did it go?', 'it got away…', 'next time, dot.', "i'll get you…"],
  box: ['a box!!', 'if it fits, i sits', 'mine now', 'perfect box', 'my castle ♪'],
  hat: ['how do i look?', 'fancy!', '♪ new hat ♪', 'am i cute?', 'very stylish', 'this is my look now'],
  hat_off: ['ah, freedom', 'naked head!', 'that was itchy'],
  hungry: [
    'feed me…',
    'fish? 🐟',
    'so hungry…',
    'tummy empty…',
    'my bowl… look at it…',
    'is it dinner time?',
    '*stares at bowl*',
  ],
  wake: ['*yawn*', "mrr… what'd i miss?", 'good nap', "i wasn't asleep", '…5 more minutes'],
  grump: ['too much!', 'hmph.', 'personal space!', 'ok that is ENOUGH', 'nope.', '*tail flick*'],
  zoomies: ['ZOOMIES', 'nyoom', 'gotta go fast', '!!!'],
  pumpkin: ['boo!', 'my pumpkin', 'pumpkin ♪', '*bats pumpkin*'],
  idle: [
    'nya~',
    'is that a bird?',
    '*stares at nothing*',
    'mew',
    '…',
    "where's my fish",
    'i love this show',
    'pet me?',
    'what if fish could fly',
    'i should knock something over',
    '*kneads air*',
    'i am a good cat',
    'this spot is warm',
    'thinking about fish',
  ],
  night: ['so late…', "shouldn't you be asleep?", 'night owls ♪', '*sleepy blink*', 'midnight snack?'],
  halloween: [
    'spooky season ♪',
    'trick or treat? treat pls',
    'boo!',
    'i am a witch cat',
    'black cats are lucky actually',
  ],
  winter: ['brrr', 'is it snowing?', 'cozy time', 'warm me up', 'snow cat ♪'],
  hover: ['mrrp?', 'hi!', 'pet me?', 'oh, hi', '*sniff sniff*', 'boop?'],
}

// a line picker that does not repeat itself: none of a list's last few lines (or the extra ones)
// comes again until the others have had a turn
export function lines(rng = Math.random) {
  const recent: Partial<Record<Say, string[]>> = {}
  return (say: Say, name = '', extra: readonly string[] = []) => {
    const list = [...LINES[say], ...extra]
    const last = recent[say] ?? []
    const fresh = list.filter((l) => !last.includes(l))
    const pool = fresh.length ? fresh : list
    const pick = pool[Math.floor(rng() * pool.length)]
    recent[say] = [...last, pick].slice(-Math.min(4, list.length - 1))
    return pick.replace('{name}', name || 'friend')
  }
}

// ---- how chatty she is ----

// what she says unprompted (the others answer something the room did)
const OWN: Say[] = ['idle', 'hover', 'hungry', 'zoomies', 'pumpkin', 'wake']
// quiet: nothing; normal: answers the room, muses every few minutes, asks for food once per hungry
// spell, and keeps her own thoughts to herself while a show plays; chatty: as much as she likes
export const TALK: Record<Talk, { musingMs: number; hungryMs: number; hover: number }> = {
  quiet: { musingMs: Infinity, hungryMs: Infinity, hover: 0 },
  normal: { musingMs: 4 * 60_000, hungryMs: Infinity, hover: 0.15 },
  chatty: { musingMs: 40_000, hungryMs: 2 * 60_000, hover: 0.35 },
}
export function maySay(say: Say, talk: Talk, showing: boolean) {
  if (talk === 'quiet') return false
  if (talk === 'chatty') return true
  return !(showing && OWN.includes(say))
}

// ---- the clock and the calendar ----

export type Season = 'halloween' | 'winter' | null
export function season(d = new Date()): Season {
  const m = d.getMonth()
  if (m === 9) return 'halloween'
  if (m === 11 || (m === 0 && d.getDate() <= 6)) return 'winter'
  return null
}
// the lines her musings choose from at a time of day and year
export function musings(d = new Date()): string[] {
  const s = season(d)
  return [...(d.getHours() < 5 ? LINES.night : []), ...(s ? LINES[s] : [])]
}

// ---- what she does on her own ----

export type Act =
  | 'sit'
  | 'walk'
  | 'run'
  | 'groom'
  | 'yawn'
  | 'look'
  | 'blep'
  | 'tail'
  | 'happy'
  | 'wide'
  | 'bat'
  | 'loaf'
  | 'crouch'
  | 'leap'
  | 'grump'
export type Idle = 'wander' | 'groom' | 'yawn' | 'look' | 'blep' | 'tail' | 'chatter' | 'zoomies' | 'bat' | 'loaf'
export interface IdleContext {
  hour: number // the viewer's local hour
  talk: Talk
  showing: boolean // a show is playing
  tucked: boolean // fullscreen during a show: she keeps to her corner
  pumpkin: boolean // there is a pumpkin to bat
}
// by weight; sleepy and wild at night (zoomies only with nothing playing), lazy in the afternoon
export function idleWeights({ hour, talk, showing, tucked, pumpkin }: IdleContext): [Idle, number][] {
  const night = hour < 5
  const dusk = hour >= 18 && hour < 22
  const afternoon = hour >= 13 && hour < 17
  const wild = !showing && !tucked
  return [
    ['wander', tucked ? 0 : night ? 2 : afternoon ? 3 : 4],
    ['tail', 3],
    ['look', 2],
    ['groom', 2],
    ['blep', 2],
    ['yawn', night ? 3 : afternoon ? 2 : 1],
    ['chatter', talk === 'quiet' ? 0 : talk === 'chatty' ? 2 : 1],
    ['zoomies', wild ? (night ? 0.6 : dusk ? 0.4 : 0.1) : 0],
    ['bat', pumpkin ? 1.5 : 0],
    ['loaf', afternoon || night ? 1 : 0],
  ]
}
export function pickIdle(rng: () => number, ctx: IdleContext): Idle {
  const list = idleWeights(ctx).filter(([, w]) => w > 0)
  let r = rng() * list.reduce((n, [, w]) => n + w, 0)
  for (const [idle, w] of list) if ((r -= w) < 0) return idle
  return list[0][0]
}

// how long an idle thing lasts, ms
export const IDLE_MS: Record<Exclude<Idle, 'wander' | 'chatter' | 'zoomies'>, number> = {
  groom: 2600,
  yawn: 1400,
  look: 2400,
  blep: 2200,
  tail: 2400,
  bat: 2400,
  loaf: 9000,
}

// what she tends to do right after something: groom after eating, after zoomies ("I meant to do
// that") and after sulking; sometimes after a catch
const AFTER: Partial<Record<Act | 'eat' | 'zoomies', [Act, number, number]>> = {
  eat: ['groom', 2600, 0.7],
  zoomies: ['groom', 2600, 0.8],
  grump: ['groom', 2600, 0.6],
  happy: ['groom', 2200, 0.25],
  yawn: ['tail', 2000, 0.4],
}
export function after(what: Act | 'eat' | 'zoomies', rng = Math.random): [Act, number] | null {
  const next = AFTER[what]
  return next && rng() < next[2] ? [next[0], next[1]] : null
}

// where to wander: somewhere at least a fifth of the way from where she is
export function wanderTo(x: number, rng = Math.random) {
  for (let i = 0; i < 8; i++) {
    const to = rng()
    if (Math.abs(to - x) >= 0.2) return to
  }
  return x < 0.5 ? x + 0.3 : x - 0.3
}

// ---- her needs ----

export const HUNGRY = 20

// her mood, 0..100: half her tummy, half the attention she got lately (a play an hour ago is
// forgotten)
export function mood(tummy: number, lastPlay: number, now = Date.now()) {
  const attention = Math.max(0, 100 - ((now - lastPlay) / 3_600_000) * 100)
  return Math.round((tummy + attention) / 2)
}

// petted too much: this many pets within this long and she stalks off to sulk for a while
export const OVERPET = { pets: 7, within: 8000, sulk: 20_000 }
export const overpetted = (times: readonly number[], now = Date.now()) =>
  times.filter((t) => now - t <= OVERPET.within).length >= OVERPET.pets

// ---- toys ----

// the laser dot's hops along the bottom (0..1), HOP_MS apart, the same for everyone from the seed
export const HOP_MS = 1000
export function laserPath(seed: number, hops = 6) {
  let s = seed >>> 0
  const rng = () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const out: number[] = []
  let x = 0.5
  for (let i = 0; i < hops; i++) {
    x = Math.min(0.97, Math.max(0.03, wanderTo(x, rng)))
    out.push(x)
  }
  return out
}
