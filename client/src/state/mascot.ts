// feeding Tuna, the mascot: a click on her sends a fish to the room (a broadcast); everyone sees her
// eat and the chat says who fed her
import { isMuted, scoped, type NekoApp } from './app'
import { event } from './bus'
import { t } from '@/i18n'

const FEED_EVERY = 3000

export function showFeed(neko: NekoApp, sender: string) {
  neko.app.setState({ fed: { at: Date.now(), by: sender }, activity: Date.now() })
  event(neko, sender, t('mascot.fed'))
}

const last = scoped(() => ({ fed: 0 }))
export function feed(neko: NekoApp) {
  const { client } = neko
  const now = Date.now()
  if (isMuted(client) || now - last(neko).fed < FEED_EVERY) return
  last(neko).fed = now
  client.sendBroadcast('feed', null)
  showFeed(neko, client.state.session_id ?? '') // server does not echo broadcasts to the sender
}
