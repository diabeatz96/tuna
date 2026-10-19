// the GUI's sounds, all made with Web Audio so there is no file to fetch or license: the join / leave
// chime, the soundboard and the bingo fanfare; silent where audio is not allowed yet
let ctx: AudioContext | undefined

function audio() {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

interface Tone {
  type?: OscillatorType
  freq: number
  to?: number // glide to this frequency over the tone
  at: number // seconds from now
  dur: number
  gain?: number
  vibrato?: [rate: number, depth: number]
  filter?: [type: BiquadFilterType, freq: number, q?: number]
}

// one oscillator with a quick attack and an exponential release
function tone(c: AudioContext, { type = 'sine', freq, to, at, dur, gain = 0.12, vibrato, filter }: Tone) {
  const t0 = c.currentTime + at
  const osc = c.createOscillator()
  const env = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur)
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
  let out: AudioNode = osc.connect(env)
  if (filter) {
    const f = c.createBiquadFilter()
    f.type = filter[0]
    f.frequency.value = filter[1]
    if (filter[2]) f.Q.value = filter[2]
    out = out.connect(f)
  }
  out.connect(c.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

// a burst of filtered noise: the cymbal of the rimshot
function hiss(c: AudioContext, at: number, dur: number, gain: number) {
  const t0 = c.currentTime + at
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  const hp = c.createBiquadFilter()
  const env = c.createGain()
  src.buffer = buf
  hp.type = 'highpass'
  hp.frequency.value = 6000
  env.gain.setValueAtTime(gain, t0)
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(hp).connect(env).connect(c.destination)
  src.start(t0)
}

export function chime(join: boolean) {
  try {
    const c = audio()
    const [a, b] = join ? [660, 880] : [880, 660]
    tone(c, { freq: a, at: 0, dur: 0.25 })
    tone(c, { freq: b, at: 0.12, dur: 0.25 })
  } catch {}
}

// the soundboard, in the order of its menu
export const SOUNDS = ['airhorn', 'rimshot', 'meow', 'boing', 'trombone'] as const
export type SoundName = (typeof SOUNDS)[number]
export const SOUND_ICON: Record<SoundName, string> = {
  airhorn: '📯',
  rimshot: '🥁',
  meow: '🐱',
  boing: '🎈',
  trombone: '🎺',
}

const recipes: Record<SoundName, (c: AudioContext) => void> = {
  // three blasts of a brassy chord
  airhorn: (c) => {
    for (const [at, dur] of [
      [0, 0.16],
      [0.2, 0.16],
      [0.4, 0.7],
    ])
      for (const freq of [466, 587, 698])
        tone(c, { type: 'sawtooth', freq, to: freq * 0.97, at, dur, gain: 0.05, filter: ['lowpass', 2500] })
  },
  // ba-dum-tss
  rimshot: (c) => {
    tone(c, { freq: 200, to: 90, at: 0, dur: 0.14, gain: 0.3 })
    tone(c, { freq: 150, to: 70, at: 0.17, dur: 0.16, gain: 0.3 })
    hiss(c, 0.36, 0.7, 0.12)
  },
  // a nasal glide up and down
  meow: (c) => {
    tone(c, { type: 'sawtooth', freq: 480, to: 900, at: 0, dur: 0.2, gain: 0.1, filter: ['bandpass', 1300, 4] })
    tone(c, { type: 'sawtooth', freq: 900, to: 380, at: 0.18, dur: 0.4, gain: 0.1, filter: ['bandpass', 1100, 4] })
  },
  // a wobbling spring
  boing: (c) => tone(c, { freq: 140, to: 320, at: 0, dur: 0.6, gain: 0.2, vibrato: [14, 40] }),
  // wah wah wah waaah
  trombone: (c) => {
    const notes = [392, 370, 349]
    notes.forEach((freq, i) =>
      tone(c, { type: 'sawtooth', freq, at: i * 0.38, dur: 0.34, gain: 0.07, filter: ['lowpass', 1200] }),
    )
    tone(c, {
      type: 'sawtooth',
      freq: 330,
      to: 300,
      at: 1.14,
      dur: 1,
      gain: 0.07,
      vibrato: [6, 8],
      filter: ['lowpass', 1200],
    })
  },
}

export function playSound(name: SoundName) {
  try {
    recipes[name](audio())
  } catch {}
}

// bingo: a rising arpeggio
export function fanfare() {
  try {
    const c = audio()
    ;[523, 659, 784].forEach((freq, i) => tone(c, { type: 'square', freq, at: i * 0.12, dur: 0.12, gain: 0.05 }))
    tone(c, { type: 'square', freq: 1047, at: 0.36, dur: 0.6, gain: 0.05, vibrato: [7, 6] })
  } catch {}
}
