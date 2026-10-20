// Unit tests of the room's video clock: `npm test` (vitest)
import { expect, test } from 'vitest'
import { clock, now } from './store.ts'

const video = { found: true, paused: false, time: 100, duration: 1440, title: 'Ep 1' }

test('now: the reported time, counted on while it plays, never past the end', () => {
  expect(now(video, 1000, 6000)).toBe(105)
  expect(now({ ...video, paused: true }, 1000, 60_000)).toBe(100)
  expect(now(video, 0, 10_000_000)).toBe(1440)
  expect(now({ ...video, duration: 0 }, 0, 10_000)).toBe(110) // a live stream has no end
})

test('clock: m:ss, then h:mm:ss', () => {
  expect(clock(0)).toBe('0:00')
  expect(clock(65.9)).toBe('1:05')
  expect(clock(754)).toBe('12:34')
  expect(clock(3723)).toBe('1:02:03')
  expect(clock(-3)).toBe('0:00')
})
