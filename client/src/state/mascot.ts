// playing with Tuna, the mascot. Each play is a broadcast (`feed`, `pet`, `ball`, `laser`, `box`,
// `hat`) that everyone sees; the chat says who fed her. A fish fills her tummy, which empties over
// time but not while she naps. Each member's plays add up to their Tuna points: kept on their own
// device and announced to the room (`points`) when they join, after each play, and to each newcomer.
// Her hat and her tummy are the room's: the newest pick (or fish) wins, and both are passed to
// newcomers with the points. She makes no sounds.
import { isMuted, scoped, type NekoApp } from './app'
import { event } from './bus'
import { get, set } from './storage'
import { t } from '@/i18n'

export interface Points {
  feed: number
  pet: number
  ball: number
}
const ZERO: Points = { feed: 0, pet: 0, ball: 0 }
// a yarn ball (or a laser dot, or a box) is worth two: she has to run for it
export const score = (p?: Points) => (p ? p.feed + p.pet + 2 * p.ball : 0)
// what a member mostly does with her, for their title on the board
export const favourite = (p: Points): keyof Points =>
  p.ball >= p.feed && p.ball >= p.pet ? 'ball' : p.feed >= p.pet ? 'feed' : 'pet'

// the room's level with her: all the points of the members here; level n takes 5 * n^2 points
export function level(total: number) {
  const n = Math.floor(Math.sqrt(Math.max(0, total) / 5)) + 1
  const from = 5 * (n - 1) ** 2
  const to = 5 * n ** 2
  return { level: n, progress: (total - from) / (to - from) }
}

// her tummy: 0..100 at a time, emptying by one a minute after it; `fed` is when the fish that set it
// was eaten (0: nobody fed her yet), the newest of which the room agrees on
export interface Tummy {
  level: number
  at: number
  fed: number
}
export const FISH = 25
export const tummy = ({ level, at }: { level: number; at: number }, now = Date.now()) =>
  Math.max(0, Math.min(100, level - (now - at) / 60_000))

// her hats (and her scarf); '' is none
export const HATS = ['', 'party', 'crown', 'bow', 'beanie', 'flower', 'witch', 'scarf'] as const
export type Hat = (typeof HATS)[number]
export const isHat = (v: unknown): v is Hat => HATS.includes(v as Hat)

// how often one member may play, per kind
const EVERY = { feed: 3000, pet: 800, ball: 4000, laser: 8000, box: 10_000, hat: 1000 }
type Kind = keyof typeof EVERY

const count = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : 0)
const isTime = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
export const mine = (): Points => {
  try {
    const p = JSON.parse(get('tuna_points', '{}'))
    return { feed: count(p.feed), pet: count(p.pet), ball: count(p.ball) }
  } catch {
    return { ...ZERO }
  }
}

const local = scoped(() => ({
  last: { feed: 0, pet: 0, ball: 0, laser: 0, box: 0, hat: 0 } as Record<Kind, number>,
  known: new Set<string>(),
}))

export function showFeed(neko: NekoApp, sender: string) {
  const now = Date.now()
  neko.app.setState((s) => ({
    fed: { at: now, by: sender },
    tummy: { level: Math.min(100, tummy(s.tummy, now) + FISH), at: now, fed: now },
    activity: now,
  }))
  event(neko, sender, t('mascot.fed'))
}

// the room's tummy, passed to a newcomer: taken when it comes from a newer fish than mine
export function showTummy(neko: NekoApp, body: any) {
  const { level, at, fed } = body ?? {}
  if (typeof level !== 'number' || !(level >= 0 && level <= 100) || !isTime(at) || !isTime(fed)) return
  if (fed <= neko.app.getState().tummy.fed) return
  neko.app.setState({ tummy: { level, at: Math.min(at, Date.now()), fed } })
}

// she napped from `since` until now: her tummy did not empty meanwhile
export function napped(neko: NekoApp, since: number, now = Date.now()) {
  neko.app.setState((s) => ({ tummy: { ...s.tummy, level: tummy(s.tummy, since), at: now } }))
}

export function showPet(neko: NekoApp, sender: string) {
  const now = Date.now()
  neko.app.setState({ petted: { at: now, by: sender }, activity: now })
}

// x: where the ball stops, a fraction of the video's width
export function showBall(neko: NekoApp, sender: string, x: unknown) {
  if (typeof x !== 'number' || !(x >= 0 && x <= 1)) return
  neko.app.setState({ ball: { at: Date.now(), by: sender, x }, activity: Date.now() })
}

