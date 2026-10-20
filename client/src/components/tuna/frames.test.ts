// Unit tests of Tuna's pixel art: `npm test` (vitest)
import { expect, test } from 'vitest'
import { HATS as HAT_NAMES } from '@/state/mascot'
import { FAMILY, FRAMES, HAT_SPOT, HATS, PALETTE, SPOTS, TOYS, type Frame } from './frames'
import { sideways, toPaths } from './PixelCat'

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
  for (const name of Object.keys(HATS)) expect(['top', 'ear', 'neck']).toContain(HAT_SPOT[name as keyof typeof HATS])
  for (const family of Object.values(FAMILY)) expect(Object.keys(SPOTS[family]).sort()).toEqual(['ear', 'neck', 'top'])
})

test('the side views (walking, crouching, the leap, lounging, sprawled) are one size, as tall as sitting', () => {
  const side = Object.entries(FRAMES).filter(([f]) => sideways(f as Frame))
  expect(side.map(([f]) => f)).toEqual(expect.arrayContaining(['walk_1', 'leap', 'lounge', 'sprawl']))
  expect([...new Set(side.map(([, g]) => `${g[0].length}x${g.length}`))]).toEqual(['36x26'])
  expect(FRAMES.walk_1.length).toBe(FRAMES.sit.length)
})

test('the side views wear her sitting face: the same eyes, nose and ginger patch, turned to us', () => {
  // the sitting face's middle rows (eyes, nose) appear in the walking frame, moved right
  const rows = (g: readonly string[], y: number, x0: number) => g[y].slice(x0, x0 + 14)
  for (const y of [9, 12]) expect(rows(FRAMES.walk_1, y, 17)).toBe(rows(FRAMES.look_r, y, 6))
})

test('she is drawn from her photos: her ginger patch, her whiskers, her golden belly', () => {
  const has = (frame: Frame, c: string) => FRAMES[frame].some((row) => row.includes(c))
  for (const f of ['sit', 'judge', 'sleep', 'walk_1'] as Frame[]) {
    expect(has(f, 'a'), `${f}: ginger`).toBe(true)
    expect(has(f, 'W'), `${f}: whiskers`).toBe(true)
  }
  for (const f of ['walk_1', 'lounge'] as Frame[]) expect(has(f, 'h'), `${f}: belly`).toBe(true)
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
