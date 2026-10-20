// Unit tests of the watch party's diary helpers and awards: `npm test` (vitest)
import { expect, test } from 'vitest'
import type { DiaryEntry } from '@/plugins/types'
import { applyEntry, average, awards, cleanTitle } from './party.ts'

const entry = (id: string, date: string, attendees: string[], ratings: Record<string, number> = {}, extra = {}) =>
  ({
    id,
    title: `Ep ${id} - Watch on Crunchyroll`,
    site: 'www.crunchyroll.com',
    date,
    minutes: 24,
    attendees,
    ratings,
    ...extra,
  }) as DiaryEntry

test('cleanTitle drops the site name, nothing else', () => {
  expect(cleanTitle('Frieren E12 - Watch on Crunchyroll')).toBe('Frieren E12')
  expect(cleanTitle('▶ Lofi beats - YouTube')).toBe('Lofi beats')
  expect(cleanTitle('Dune | Plex')).toBe('Dune')
  expect(cleanTitle('Just a title')).toBe('Just a title')
  expect(cleanTitle(' - YouTube')).toBe(' - YouTube') // nothing left: kept as it was
})

test('applyEntry: a new entry goes first, a changed one stays in place, a deleted one goes', () => {
  const a = entry('a', '2026-10-01T20:00:00Z', ['Alice'])
  const b = entry('b', '2026-10-02T20:00:00Z', ['Bob'])
  let diary = applyEntry([], a)
  diary = applyEntry(diary, b)
  expect(diary.map((e) => e.id)).toEqual(['b', 'a'])
  diary = applyEntry(diary, { ...a, minutes: 30 })
  expect(diary.map((e) => [e.id, e.minutes])).toEqual([
    ['b', 24],
    ['a', 30],
  ])
  expect(applyEntry(diary, { ...b, deleted: true }).map((e) => e.id)).toEqual(['a'])
})

test('awards from the diary', () => {
  const diary = [
    entry(
      '1',
      '2026-10-01T20:00:00',
      ['Alice', 'Bob'],
      { Alice: 5, Bob: 2 },
      { predictions: [{ name: 'Bob', text: 'x' }] },
    ),
    entry('2', '2026-10-02T20:00:00', ['Alice', 'Bob'], { Alice: 5, Bob: 3 }),
    entry('3', '2026-10-03T21:00:00', ['Alice'], { Alice: 4, Bob: 1 }),
    entry(
      '4',
      '2026-10-10T21:00:00',
      ['Bob', 'Carol'],
      {},
      {
        predictions: [
          { name: 'Bob', text: 'y' },
          { name: 'Carol', text: 'z' },
        ],
      },
    ),
  ]
  const byId = Object.fromEntries(awards(diary).map((a) => [a.id, [a.winner, a.detail]]))
  expect(byId).toEqual({
    most: ['Alice', '3'], // Alice and Bob both 3: by name
    streak: ['Alice', '3'], // the 1st to the 3rd
    kind: ['Alice', '4.7'],
    tough: ['Bob', '2.0'],
    seer: ['Bob', '2'],
    top: ['Ep 2', '4.0'],
    hours: ['', '1.6'],
  })
  expect(average({})).toBe(0)
  expect(awards([])).toEqual([])
})
