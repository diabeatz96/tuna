import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { selectIsAdmin } from '@m1k1o/neko'
import { useTranslation } from 'react-i18next'
import { EyeSlashIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { feed, pet, score, throwBall, tummy } from '@/state/mascot'
import { useNeko } from '@/state/provider'
import { setSetting } from '@/state/settings'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FISH, FRAMES, MOUTH, toPaths, YARN, type Face } from './sprite'

const SCALE = 3 // screen pixels per sprite pixel
const EAT_MS = 2200 // after a fish
const HAPPY_MS = 1500 // after an emote, a sound, a ping or a pet
const NAP_MS = 10 * 60_000 // a quiet room
const HUNGRY = 20 // tummy level that makes her ask for a fish

const W = FRAMES.open[0].length
const H = FRAMES.open.length
const paths = Object.fromEntries(Object.entries(FRAMES).map(([k, grid]) => [k, toPaths(grid)])) as Record<
  Face,
  ReturnType<typeof toPaths>
>
const fish = toPaths(FISH)
const yarn = toPaths(YARN)

function Sprite({ p, w, h, className }: { p: ReturnType<typeof toPaths>; w: number; h: number; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width={w * SCALE}
      height={h * SCALE}
      shapeRendering="crispEdges"
      className={className}
    >
      {p.map((x) => (
        <path key={x.fill} fill={x.fill} d={x.d} />
      ))}
    </svg>
  )
}

// the time, every second: the moods run out by the clock
function useNow() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

// a blink now and then
function useBlink() {
  const [blink, setBlink] = useState(false)
  useEffect(() => {
    let t = 0
    const next = () => {
      t = window.setTimeout(
        () => {
          setBlink(true)
          t = window.setTimeout(() => (setBlink(false), next()), 160)
        },
        2500 + Math.random() * 4000,
      )
    }
    next()
    return () => clearTimeout(t)
  }, [])
  return blink
}

// a yarn ball's throw: it rolls out, she runs after it, catches it, and walks back home
type Chase = 'home' | 'roll' | 'run' | 'caught' | 'back'
function useChase(at: number) {
  const [chase, setChase] = useState<Chase>('home')
  useEffect(() => {
    if (!at || Date.now() - at > 4000) return
    const steps: [Chase, number][] = [
      ['roll', 0],
      ['run', 350],
      ['caught', 1500],
      ['back', 2600],
      ['home', 3700],
    ]
    const ids = steps.map(([c, ms]) => window.setTimeout(() => setChase(c), ms))
    return () => ids.forEach(clearTimeout)
  }, [at])
  return chase
}

// her place along the bottom: home on the left, or `x` of the way across (a fraction of the width)
const along = (x: number, offset = 0) => `calc(${15 + offset}px + ${x} * (100% - ${W * SCALE + 30}px))`