// a laser dot darting about for a few seconds; everyone draws the same path from the seed
export function showLaser(neko: NekoApp, sender: string, seed: unknown) {
  if (!Number.isInteger(seed) || (seed as number) < 0 || (seed as number) >= 2 ** 31) return
  neko.app.setState({ laser: { at: Date.now(), by: sender, seed: seed as number }, activity: Date.now() })
}

// a cardboard box set down at x (a fraction of the video's width); she will want to sit in it
export function showBox(neko: NekoApp, sender: string, x: unknown) {
  if (typeof x !== 'number' || !(x >= 0 && x <= 1)) return
  neko.app.setState({ box: { at: Date.now(), by: sender, x }, activity: Date.now() })
}

// a hat the room picked, at a time: the newest pick wins, so an old one passed on to a newcomer
// does not undo a newer one
export function showHat(neko: NekoApp, sender: string, body: any) {
  const name = body?.name
  const at = body?.at
  if (!isHat(name) || typeof at !== 'number' || !Number.isFinite(at)) return
  if (at <= neko.app.getState().hat.at) return
  neko.app.setState({ hat: { name, at, by: sender } })
}

export function showPoints(neko: NekoApp, sender: string, p: any) {
  if (!sender) return
  neko.app.setState((s) => ({
    points: { ...s.points, [sender]: { feed: count(p?.feed), pet: count(p?.pet), ball: count(p?.ball) } },
  }))
  // a newcomer, or someone who just connected again (a reload is too quick for the room to see
  // them leave, so they say hello): tell them mine, her hat and her tummy
  if (p?.hello === true || !local(neko).known.has(sender)) {
    local(neko).known.add(sender)
    announce(neko)
  }
}

// my points, the hat she wears and how full she is, to the room; `hello` when I have just
// connected, so everyone answers with theirs
export function announce(neko: NekoApp, hello = false) {
  const { client, app } = neko
  const p = mine()
  client.sendBroadcast('points', hello ? { ...p, hello } : p)
  const { hat, tummy: belly } = app.getState()
  if (hat.at) client.sendBroadcast('hat', { name: hat.name, at: hat.at })
  if (belly.fed) client.sendBroadcast('tummy', belly)
  const me = client.state.session_id
  if (me) app.setState((s) => ({ points: { ...s.points, [me]: p } }))
}

// one play of mine: rate-limited, sent, shown here (the server does not echo to the sender),
// counted as a point of `counts`
function play(neko: NekoApp, kind: Kind, counts: keyof Points, body: unknown, show: (me: string) => void) {
  const { client } = neko
  const now = Date.now()
  if (isMuted(client) || now - local(neko).last[kind] < EVERY[kind]) return false
  local(neko).last[kind] = now
  client.sendBroadcast(kind, body)
  show(client.state.session_id ?? '')
  const p = mine()
  set('tuna_points', JSON.stringify({ ...p, [counts]: p[counts] + 1 }))
  announce(neko)
  return true
}

export const feed = (neko: NekoApp) => play(neko, 'feed', 'feed', null, (me) => showFeed(neko, me))
export const pet = (neko: NekoApp) => play(neko, 'pet', 'pet', null, (me) => showPet(neko, me))
export function throwBall(neko: NekoApp) {
  const x = 0.3 + Math.random() * 0.6
  return play(neko, 'ball', 'ball', { x }, (me) => showBall(neko, me, x))
}
export function shineLaser(neko: NekoApp) {
  const seed = Math.floor(Math.random() * 2 ** 31)
  return play(neko, 'laser', 'ball', seed, (me) => showLaser(neko, me, seed))
}
export function setBox(neko: NekoApp) {
  const x = 0.15 + Math.random() * 0.7
  return play(neko, 'box', 'ball', { x }, (me) => showBox(neko, me, x))
}

// dress her up: for everyone; not counted as points
export function wear(neko: NekoApp, name: Hat) {
  const { client } = neko
  const now = Date.now()
  if (isMuted(client) || now - local(neko).last.hat < EVERY.hat) return false
  local(neko).last.hat = now
  const at = Math.max(now, neko.app.getState().hat.at + 1)
  client.sendBroadcast('hat', { name, at })
  showHat(neko, client.state.session_id ?? '', { name, at })
  return true
}

// a member who comes back keeps their session id but heard nothing: a newcomer again
export function forget(neko: NekoApp, id: string) {
  local(neko).known.delete(id)
}

// a new connection: forget who heard my points, and tell the room
export function resetPoints(neko: NekoApp) {
  local(neko).known.clear()
  neko.app.setState({ points: {} })
}
