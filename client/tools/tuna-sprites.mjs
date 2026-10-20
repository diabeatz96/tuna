// Draws Tuna the mascot's pixel art from shapes and writes src/components/tuna/frames.ts: one grid of
// characters per frame (a character per pixel, '.' clear, the others colors of PALETTE), the hats,
// the toys and where the hats sit. `node tools/tuna-sprites.mjs [--png preview.png]`; the PNG shows
// every frame, for looking at the art.
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

// Tuna's colors, from photos of her: a long-haired charcoal tabby, silver and dark stripes, tortie
// ginger on her face and her belly gold, a cream ruff, a pale chin, green-yellow eyes, a salmon
// nose and long white whiskers; and a few for her things
const PALETTE = {
  k: '#1b1714', // outline
  s: '#262325', // dark stripes, shade
  d: '#46423f', // fur: charcoal
  m: '#8e8880', // silver: tabby markings, muzzle, paws
  l: '#cfc4b3', // the ruff on her chest
  a: '#b8733a', // tortie ginger
  h: '#d9a862', // her golden belly fluff
  c: '#e9dfd1', // cream: chin, ear tufts
  W: '#e7e2da', // whiskers
  e: '#b4bf4f', // eyes: green-yellow
  p: '#16120f', // pupils, mouth
  w: '#f7f2ea', // shine
  n: '#e3958a', // nose, ears, blush, tongue
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
// a line a pixel wide through points, over only the colors in `over`
function line(g, pts, c, over) {
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]
    const [x1, y1] = pts[i]
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2)
    for (let j = 0; j <= n; j++) {
      const x = Math.round(x0 + ((x1 - x0) * j) / n)
      const y = Math.round(y0 + ((y1 - y0) * j) / n)
      if (g[y]?.[x] !== undefined && over.includes(g[y][x])) g[y][x] = c
    }
  }
}
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
const at = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy])
// what a whisker may cross: her fur, her outline, the air
const WHISKER_OVER = ['.', 'k', 'd', 's']

// ---- Tuna, sitting, facing the viewer: 26 x 26, her middle between columns 12 and 13 ----

