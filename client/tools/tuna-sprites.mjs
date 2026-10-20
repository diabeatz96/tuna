// Draws Tuna the mascot's pixel art from shapes and writes src/components/tuna/frames.ts: one grid of
// characters per frame (a character per pixel, '.' clear, the others colors of PALETTE), the hats,
// the toys and where the hats sit. `node tools/tuna-sprites.mjs [--png preview.png]`; the PNG shows
// every frame, for looking at the art.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

// the logo's colors (src/assets/images/logo.svg), and a few for her things
const PALETTE = {
  k: '#1b1714', // outline
  s: '#2b241f', // shade
  d: '#3d332b', // fur
  m: '#7f6b58', // tabby stripes
  l: '#b3a089', // muzzle, chest, paws
  c: '#e9dfd1', // cream
  e: '#c2bd5c', // eyes
  p: '#16120f', // pupils, mouth
  w: '#f7f2ea', // shine
  n: '#d68f87', // nose, ears, blush, tongue
  r: '#d9667a', // red: hats, yarn
  R: '#a8455a', // dark red
  y: '#e8c547', // gold
  b: '#6fa8c9', // blue: the fish
}

// a canvas of w x h pixels, '.' clear; shapes are filled by pixel centers
const canvas = (w, h) => Array.from({ length: h }, () => Array(w).fill('.'))
const put = (g, x, y, c) => {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = c
}
function ellipse(g, cx, cy, rx, ry, c) {
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[0].length; x++) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) g[y][x] = c
}
function poly(g, pts, c) {
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[0].length; x++) {
      const [px, py] = [x + 0.5, y + 0.5]
      let inside = false
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]
        const [xj, yj] = pts[j]
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
      }
      if (inside) g[y][x] = c
    }
}
const dots = (g, list, c) => list.forEach(([x, y]) => put(g, x, y, c))
// a pixel and its mirror image across the canvas's middle
const mirror = (g, list, c) => list.forEach(([x, y]) => (put(g, x, y, c), put(g, g[0].length - 1 - x, y, c)))
// a thick stroke through points
const stroke = (g, pts, r, c) => pts.forEach(([x, y]) => ellipse(g, x, y, r, r, c))
// the outline: every clear pixel next to a drawn one (not diagonally)
function outline(g, c = 'k') {
  const was = g.map((row) => [...row])
  const drawn = (x, y) => was[y]?.[x] !== undefined && was[y][x] !== '.'
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < g[0].length; x++)
      if (!drawn(x, y) && (drawn(x - 1, y) || drawn(x + 1, y) || drawn(x, y - 1) || drawn(x, y + 1))) g[y][x] = c
}
// a sprite drawn on a template string list, for small things
const art = (rows) => rows.map((r) => [...r])

// ---- Tuna, sitting, facing the viewer: 26 x 26, her middle between columns 12 and 13 ----

const EYES = {
  // 6 x 6, the left one at x 6..11, the right one at 14..19, rows 8..13: a big pupil in a
  // yellow-green rim with a shine top-left (the same side on both eyes)
  open: ['.kkkk.', 'keeeek', 'kewpek', 'keppek', 'keeeek', '.kkkk.'],
  look_l: ['.kkkk.', 'keeeek', 'kwpeek', 'kppeek', 'keeeek', '.kkkk.'],
  look_r: ['.kkkk.', 'keeeek', 'keewpk', 'keeppk', 'keeeek', '.kkkk.'],
  wide: ['.kkkk.', 'keeeek', 'keweek', 'keepek', 'keeeek', '.kkkk.'],
  blink: ['......', '......', '......', 'kkkkkk', '......', '......'],
  happy: ['......', '..kk..', '.k..k.', 'k....k', '......', '......'],
  squeeze: ['......', 'kkk...', '...kkk', 'kkk...', '......', '......'],
  love: ['......', 'rr..rr', 'rrrrrr', '.rrrr.', '..rr..', '......'],
  sleep: ['......', '......', 'k....k', '.kkkk.', '......', '......'],
}

