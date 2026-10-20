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
  b: '#6fa8c9', // blue: the fish, the scarf
  g: '#e58a3a', // the pumpkin
  G: '#b5622a',
  q: '#6f8f3e', // its stem
  v: '#7a5a9e', // the witch hat
  V: '#553d75',
  o: '#c8955a', // the cardboard box
  O: '#9a6b3a',
  x: '#ff4d5e', // the laser dot
}

// a canvas of w x h pixels, '.' clear; shapes are filled by pixel centers
const canvas = (w, h) => Array.from({ length: h }, () => Array(w).fill('.'))
const put = (g, x, y, c) => {
  x = Math.round(x)
  y = Math.round(y)
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
  // begging: all pupil, two shines
  plead: ['.kkkk.', 'kppppk', 'kpwppk', 'kppppk', 'kppwpk', '.kkkk.'],
  // fed up: the lids half down, looking aside
  grump: ['......', '......', 'kkkkkk', 'keepek', '.kkkk.', '......'],
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
  if (kind === 'frown') {
    dots(
      g,
      [
        [11, 15 + dy],
        [12, 14 + dy],
        [13, 14 + dy],
        [14, 15 + dy],
      ],
      'k',
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

// her ears, up or flattened sideways (fed up), the left one; the right one mirrors it
const EARS = {
  up: {
    ear: [
      [3.4, 9.6],
      [5, 0.4],
      [11.2, 4.4],
    ],
    pink: [
      [5.3, 6.9],
      [5.9, 2.4],
      [9.6, 4.8],
    ],
  },
  flat: {
    ear: [
      [3.2, 10],
      [0.3, 4.6],
      [9.4, 5],
    ],
    pink: [
      [3.6, 8.4],
      [1.9, 5.5],
      [7.4, 5.6],
    ],
  },
}

function head(g, dy = 0, ears = 'up') {
  // the ears, their pink, the head
  const { ear, pink } = EARS[ears]
  for (const [pts, c] of [
    [ear, 'd'],
    [pink, 'n'],
  ]) {
    poly(
      g,
      pts.map(([x, y]) => [x, y + dy]),
      c,
    )
    poly(
      g,
      pts.map(([x, y]) => [26 - x, y + dy]),
      c,
    )
  }
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

// a paw raised at her mouth (grooming); batting at something, a leg reaches out to the side
const PAWS = { groom: [15.8, 16.2] }

function sitting({ eyes: e = 'open', mouth: m = 'w', tail = 'down', paw = '', ears = 'up', box = false } = {}) {
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
  if (paw === 'bat') {
    // a front leg reaching out to her side, its paw up
    stroke(
      g,
      [
        [16.4, 19.2],
        [18.4, 18],
        [20.4, 16.8],
        [22, 15.8],
      ],
      1.1,
      'd',
    )
    ellipse(g, 22.9, 15.2, 1.6, 1.4, 'l')
  }
  head(g, 0, ears)
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
  if (PAWS[paw]) {
    const [px, py] = PAWS[paw]
    ellipse(g, px, py, 1.9, 1.6, 'k')
    ellipse(g, px, py, 1.1, 0.8, 'l')
  }
  if (box) {
    // sitting in a cardboard box: its flaps, its front, a strip of tape
    poly(
      g,
      [
        [3, 19],
        [0.2, 15.6],
        [4.4, 15.6],
        [7.2, 19],
      ],
      'O',
    )
    poly(
      g,
      [
        [23, 19],
        [25.8, 15.6],
        [21.6, 15.6],
        [18.8, 19],
      ],
      'O',
    )
    poly(
      g,
      [
        [3, 19],
        [23, 19],
        [22.6, 26],
        [3.4, 26],
      ],
      'o',
    )
    for (let x = 3; x <= 22; x++) put(g, x, 19, 'k')
    for (let y = 20; y <= 21; y++) for (let x = 4; x <= 21; x++) put(g, x, y, 'O')
    for (let y = 20; y <= 25; y++)
      dots(
        g,
        [
          [12, y],
          [13, y],
        ],
        'c',
      )
    outline(g)
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
  sideHead(g)
  outline(g)
  sideFace(g)
  return g
}

// her head from the side, facing right, moved by (dx, dy): the ears, the head, the muzzle
function sideHead(g, dx = 0, dy = 0) {
  const at = (pts) => pts.map(([x, y]) => [x + dx, y + dy])
  poly(
    g,
    at([
      [19.4, 5.4],
      [20.4, 0.4],
      [24, 3.4],
    ]),
    'd',
  )
  poly(
    g,
    at([
      [24.2, 3.2],
      [27.4, 0.4],
      [28.8, 5.2],
    ]),
    'd',
  )
  poly(
    g,
    at([
      [25.4, 3.4],
      [27, 1.6],
      [27.8, 4.2],
    ]),
    'n',
  )
  ellipse(g, 24.2 + dx, 8.6 + dy, 5.6, 5.1, 'd')
  dots(
    g,
    at([
      [21, 5],
      [22, 4],
      [22, 5],
    ]),
    'm',
  )
  ellipse(g, 27.6 + dx, 10.4 + dy, 2.6, 1.8, 'l')
}

// and its face, drawn after the outline: the nose, the mouth, a blush, the eye (wide: hunting)
function sideFace(g, dx = 0, dy = 0, eye = 'open') {
  dx = Math.round(dx)
  dy = Math.round(dy)
  dots(
    g,
    [
      [29 + dx, 9 + dy],
      [30 + dx, 9 + dy],
    ],
    'n',
  )
  dots(
    g,
    [
      [28 + dx, 11 + dy],
      [29 + dx, 11 + dy],
    ],
    'k',
  )
  dots(g, [[24 + dx, 10 + dy]], 'n')
  art(eye === 'wide' ? ['.kk.', 'kppk', 'kwpk', '.kk.'] : ['.kk.', 'kwpk', 'kepk', '.kk.']).forEach((row, y) =>
    row.forEach((c, x) => c !== '.' && put(g, 24 + dx + x, 5 + dy + y, c)),
  )
}

// a leg from the side, from the body down to its paw
function leg(g, from, to, c) {
  const n = 6
  stroke(
    g,
    Array.from({ length: n + 1 }, (_, i) => [
      from[0] + ((to[0] - from[0]) * i) / n,
      from[1] + ((to[1] - from[1]) * i) / n,
    ]),
    0.9,
    c,
  )
  ellipse(g, to[0], to[1], 1.1, 0.8, 'l')
}

// hunting: low down, her bottom up and wiggling (`wiggle` 0 or 1), eyes on the prey; 32 x 22
function crouching(wiggle) {
  const g = canvas(32, 22)
  const w = wiggle ? 0.7 : -0.7
  stroke(
    g,
    [
      [5.5, 13.5],
      [4.2 + w, 12.2],
      [3.2 + w, 10.6],
      [2.8 + w, 8.8],
      [3.2 + w, 7.2],
    ],
    1.1,
    'd',
  )
  dots(g, [[Math.round(3.2 + w), 7]], 'm')
  leg(g, [8, 16], [7.4 + w / 2, 20], 's')
  leg(g, [11, 17], [11.2, 20.2], 'd')
  leg(g, [18, 17.4], [19.6, 20.4], 's')
  leg(g, [21, 17.4], [23, 20.4], 'd')
  // the body, low at the front
  ellipse(g, 13.6 + w / 3, 14.6, 9, 3.8, 'd')
  ellipse(g, 18.4, 16.8, 5.2, 2.4, 'd')
  dots(
    g,
    [
      [9, 11],
      [12, 11],
      [12, 12],
      [15, 12],
    ],
    'm',
  )
  ellipse(g, 16.6, 17.4, 4.6, 1.5, 'l')
  sideHead(g, 0.4, 5)
  outline(g)
  sideFace(g, 0.4, 5, 'wide')
  return g
}

// the pounce: stretched out in the air, front paws reaching; 32 x 22
function leaping() {
  const g = canvas(32, 22)
  stroke(
    g,
    [
      [5, 10.6],
      [3.6, 10],
      [2.2, 9.2],
      [1.2, 8.2],
    ],
    1.05,
    'd',
  )
  dots(g, [[1, 8]], 'm')
  leg(g, [7.5, 12.4], [3.4, 16.6], 's')
  leg(g, [10, 13], [6.6, 17.6], 'd')
  leg(g, [20, 12.6], [26.4, 15.8], 's')
  leg(g, [22, 12], [28.4, 13.8], 'd')
  ellipse(g, 14.6, 10.8, 10.2, 3.7, 'd')
  dots(
    g,
    [
      [10, 8],
      [13, 7],
      [13, 8],
      [16, 8],
    ],
    'm',
  )
  ellipse(g, 15.6, 13, 6, 1.4, 'l')
  sideHead(g, 1, 0.6)
  outline(g)
  sideFace(g, 1, 0.6, 'wide')
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
  witch: hat([
    '.......vv..',
    '......vv...',
    '.....vvv...',
    '....vvvv...',
    '....vvvvv..',
    '...vvvvvv..',
    '...yyyyyy..',
    'vvvvvvvvvvv',
    '.VVVVVVVVV.',
  ]),
  scarf: hat(['.bbbbbbbbb.', 'bbcbbcbbcbb', '......bcb..', '......bbb..', '......bcb..']),
}
// where each thing goes: on her head's top (the middle of its bottom row), on her ear, or round
// her neck
const HAT_SPOT = {
  party: 'top',
  crown: 'top',
  bow: 'ear',
  beanie: 'top',
  flower: 'ear',
  witch: 'top',
  scarf: 'neck',
}

// ---- her toys, her things and her bubbles' bits ----

const TOYS = {
  fish: art(['.kkkk..k.', 'kbbbbkkbk', 'kpwbbbbbk', 'kwwwbkkbk', '.kkkk..k.']),
  yarn: art(['..kkk..', '.krRrk.', 'krrRrrk', 'kRrrRrk', 'krRrrRk', '.krrRk.', '..kkk..']),
  heart: art(['.kk.kk.', 'krrkrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...']),
  zzz: art(['kkkk', '..k.', '.k..', 'kkkk']),
  sparkle: art(['..y..', '..y..', 'yyyyy', '..y..', '..y..']),
  // her food bowl, empty
  bowl: hat(['ccccccccc', '.rrrrrrr.', '.rRrRrRr.', '..rrrrr..']),
  pumpkin: hat(['....q....', '...qq....', '.ggGgGgg.', 'gggGgGggg', 'gggGgGggg', 'gggGgGggg', '.ggGgGgg.']),
  laser: art(['.x.', 'xwx', '.x.']),
  box: hat([
    'O............O',
    'OO..........OO',
    '.OOssssssssOO.',
    '..kkkkkkkkkk..',
    '..oOOOOOOOOo..',
    '..ooooccoooo..',
    '..ooooccoooo..',
    '..ooooccoooo..',
  ]),
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
  groom: sitting({ eyes: 'happy', paw: 'groom' }),
  yawn: sitting({ eyes: 'squeeze', mouth: 'yawn' }),
  plead: sitting({ eyes: 'plead', tail: 'up' }),
  grump: sitting({ eyes: 'grump', mouth: 'frown', ears: 'flat' }),
  bat: sitting({ eyes: 'look_r', mouth: 'open', paw: 'bat', tail: 'up' }),
  boxed: sitting({ box: true }),
  boxed_blink: sitting({ eyes: 'blink', box: true }),
  boxed_happy: sitting({ eyes: 'happy', box: true }),
  sleep: loaf(),
  walk_1: walking(0),
  walk_2: walking(1),
  crouch_1: crouching(0),
  crouch_2: crouching(1),
  leap: leaping(),
}
// her head's top middle, her right ear and her neck, per family, in frame pixels
const SPOTS = {
  sit: { top: [13, 4], ear: [20, 3], neck: [13, 22] },
  loaf: { top: [13, 9], ear: [20, 8], neck: [13, 26] },
  walk: { top: [24, 4], ear: [27, 2], neck: [22, 17] },
  crouch: { top: [24, 9], ear: [27, 7], neck: [22, 21] },
  leap: { top: [25, 5], ear: [28, 3], neck: [23, 17] },
}
const FAMILY = Object.fromEntries(
  Object.keys(FRAMES).map((k) => [
    k,
    k === 'sleep'
      ? 'loaf'
      : k.startsWith('walk')
        ? 'walk'
        : k.startsWith('crouch')
          ? 'crouch'
          : k === 'leap'
            ? 'leap'
            : 'sit',
  ]),
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
export type Family = 'sit' | 'loaf' | 'walk' | 'crouch' | 'leap'
export const FAMILY: Record<Frame, Family> = ${JSON.stringify(FAMILY, null, 2)}
export const SPOTS: Record<Family, Record<'top' | 'ear' | 'neck', [number, number]>> = ${JSON.stringify(SPOTS)}

export const HATS = {
${ts(HATS)}
}
export const HAT_SPOT: Record<keyof typeof HATS, 'top' | 'ear' | 'neck'> = ${JSON.stringify(HAT_SPOT)}

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
