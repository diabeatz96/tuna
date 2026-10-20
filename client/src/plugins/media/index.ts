import { PopcornIcon } from '@phosphor-icons/react'
import { name } from '@/state/app'
import { event, line } from '@/state/bus'
import { t } from '@/i18n'
import type { Plugin } from '@/plugins/types'
import { RoomControls } from './RoomControls'
import { Overlay } from './Overlay'
import { Party } from './Party'
import { applyEntry, cleanTitle, loadDiary } from './party'
import { media as store, now } from './store'

// room-wide play, pause and seek of the video in the browser and the watch party around it (Tuna's
// server plugin `media`): the controls in the room bar, the ready check and the rating card over the
// video, the Watch Party tab (predictions, diary, awards), and the chat says who did what and what is
// playing. Its strings live in `common`.
export const media: Plugin = {
  id: 'media',
  ns: 'common',
  tab: { id: 'party', icon: PopcornIcon, label: 'party.tab', component: Party },
  roomBar: [{ id: 'media-controls', component: RoomControls }],
  overlay: [{ id: 'media-overlay', component: Overlay }],
  onEvent(neko, ...[event_, payload]) {
    const s = store(neko)
    if (event_ === 'media/init') s.setState({ enabled: payload.enabled })
    if (event_ === 'media/state') {
      const { state: before, at } = s.getState()
      // where the video would be now, had nobody touched it
      const expected = before ? now(before, at) : 0
      s.setState({ state: payload, at: Date.now() })
      if (payload.by && payload.action) {
        const what =
          payload.action === 'seek'
            ? t(payload.time >= expected ? 'media.did_forward' : 'media.did_back')
            : t(payload.paused ? 'media.did_pause' : 'media.did_play')
        event(neko, payload.by, what)
      }
      if (payload.found && payload.title && payload.title !== before?.title)
        line(neko, '🎬', t('media.now_playing', { title: cleanTitle(payload.title) }))
      // Tuna watches too
      const who = payload.by ? name(neko.client, payload.by) : ''
      if (before?.found && payload.found && before.title && payload.title !== before.title)
        neko.bus.emit('cue', { kind: 'show' })
      else if (before?.found && payload.found && payload.paused !== before.paused)
        neko.bus.emit('cue', { kind: payload.paused ? 'pause' : 'play', name: who })
    }
    if (event_ === 'media/ready') {
      const before = s.getState().ready
      s.setState({ ready: payload, goAt: payload.go_at ?? 0 })
      if (payload.active && !before?.active && payload.by) {
        event(neko, payload.by, t('party.ready_started'))
        neko.bus.emit('cue', { kind: 'ready' })
      }
      if (payload.go_at) {
        line(neko, '✋', t('party.ready_go'))
        neko.bus.emit('cue', { kind: 'go' })
      }
    }
    if (event_ === 'media/predict') {
      const before = s.getState().predict
      s.setState({ predict: payload.id ? payload : null })
      if (payload.id && payload.id !== before?.id) event(neko, payload.by, t('party.predict_opened'))
      if (payload.revealed && !before?.revealed && payload.id === before?.id)
        line(neko, '🔮', t('party.predict_revealed'))
    }
    if (event_ === 'media/diary') {
      const isNew = !s.getState().diary.some((e) => e.id === payload.id)
      s.setState((st) => ({ diary: applyEntry(st.diary, payload) }))
      if (isNew && !payload.deleted) line(neko, '📖', t('party.diary_added', { title: cleanTitle(payload.title) }))
    }
    if (event_ === 'media/rate') {
      s.setState({ rate: payload })
      neko.bus.emit('cue', { kind: 'rate' })
    }
  },
  init(neko) {
    const { client, bus } = neko
    // the diary, at each connection
    client.store.subscribe(
      (st) => st.session_id,
      (id) => id && void loadDiary(neko),
    )
    bus.on('logout', () =>
      store(neko).setState({ state: null, at: 0, ready: null, goAt: 0, predict: null, diary: [], rate: null }),
    )
  },
}