// Tuna on the video's lower left (a viewer setting, on by default, and the cat button over the
// video). She perks up when the room cheers, naps when it is quiet, the stream stops or the curtain
// is down, and asks for a fish when her tummy is empty. A click opens her play menu: feed her, pet
// her, throw her a yarn ball; everyone sees it, and it counts towards your Tuna points.
export function Mascot() {
  const { t } = useTranslation()
  const neko = useNeko()
  const { on, activity, fed, petted, ball, belly, points } = useStore(
    neko.app,
    useShallow((s) => ({
      on: s.settings.show_mascot,
      activity: s.activity,
      fed: s.fed,
      petted: s.petted,
      ball: s.ball,
      belly: s.tummy,
      points: s.points,
    })),
  )
  const { playing, curtain, sessions, me } = useStore(
    neko.client.store,
    useShallow((s) => ({
      playing: s.video.playing,
      curtain: s.settings.private_mode && !selectIsAdmin(s),
      sessions: s.sessions,
      me: s.session_id,
    })),
  )
  const now = useNow()
  const blink = useBlink()
  const chase = useChase(ball.at)
  const [open, setOpen] = useState(false)
  if (!on) return null

  const eating = now - fed.at < EAT_MS
  const loved = now - petted.at < HAPPY_MS
  const happy = loved || chase === 'caught' || now - activity < HAPPY_MS
  const chasing = chase === 'roll' || chase === 'run'
  const asleep = !eating && !chasing && !open && (!playing || curtain || now - activity > NAP_MS)
  const mood: Face = eating ? 'eat' : chasing ? 'open' : asleep ? 'sleep' : happy ? 'happy' : blink ? 'blink' : 'open'
  const level = tummy(belly, now)
  const away = chase === 'run' || chase === 'caught' ? ball.x : 0

  // the room's players, best first; only the members here
  const board = Object.entries(points)
    .filter(([id]) => sessions[id]?.state.is_connected || id === me)
    .map(([id, p]) => ({ id, p, name: id === me ? t('you') : sessions[id]?.profile.name || t('somebody') }))
    .filter((x) => score(x.p) > 0)
    .sort((a, b) => score(b.p) - score(a.p))
    .slice(0, 5)

  const action =
    'flex flex-1 flex-col items-center gap-0.5 rounded-[4px] bg-background-tertiary py-1.5 hover:bg-background-accent'

  return (
    <>
      {/* the yarn ball, rolling from her paws to where it stops */}
      {chase !== 'home' && chase !== 'back' && chase !== 'caught' && (
        <div
          className="absolute bottom-[12px] transition-[left] duration-700 ease-out"
          style={{ left: along(chase === 'roll' ? 0 : ball.x, W * SCALE * 0.6) }}
          data-testid="yarn"
        >
          <Sprite p={yarn} w={YARN[0].length} h={YARN.length} className="animate-spin [animation-duration:0.6s]" />
        </div>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="pointer-events-auto absolute bottom-[10px] cursor-pointer transition-[left] duration-1000 ease-in-out focus-visible:outline-2 focus-visible:outline-style-primary"
            style={{ width: W * SCALE, height: H * SCALE, left: along(away) }}
            title={t('mascot.play')}
            aria-label={t('mascot.play')}
            data-testid="mascot"
            data-mood={mood}
            data-chase={chase}
          >
            {/* keyed by what happened last, so each one restarts the hop */}
            <Sprite
              key={chasing ? 'run' : happy ? `${activity}-${petted.at}-${chase}` : 'still'}
              p={paths[mood]}
              w={W}
              h={H}
              className={cn(
                'origin-bottom drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]',
                asleep && 'animate-breathe',
                (happy || chase === 'run') && !eating && 'animate-hop',
              )}
            />
            {asleep && (
              <>
                <span className="absolute -top-1 right-1 animate-snooze text-[13px] font-bold text-white/80">z</span>
                <span className="absolute -top-1 right-1 animate-snooze text-[10px] font-bold text-white/70 [animation-delay:1.2s]">
                  z
                </span>
              </>
            )}
            {loved &&
              [0, 1, 2].map((i) => (
                <span
                  key={`${petted.at}-${i}`}
                  className="absolute -top-1 animate-snooze text-[14px]"
                  style={{ left: 10 + i * 14, animationDelay: `${i * 0.2}s` }}
                >
                  ❤️
                </span>
              ))}
            {chase === 'caught' && (
              <span className="absolute -top-3 left-1/2 animate-snooze text-[14px] font-black text-style-primary">
                +2
              </span>
            )}
            {!asleep && !eating && !chasing && level < HUNGRY && (
              <span className="absolute -top-6 -right-6 rounded-full bg-white px-1.5 py-0.5 text-[12px] text-black shadow-elevation-high">
                🐟?
              </span>
            )}
            {eating && (
              <span
                key={fed.at}
                className="absolute"
                style={{ left: (MOUTH.x - 1) * SCALE, top: (MOUTH.y - 2) * SCALE }}
              >
                <Sprite p={fish} w={FISH[0].length} h={FISH.length} className="animate-gulp" />
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="start"
          className="w-[230px] rounded-[5px] bg-background-floating p-2.5 text-[13px] shadow-elevation-high"
          data-testid="mascot-menu"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="font-bold">🐟 Tuna</span>
            <button
              type="button"
              className="flex cursor-pointer items-center gap-1 text-[12px] text-text-muted hover:text-text-normal"
              onClick={() => (setOpen(false), setSetting(neko, 'show_mascot', false))}
            >
              <EyeSlashIcon className="size-3.5" /> {t('mascot.hide')}
            </button>
          </div>
          <div className="mb-1 flex justify-between text-[12px] text-text-muted">
            <span>{t('mascot.tummy')}</span>
            <span>{Math.round(level)}%</span>
          </div>
          <div className="mb-2.5 h-2 overflow-hidden rounded-full bg-background-tertiary">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                level < HUNGRY ? 'bg-style-error' : 'bg-style-primary',
              )}
              style={{ width: `${level}%` }}
            />
          </div>
          <div className="mb-2.5 flex gap-1.5">
            <button type="button" className={action} data-testid="mascot-feed" onClick={() => feed(neko)}>
              <span className="text-[18px]">🐟</span>
              <span className="text-[11px]">{t('mascot.feed')}</span>
            </button>
            <button type="button" className={action} data-testid="mascot-pet" onClick={() => pet(neko)}>
              <span className="text-[18px]">✋</span>
              <span className="text-[11px]">{t('mascot.pet')}</span>
            </button>
            <button
              type="button"
              className={action}
              data-testid="mascot-ball"
              onClick={() => throwBall(neko) && setOpen(false)}
            >
              <span className="text-[18px]">🧶</span>
              <span className="text-[11px]">{t('mascot.ball')}</span>
            </button>
          </div>
          <div className="mb-1 text-[12px] font-bold">{t('mascot.points')}</div>
          {board.length ? (
            <ol className="flex flex-col gap-1" data-testid="mascot-points">
              {board.map((x, i) => (
                <li
                  key={x.id}
                  className="flex justify-between gap-2"
                  title={`🐟 ${x.p.feed} · ✋ ${x.p.pet} · 🧶 ${x.p.ball}`}
                >
                  <span className="truncate">
                    {['🥇', '🥈', '🥉'][i] ?? '🐾'} {x.name}
                  </span>
                  <span className="font-bold">{score(x.p)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="text-[12px] text-text-muted">{t('mascot.no_points')}</div>
          )}
        </PopoverContent>
      </Popover>
    </>
  )
}
