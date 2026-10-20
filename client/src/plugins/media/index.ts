import { event, line } from '@/state/bus'
import { t } from '@/i18n'
import type { Plugin } from '@/plugins/types'
import { RoomControls } from './RoomControls'
import { media as store, now } from './store'

// room-wide play, pause and seek of the video in the browser (Tuna's server plugin `media`): the
// controls in the room bar, and the chat says who did what and what is playing. Its strings live in
// `common`.
export const media: Plugin = {
  id: 'media',
  ns: 'common',
  roomBar: [{ id: 'media-controls', component: RoomControls }],
  onEvent(neko, ...[event_, payload]) {
    if (event_ === 'media/init') store(neko).setState({ enabled: payload.enabled })
    if (event_ === 'media/state') {
      const { state: before, at } = store(neko).getState()
      // where the video would be now, had nobody touched it
      const expected = before ? now(before, at) : 0
      store(neko).setState({ state: payload, at: Date.now() })
      if (payload.by && payload.action) {
        const what =
          payload.action === 'seek'
            ? t(payload.time >= expected ? 'media.did_forward' : 'media.did_back')
            : t(payload.paused ? 'media.did_pause' : 'media.did_play')
        event(neko, payload.by, what)
      }
      if (payload.found && payload.title && payload.title !== before?.title)
        line(neko, '🎬', t('media.now_playing', { title: payload.title }))
    }
  },
  init(neko) {
    neko.bus.on('logout', () => store(neko).setState({ state: null, at: 0 }))
  },
}
