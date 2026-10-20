import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { selectIsAdmin } from '@m1k1o/neko'
import type { Cue } from '@/state/bus'
import { napped, tummy } from '@/state/mascot'
import { useNeko } from '@/state/provider'
import { Popover, PopoverTrigger } from '@/components/ui/popover'
import { Bubble, PixelCat, sideways, Toy, useBlink, useCycle, type Frame } from '@/components/tuna/PixelCat'
import {
  after,
  HOP_MS,
  HUNGRY,
  IDLE_MS,
  laserPath,
  lines,
  maySay,
  musings,
  OVERPET,
  overpetted,
  pickIdle,
  season,
  TALK,
  wanderTo,
  type Act,
  type Say,
} from './brain'
import { Menu } from './Menu'

const NAP_MS = 10 * 60_000 // a quiet room sends her to sleep
const EAT_MS = 2200
const LOVE_MS = 1800
const SAY_MS = 3600 // a bubble's time
const SAY_EVERY = 5000 // between two bubbles nobody asked for
const WALK_MS = 7000 // across the whole width, strolling
const RUN_MS = 1800 // after a yarn ball
const DASH_MS = 1100 // zoomies, a pounce
const BOX_MS = 4 * 60_000 // how long a box stays
const LASER_MS = 7 * HOP_MS
const CHAT_MS = 7000 // a chat message's time in fullscreen
const TUCK_X = 0.02 // her corner in fullscreen while a show plays

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

function useFullscreen() {
  const [fs, setFs] = useState(() => !!document.fullscreenElement)
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  return fs
}

// a chat message she carries into fullscreen, where the side panel is not seen
function ChatLine({ name, text }: { name: string; text: string }) {
  return (
    <span className="pixel-box block w-max max-w-[min(300px,45vw)] animate-pop px-2 py-1 font-mono text-[11px] leading-4 break-words whitespace-normal text-[#e9dfd1]">
      <b className="text-[#e8c547]">{name}</b> {text}
    </span>
  )
}

