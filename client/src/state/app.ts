// The GUI's own state next to the core's `client.state`: viewer settings, the side panel, the
// dialog. A zustand store: components select from it (`useStore(app, (s) => s.side)`), everything
// else reads `app.getState()` and writes with `app.setState()`. Plugins keep their own stores.
// Also the bundle one instance of the GUI runs on (`NekoApp`) and the small readers of the
// client's state that components share.
import { createStore } from 'zustand/vanilla'
import type { NekoClient, Overlay, Settings, State } from '@m1k1o/neko'
import { get } from './storage'
import type { Dialog } from './dialogs'
import type { Bus } from './bus'
import type { Reaction } from './emotes'
import type { Ping } from './pings'
import type { Hat, Points, Tummy } from './mascot'
import { t } from '@/i18n'

export const defaults = {
  // v3 scroll steps -5..5; new key because the legacy `scroll` (1..100 px clamp) meant something else
  scroll_sensitivity: 0,
  scroll_invert: true,
  autoplay: true,
  ignore_emotes: false,
  chat_sound: true,
  // a short chime when someone joins or leaves (state/sound.ts)
  join_sound: false,
  // the soundboard's sounds from the others (state/soundboard.ts)
  ignore_sounds: false,
  // everyone's avatar in a row of seats along the bottom of the video
  theater_seats: false,
  // Tuna the cat on the video (features/mascot), how much she says, and whether she brings the
  // chat into fullscreen (where the side panel is not seen)
  show_mascot: true,
  tuna_talk: 'normal' as Talk,
  tuna_chat: true,
  // open chat links on the remote desktop instead of locally (needs the openinapp plugin)
  links_in_app: false,
  keyboard_layout: 'us',
}
export type ViewerSettings = typeof defaults

// how much Tuna says: nothing, now and then, or a lot
export const TALKS = ['quiet', 'normal', 'chatty'] as const
export type Talk = (typeof TALKS)[number]

function load(): ViewerSettings {
  const out = { ...defaults }
  for (const k of Object.keys(defaults) as (keyof ViewerSettings)[]) (out as any)[k] = get(k, defaults[k])
  if (!TALKS.includes(out.tuna_talk)) out.tuna_talk = defaults.tuna_talk
  // before the three levels her bubbles were on or off
  if (get('tuna_talk', '') === '' && !get('tuna_talks', true)) out.tuna_talk = 'quiet'
  return out
}

// one per instance (createNekoApp); what the URL and the stored settings say at start-up
export function createAppStore() {
  const params = new URL(location.href).searchParams
  return createStore(() => ({
    settings: load(),
    side: params.has('show_side') ? params.get('show_side') === '1' : get('side', false),
    // id of the side panel's tab (a plugin's or 'settings')
    tab: get<string>('tab', 'chat'),
    // openinapp/init: links can be opened on the remote desktop
    openInApp: false,
    emotes: {} as Record<string, string>,
    // who sent which emote lately, the tally over the video (state/emotes.ts)
    reactions: [] as Reaction[],
    // markers dropped on the picture (state/pings.ts)
    pings: [] as Ping[],
    // when each member last cheered (an emote, a sound, a ping): their theater seat hops
    cheers: {} as Record<string, number>,
    // the room's last emote, sound, ping or play with the mascot: her mood (state/mascot.ts)
    activity: Date.now(),
    fed: { at: 0, by: '' },
    petted: { at: 0, by: '' },
    // the yarn ball's last throw: where it stops, a fraction of the video's width
    ball: { at: 0, by: '', x: 0 },
    // a laser dot's last run (its path comes from the seed), and a box set down for her
    laser: { at: 0, by: '', seed: 0 },
    box: { at: 0, by: '', x: 0 },
    // her tummy (0..100) at a time; it empties over time (state/mascot.ts)
    tummy: { level: 50, at: Date.now(), fed: 0 } as Tummy,
    // the hat she wears, picked by someone in the room at a time (the newest pick wins)
    hat: { name: '' as Hat, at: 0, by: '' },
    // each member's Tuna points, as they announced them
    points: {} as Record<string, Points>,
    ignored: {} as Record<string, boolean>,
    broadcast: { active: false, url: '' },
    keyboardLayouts: {} as Record<string, string>,
    menu: null as null | { x: number; y: number; id: string },
    dialog: null as Dialog | null,
    about: false,
  }))
}
export type AppStore = ReturnType<typeof createAppStore>

// What one instance of the GUI runs on: the core client with its keyboard/mouse/touch overlay, the
// store above and the bus. Made by createNekoApp (neko.ts), handed to <NekoProvider>, read by the
// hooks (provider.tsx) in components and passed to everything else (actions, plugins, ...).
export interface NekoApp {
  client: NekoClient
  overlay: Overlay
  app: AppStore
  bus: Bus
}

// one value per instance, made on first use: a plugin's store, the bound actions
export function scoped<T>(create: (neko: NekoApp) => T): (neko: NekoApp) => T {
  const cache = new WeakMap<NekoApp, T>()
  return (neko) => {
    if (!cache.has(neko)) cache.set(neko, create(neko))
    return cache.get(neko)!
  }
}

export const name = (client: NekoClient, id?: string | null) =>
  (id && client.state.sessions[id]?.profile.name) || t('somebody')
// the server's chat plugin took this member's right to send (chat.can_send); emotes follow it too
export const selectMuted = (s: State, id = s.session_id) =>
  !!id && s.sessions[id]?.profile.plugins?.['chat.can_send'] === false
export const isMuted = (client: NekoClient, id?: string | null) => selectMuted(client.state, id)

export type LockResource = 'login' | 'control'
export const isLocked = (r: LockResource, settings: Settings) =>
  r === 'login' ? settings.locked_logins : settings.locked_controls

// the room settings an admin switches in the settings tab (the locks are in the header);
// inactive_cursors is left out because this client does not draw the other cursors
export const ROOM_TOGGLES = ['private_mode', 'control_protection', 'implicit_hosting', 'merciful_reconnect'] as const
export type RoomToggle = (typeof ROOM_TOGGLES)[number]
