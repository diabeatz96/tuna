// Unit tests of Tuna's personality: `npm test` (vitest)
import { expect, test } from 'vitest'
import { line, LINES, mood, pickIdle, wanderTo } from './brain'

// a fixed sequence of "random" numbers
const seq = (...n: number[]) => {
  let i = 0
  return () => n[i++ % n.length]
}

test('line: one of the lines for what happened, with the name in it', () => {
  expect(line('join', 'Adam', seq(0))).toBe('hi Adam!')
  expect(line('join', 'Adam', seq(0.99))).toBe("Adam's here!")
  expect(line('bingo', '', seq(0.4))).toBe('friend wins!')
  for (const list of Object.values(LINES)) expect(list.length).toBeGreaterThan(0)
})

test('pickIdle: by weight, and no musing when she does not talk', () => {
  expect(pickIdle(seq(0))).toBe('wander')
  expect(pickIdle(seq(0.999))).toBe('chatter')
  expect(pickIdle(seq(0.999), false)).not.toBe('chatter')
  const counts: Record<string, number> = {}
  for (let i = 0; i < 1500; i++) {
    const idle = pickIdle(seq(i / 1500))
    counts[idle] = (counts[idle] ?? 0) + 1
  }
  expect(counts.wander).toBeGreaterThan(counts.yawn) // 4 to 1
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
