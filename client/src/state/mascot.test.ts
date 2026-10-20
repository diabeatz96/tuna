// Unit tests of playing with the mascot: `npm test` (vitest)
import { expect, test, vi } from 'vitest'
import { fakeBrowser, fakeTransport } from '@/test/browser'

vi.mock('sonner', () => ({
  toast: { info: vi.fn(), success: vi.fn(), warning: vi.fn(), error: vi.fn(), dismiss: vi.fn() },
}))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))
const stored = fakeBrowser()
const { createNekoApp } = await import('./neko.ts')
const { FISH, mine, score, showFeed, showPoints, tummy } = await import('./mascot.ts')

test('the tummy: a fish fills it, it empties by one a minute, between 0 and 100', () => {
  const at = 1_000_000
  expect(tummy({ level: 50, at }, at)).toBe(50)
  expect(tummy({ level: 50, at }, at + 10 * 60_000)).toBe(40)
  expect(tummy({ level: 10, at }, at + 60 * 60_000)).toBe(0)
  expect(tummy({ level: 150, at }, at)).toBe(100)

  const neko = createNekoApp({ transport: fakeTransport() })
  const before = tummy(neko.app.getState().tummy)
  showFeed(neko, 'bob')
  expect(tummy(neko.app.getState().tummy)).toBeCloseTo(Math.min(100, before + FISH), 0)
  expect(neko.app.getState().fed.by).toBe('bob')
})

test('points: a yarn ball counts twice; what the room announces is cleaned up', () => {
  expect(score({ feed: 2, pet: 3, ball: 1 })).toBe(7)
  expect(score(undefined)).toBe(0)

  const neko = createNekoApp({ transport: fakeTransport() })
  showPoints(neko, 'bob', { feed: 3, pet: -1, ball: 'lots', extra: 9 })
  expect(neko.app.getState().points.bob).toEqual({ feed: 3, pet: 0, ball: 0 })
  showPoints(neko, '', { feed: 1 })
  expect(Object.keys(neko.app.getState().points)).toEqual(['bob'])
})

test('my points are read from this device, a damaged value as none', () => {
  stored.set('tuna_points', JSON.stringify({ feed: 4, pet: 1, ball: 2 }))
  expect(mine()).toEqual({ feed: 4, pet: 1, ball: 2 })
  stored.set('tuna_points', 'not json')
  expect(mine()).toEqual({ feed: 0, pet: 0, ball: 0 })
})
