// event wiring: turn v3 events into event lines (shown by the chat) and toasts
import type { Settings } from '@m1k1o/neko'
import { isLocked, isMuted, name, ROOM_TOGGLES, type LockResource, type NekoApp } from './app'
import { actions } from './actions'
import { toast, tell, dismissToasts } from './dialogs'
import { event } from './bus'
import { EMOTES, showEmote } from './emotes'
import { announce, forget, resetPoints, showBall, showFeed, showHat, showPet, showPoints } from './mascot'
import { showPing } from './pings'
import { chime } from './sound'
import { hearSound, isSound } from './soundboard'
import { t } from '@/i18n'

// once per instance (createNekoApp), before the connection
export function wireEvents(neko: NekoApp) {
  const { client, app, bus } = neko
  const ev = client.events
  let initialized = false
  let lastHost: string | null = null
  let lastSettings: Settings | null = null
  // last seen state per session; names outlive session/deleted (core drops the session first)
  const known: Record<string, { connected: boolean; name: string }> = {}

  // session/created events during system/init are the existing member list, not joins
  client.store.subscribe(
    (s) => s.session_id,
    (id) => {
      initialized = !!id
      if (!id) return
      lastHost = client.state.control.host_id
      lastSettings = { ...client.state.settings, plugins: { ...client.state.settings.plugins } }
      for (const [sid, sess] of Object.entries(client.state.sessions))
        known[sid] = { connected: sess.state.is_connected, name: sess.profile.name }
      event(neko, id, t('notifications.connected', { name: '' }))
    },
  )

  function onSession(id: string) {
    if (!initialized) return
    const sess = client.state.sessions[id]
    const now = !!sess?.state.is_connected
    if (now !== !!known[id]?.connected && id !== client.state.session_id) {
      forget(neko, id)
      event(neko, id, t(now ? 'notifications.connected' : 'notifications.disconnected', { name: '' }))
      if (app.getState().settings.join_sound) chime(now)
      bus.emit('cue', { kind: now ? 'join' : 'leave', name: sess?.profile.name ?? known[id]?.name })
    }
    known[id] = { connected: now, name: sess?.profile.name ?? known[id]?.name ?? '' }
  }
  ev.on('session.created', onSession)
  ev.on('session.updated', onSession)
  ev.on('session.deleted', (id) => {
    const k = known[id]
    forget(neko, id)
    if (k?.connected) {
      bus.emit('log', id, k.name || t('somebody'), t('notifications.disconnected', { name: '' }))
      if (app.getState().settings.join_sound) chime(false)
      bus.emit('cue', { kind: 'leave', name: k.name })
    }
    delete known[id]
  })

  ev.on('room.control.host', (hasHost, hostID, by) => {
    const me = client.state.session_id
    if (hasHost && hostID) {
      if (by && by !== hostID) event(neko, by, t('notifications.controls_given', { name: name(client, hostID) }))
      else if (lastHost && lastHost !== hostID)
        event(neko, hostID, t('notifications.controls_taken_steal', { name: name(client, lastHost) }))
      else event(neko, hostID, t('notifications.controls_taken', { name: '' }))
      if (hostID === me) toast(t('notifications.controls_taken', { name: t('you') }))
      else if (lastHost === me) toast(t('notifications.controls_released', { name: t('you') }))
    } else if (lastHost) {
      if (by && by !== lastHost)
        event(neko, by, t('notifications.controls_released_steal', { name: name(client, lastHost) }))
      else event(neko, lastHost, t('notifications.controls_released', { name: '' }))
      if (lastHost === me) toast(t('notifications.controls_released', { name: t('you') }))
    }
    lastHost = hasHost ? (hostID ?? null) : null
  })

  // connection toasts, as the legacy client showed them
  client.store.subscribe(
    (s) => s.connection.status,
    (status, old) => {
      if (status === 'connecting' && old === 'connected') toast(t('connection.reconnecting'), undefined, 'warning')
      if (status === 'connected') {
        dismissToasts()
        toast(t('connection.connected'), undefined, 'success')
      }
    },
  )

  ev.on('room.control.request', (id) => {
    if (!app.getState().ignored[id]) toast(t('notifications.controls_requesting', { name: name(client, id) }))
  })

  ev.on('room.screen.updated', (width, height, rate, id) => {
    if (id) event(neko, id, t('notifications.resolution', { width, height, rate }))
  })

  ev.on('room.settings.updated', (next, id) => {
    if (lastSettings && id) {
      for (const r of ['control', 'login'] as LockResource[]) {
        const locked = isLocked(r, next)
        if (locked !== isLocked(r, lastSettings))
          event(neko, id, t(`locks.${r}.notif_${locked ? 'locked' : 'unlocked'}`))
      }
      for (const k of ROOM_TOGGLES)
        if (next[k] !== lastSettings[k])
          event(neko, id, t(`room.notif_${next[k] ? 'on' : 'off'}`, { setting: t(`room.${k}`) }))
    }
    lastSettings = { ...next, plugins: { ...next.plugins } }
  })

  // files dropped on the video go to the remote desktop through the core (room/upload/drop)
  ev.on('upload.drop.finished', (error) => error && toast(error.message, undefined, 'error'))

  ev.on('room.broadcast.status', (active, url) => app.setState({ broadcast: { active, url: url || '' } }))

  ev.on('receive.broadcast', (sender, subject, body) => {
    // other clients may send anything: each subject checks its body (only known names become class
    // names or sounds); what ignored or muted members send is dropped
    if (app.getState().ignored[sender] || isMuted(client, sender)) return
    if (subject === 'emote' && EMOTES.includes(body)) showEmote(app, body, sender)
    else if (subject === 'sound' && isSound(body)) hearSound(neko, sender, body)
    else if (subject === 'ping') showPing(app, sender, body?.x, body?.y)
    else if (subject === 'feed') showFeed(neko, sender)
    else if (subject === 'pet') showPet(neko, sender)
    else if (subject === 'ball') showBall(neko, sender, body?.x)
    else if (subject === 'points') showPoints(neko, sender, body)
    else if (subject === 'hat') showHat(neko, sender, body)
  })

  // Tuna points: a new connection starts the room's list over and announces mine
  client.store.subscribe(
    (s) => s.session_id,
    (id) => {
      resetPoints(neko)
      if (id) announce(neko)
    },
  )

  // plugin events (`chat/*`, ...) are dispatched by the plugin registry
  ev.on('message', (event, payload) => {
    if (event === 'openinapp/init') app.setState({ openInApp: !!payload.enabled })
  })

  ev.on('connection.closed', (error) => {
    initialized = false
    if (!error) return
    const reason =
      error.message === 'session deleted'
        ? t('connection.kicked')
        : error.message === 'connection replaced'
          ? t('connection.replaced')
          : error.message
    // session gone server-side (kicked, logged out elsewhere, server restarted: 401) or its login
    // disabled (403): back to the login screen. Any other failure, such as no network,
    // keeps the session for the Connect button.
    client.api
      .req('GET', '/whoami')
      .catch((err) => (err.status === 401 || err.status === 403 ? actions(neko).logout() : undefined))
      .finally(() => tell(app, t('connection.disconnected'), reason))
  })
}
