// Unit tests of the mascot's pixel art: `npm test` (vitest)
import { expect, test } from 'vitest'
import { FISH, FRAMES, PALETTE, toPaths } from './sprite'

test('every frame is a rectangle of the body size, drawn only with palette colors', () => {
  const [w, h] = [FRAMES.open[0].length, FRAMES.open.length]
  for (const [name, grid] of Object.entries(FRAMES)) {
    expect(grid, name).toHaveLength(h)
    for (const row of grid) {
      expect(row.length, `${name}: ${row}`).toBe(w)
      for (const c of row) expect(c === '.' || c in PALETTE, `${name}: ${c}`).toBe(true)
    }
  }
  for (const row of FISH) expect(row.length).toBe(FISH[0].length)
})

test('toPaths: one path per color, a run of pixels is one rectangle', () => {
  expect(toPaths(['.kk', 'kbk'])).toEqual([
    { fill: PALETTE.k, d: 'M1 0h2v1h-2zM0 1h1v1h-1zM2 1h1v1h-1z' },
    { fill: PALETTE.b, d: 'M1 1h1v1h-1z' },
  ])
})
