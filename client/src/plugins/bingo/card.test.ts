// Unit tests of the bingo card: `npm test` (vitest)
import { expect, test } from 'vitest'
import { deal, FREE, isBingo, LINES, TROPES } from './card'

test('deal: 24 different tropes around a free middle, the same for the same seed and player', () => {
  const card = deal('round-1', 'alice')
  expect(card).toHaveLength(25)
  expect(card[FREE]).toBe('')
  const tropes = card.filter((_, i) => i !== FREE)
  expect(new Set(tropes).size).toBe(24)
  for (const t of tropes) expect(TROPES).toContain(t)
  expect(deal('round-1', 'alice')).toEqual(card)
  expect(deal('round-1', 'bob')).not.toEqual(card)
  expect(deal('round-2', 'alice')).not.toEqual(card)
})

test('lines: 5 rows, 5 columns, 2 diagonals, all through the board', () => {
  expect(LINES).toHaveLength(12)
  expect(LINES[10]).toEqual([0, 6, 12, 18, 24])
  expect(LINES[11]).toEqual([4, 8, 12, 16, 20])
})

test('isBingo: a full line wins, the free middle counts', () => {
  expect(isBingo(new Set())).toBe(false)
  expect(isBingo(new Set([0, 1, 2, 3]))).toBe(false)
  expect(isBingo(new Set([0, 1, 2, 3, 4]))).toBe(true)
  expect(isBingo(new Set([2, 7, 17, 22]))).toBe(true) // the middle column, through the free square
  expect(isBingo(new Set([0, 6, 18, 24]))).toBe(true) // a diagonal
})
