// pings: a marker someone drops on the picture ("look here"), sent to the room as a broadcast; x and y
// are fractions of the remote screen, so the marker lands on the same spot whatever the viewer's size
import { isMuted, scoped, type AppStore, type NekoApp } from './app'
import { cheer } from './emotes'
import { uid } from '@/lib/utils'

export interface Ping {
  key: string
  sender: string
  x: number
  y: number
}
// how long a marker stays, and how often one member may drop one
export const PING_MS = 2500
const PING_EVERY = 400

const inside = (v: unknown): v is number => typeof v === 'number' && v >= 0 && v <= 1

export function showPing(app: AppStore, sender: string, x: unknown, y: unknown) {
  if (!inside(x) || !inside(y)) return
  const key = uid()
  cheer(app, sender)
  app.setState((s) => ({ pings: [...s.pings, { key, sender, x, y }].slice(-10) }))
  setTimeout(() => app.setState((s) => ({ pings: s.pings.filter((p) => p.key !== key) })), PING_MS)
}

const limit = scoped(() => ({ last: 0 }))
export function sendPing(neko: NekoApp, x: number, y: number) {
  const { client, app } = neko
  const now = Date.now()
  if (isMuted(client) || now - limit(neko).last < PING_EVERY) return
  limit(neko).last = now
  client.sendBroadcast('ping', { x, y })
  showPing(app, client.state.session_id ?? '', x, y) // server does not echo broadcasts to the sender
}
