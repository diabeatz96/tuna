// playing with Tuna, the mascot. Each play is a broadcast (`feed`, `pet`, `ball`) that everyone
// sees; the chat says who fed her. A fish fills her tummy, which empties over time. Each member's
// plays add up to their Tuna points: kept on their own device and announced to the room (`points`)
// when they join, after each play, and to each newcomer.
import { isMuted, scoped, type NekoApp } from './app'
import { event } from './bus'
import { playSound } from './sound'
import { get, set } from './storage'
import { t } from '@/i18n'

export interface Points {
  feed: number
  pet: number
  ball: number
}
const ZERO: Points = { feed: 0, pet: 0, ball: 0 }
// a yarn ball is worth two: she has to run for it
export const score = (p?: Points) => (p ? p.feed + p.pet + 2 * p.ball : 0)

// her tummy: 0..100, a fish adds FISH, it empties by one a minute
export const FISH = 25
export const tummy = ({ level, at }: { level: number; at: number }, now = Date.now()) =>
  Math.max(0, Math.min(100, level - (now - at) / 60_000))

// how often one member may play, per kind; a purr every PURR_EVERY at most
const EVERY = { feed: 3000, pet: 800, ball: 4000 }
const PURR_EVERY = 2500

const count = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : 0)
export const mine = (): Points => {
  try {
    const p = JSON.parse(get('tuna_points', '{}'))
    return { feed: count(p.feed), pet: count(p.pet), ball: count(p.ball) }
  } catch {
    return { ...ZERO }
  }
}

const local = scoped(() => ({ last: { feed: 0, pet: 0, ball: 0 }, purred: 0, known: new Set<string>() }))

export function showFeed(neko: NekoApp, sender: string) {
  const now = Date.now()
  neko.app.setState((s) => ({
    fed: { at: now, by: sender },
    tummy: { level: Math.min(100, tummy(s.tummy, now) + FISH), at: now },
    activity: now,
  }))
  event(neko, sender, t('mascot.fed'))
}

export function showPet(neko: NekoApp, sender: string) {
  const now = Date.now()
  neko.app.setState({ petted: { at: now, by: sender }, activity: now })
  if (now - local(neko).purred > PURR_EVERY && !neko.app.getState().settings.ignore_sounds) {
    local(neko).purred = now
    playSound('purr', 0.5)
  }
}

// x: where the ball stops, a fraction of the video's width
export function showBall(neko: NekoApp, sender: string, x: unknown) {
  if (typeof x !== 'number' || !(x >= 0 && x <= 1)) return
  neko.app.setState({ ball: { at: Date.now(), by: sender, x }, activity: Date.now() })
}

export function showPoints(neko: NekoApp, sender: string, p: any) {
  if (!sender) return
  neko.app.setState((s) => ({
    points: { ...s.points, [sender]: { feed: count(p?.feed), pet: count(p?.pet), ball: count(p?.ball) } },
  }))
  // a newcomer: tell them mine, once
  if (!local(neko).known.has(sender)) {
    local(neko).known.add(sender)
    announce(neko)
  }
}

// my points, to the room
export function announce(neko: NekoApp) {
  const { client } = neko
  const p = mine()
  client.sendBroadcast('points', p)
  const me = client.state.session_id
  if (me) neko.app.setState((s) => ({ points: { ...s.points, [me]: p } }))
}

// one play of mine: rate-limited, sent, shown here (the server does not echo to the sender), counted
function play(neko: NekoApp, kind: keyof Points, body: unknown, show: (me: string) => void) {
  const { client } = neko
  const now = Date.now()
  if (isMuted(client) || now - local(neko).last[kind] < EVERY[kind]) return false
  local(neko).last[kind] = now
  client.sendBroadcast(kind, body)
  show(client.state.session_id ?? '')
  const p = mine()
  set('tuna_points', JSON.stringify({ ...p, [kind]: p[kind] + 1 }))
  announce(neko)
  return true
}

export const feed = (neko: NekoApp) => play(neko, 'feed', null, (me) => showFeed(neko, me))
export const pet = (neko: NekoApp) => play(neko, 'pet', null, (me) => showPet(neko, me))
export function throwBall(neko: NekoApp) {
  const x = 0.3 + Math.random() * 0.6
  return play(neko, 'ball', { x }, (me) => showBall(neko, me, x))
}

// a new connection: forget who heard my points, and tell the room
export function resetPoints(neko: NekoApp) {
  local(neko).known.clear()
  neko.app.setState({ points: {} })
}