// Tuna, living along the bottom of the video (a viewer setting, and the cat button over the video).
// She sits, blinks, swishes her tail, grooms, looks around, bleps, bats her pumpkin in October and
// strolls about on her own, sleepier at night and wilder at dusk; naps when the stream stops, the
// curtain is down or the room is quiet; watches the cursor near her and pounces on it; says things
// in a pixel bubble about who comes and goes, the show, the chat and bingo, as much as her viewer
// lets her; keeps to a corner in fullscreen while a show plays, and brings the chat along; and a
// click opens her menu: feed her, pet her (not too much), throw a yarn ball, shine a laser, set down
// a box, dress her up. What the room does with her everyone sees; her strolls and musings are this
// viewer's own.
export function Mascot() {
  const neko = useNeko()
  const { client, app } = neko
  const { on, talk, chatOn, activity, fed, petted, ball, laser, box, belly, hat } = useStore(
    app,
    useShallow((s) => ({
      on: s.settings.show_mascot,
      talk: s.settings.tuna_talk,
      chatOn: s.settings.tuna_chat,
      activity: s.activity,
      fed: s.fed,
      petted: s.petted,
      ball: s.ball,
      laser: s.laser,
      box: s.box,
      belly: s.tummy,
      hat: s.hat,
    })),
  )
  const { playing, curtain } = useStore(
    client.store,
    useShallow((s) => ({ playing: s.video.playing, curtain: s.settings.private_mode && !selectIsAdmin(s) })),
  )
  const now = useNow()
  const phone = usePhone()
  const fullscreen = useFullscreen()

  const [x, setX] = useState(0)
  const [moveMs, setMoveMs] = useState(0)
  const [facing, setFacing] = useState<1 | -1>(1)
  const [act, setAct] = useState<{ kind: Act; until: number }>({ kind: 'sit', until: 0 })
  const [bubble, setBubble] = useState<{ text: string; key: number } | null>(null)
  const [chats, setChats] = useState<{ name: string; text: string; key: number }[]>([])
  const [yarnX, setYarnX] = useState<number | null>(null)
  const [laserX, setLaserX] = useState<number | null>(null)
  const [sparkle, setSparkle] = useState(0)
  const [sulkUntil, setSulkUntil] = useState(0)
  const [watch, setWatch] = useState<-1 | 1 | 0>(0)
  const [open, setOpen] = useState(false)
  // the show in the shared browser, as the room's controls report it
  const [media, setMedia] = useState<'playing' | 'paused' | 'unknown'>('unknown')

  const showing = media === 'playing'
  const tucked = fullscreen && media !== 'paused'
  const scale = phone || tucked ? 2 : 3
  const kind: Act = act.until > now ? act.kind : 'sit'
  const moving = kind === 'walk' || kind === 'run' || kind === 'leap'
  const sulking = sulkUntil > now
  const eating = now - fed.at < EAT_MS
  const loved = now - petted.at < LOVE_MS && !sulking
  const level = tummy(belly, now)
  const hungry = level < HUNGRY
  const boxOn = now - box.at < BOX_MS
  const boxX = tucked ? TUCK_X : box.x
  const inBox = boxOn && !moving && Math.abs(x - boxX) < 0.01
  const pumpkin = season(new Date(now)) === 'halloween'
  const busy = moving || eating || loved || sulking || yarnX !== null || laserX !== null || kind === 'crouch'
  const asleep = !busy && !open && (!playing || curtain || now - activity > NAP_MS)

  // what the timers and the room's events need to know, without restarting them
  const live = useRef({
    x,
    asleep,
    busy,
    open,
    talk,
    showing,
    tucked,
    hungry,
    sulking,
    boxOn,
    boxX,
    pumpkin,
    fullscreen,
    chatOn,
    saidAt: 0,
    musedAt: 0,
    mountedAt: Date.now(),
  })
  live.current = {
    ...live.current,
    x,
    asleep,
    busy,
    open,
    talk,
    showing,
    tucked,
    hungry,
    sulking,
    boxOn,
    boxX,
    pumpkin,
    fullscreen,
    chatOn,
  }
  const timers = useRef<number[]>([])
  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms))
  }, [])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const [pick] = useState(() => lines())

  // an act, and maybe the one that tends to follow it
  const doAct = useCallback(
    (k: Act, ms: number) => {
      const until = Date.now() + ms
      setAct({ kind: k, until })
      const next = after(k)
      if (next) later(ms, () => setAct((a) => (a.until === until ? { kind: next[0], until: Date.now() + next[1] } : a)))
    },
    [later],
  )
  // a bubble, if her viewer lets her and she has not just said something; whether she said it
  const say = useCallback(
    (what: Say, name = '', force = false, extra?: readonly string[]) => {
      const l = live.current
      if (!maySay(what, l.talk, l.showing)) return false
      if (!force && Date.now() - l.saidAt < SAY_EVERY) return false
      l.saidAt = Date.now()
      const key = Date.now()
      setBubble({ text: pick(what, name, extra), key })
      later(SAY_MS, () => setBubble((b) => (b?.key === key ? null : b)))
      return true
    },
    [later, pick],
  )
  const moveTo = useCallback((to: number, msPerWidth: number, k: Act) => {
    const from = live.current.x
    const ms = Math.max(300, Math.abs(to - from) * msPerWidth)
    setFacing(to >= from ? 1 : -1)
    setMoveMs(ms)
    setX(to)
    setAct({ kind: k, until: Date.now() + ms })
    return ms
  }, [])

  // the room's events
  useEffect(
    () =>
      neko.bus.on('cue', (cue: Cue) => {
        const l = live.current
        if (cue.kind === 'play' || cue.kind === 'go' || cue.kind === 'show') setMedia('playing')
        if (cue.kind === 'pause') setMedia('paused')
        if (cue.kind === 'chat') {
          if (!l.fullscreen || !l.chatOn || !cue.text) return
          const key = Date.now() + Math.random()
          const text = cue.text.length > 120 ? cue.text.slice(0, 119) + '…' : cue.text
          setChats((c) => [...c.slice(-2), { name: cue.name ?? '', text, key }])
          later(CHAT_MS, () => setChats((c) => c.filter((m) => m.key !== key)))
          return
        }
        if (l.asleep && cue.kind !== 'mention' && cue.kind !== 'bingo') return
        const react: Partial<Record<Cue['kind'], [Act, number, boolean]>> = {
          join: ['happy', 1500, false],
          mention: ['happy', 1200, true],
          play: ['happy', 1000, false],
          pause: ['wide', 1500, false],
          ready: ['happy', 1000, false],
          go: ['happy', 1500, true],
          show: ['wide', 1200, false],
          rate: ['judge', 2400, false],
          bingo: ['happy', 2000, true],
        }
        const r = react[cue.kind]
        if (r && !l.busy) doAct(r[0], r[1])
        if (cue.kind === 'play' && l.talk !== 'chatty') return
        say(cue.kind, cue.name, r?.[2] ?? false)
      }),
    [neko, doAct, say, later],
  )

  // the room's plays with her; the first values seen are old news
  const seen = useRef({ fed: fed.at, petted: petted.at, ball: ball.at, hat: hat.at, laser: laser.at, box: box.at })
  const pets = useRef<number[]>([])
  useEffect(() => {
    if (fed.at === seen.current.fed) return
    seen.current.fed = fed.at
    say('fed', '', true)
    later(EAT_MS, () => {
      const next = after('eat')
      if (next) doAct(...next)
    })
  }, [fed.at, say, later, doAct])
  useEffect(() => {
    if (petted.at === seen.current.petted) return
    seen.current.petted = petted.at
    const t = Date.now()
    pets.current = [...pets.current.filter((p) => t - p <= OVERPET.within), t]
    if (live.current.sulking) return
    // too much: a hiss of a face, and off she stalks to sulk on the other side
    if (overpetted(pets.current, t)) {
      pets.current = []
      setSulkUntil(t + OVERPET.sulk)
      doAct('grump', 1200)
      say('grump', '', true)
      if (!live.current.tucked) later(1200, () => moveTo(live.current.x < 0.5 ? 0.8 : 0.2, WALK_MS * 0.7, 'walk'))
      later(OVERPET.sulk, () => doAct('groom', 2600))
      return
    }
    say('pet', '', true)
  }, [petted.at, say, later, doAct, moveTo])
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
  // a laser dot: it darts about; each time she crouches, wiggles and leaps after it
  useEffect(() => {
    if (laser.at === seen.current.laser || Date.now() - laser.at > LASER_MS) return
    seen.current.laser = laser.at
    say('laser', '', true)
    const path = laserPath(laser.seed)
    path.forEach((to, i) => {
      later(i * HOP_MS, () => setLaserX(to))
      later(i * HOP_MS + 200, () => {
        setFacing(to >= live.current.x ? 1 : -1)
        setAct({ kind: 'crouch', until: Date.now() + 350 })
      })
      later(i * HOP_MS + 550, () => moveTo(to, DASH_MS, 'leap'))
    })
    later(path.length * HOP_MS, () => {
      setLaserX(null)
      doAct('wide', 1200)
      say(Math.random() < 0.5 ? 'laser_gone' : 'caught', '', true)
    })
  }, [laser.at, laser.seed, say, later, moveTo, doAct])
  // a box: she has to sit in it
  useEffect(() => {
    if (box.at === seen.current.box || Date.now() - box.at > BOX_MS) return
    seen.current.box = box.at
    doAct('wide', 500)
    later(500, () => {
      const ms = moveTo(live.current.boxX, RUN_MS, 'run')
      later(ms, () => say('box', '', true))
    })
  }, [box.at, say, later, moveTo, doAct])

  // waking up: a yawn; her tummy did not empty while she slept
  const sleptAt = useRef(asleep ? Date.now() : 0)
  useEffect(() => {
    if (asleep) {
      sleptAt.current = Date.now()
      return
    }
    if (sleptAt.current) {
      napped(neko, sleptAt.current)
      sleptAt.current = 0
      doAct('yawn', 1400)
      say('wake')
    }
  }, [asleep, neko, doAct, say])

  // fullscreen while a show plays: off to her corner
  useEffect(() => {
    if (tucked && !live.current.busy) moveTo(TUCK_X, WALK_MS / 2, 'walk')
  }, [tucked, moveTo])

  // on her own, now and then: a stroll, a groom, a look around, a musing, zoomies, a catnap
  useEffect(() => {
    if (!on) return
    let t = 0
    const next = () => {
      t = window.setTimeout(
        () => {
          const l = live.current
          if (!l.asleep && !l.busy && !l.open) {
            const home = l.boxOn ? l.boxX : l.tucked ? TUCK_X : null
            if (home !== null && Math.abs(l.x - home) > 0.01) moveTo(home, WALK_MS / 2, 'walk')
            else if (!(l.boxOn && Math.abs(l.x - l.boxX) < 0.01) && !l.hungry) idle(l)
            else if (Math.random() < 0.4) doAct('tail', IDLE_MS.tail)
          }
          next()
        },
        6000 + Math.random() * 9000,
      )
    }
    const idle = (l: typeof live.current) => {
      const d = new Date()
      const what = pickIdle(Math.random, {
        hour: d.getHours(),
        talk: l.talk,
        showing: l.showing,
        tucked: l.tucked,
        pumpkin: l.pumpkin,
      })
      if (what === 'wander') moveTo(wanderTo(l.x), WALK_MS, 'walk')
      else if (what === 'chatter') {
        if (Date.now() - l.musedAt < TALK[l.talk].musingMs) return
        if (say('idle', '', false, musings(d))) l.musedAt = Date.now()
      } else if (what === 'zoomies') {
        say('zoomies')
        const far = l.x < 0.5 ? 0.95 : 0.05
        const ms = moveTo(far, DASH_MS, 'run')
        later(ms + 150, () => {
          const back = moveTo(0.3 + Math.random() * 0.4, DASH_MS, 'run')
          later(back, () => doAct('groom', 2600))
        })
      } else if (what === 'bat') {
        // her pumpkin sits just right of her corner
        const ms = Math.abs(l.x - TUCK_X) > 0.01 ? moveTo(TUCK_X, WALK_MS / 2, 'walk') : 0
        later(ms, () => {
          doAct('bat', IDLE_MS.bat)
          if (Math.random() < 0.3) say('pumpkin')
        })
      } else doAct(what, IDLE_MS[what])
    }
    next()
    return () => clearTimeout(t)
  }, [on, moveTo, say, doAct, later])

  // hungry: she sits by her empty bowl and gives the room a look; she asks out loud once in a
  // hungry spell (more often when chatty), never in a viewer's first minute or mid-show
  const askedAt = useRef(0)
  useEffect(() => {
    if (!hungry) {
      askedAt.current = 0
      return
    }
    const id = setInterval(() => {
      const l = live.current
      if (l.asleep || Date.now() - l.mountedAt < 60_000) return
      const every = TALK[l.talk].hungryMs
      if (askedAt.current && (every === Infinity || Date.now() - askedAt.current < every)) return
      if (say('hungry')) askedAt.current = Date.now()
    }, 5000)
    return () => clearInterval(id)
  }, [hungry, say])

  // the cursor near her: hers (this viewer's mouse) or the remote desktop's, whoever has the
  // controls; she watches it, and if it lingers and moves she crouches and pounces
  const wrap = useRef<HTMLDivElement>(null)
  const cursor = useRef({ fx: 0, near: false, since: 0, moved: 0, pounced: 0 })
  useEffect(() => {
    const box = 32 * scale
    const track = (cx: number, cy: number) => {
      const stage = wrap.current?.parentElement?.getBoundingClientRect()
      if (!stage) return
      const near = cx >= stage.left && cx <= stage.right && cy <= stage.bottom && cy >= stage.bottom - 140
      const c = cursor.current
      const t = Date.now()
      if (near && !c.near) c.since = t
      c.near = near
      c.moved = t
      c.fx = Math.min(1, Math.max(0, (cx - stage.left - 10 - box / 2) / Math.max(1, stage.width - box - 20)))
    }
    const onMove = (e: PointerEvent) => track(e.clientX, e.clientY)
    const onLeave = () => (cursor.current.near = false)
    window.addEventListener('pointermove', onMove)
    document.addEventListener('pointerleave', onLeave)
    let last = 0
    const off = client.transport.on('cursor.position', (p) => {
      if (!p || client.state.control.host_id === client.state.session_id || Date.now() - last < 100) return
      last = Date.now()
      const pic = wrap.current?.closest('[data-testid=player]')?.querySelector('[data-box]')?.getBoundingClientRect()
      const { width, height } = client.state.screen.size
      if (pic && width && height) track(pic.left + (p.x / width) * pic.width, pic.top + (p.y / height) * pic.height)
    })
    const id = setInterval(() => {
      const l = live.current
      const c = cursor.current
      const t = Date.now()
      const near = c.near && t - c.moved < 3000 && !l.asleep && !l.open && !l.sulking
      setWatch(near && !l.busy ? (c.fx < l.x ? -1 : 1) : 0)
      if (!near || l.busy || l.tucked || l.boxOn || t - c.pounced < 10_000) return
      const d = Math.abs(c.fx - l.x)
      if (t - c.since < 1200 || t - c.moved > 600 || d < 0.04 || d > 0.5) return
      c.pounced = t
      setFacing(c.fx >= l.x ? 1 : -1)
      setAct({ kind: 'crouch', until: t + 900 })
      later(900, () => {
        const ms = moveTo(cursor.current.fx, DASH_MS, 'leap')
        later(ms, () => doAct('happy', 900))
      })
    }, 200)
    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
      off()
      clearInterval(id)
    }
  }, [client, scale, later, moveTo, doAct])

  // the frame: what is happening first, then what she is doing
  const walkFrame = useCycle<Frame>(['walk_1', 'walk_2'], kind === 'run' ? 110 : 200, kind === 'walk' || kind === 'run')
  const crouchFrame = useCycle<Frame>(['crouch_1', 'crouch_2'], 120, kind === 'crouch')
  const tailFrame = useCycle<Frame>(['sit', 'sit_tail'], 350, kind === 'tail')
  const lookFrame = useCycle<Frame>(['look_l', 'look_r'], 800, kind === 'look')
  const batFrame = useCycle<Frame>(['bat', 'sit'], 300, kind === 'bat')
  const pleadFrame = useCycle<Frame>(['plead', 'look_r', 'plead', 'sit'], 1400, hungry)
  let frame: Frame = 'sit'
  if (eating) frame = 'eat'
  else if (loved) frame = inBox ? 'boxed_happy' : 'love'
  else if (kind === 'leap') frame = 'leap'
  else if (moving) frame = walkFrame
  else if (kind === 'crouch') frame = crouchFrame
  else if (sulking) frame = kind === 'groom' ? 'groom' : 'grump'
  else if (inBox) frame = asleep ? 'boxed_blink' : kind === 'happy' ? 'boxed_happy' : 'boxed'
  // asleep curled in a loaf or stretched out flat, one or the other for a whole nap
  else if (asleep) frame = Math.floor(activity / 1000) % 2 ? 'sprawl' : 'sleep'
  else if (kind === 'loaf') frame = 'sprawl'
  else if (kind === 'tail') frame = tailFrame
  else if (kind === 'look') frame = lookFrame
  else if (kind === 'bat') frame = batFrame
  else if (kind !== 'sit') frame = kind as Frame
  else if (hungry) frame = pleadFrame
  else if (watch) frame = watch < 0 ? 'look_l' : 'look_r'
  frame = useBlink(frame, !asleep && !moving)

  if (!on) return null
  const W = 32 * scale
  const along = (at: number, offset = 0) => `calc(${10 + offset}px + ${at} * (100% - ${W + 20}px))`
  const right = x > 0.65
  // seen from the side she faces the way she last went
  const flip = facing < 0 && sideways(frame)

  return (
    <>
      {pumpkin && (
        <span className="absolute bottom-[8px]" style={{ left: along(TUCK_X, 28 * scale) }} data-testid="pumpkin">
          <Toy toy="pumpkin" scale={scale} />
        </span>
      )}
      {boxOn && !inBox && (
        <span className="absolute bottom-[8px]" style={{ left: along(boxX, 8 * scale) }} data-testid="box">
          <Toy toy="box" scale={scale} />
        </span>
      )}
      {yarnX !== null && (
        <span
          className="absolute bottom-[10px] transition-[left] duration-700 ease-out"
          style={{ left: along(yarnX, W / 2) }}
          data-testid="yarn"
        >
          <Toy toy="yarn" scale={scale} className="animate-spin [animation-duration:0.5s]" />
        </span>
      )}
      {laserX !== null && (
        <span
          className="absolute bottom-[12px] transition-[left] duration-200 ease-out"
          style={{ left: along(laserX, W / 2) }}
          data-testid="laser"
        >
          <Toy toy="laser" scale={scale} className="drop-shadow-[0_0_4px_#ff4d5e]" />
        </span>
      )}
      <div
        ref={wrap}
        className="absolute bottom-[8px] flex items-end justify-center"
        style={{
          left: along(x),
          width: W,
          height: 26 * scale,
          transition: `left ${moveMs}ms ${kind === 'run' || kind === 'leap' ? 'ease-in' : 'linear'}`,
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
                const l = live.current
                if (l.asleep || l.busy || l.open) return
                doAct('happy', 900)
                if (Math.random() < TALK[l.talk].hover) say('hover')
              }}
            >
              <PixelCat frame={frame} hat={hat.name} scale={scale} flip={flip}>
                {(chats.length > 0 || bubble) && (
                  <span
                    className={
                      'pointer-events-none absolute bottom-full mb-3 flex flex-col gap-1.5 ' +
                      (right ? 'right-1 items-end' : 'left-1 items-start')
                    }
                    data-testid="mascot-chat"
                  >
                    {chats.map((c) => (
                      <ChatLine key={c.key} name={c.name} text={c.text} />
                    ))}
                    {bubble && (
                      <Bubble key={bubble.key} right={right} inline>
                        {bubble.text}
                      </Bubble>
                    )}
                  </span>
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
              {hungry && !moving && !inBox && (
                <Toy
                  toy="bowl"
                  scale={scale}
                  className="absolute bottom-0"
                  style={{ left: right ? -10 * scale : 27 * scale }}
                />
              )}
            </button>
          </PopoverTrigger>
          <Menu onClose={() => setOpen(false)} />
        </Popover>
      </div>
    </>
  )
}
