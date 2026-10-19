// emotes: the names the sprite sheet knows, showing one, sending one
import { isMuted, type AppStore, type NekoApp } from './app'
import { uid } from '@/lib/utils'

export const EMOTES = [
  'anger',
  'bomb',
  'sleep',
  'explode',
  'sweat',
  'poo',
  'hundred',
  'alert',
  'punch',
  'wave',
  'okay',
  'thumbs-up',
  'clap',
  'prey',
  'celebrate',
  'flame',
  'goof',
  'love',
  'cool',
  'smerk',
  'worry',
  'ouch',
  'cry',
  'surprised',
  'quiet',
  'rage',
  'annoy',
  'steamed',
  'scared',
  'terrified',
  'sleepy',
  'dead',
  'happy',
  'roll-eyes',
  'thinking',
  'clown',
  'sick',
  'rofl',
  'drule',
  'sniff',
  'sus',
  'party',
  'odd',
  'hot',
  'cold',
  'blush',
  'sad',
]

// one line of the tally over the video: a member's emote, counted while they keep sending it
export interface Reaction {
  key: string
  sender: string
  emote: string
  count: number
  at: number
}
// the same emote from the same member within BURST ms adds to its line; SHOWN lines at most
export const BURST = 3000
export const SHOWN = 3

export function showEmote(app: AppStore, emote: string, sender = '') {
  if (app.getState().settings.ignore_emotes || document.visibilityState === 'hidden') return
  const now = Date.now()
  app.setState((s) => {
    const i = s.reactions.findIndex((r) => r.sender === sender && r.emote === emote && now - r.at < BURST)
    const reactions =
      i < 0
        ? [...s.reactions, { key: uid(), sender, emote, count: 1, at: now }].slice(-SHOWN)
        : s.reactions.map((r, j) => (j === i ? { ...r, count: r.count + 1, at: now } : r))
    return { emotes: { ...s.emotes, [uid()]: emote }, reactions }
  })
}

// a tally line has faded; one that was counted again since (a newer `at`) stays
export function hideReaction(app: AppStore, key: string, at: number) {
  app.setState((s) => ({ reactions: s.reactions.filter((r) => r.key !== key || r.at !== at) }))
}

// the emote's animation is over
export function hideEmote(app: AppStore, id: string) {
  app.setState((s) => {
    const emotes = { ...s.emotes }
    delete emotes[id]
    return { emotes }
  })
}

export function sendEmote({ client, app }: NekoApp, emote: string) {
  if (isMuted(client)) return
  client.sendBroadcast('emote', emote)
  showEmote(app, emote, client.state.session_id ?? '') // server does not echo broadcasts to the sender
}