function eyes(g, kind, dy = 0) {
  const t = EYES[kind]
  for (const [ox, flip] of [
    [6, false],
    [14, kind === 'squeeze'],
  ])
    t.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (c === '.') return
        // a closed eye's lines are drawn over the fur; an open eye's whites are the eye
        put(g, flip ? ox + 5 - x : ox + x, 8 + y + dy, c)
      }),
    )
}

// the nose, and below it a smiling :3 (its corners up), the tongue out, or open
function mouth(g, kind, dy = 0) {
  dots(
    g,
    [
      [12, 13 + dy],
      [13, 13 + dy],
    ],
    'n',
  )
  if (kind === 'w' || kind === 'blep') {
    dots(
      g,
      [
        [11, 14 + dy],
        [14, 14 + dy],
        [12, 15 + dy],
        [13, 15 + dy],
      ],
      'k',
    )
    if (kind === 'blep') dots(g, [[13, 16 + dy]], 'n')
  }
  if (kind === 'open') {
    dots(
      g,
      [
        [12, 14 + dy],
        [13, 14 + dy],
      ],
      'p',
    )
    dots(
      g,
      [
        [12, 15 + dy],
        [13, 15 + dy],
      ],
      'n',
    )
  }
  if (kind === 'yawn') {
    ellipse(g, 13, 15.6 + dy, 2.1, 1.8, 'p')
    dots(
      g,
      [
        [12, 16 + dy],
        [13, 16 + dy],
      ],
      'n',
    )
  }
}

const TAILS = {
  down: [
    [19.5, 23.2],
    [21, 22.8],
    [22.3, 21.8],
    [23.1, 20.3],
    [23.3, 18.6],
    [22.8, 17.2],
  ],
  up: [
    [19.5, 23.2],
    [21.1, 22.3],
    [22.4, 20.6],
    [23, 18.6],
    [22.8, 16.6],
    [21.8, 15.2],
  ],
}

function head(g, dy = 0) {
  // the ears, their pink, the head
  poly(
    g,
    [
      [3.4, 9.6 + dy],
      [5, 0.4 + dy],
      [11.2, 4.4 + dy],
    ],
    'd',
  )
  poly(
    g,
    [
      [22.6, 9.6 + dy],
      [21, 0.4 + dy],
      [14.8, 4.4 + dy],
    ],
    'd',
  )
  poly(
    g,
    [
      [5.3, 6.9 + dy],
      [5.9, 2.4 + dy],
      [9.6, 4.8 + dy],
    ],
    'n',
  )
  poly(
    g,
    [
      [20.7, 6.9 + dy],
      [20.1, 2.4 + dy],
      [16.4, 4.8 + dy],
    ],
    'n',
  )
  ellipse(g, 13, 10.6 + dy, 9.7, 7.5, 'd')
  // the tabby M on her forehead, the stripes on her cheeks
  mirror(
    g,
    [
      [9, 4 + dy],
      [9, 5 + dy],
      [11, 3 + dy],
      [11, 4 + dy],
      [12, 4 + dy],
    ],
    'm',
  )
  mirror(
    g,
    [
      [4, 10 + dy],
      [3, 12 + dy],
      [4, 12 + dy],
    ],
    'm',
  )
  // the muzzle and the blush
  ellipse(g, 13, 14.7 + dy, 3.6, 2.3, 'l')
  mirror(
    g,
    [
      [5, 14 + dy],
      [6, 14 + dy],
    ],
    'n',
  )
}

