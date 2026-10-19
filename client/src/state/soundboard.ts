// the soundboard: a member plays a sound for the whole room (a broadcast); the sounds are made by
// state/sound.ts. Sending and hearing are both rate-limited, so a held button is not an air raid.
import { isMuted, scoped, type NekoApp } from './app'
import { cheer } from './emotes'
import { playSound, SOUNDS, type SoundName } from './sound'

const SEND_EVERY = 1500 // ms between two sounds from me
const HEAR_EVERY = 1000 // ms between two sounds from one member

export const isSound = (s: unknown): s is SoundName => SOUNDS.includes(s as SoundName)

const last = scoped(() => ({ sent: 0, heard: {} as Record<string, number> }))

export function hearSound(neko: NekoApp, sender: string, sound: SoundName) {
  const heard = last(neko).heard
  const now = Date.now()
  if (now - (heard[sender] ?? 0) < HEAR_EVERY) return
  heard[sender] = now
  cheer(neko.app, sender)
  if (!neko.app.getState().settings.ignore_sounds) playSound(sound)
}

export function sendSound(neko: NekoApp, sound: SoundName) {
  const { client, app } = neko
  const now = Date.now()
  if (isMuted(client) || now - last(neko).sent < SEND_EVERY) return false
  last(neko).sent = now
  client.sendBroadcast('sound', sound)
  cheer(app, client.state.session_id ?? '')
  playSound(sound) // server does not echo broadcasts to the sender
  return true
}