const EYES = {
  // 6 x 6, the left one at x 6..11, the right one at 14..19, rows 8..13: a big pupil in a
  // green-yellow rim with a shine top-left (the same side on both eyes)
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
  // unimpressed: the lids half down, looking right at you
  judge: ['......', '......', 'kkkkkk', 'kewpek', 'keppek', '.kkkk.'],
  // hunting: big pupils, looking ahead (right)
  hunt: ['.kkkk.', 'keeppk', 'kepwpk', 'kepppk', 'keeppk', '.kkkk.'],
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

// her nose (a pink button), and below it a smiling :3 (its corners up), the tongue out, open,
// a frown, a flat line, a yawn
function mouth(g, kind, dy = 0) {
  dots(
    g,
    [
      [12, 12 + dy],
      [13, 12 + dy],
      [12, 13 + dy],
      [13, 13 + dy],
    ],
    'n',
  )
  const k = (pts) => dots(g, at(pts, 0, dy), 'k')
  if (kind === 'w' || kind === 'blep') {
    k([
      [11, 14],
      [14, 14],
      [12, 15],
      [13, 15],
    ])
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
  if (kind === 'frown')
    k([
      [11, 15],
      [12, 14],
      [13, 14],
      [14, 15],
    ])
  if (kind === 'flat')
    k([
      [12, 15],
      [13, 15],
    ])
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

// her long white whiskers, from her cheeks out past her face; on the side views only the ones on
// the side she faces, so they do not cross her body
function whiskers(g, dy = 0, both = true) {
  for (const pts of [
    [
      [5.2, 13.8],
      [2.6, 13.2],
      [0.2, 12.4],
    ],
    [
      [5.2, 15.2],
      [2.6, 15.6],
      [0.2, 16.6],
    ],
  ]) {
    if (both) line(g, at(pts, 0, dy), 'W', WHISKER_OVER)
    line(
      g,
      pts.map(([x, y]) => [25 - x, y + dy]),
      'W',
      WHISKER_OVER,
    )
  }
}

// her big fluffy tail, curled round to one side
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

// her ears, up or flattened sideways (fed up), the left one; the right one mirrors it. Big, with
// tufts of long fur inside
const EARS = {
  up: {
    ear: [
      [3.2, 9.8],
      [4.8, 0.2],
      [11.4, 4.4],
    ],
    pink: [
      [5.3, 6.9],
      [5.8, 2.2],
      [9.6, 4.8],
    ],
    tufts: [
      [6, 4],
      [7, 5],
      [6, 5],
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
    tufts: [
      [3, 6],
      [4, 7],
    ],
  },
}

function head(g, dy = 0, ears = 'up') {
  // the ears, their pink, their tufts
  const { ear, pink, tufts } = EARS[ears]
  for (const [pts, c] of [
    [ear, 'd'],
    [pink, 'n'],
  ]) {
    poly(g, at(pts, 0, dy), c)
    poly(
      g,
      pts.map(([x, y]) => [26 - x, y + dy]),
      c,
    )
  }
  mirror(g, at(tufts, 0, dy), 'c')
  // the head, wide at the cheeks with fluff sticking out
  ellipse(g, 13, 12.8 + dy, 10.4, 5, 'd')
  ellipse(g, 13, 10.6 + dy, 9.7, 7.5, 'd')
  mirror(
    g,
    at(
      [
        [2, 12],
        [2, 14],
        [3, 16],
      ],
      0,
      dy,
    ),
    'd',
  )
  // the tabby forehead: dark stripes running up, a little silver between
  mirror(
    g,
    at(
      [
        [11, 3],
        [11, 4],
        [11, 5],
        [11, 6],
        [9, 5],
        [9, 6],
      ],
      0,
      dy,
    ),
    's',
  )
  mirror(
    g,
    at(
      [
        [12, 4],
        [12, 5],
        [10, 5],
      ],
      0,
      dy,
    ),
    'm',
  )
  // the stripes on her cheeks
  mirror(
    g,
    at(
      [
        [4, 10],
        [5, 10],
        [3, 12],
        [4, 12],
      ],
      0,
      dy,
    ),
    's',
  )
  // her tortie ginger: a patch over her left eye and the bridge of her nose, a fleck on her cheek
  dots(
    g,
    at(
      [
        [15, 5],
        [16, 5],
        [16, 6],
        [17, 6],
        [18, 6],
        [17, 7],
        [18, 7],
        [12, 7],
        [5, 11],
      ],
      0,
      dy,
    ),
    'a',
  )
  // the silver muzzle, the pale chin, the blush
  ellipse(g, 13, 14.9 + dy, 3.4, 2.1, 'm')
  mirror(
    g,
    at(
      [
        [12, 16],
        [12, 17],
      ],
      0,
      dy,
    ),
    'c',
  )
  mirror(
    g,
    at(
      [
        [5, 14],
        [6, 14],
      ],
      0,
      dy,
    ),
    'n',
  )
}

// a paw raised at her mouth (grooming); batting at something, a leg reaches out to the side
const PAWS = { groom: [15.8, 16.2] }

function sitting({ eyes: e = 'open', mouth: m = 'w', tail = 'down', paw = '', ears = 'up', box = false } = {}) {
  const g = canvas(26, 26)
  // the tail, bushy, ringed darker to the tip
  const t = TAILS[tail]
  stroke(g, t, 1.6, 'd')
  dots(
    g,
    [t[2], t[4], t.at(-1)].map((p) => p.map(Math.round)),
    's',
  )
  // the body, fluffy at the sides, with a ginger fleck
  ellipse(g, 13, 20.6, 7.4, 5.2, 'd')
  mirror(
    g,
    [
      [5, 19],
      [5, 21],
    ],
    'd',
  )
  mirror(
    g,
    [
      [7, 19],
      [6, 21],
    ],
    's',
  )
  dots(
    g,
    [
      [7, 22],
      [8, 23],
    ],
    'a',
  )
  // the ruff on her chest, ragged at the bottom, streaked silver
  ellipse(g, 13, 19.4, 4.4, 4.4, 'l')
  dots(
    g,
    [
      [9, 23],
      [11, 24],
      [14, 24],
      [16, 23],
    ],
    'l',
  )
  dots(
    g,
    [
      [11, 19],
      [14, 20],
    ],
    'm',
  )
  // her front paws, silver
  ellipse(g, 10.2, 24.6, 2, 1.25, 'm')
  ellipse(g, 15.8, 24.6, 2, 1.25, 'm')
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
    ellipse(g, 22.9, 15.2, 1.6, 1.4, 'm')
  }
  head(g, 0, ears)
  outline(g)
  // the chin's shadow on the ruff
  dots(
    g,
    [
      [9, 18],
      [10, 18],
      [15, 18],
      [16, 18],
    ],
    'm',
  )
  eyes(g, e)
  mouth(g, m)
  whiskers(g)
  if (PAWS[paw]) {
    const [px, py] = PAWS[paw]
    ellipse(g, px, py, 1.9, 1.6, 'k')
    ellipse(g, px, py, 1.1, 0.8, 'm')
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
      [2, 20],
      [3, 18],
    ],
    'd',
  )
  mirror(
    g,
    [
      [4, 20],
      [4, 22],
      [6, 19],
    ],
    's',
  )
  dots(
    g,
    [
      [19, 20],
      [20, 21],
    ],
    'a',
  )
  ellipse(g, 13, 22.8, 4.6, 2.4, 'l')
  ellipse(g, 9.6, 24.6, 1.8, 1.1, 'm')
  ellipse(g, 16.4, 24.6, 1.8, 1.1, 'm')
  head(g, 5)
  outline(g)
  eyes(g, e, 5)
  mouth(g, 'w', 5)
  whiskers(g, 5)
  return g
}

// ---- seen from the side, walking right: 36 x 26, her head turned to us ----

// her face from the front, the same as when she sits (head, outline, eyes, mouth, whiskers), on a
// canvas of its own, to put on a body seen from the side
function face({ eyes: e = 'open', mouth: m = 'w', ears = 'up' } = {}) {
  const g = canvas(26, 26)
  head(g, 0, ears)
  outline(g)
  eyes(g, e)
  mouth(g, m)
  whiskers(g, 0, false)
  return g
}
// one grid on another at (dx, dy), its clear pixels left out
const paste = (g, top, dx, dy) => top.forEach((row, y) => row.forEach((c, x) => c !== '.' && put(g, x + dx, y + dy, c)))

// where her face goes on each side view (its sitting head's top left)
const HEADS = { walk: [11, 0], crouch: [11, 4], leap: [12, 0], lounge: [10, 1], sprawl: [11, 6] }

// a leg from the body down to its silver paw
function leg(g, from, to, c) {
  const n = 6
  stroke(
    g,
    Array.from({ length: n + 1 }, (_, i) => [
      from[0] + ((to[0] - from[0]) * i) / n,
      from[1] + ((to[1] - from[1]) * i) / n,
    ]),
    1,
    c,
  )
  ellipse(g, to[0], to[1], 1.3, 0.9, 'm')
}

// her bushy tail through points, ringed darker, the tip dark
function sideTail(g, pts, r = 1.7) {
  stroke(g, pts, r, 'd')
  dots(
    g,
    [pts[Math.floor(pts.length / 2)], pts.at(-1)].map((p) => p.map(Math.round)),
    's',
  )
}

// her back: tabby stripes, a little silver, a fleck of ginger
function back(g, xs, y) {
  dots(
    g,
    xs.flatMap((x) => [
      [x, y],
      [x, y + 1],
    ]),
    's',
  )
  dots(
    g,
    xs.slice(0, -1).map((x) => [x + 1, y]),
    'm',
  )
  dots(
    g,
    [
      [xs[0] - 1, y + 2],
      [xs[0], y + 3],
    ],
    'a',
  )
}

function walking(step) {
  const g = canvas(36, 26)
  // the tail, up behind her, swaying
  sideTail(
    g,
    step === 0
      ? [
          [7.5, 18],
          [6, 16.4],
          [5, 14.4],
          [4.6, 12.2],
          [5, 10.2],
          [6, 8.6],
        ]
      : [
          [7.5, 18],
          [6.2, 16.2],
          [5.4, 14.2],
          [5.4, 12],
          [6, 10],
          [7.2, 8.6],
        ],
  )
  // four short legs: apart, then together
  const legs = step === 0 ? [8, 12, 19, 23] : [10, 11, 21, 22]
  legs.forEach((x, i) => leg(g, [x + 0.5, 20], [x + 0.5, 24.6], i % 2 ? 'd' : 's'))
  // a round body, the golden belly under it
  ellipse(g, 16, 19.4, 9, 4.6, 'd')
  back(g, [9, 12, 15], 15)
  ellipse(g, 16, 22.4, 6.2, 1.6, 'h')
  outline(g)
  paste(g, face({ eyes: 'look_r' }), ...HEADS.walk)
  return g
}

// hunting: low down, her bottom up and wiggling (`wiggle` 0 or 1), big pupils on the prey
function crouching(wiggle) {
  const g = canvas(36, 26)
  const w = wiggle ? 0.7 : -0.7
  sideTail(g, [
    [7, 20.4],
    [5.4, 19.4 + w],
    [3.8, 18.6 - w],
    [2.4, 18.2 + w],
    [1.6, 17.4],
  ])
  leg(g, [9, 21], [8.4 + w / 2, 24.6], 's')
  leg(g, [12, 22], [12.2, 24.8], 'd')
  leg(g, [21, 23], [23.4, 24.8], 's')
  leg(g, [24, 23], [26.6, 24.8], 'd')
  // the body low at the front, her bottom up
  ellipse(g, 17, 21.4, 9.4, 3.4, 'd')
  ellipse(g, 10.4 + w / 3, 19.6, 4.6, 3.8, 'd')
  back(g, [8, 11, 14], 17)
  ellipse(g, 17, 23.6, 6, 1.2, 'h')
  outline(g)
  paste(g, face({ eyes: 'hunt' }), ...HEADS.crouch)
  return g
}

// the pounce: stretched out in the air, front paws reaching, tail streaming
function leaping() {
  const g = canvas(36, 26)
  sideTail(
    g,
    [
      [7, 13.6],
      [5.2, 12.8],
      [3.4, 11.8],
      [1.8, 10.6],
    ],
    1.5,
  )
  leg(g, [9, 15], [3.6, 19.6], 's')
  leg(g, [11.4, 15.6], [6.6, 21], 'd')
  leg(g, [24, 15], [31.6, 21.4], 's')
  leg(g, [22, 15.6], [28.6, 22.6], 'd')
  ellipse(g, 16, 13.6, 10.4, 3.8, 'd')
  back(g, [9, 12, 15], 10)
  ellipse(g, 16, 16, 6.4, 1.4, 'h')
  outline(g)
  paste(g, face({ eyes: 'hunt', mouth: 'open' }), ...HEADS.leap)
  return g
}

// lounging on her side on the desk, her golden belly fluff out, her head up and turned, a front
// paw reaching out and a back leg stretched
function lounging() {
  const g = canvas(36, 26)
  sideTail(
    g,
    [
      [4.4, 21.6],
      [2.6, 20.6],
      [1.6, 19],
      [1.6, 17.2],
    ],
    1.5,
  )
  leg(g, [7, 22.4], [2.6, 24.8], 'd')
  leg(g, [26, 21.6], [33.4, 24.6], 's')
  ellipse(g, 15, 20.4, 12, 4.4, 'd')
  back(g, [6, 9, 12], 16)
  // the belly: golden and curly at its edge, a little ginger in the fluff
  ellipse(g, 14.4, 22, 9.4, 2.6, 'h')
  dots(
    g,
    [
      [7, 19],
      [9, 18],
      [11, 19],
      [13, 18],
      [15, 19],
      [17, 18],
      [19, 19],
    ],
    'h',
  )
  dots(
    g,
    [
      [9, 21],
      [12, 22],
      [15, 21],
      [18, 22],
    ],
    'a',
  )
  outline(g)
  paste(g, face({ eyes: 'look_r' }), ...HEADS.lounge)
  return g
}

// stretched out flat, fast asleep, her chin down on her front paws
function sprawling() {
  const g = canvas(36, 26)
  sideTail(
    g,
    [
      [4.4, 21.6],
      [2.6, 21.2],
      [1.4, 20],
      [1, 18.4],
    ],
    1.5,
  )
  leg(g, [7, 22.6], [2.2, 24.8], 's')
  ellipse(g, 15.6, 21.6, 12.2, 3.6, 'd')
  back(g, [6, 9, 12], 18)
  ellipse(g, 13.6, 23.4, 8, 1.4, 'l')
  // her front paws stretched out in front, under her chin
  ellipse(g, 30.6, 24.6, 2, 1.1, 'm')
  ellipse(g, 34, 24.6, 1.6, 1.1, 'm')
  outline(g)
  paste(g, face({ eyes: 'sleep' }), ...HEADS.sprawl)
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
  judge: sitting({ eyes: 'judge', mouth: 'flat' }),
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
  lounge: lounging(),
  sprawl: sprawling(),
}
// her head's top middle, her right ear and her neck, per family, in frame pixels; on the side
// views her face is the sitting one, moved
const SIT = { top: [13, 4], ear: [20, 3], neck: [13, 22] }
const SPOTS = {
  sit: SIT,
  loaf: { top: [13, 9], ear: [20, 8], neck: [13, 26] },
  ...Object.fromEntries(
    Object.entries(HEADS).map(([family, [dx, dy]]) => [
      family,
      Object.fromEntries(Object.entries(SIT).map(([spot, [x, y]]) => [spot, [x + dx, y + dy]])),
    ]),
  ),
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
          : ['leap', 'lounge', 'sprawl'].includes(k)
            ? k
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
export type Family = 'sit' | 'loaf' | 'walk' | 'crouch' | 'leap' | 'lounge' | 'sprawl'
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

// the preview: every frame, its hats, the toys, at 10x (or SCALE: 3 is her size on screen), on a
// light and a dark band
const png = process.argv.indexOf('--png')
if (png > 0) {
  const S = Number(process.env.SCALE) || 10
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
  const cell = 37 * S + PAD
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