function sitting({ eyes: e = 'open', mouth: m = 'w', tail = 'down', paw = false } = {}) {
  const g = canvas(26, 26)
  stroke(g, TAILS[tail], 1.15, 'd')
  dots(g, [TAILS[tail].at(-1).map(Math.round)], 'm')
  // the body, her chest, her front paws
  ellipse(g, 13, 20.6, 7.2, 5.1, 'd')
  mirror(
    g,
    [
      [7, 19],
      [7, 21],
      [6, 20],
    ],
    'm',
  )
  ellipse(g, 13, 20.4, 3.6, 4.3, 'l')
  ellipse(g, 10.2, 24.6, 2, 1.25, 'l')
  ellipse(g, 15.8, 24.6, 2, 1.25, 'l')
  head(g)
  outline(g)
  // the chin's shadow on the body
  dots(
    g,
    [
      [9, 18],
      [10, 18],
      [15, 18],
      [16, 18],
    ],
    's',
  )
  eyes(g, e)
  mouth(g, m)
  if (paw) {
    // a paw up at her mouth: grooming
    ellipse(g, 15.8, 16.2, 1.9, 1.6, 'k')
    ellipse(g, 15.8, 16.2, 1.1, 0.8, 'l')
  }
  return g
}

// lying down, a loaf, asleep
function loaf({ eyes: e = 'sleep' } = {}) {
  const g = canvas(26, 26)
  ellipse(g, 13, 21.2, 10.8, 4.6, 'd')
  mirror(
    g,
    [
      [4, 20],
      [4, 22],
      [6, 19],
    ],
    'm',
  )
  ellipse(g, 9.6, 24.6, 1.8, 1.1, 'l')
  ellipse(g, 16.4, 24.6, 1.8, 1.1, 'l')
  head(g, 5)
  outline(g)
  eyes(g, e, 5)
  mouth(g, 'w', 5)
  return g
}

// ---- walking, seen from the side, facing right: 32 x 22 ----

function walking(step) {
  const g = canvas(32, 22)
  // the tail, up behind her
  const tail =
    step === 0
      ? [
          [5.5, 11],
          [4.4, 9.6],
          [3.6, 8],
          [3.3, 6.2],
          [3.6, 4.5],
          [4.5, 3.2],
        ]
      : [
          [5.5, 11],
          [4.5, 9.4],
          [3.9, 7.6],
          [3.9, 5.8],
          [4.5, 4.3],
          [5.6, 3.3],
        ]
  stroke(g, tail, 1.1, 'd')
  dots(g, [tail.at(-1).map(Math.round)], 'm')
  // the legs: apart, then together
  const legs = step === 0 ? [6, 11, 17, 22] : [8, 10, 19, 21]
  legs.forEach((x, i) => {
    for (let y = 14; y <= 19; y++)
      dots(
        g,
        [
          [x, y],
          [x + 1, y],
        ],
        i % 2 ? 'd' : 's',
      )
    dots(
      g,
      [
        [x, 19],
        [x + 1, 19],
      ],
      'l',
    )
  })
  ellipse(g, 14, 12.6, 9.2, 4.6, 'd')
  dots(
    g,
    [
      [10, 9],
      [10, 10],
      [13, 8],
      [13, 9],
      [16, 9],
      [16, 10],
    ],
    'm',
  )
  ellipse(g, 16, 15, 5, 1.8, 'l')
  // the ears, the head, the muzzle
  poly(
    g,
    [
      [19.4, 5.4],
      [20.4, 0.4],
      [24, 3.4],
    ],
    'd',
  )
  poly(
    g,
    [
      [24.2, 3.2],
      [27.4, 0.4],
      [28.8, 5.2],
    ],
    'd',
  )
  poly(
    g,
    [
      [25.4, 3.4],
      [27, 1.6],
      [27.8, 4.2],
    ],
    'n',
  )
  ellipse(g, 24.2, 8.6, 5.6, 5.1, 'd')
  dots(
    g,
    [
      [21, 5],
      [22, 4],
      [22, 5],
    ],
    'm',
  )
  ellipse(g, 27.6, 10.4, 2.6, 1.8, 'l')
  outline(g)
  dots(
    g,
    [
      [29, 9],
      [30, 9],
    ],
    'n',
  ) // the nose
  dots(
    g,
    [
      [28, 11],
      [29, 11],
    ],
    'k',
  ) // the mouth
  dots(g, [[24, 10]], 'n') // blush
  // the eye
  art(['.kk.', 'kwpk', 'kepk', '.kk.']).forEach((row, y) =>
    row.forEach((c, x) => c !== '.' && put(g, 24 + x, 5 + y, c)),
  )
  return g
}

