import { Emitter } from '@m1k1o/neko'
import { name, type NekoApp } from './app'
import { t } from '@/i18n'

// signals between layers that must not import each other: the room's event lines (the chat
// plugin shows them), the logout reset (every store with per-session data listens), and cues,
// things that happen in the room that Tuna the mascot reacts to (features/mascot)
export type Bus = Emitter<{
  log: (id: string, name: string, content: string) => void
  logout: () => void
  cue: (cue: Cue) => void
}>

export type CueKind =
  | 'join' // someone connected (name)
  | 'leave' // someone left (name)
  | 'mention' // a chat message names her, or cats, or fish (name: the sender)
  | 'play' // the room's video plays (name: who pressed play)
  | 'pause' // or pauses
  | 'ready' // a ready check started
  | 'go' // everyone is ready
  | 'show' // something new plays
  | 'rate' // the room is asked to rate what played
  | 'bingo' // someone got bingo (name)
  | 'chat' // someone else said something in the chat (name, text): she shows it in fullscreen
export interface Cue {
  kind: CueKind
  name?: string
  text?: string
}
export const createBus = (): Bus => new Emitter()

// an event line attributed to a session ("bob took the controls")
export const event = ({ bus, client }: NekoApp, id: string, content: string) =>
  bus.emit('log', id, id === client.state.session_id ? t('you') : name(client, id), content)

// an event line with a literal author ("You kicked bob")
export const line = ({ bus }: NekoApp, name: string, content: string) => bus.emit('log', '', name, content)
