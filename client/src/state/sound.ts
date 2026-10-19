// the join / leave chime: two short notes, rising for a join and falling for a leave, made with
// Web Audio so there is no file to fetch; silent where audio is not allowed yet
let ctx: AudioContext | undefined

export function chime(join: boolean) {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    const notes = join ? [660, 880] : [880, 660]
    notes.forEach((freq, i) => {
      const at = ctx!.currentTime + i * 0.12
      const osc = ctx!.createOscillator()
      const gain = ctx!.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.25)
      osc.connect(gain).connect(ctx!.destination)
      osc.start(at)
      osc.stop(at + 0.3)
    })
  } catch {}
}
