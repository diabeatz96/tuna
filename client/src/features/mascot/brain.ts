// Tuna's personality: what she says about what happens, what she does when nothing does, and her mood.
// Pure functions of the time, the room and a random number, so they can be tested.
import type { CueKind } from '@/state/bus'

export type Say = CueKind | 'fed' | 'pet' | 'ball' | 'caught' | 'hat' | 'hat_off' | 'hungry' | 'wake' | 'idle' | 'hover'

// her lines; {name} is someone's name
export const LINES: Record<Say, string[]> = {
  join: ['hi {name}!', '{name}! mrrp!', 'welcome, {name} ♪', "{name}'s here!"],
  leave: ['bye {name}…', 'see you, {name}', 'nooo, {name}…'],
  mention: ['you called?', 'mrrp?', "that's me!", 'did someone say fish?'],
  play: ["ooh, it's on!", 'shh, watching', 'here we go!'],
  pause: ['huh?', 'snack break?', 'bathroom break!', 'pause! nya'],
  ready: ["i'm ready!", 'ready ready ready'],
  go: ['here we go!', 'nya! it starts!'],
  show: ['ooh, something new!', "what's this?", 'new show!'],
  rate: ['rate it! ★', 'how was it?'],
  bingo: ['BINGO! nya~', '{name} wins!', 'yay {name}!'],
  fed: ['nom nom nom', 'purrfect', 'more fish?', 'yum!'],
  pet: ['purrr ♥', '♥ ♥', 'more pets pls', 'hehe'],
  ball: ['!!!', 'mine!', 'yarn!!'],
  caught: ['got it!', 'gotcha!', 'again!'],
  hat: ['how do i look?', 'fancy!', '♪ new hat ♪'],
  hat_off: ['ah, freedom'],
  hungry: ['feed me…', 'fish? 🐟', 'so hungry…', 'tummy empty…'],
  wake: ['*yawn*', "mrr… what'd i miss?"],
  idle: [
    'nya~',
    'is that a bird?',
    '*stares at nothing*',
    'mew',
    '…',
    "where's my fish",
    'i love this show',
    'pet me?',
  ],
  hover: ['mrrp?', 'hi!', 'pet me?'],
}

export function line(say: Say, name = '', rng = Math.random) {
  const list = LINES[say]
  return list[Math.floor(rng() * list.length)].replace('{name}', name || 'friend')
}

// what she does now and then, by weight; `wander` walks somewhere along the bottom
export type Idle = 'wander' | 'groom' | 'yawn' | 'look' | 'blep' | 'tail' | 'chatter'
const IDLE: [Idle, number][] = [
  ['wander', 4],
  ['tail', 3],
  ['look', 2],
  ['groom', 2],
  ['blep', 2],
  ['yawn', 1],
  ['chatter', 1],
]
export function pickIdle(rng = Math.random, talks = true): Idle {
  const list = IDLE.filter(([idle]) => talks || idle !== 'chatter')
  let r = rng() * list.reduce((n, [, w]) => n + w, 0)
  for (const [idle, w] of list) if ((r -= w) < 0) return idle
  return list[0][0]
}

// how long an idle thing lasts, ms
export const IDLE_MS: Record<Exclude<Idle, 'wander' | 'chatter'>, number> = {
  groom: 2600,
  yawn: 1400,
  look: 2400,
  blep: 2200,
  tail: 2400,
}

// where to wander: somewhere at least a fifth of the way from where she is
export function wanderTo(x: number, rng = Math.random) {
  for (let i = 0; i < 8; i++) {
    const to = rng()
    if (Math.abs(to - x) >= 0.2) return to
  }
  return x < 0.5 ? x + 0.3 : x - 0.3
}

// her mood, 0..100: half her tummy, half the attention she got lately (a play an hour ago is
// forgotten)
export function mood(tummy: number, lastPlay: number, now = Date.now()) {
  const attention = Math.max(0, 100 - ((now - lastPlay) / 3_600_000) * 100)
  return Math.round((tummy + attention) / 2)
}
