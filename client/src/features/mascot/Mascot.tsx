import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { selectIsAdmin } from '@m1k1o/neko'
import type { Cue } from '@/state/bus'
import { tummy } from '@/state/mascot'
import { useNeko } from '@/state/provider'
import { Popover, PopoverTrigger } from '@/components/ui/popover'
import { Bubble, PixelCat, Toy, useBlink, useCycle, type Frame } from '@/components/tuna/PixelCat'
import { IDLE_MS, line, pickIdle, wanderTo, type Say } from './brain'
import { Menu } from './Menu'

const NAP_MS = 10 * 60_000 // a quiet room sends her to sleep
const EAT_MS = 2200
const LOVE_MS = 1800
const SAY_MS = 3600 // a bubble's time
const SAY_EVERY = 5000 // between two bubbles nobody asked for
const WALK_MS = 7000 // across the whole width, strolling
const RUN_MS = 1800 // and after a yarn ball
const HUNGRY = 20

type Act = 'sit' | 'walk' | 'run' | 'groom' | 'yawn' | 'look' | 'blep' | 'tail' | 'happy' | 'wide'

// the time, every half second: her moods run out by the clock
function useNow() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])
  return now
}

function usePhone() {
  const query = '(max-width: 768px)'
  const [phone, setPhone] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches)
  useEffect(() => {
    const m = matchMedia(query)
    const on = () => setPhone(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return phone
}

// Tuna, living along the bottom of the video (a viewer setting, and the cat button over the video).
// She sits, blinks, swishes her tail, grooms, looks around, bleps and strolls about on her own; naps
// when the stream stops, the curtain is down or the room is quiet; says things in a pixel bubble about
// who comes and goes, the show, the chat and bingo; and a click opens her menu: feed her, pet her,
// throw her a yarn ball she runs after, dress her up. What the room does with her everyone sees; her
// strolls and musings are this viewer's own.
export function Mascot() {
  const neko = useNeko()
  const { on, talks, activity, fed, petted, ball, belly, hat } = useStore(
    neko.app,
    useShallow((s) => ({
      on: s.settings.show_mascot,
      talks: s.settings.tuna_talks,
      activity: s.activity,
      fed: s.fed,
      petted: s.petted,
      ball: s.ball,
      belly: s.tummy,
      hat: s.hat,
    })),
  )
  const { playing, curtain } = useStore(
    neko.client.store,
    useShallow((s) => ({ playing: s.video.playing, curtain: s.settings.private_mode && !selectIsAdmin(s) })),
  )
  const now = useNow()
  const phone = usePhone()
  const scale = phone ? 2 : 3

  const [x, setX] = useState(0)
  const [moveMs, setMoveMs] = useState(0)
  const [facing, setFacing] = useState<1 | -1>(1)
  const [act, setAct] = useState<{ kind: Act; until: number }>({ kind: 'sit', until: 0 })
  const [bubble, setBubble] = useState<{ text: string; key: number } | null>(null)
  const [yarnX, setYarnX] = useState<number | null>(null)
  const [sparkle, setSparkle] = useState(0)
  const [open, setOpen] = useState(false)

  const kind: Act = act.until > now ? act.kind : 'sit'
  const moving = kind === 'walk' || kind === 'run'
  const eating = now - fed.at < EAT_MS
  const loved = now - petted.at < LOVE_MS
  const busy = moving || eating || loved || yarnX !== null
  const asleep = !busy && !open && (!playing || curtain || now - activity > NAP_MS)

  // what the timers and the room's events need to know, without restarting them
  const live = useRef({ x, asleep, busy, open, talks, saidAt: 0 })
  live.current = { ...live.current, x, asleep, busy, open, talks }
  const timers = useRef<number[]>([])
  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms))
  }, [])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const doAct = useCallback((k: Act, ms: number) => setAct({ kind: k, until: Date.now() + ms }), [])
  const say = useCallback(
    (what: Say, name = '', force = false) => {
      const l = live.current
      if (!l.talks || (!force && Date.now() - l.saidAt < SAY_EVERY)) return
      l.saidAt = Date.now()
      const key = Date.now()
      setBubble({ text: line(what, name), key })
      later(SAY_MS, () => setBubble((b) => (b?.key === key ? null : b)))
    },
    [later],
  )
  const moveTo = useCallback(
    (to: number, msPerWidth: number, k: Act) => {
      const from = live.current.x
      const ms = Math.max(300, Math.abs(to - from) * msPerWidth)
      setFacing(to >= from ? 1 : -1)
      setMoveMs(ms)
      setX(to)
      doAct(k, ms)
      return ms
    },
    [doAct],
  )

  // the room's events
  useEffect(
    () =>
      neko.bus.on('cue', (cue: Cue) => {
        if (live.current.asleep && cue.kind !== 'mention' && cue.kind !== 'bingo') return
        const react: Partial<Record<Cue['kind'], [Act, number, boolean]>> = {
          join: ['happy', 1500, false],
          mention: ['happy', 1200, true],
          play: ['happy', 1000, false],
          pause: ['wide', 1500, false],
          ready: ['happy', 1000, false],
          go: ['happy', 1500, true],
          show: ['wide', 1200, false],
          bingo: ['happy', 2000, true],
        }
        const r = react[cue.kind]
        if (r && !live.current.busy) doAct(r[0], r[1])
        say(cue.kind, cue.name, r?.[2] ?? false)
      }),
    [neko, doAct, say],
  )

  // the room's plays with her; the first values seen are old news
  const seen = useRef({ fed: fed.at, petted: petted.at, ball: ball.at, hat: hat.at })
  useEffect(() => {
    if (fed.at === seen.current.fed) return
    seen.current.fed = fed.at
    say('fed', '', true)
  }, [fed.at, say])
  useEffect(() => {
    if (petted.at === seen.current.petted) return
    seen.current.petted = petted.at
    say('pet', '', true)
  }, [petted.at, say])
  useEffect(() => {
    if (hat.at === seen.current.hat) return
    seen.current.hat = hat.at
    say(hat.name ? 'hat' : 'hat_off', '', true)
  }, [hat.at, hat.name, say])
  // a yarn ball: it rolls out from her paws, she runs after it, pounces, and is pleased with herself
  useEffect(() => {
    if (ball.at === seen.current.ball || Date.now() - ball.at > 4000) return
    seen.current.ball = ball.at
    say('ball', '', true)
    doAct('wide', 400)
    setYarnX(live.current.x)
    later(30, () => setYarnX(ball.x))
    later(350, () => {
      const ms = moveTo(ball.x, RUN_MS, 'run')
      later(ms, () => {
        setYarnX(null)
        setSparkle(Date.now())
        doAct('happy', 1600)
        say('caught', '', true)
      })
    })
  }, [ball.at, ball.x, say, later, moveTo, doAct])

  // waking up: a yawn
  const wasAsleep = useRef(asleep)
  useEffect(() => {
    if (wasAsleep.current && !asleep) {
      doAct('yawn', 1400)
      say('wake')
    }
    wasAsleep.current = asleep
  }, [asleep, doAct, say])

  // on her own, now and then: a stroll, a groom, a look around, a musing
  useEffect(() => {
    if (!on) return
    let t = 0
    const next = () => {
      t = window.setTimeout(
        () => {
          const l = live.current
          if (!l.asleep && !l.busy && !l.open) {
            const idle = pickIdle(Math.random, l.talks)
            if (idle === 'wander') moveTo(wanderTo(l.x), WALK_MS, 'walk')
            else if (idle === 'chatter') say('idle')
            else doAct(idle, IDLE_MS[idle])
          }
          next()
        },
        6000 + Math.random() * 9000,
      )
    }
    next()
    return () => clearTimeout(t)
  }, [on, moveTo, say, doAct])

  // hungry: she says so, every couple of minutes
  const level = tummy(belly, now)
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => {
      if (!live.current.asleep && tummy(neko.app.getState().tummy) < HUNGRY) say('hungry')
    }, 120_000)
    return () => clearInterval(id)
  }, [on, neko, say])

  // the frame: what is happening first, then what she is doing
  const walkFrame = useCycle<Frame>(['walk_1', 'walk_2'], kind === 'run' ? 110 : 200, moving)
  const tailFrame = useCycle<Frame>(['sit', 'sit_tail'], 350, kind === 'tail')
  const lookFrame = useCycle<Frame>(['look_l', 'look_r'], 800, kind === 'look')
  let frame: Frame = 'sit'
  if (eating) frame = 'eat'
  else if (loved) frame = 'love'
  else if (moving) frame = walkFrame
  else if (asleep) frame = 'sleep'
  else if (kind === 'tail') frame = tailFrame
  else if (kind === 'look') frame = lookFrame
  else if (kind !== 'sit') frame = kind as Frame
  else if (level < HUNGRY) frame = 'look_r'
  frame = useBlink(frame, !asleep && !moving)

  if (!on) return null
  const box = 32 * scale
  const along = (at: number, offset = 0) => `calc(${10 + offset}px + ${at} * (100% - ${box + 20}px))`

  return (
    <>
      {yarnX !== null && (
        <span
          className="absolute bottom-[10px] transition-[left] duration-700 ease-out"
          style={{ left: along(yarnX, box / 2) }}
          data-testid="yarn"
        >
          <Toy toy="yarn" scale={scale} className="animate-spin [animation-duration:0.5s]" />
        </span>
      )}
      <div
        className="absolute bottom-[8px] flex items-end justify-center"
        style={{
          left: along(x),
          width: box,
          height: 26 * scale,
          transition: `left ${moveMs}ms ${kind === 'run' ? 'ease-in' : 'linear'}`,
        }}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="pointer-events-auto relative cursor-pointer drop-shadow-[0_3px_0_rgba(0,0,0,0.45)] focus-visible:outline-2 focus-visible:outline-style-primary"
              aria-label="Tuna"
              title="Tuna"
              data-testid="mascot"
              data-frame={frame}
              data-x={x.toFixed(2)}
              onMouseEnter={() => {
                if (live.current.asleep || live.current.busy || live.current.open) return
                doAct('happy', 900)
                if (Math.random() < 0.25) say('hover')
              }}
            >
              <PixelCat frame={frame} hat={hat.name} scale={scale} flip={moving && facing < 0}>
                {bubble && (
                  <Bubble key={bubble.key} right={x > 0.65}>
                    {bubble.text}
                  </Bubble>
                )}
                {asleep && (
                  <>
                    <Toy toy="zzz" scale={scale - 1} className="absolute -top-2 right-1 animate-snooze" />
                    <Toy
                      toy="zzz"
                      scale={scale - 1}
                      className="absolute -top-2 right-1 animate-snooze [animation-delay:1.2s]"
                    />
                  </>
                )}
                {loved &&
                  [0, 1, 2].map((i) => (
                    <Toy
                      key={`${petted.at}-${i}`}
                      toy="heart"
                      scale={scale - 1}
                      className="absolute -top-1 animate-snooze"
                      // spread across her head, one after the other
                      style={{ left: (4 + i * 7) * scale, animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                {now - sparkle < 1200 && (
                  <Toy
                    key={sparkle}
                    toy="sparkle"
                    scale={scale - 1}
                    className="absolute -top-3 left-0 animate-snooze"
                  />
                )}
                {eating && (
                  <span key={fed.at} className="absolute" style={{ left: 9 * scale, top: 12 * scale }}>
                    <Toy toy="fish" scale={scale - 1} className="animate-gulp" />
                  </span>
                )}
              </PixelCat>
            </button>
          </PopoverTrigger>
          <Menu onClose={() => setOpen(false)} />
        </Popover>
      </div>
    </>
  )
}