// ---- her hats: drawn on a canvas a pixel bigger all round, then outlined ----

function hat(rows) {
  const g = canvas(rows[0].length + 2, rows.length + 2)
  rows.forEach((row, y) => [...row].forEach((c, x) => c !== '.' && put(g, x + 1, y + 1, c)))
  outline(g)
  return g
}

const HATS = {
  party: hat(['...y...', '..yyy..', '...r...', '..rcr..', '..rrr..', '.rcrcr.', '.rrrrr.', 'rcrcrcr']),
  crown: hat(['y...y...y', 'yy.yyy.yy', 'yyyyryyyy', 'yyyyyyyyy']),
  bow: hat(['rr...rr', 'rrrRrrr', 'rr...rr']),
  beanie: hat(['....ccc....', '...rrrrr...', '..rrRrRrr..', '.rrrrrrrrr.', 'ccccccccccc']),
  flower: hat(['.n..n.', 'nnnnnn', '.nyyn.', '.nyyn.', 'nnnnnn', '.n..n.']),
}
// where each hat goes: on her head's top (the middle of the hat's bottom row) or on her ear
const HAT_SPOT = { party: 'top', crown: 'top', bow: 'ear', beanie: 'top', flower: 'ear' }

// ---- her toys and her bubbles' bits ----

const TOYS = {
  fish: art(['.kkkk..k.', 'kbbbbkkbk', 'kpwbbbbbk', 'kwwwbkkbk', '.kkkk..k.']),
  yarn: art(['..kkk..', '.krRrk.', 'krrRrrk', 'kRrrRrk', 'krRrrRk', '.krrRk.', '..kkk..']),
  heart: art(['.kk.kk.', 'krrkrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...']),
  zzz: art(['kkkk', '..k.', '.k..', 'kkkk']),
  sparkle: art(['..y..', '..y..', 'yyyyy', '..y..', '..y..']),
}

// ---- the frames, by name; a family says where her head is ----

const FRAMES = {
  sit: sitting(),
  sit_tail: sitting({ tail: 'up' }),
  blink: sitting({ eyes: 'blink' }),
  look_l: sitting({ eyes: 'look_l' }),
  look_r: sitting({ eyes: 'look_r', tail: 'up' }),
  blep: sitting({ mouth: 'blep' }),
  happy: sitting({ eyes: 'happy', tail: 'up' }),
  love: sitting({ eyes: 'love', mouth: 'blep', tail: 'up' }),
  wide: sitting({ eyes: 'wide', mouth: 'open' }),
  eat: sitting({ eyes: 'happy', mouth: 'open' }),
  groom: sitting({ eyes: 'happy', paw: true }),
  yawn: sitting({ eyes: 'squeeze', mouth: 'yawn' }),
  sleep: loaf(),
  walk_1: walking(0),
  walk_2: walking(1),
}
// her head's top middle and her right ear, per family, in frame pixels
const SPOTS = {
  sit: { top: [13, 4], ear: [20, 3] },
  loaf: { top: [13, 9], ear: [20, 8] },
  walk: { top: [24, 4], ear: [27, 2] },
}
const FAMILY = Object.fromEntries(
  Object.keys(FRAMES).map((k) => [k, k === 'sleep' ? 'loaf' : k.startsWith('walk') ? 'walk' : 'sit']),
)

// ---- output ----

