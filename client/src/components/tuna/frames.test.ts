// Unit tests of Tuna's pixel art: `npm test` (vitest)
import { expect, test } from 'vitest'
import { HATS as HAT_NAMES } from '@/state/mascot'
import { FAMILY, FRAMES, HAT_SPOT, HATS, PALETTE, SPOTS, TOYS } from './frames'
import { toPaths } from './PixelCat'

const grids = { ...FRAMES, ...HATS, ...TOYS }

test('every frame, hat and toy is a rectangle drawn only with palette colors', () => {
  for (const [name, grid] of Object.entries(grids)) {
    const w = grid[0].length
    for (const row of grid) {
      expect(row.length, `${name}: ${row}`).toBe(w)
      for (const c of row) expect(c === '.' || c in PALETTE, `${name}: '${c}'`).toBe(true)
    }
  }
})

test('the sitting frames are one size, so she does not jump between them', () => {
  const sizes = new Set(
    Object.entries(FRAMES)
      .filter(([f]) => FAMILY[f as keyof typeof FAMILY] === 'sit')
      .map(([, g]) => `${g[0].length}x${g.length}`),
  )
  expect([...sizes]).toEqual(['26x26'])
})

test('every hat has art and a place, and the room can pick exactly these', () => {
  expect(HAT_NAMES.filter(Boolean).sort()).toEqual(Object.keys(HATS).sort())
  for (const name of Object.keys(HATS)) expect(['top', 'ear']).toContain(HAT_SPOT[name as keyof typeof HATS])
  for (const family of Object.values(FAMILY)) expect(SPOTS[family]).toBeDefined()
})

test('toPaths: one path per color, a run of pixels is one rectangle, worked out once', () => {
  const grid = ['.kk', 'kbk']
  const paths = toPaths(grid)
  expect(paths).toEqual([
    { fill: PALETTE.k, d: 'M1 0h2v1h-2zM0 1h1v1h-1zM2 1h1v1h-1z' },
    { fill: PALETTE.b, d: 'M1 1h1v1h-1z' },
  ])
  expect(toPaths(grid)).toBe(paths)
})
