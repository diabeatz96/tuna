// Tuna, the mascot, as pixel art: each frame is a grid of characters, one per pixel, in the colors
// of the logo (src/assets/images/logo.svg). The frames share the body and differ in the face rows;
// toPaths() turns a grid into one SVG path per color, so a frame is a handful of elements.

export const PALETTE: Record<string, string> = {
  k: '#1b1714', // outline
  d: '#3d332b', // fur
  m: '#7f6b58', // tabby stripes
  l: '#b3a089', // muzzle and chest
  e: '#c2bd5c', // eyes
  p: '#16120f', // pupils
  n: '#c98a82', // nose and inner ears
  b: '#6fa8c9', // the fish
  w: '#e9dfd1', // the fish's eye and belly
}

// sitting, facing the viewer, the tongue out like the logo's; rows 6-10 are the eyes and 12-13 the
// mouth, swapped per face
const BODY = [
  '..k..............k..',
  '..kk............kk..',
  '..knk..........knk..',
  '..knnkkkkkkkkkknnk..',
  '..kddddddmmddddddk..',
  '.kdddddmddddmdddddk.',
  '.kddkkkkddddkkkkddk.',
  '.kdkeweekddkeweekdk.',
  '.kdkeppekddkeppekdk.',
  '.kdkeppekddkeppekdk.',
  '.kddkkkkdlldkkkkddk.',
  '.kdddddllnnlldddddk.',
  '.kmddddllkkllddddmk.',
  '.kddddddlnnlddddddk.',
  '..kddddllllllddddk..',
  '.kdddmdlllllldmdddk.',
  '.kddmddllllllddmddk.',
  'kdmdddllllllldddmddk',
  'kddkllkddddddkllkddk',
  'kkkkkkkkkkkkkkkkkkkk',
]

const face = (rows: Record<number, string>) => BODY.map((row, i) => rows[i] ?? row)
const FUR = '.kddddddddddddddddk.'
const MUZZLE_TOP = '.kdddddddlldddddddk.' // row 10 without the eyes' lower rims
const SHUT = '.kddkkkkddddkkkkddk.' // a closed eye: one line
const SMILE = ['.kdddkkddddddkkdddk.', '.kddkddkddddkddkddk.'] // ^ ^

export const FRAMES = {
  open: BODY,
  blink: face({ 6: FUR, 7: FUR, 8: SHUT, 9: FUR, 10: MUZZLE_TOP }),
  happy: face({ 6: FUR, 7: SMILE[0], 8: SMILE[1], 9: FUR, 10: MUZZLE_TOP }),
  sleep: face({ 6: FUR, 7: FUR, 8: FUR, 9: SHUT, 10: MUZZLE_TOP }),
  eat: face({
    6: FUR,
    7: SMILE[0],
    8: SMILE[1],
    9: FUR,
    10: MUZZLE_TOP,
    12: '.kmddddlkkkklddddmk.',
    13: '.kddddddlkklddddddk.',
  }),
}
export type Face = keyof typeof FRAMES

export const FISH = ['.kkkk..k.', 'kbbbbkkbk', 'kpwbbbbbk', 'kwwwbkkbk', '.kkkk..k.']
// where the mouth is on the body grid: the fish lands there
export const MOUTH = { x: 9, y: 12 }

// one path per color, each pixel run of a row a rectangle (`M x y h n v 1 h -n z`)
export function toPaths(grid: string[]) {
  const d: Record<string, string> = {}
  grid.forEach((row, y) => {
    for (let x = 0; x < row.length;) {
      const c = row[x]
      let n = 1
      while (row[x + n] === c) n++
      if (c !== '.') d[c] = (d[c] ?? '') + `M${x} ${y}h${n}v1h-${n}z`
      x += n
    }
  })
  return Object.entries(d).map(([c, path]) => ({ fill: PALETTE[c], d: path }))
}