const rows = (g) => g.map((r) => r.join(''))
const ts = (obj) =>
  Object.entries(obj)
    .map(
      ([k, g]) =>
        `  ${k}: [\n${rows(g)
          .map((r) => `    '${r}',`)
          .join('\n')}\n  ],`,
    )
    .join('\n')

const out = `// Tuna's pixel art, written by tools/tuna-sprites.mjs: do not edit, change the drawing there and run
// \`npm run build:tuna\`. A character per pixel: '.' clear, the others colors of PALETTE.

export const PALETTE: Record<string, string> = ${JSON.stringify(PALETTE, null, 2)}

export const FRAMES = {
${ts(FRAMES)}
}
export type Frame = keyof typeof FRAMES

// which body a frame is, for where her hat goes
export const FAMILY: Record<Frame, 'sit' | 'loaf' | 'walk'> = ${JSON.stringify(FAMILY, null, 2)}
export const SPOTS: Record<'sit' | 'loaf' | 'walk', { top: [number, number]; ear: [number, number] }> = ${JSON.stringify(SPOTS)}

export const HATS = {
${ts(HATS)}
}
export const HAT_SPOT: Record<keyof typeof HATS, 'top' | 'ear'> = ${JSON.stringify(HAT_SPOT)}

export const TOYS = {
${ts(TOYS)}
}
`
writeFileSync(new URL('../src/components/tuna/frames.ts', import.meta.url), out)
console.log(`frames: ${Object.keys(FRAMES).join(', ')}`)

// the preview: every frame, its hats, the toys, at 10x, on a light and a dark band
const png = process.argv.indexOf('--png')
if (png > 0) {
  const S = 10
  const PAD = 8
  const items = [
    ...Object.values(FRAMES),
    ...Object.entries(HATS).map(([name, h]) => {
      // on a canvas with room above her head, so the hat is not cut off
      const g = [...Array.from({ length: 8 }, () => Array(26).fill('.')), ...sitting({ tail: 'up' })]
      const [ax, ay0] = SPOTS.sit[HAT_SPOT[name]]
      const ay = ay0 + 8
      const ox = ax - Math.floor(h[0].length / 2)
      const oy = ay - h.length + 1
      h.forEach((row, y) => row.forEach((c, x) => c !== '.' && put(g, ox + x, oy + y, c)))
      return g
    }),
    ...Object.values(TOYS),
  ]
  const perRow = 8
  const cell = 34 * S + PAD
  const W = perRow * cell + PAD
  const H = Math.ceil(items.length / perRow) * cell + PAD
  const px = Buffer.alloc(W * H * 3)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 3
      const light = Math.floor(y / cell) % 2 === 0
      px[o] = px[o + 1] = px[o + 2] = light ? 0xdd : 0x2f
    }
  items.forEach((g, i) => {
    const bx = PAD + (i % perRow) * cell
    const by = PAD + Math.floor(i / perRow) * cell
    g.forEach((row, y) =>
      row.forEach((c, x) => {
        if (c === '.') return
        const rgb = [1, 3, 5].map((j) => parseInt(PALETTE[c].slice(j, j + 2), 16))
        for (let dy = 0; dy < S; dy++)
          for (let dx = 0; dx < S; dx++) {
            const o = ((by + y * S + dy) * W + bx + x * S + dx) * 3
            px[o] = rgb[0]
            px[o + 1] = rgb[1]
            px[o + 2] = rgb[2]
          }
      }),
    )
  })
  const raw = Buffer.alloc((W * 3 + 1) * H)
  for (let y = 0; y < H; y++) px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3)
  const crc = (buf) => {
    let c = ~0
    for (const b of buf) {
      c ^= b
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
    }
    return ~c >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0)
  ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  writeFileSync(
    process.argv[png + 1],
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', ihdr),
      chunk('IDAT', deflateSync(raw)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  )
  console.log(`preview: ${process.argv[png + 1]}`)
}
