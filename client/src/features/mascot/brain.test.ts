// Unit tests of Tuna's personality: `npm test` (vitest)
import { expect, test } from 'vitest'
import {
  after,
  idleWeights,
  laserPath,
  lines,
  LINES,
  maySay,
  mood,
  musings,
  OVERPET,
  overpetted,
  pickIdle,
  season,
  wanderTo,
  type IdleContext,
} from './brain'

// a fixed sequence of "random" numbers
const seq = (...n: number[]) => {
  let i = 0
  return () => n[i++ % n.length]
}

test('lines: one of the lines for what happened, with the name in it', () => {
  expect(lines(seq(0))('join', 'Adam')).toBe('hi Adam!')
  expect(lines(seq(0.4))('bingo')).toBe('yay friend!')
  for (const list of Object.values(LINES)) expect(list.length).toBeGreaterThan(2)
})

test('lines: no repeats until the others had a turn', () => {
  const say = lines(seq(0))
  const seen = Array.from({ length: 5 }, () => say('pet'))
  expect(new Set(seen).size).toBe(5)
  // extra lines join the list
  expect(lines(seq(0.999))('idle', '', ['boo!'])).toBe('boo!')
})

test('maySay: quiet says nothing, normal keeps her own thoughts to herself mid-show, chatty says it all', () => {
  expect(maySay('join', 'quiet', false)).toBe(false)
  expect(maySay('join', 'normal', true)).toBe(true)
  expect(maySay('idle', 'normal', true)).toBe(false)
  expect(maySay('hungry', 'normal', true)).toBe(false)
  expect(maySay('idle', 'normal', false)).toBe(true)
  expect(maySay('idle', 'chatty', true)).toBe(true)
})

const ctx = (c: Partial<IdleContext> = {}): IdleContext => ({
  hour: 20,
  talk: 'normal',
  showing: false,
  tucked: false,
  pumpkin: false,
  ...c,
})
const weight = (c: Partial<IdleContext>, idle: string) => idleWeights(ctx(c)).find(([i]) => i === idle)![1]

test('idle: by weight; no strolls in her fullscreen corner, zoomies only with nothing playing', () => {
  expect(pickIdle(seq(0), ctx())).toBe('wander')
  expect(weight({ tucked: true }, 'wander')).toBe(0)
  expect(weight({ showing: true }, 'zoomies')).toBe(0)
  expect(weight({ hour: 2 }, 'zoomies')).toBeGreaterThan(weight({ hour: 10 }, 'zoomies'))
  expect(weight({ hour: 2 }, 'yawn')).toBeGreaterThan(weight({ hour: 10 }, 'yawn'))
  expect(weight({ talk: 'quiet' }, 'chatter')).toBe(0)
  expect(weight({}, 'bat')).toBe(0)
  expect(weight({ pumpkin: true }, 'bat')).toBeGreaterThan(0)
  const counts: Record<string, number> = {}
  for (let i = 0; i < 2000; i++) {
    const idle = pickIdle(seq(i / 2000), ctx({ tucked: true }))
    counts[idle] = (counts[idle] ?? 0) + 1
  }
  expect(counts.wander).toBeUndefined()
  expect(counts.tail).toBeGreaterThan(counts.yawn)
})

test('after: a groom after eating, mostly', () => {
  expect(after('eat', seq(0.1))).toEqual(['groom', 2600])
  expect(after('eat', seq(0.9))).toBeNull()
  expect(after('walk', seq(0))).toBeNull()
})

test('season and musings: a witch in October, cold in December, sleepy small hours', () => {
  expect(season(new Date(2026, 9, 19))).toBe('halloween')
  expect(season(new Date(2026, 11, 24))).toBe('winter')
  expect(season(new Date(2027, 0, 3))).toBe('winter')
  expect(season(new Date(2027, 2, 3))).toBeNull()
  expect(musings(new Date(2026, 9, 19, 2))).toEqual([...LINES.night, ...LINES.halloween])
  expect(musings(new Date(2027, 2, 3, 15))).toEqual([])
})

test('wanderTo: somewhere a fifth of the way off at least', () => {
  expect(wanderTo(0.5, seq(0.55, 0.9))).toBe(0.9)
  expect(wanderTo(0.1, seq(0.15))).toBeCloseTo(0.4) // no luck: a fixed step
})

test('mood: half her tummy, half the attention, which an hour forgets', () => {
  const now = 10_000_000
  expect(mood(100, now, now)).toBe(100)
  expect(mood(0, now, now)).toBe(50)
  expect(mood(100, now - 3_600_000, now)).toBe(50)
  expect(mood(40, now - 1_800_000, now)).toBe(45)
})

test('overpetted: too many pets too fast', () => {
  const now = 100_000
  const fast = Array.from({ length: OVERPET.pets }, (_, i) => now - i * 500)
  expect(overpetted(fast, now)).toBe(true)
  expect(overpetted(fast.slice(1), now)).toBe(false)
  expect(overpetted(fast, now + OVERPET.within)).toBe(false)
})

test('laserPath: the same hops for everyone from a seed, on the strip, each a fair way on', () => {
  const a = laserPath(12345)
  expect(laserPath(12345)).toEqual(a)
  expect(laserPath(54321)).not.toEqual(a)
  for (const x of a) expect(x >= 0.03 && x <= 0.97).toBe(true)
  for (let i = 1; i < a.length; i++) expect(Math.abs(a[i] - a[i - 1])).toBeGreaterThan(0.1)
})
