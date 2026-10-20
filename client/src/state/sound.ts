// the GUI's sounds: the join / leave chime and the bingo fanfare are made with Web Audio, the
// soundboard plays short cat recordings (public/sounds, credits in public/sounds/CREDITS.md);
// silent where audio is not allowed yet
let ctx: AudioContext | undefined

function audio() {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

interface Tone {
  type?: OscillatorType
  freq: number
  at: number // seconds from now
  dur: number
  gain?: number
  vibrato?: [rate: number, depth: number]
}

// one oscillator with a quick attack and an exponential release
function tone(c: AudioContext, { type = 'sine', freq, at, dur, gain = 0.12, vibrato }: Tone) {
  const t0 = c.currentTime + at
  const osc = c.createOscillator()
  const env = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (vibrato) {
    const lfo = c.createOscillator()
    const depth = c.createGain()
    lfo.frequency.value = vibrato[0]
    depth.gain.value = vibrato[1]
    lfo.connect(depth).connect(osc.frequency)
    lfo.start(t0)
    lfo.stop(t0 + dur)
  }
  env.gain.setValueAtTime(0.0001, t0)
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.015)
  env.gain.setValueAtTime(gain, t0 + Math.max(0.02, dur - 0.08))
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(env).connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

export function chime(join: boolean) {
  try {
    const c = audio()
    const [a, b] = join ? [660, 880] : [880, 660]
    tone(c, { freq: a, at: 0, dur: 0.25 })
    tone(c, { freq: b, at: 0.12, dur: 0.25 })
  } catch {}
}

// the soundboard, in the order of its menu: a recording and the speed it plays at
export const SOUNDS = ['meow', 'kitten', 'feedme', 'hungry', 'purr', 'hiss', 'yowl'] as const
export type SoundName = (typeof SOUNDS)[number]
const CLIPS: Record<SoundName, [file: string, rate: number]> = {
  meow: ['cat-meow', 1],
  kitten: ['cat-meow', 1.6],
  feedme: ['cat-feedme', 1],
  hungry: ['cat-hungry', 1],
  purr: ['cat-purr', 1],
  hiss: ['cat-hiss', 1],
  yowl: ['cat-yowl', 1],
}
export const SOUND_ICON: Record<SoundName, string> = {
  meow: '🐱',
  kitten: '🍼',
  feedme: '🐟',
  hungry: '🍽️',
  purr: '😻',
  hiss: '😾',
  yowl: '🙀',
}

// each recording is fetched and decoded once, on its first play
const buffers = new Map<string, Promise<AudioBuffer>>()
function clip(c: AudioContext, file: string) {
  if (!buffers.has(file))
    buffers.set(
      file,
      fetch(`sounds/${file}.mp3`)
        .then((r) => r.arrayBuffer())
        .then((b) => c.decodeAudioData(b)),
    )
  return buffers.get(file)!
}

export function playSound(name: SoundName, gain = 0.8) {
  try {
    const c = audio()
    const [file, rate] = CLIPS[name]
    clip(c, file)
      .then((buffer) => {
        const src = c.createBufferSource()
        const vol = c.createGain()
        src.buffer = buffer
        src.playbackRate.value = rate
        vol.gain.value = gain
        src.connect(vol).connect(c.destination)
        src.start()
      })
      .catch(() => buffers.delete(file)) // a failed fetch is tried again next time
  } catch {}
}

// bingo: a rising arpeggio, then a meow
export function fanfare() {
  try {
    const c = audio()
    ;[523, 659, 784].forEach((freq, i) => tone(c, { type: 'square', freq, at: i * 0.12, dur: 0.12, gain: 0.05 }))
    tone(c, { type: 'square', freq: 1047, at: 0.36, dur: 0.5, gain: 0.05, vibrato: [7, 6] })
    setTimeout(() => playSound('hungry', 0.7), 850)
  } catch {}
}
