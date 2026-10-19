import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { selectIsAdmin } from '@m1k1o/neko'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { feed } from '@/state/mascot'
import { useNeko } from '@/state/provider'
import { FISH, FRAMES, MOUTH, toPaths, type Face } from './sprite'

const SCALE = 3 // screen pixels per sprite pixel
const EAT_MS = 2200 // after a fish
const HAPPY_MS = 1500 // after an emote, a sound or a ping
const NAP_MS = 10 * 60_000 // a quiet room

const W = FRAMES.open[0].length
const H = FRAMES.open.length
const paths = Object.fromEntries(Object.entries(FRAMES).map(([k, grid]) => [k, toPaths(grid)])) as Record<
  Face,
  ReturnType<typeof toPaths>
>
const fish = toPaths(FISH)

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

// Tuna on the video's lower left (a viewer setting, on by default). She perks up when the room
// cheers, naps when the stream stops, the curtain is down or nothing happened for a while, and eats
// the fish anyone feeds her with a click; the chat says who.
export function Mascot() {
  const { t } = useTranslation()
  const neko = useNeko()
  const { on, activity, fed } = useStore(
    neko.app,
    useShallow((s) => ({ on: s.settings.show_mascot, activity: s.activity, fed: s.fed })),
  )
  const { playing, curtain } = useStore(
    neko.client.store,
    useShallow((s) => ({ playing: s.video.playing, curtain: s.settings.private_mode && !selectIsAdmin(s) })),
  )
  const now = useNow()
  const blink = useBlink()
  if (!on) return null

  const eating = now - fed.at < EAT_MS
  const happy = now - activity < HAPPY_MS
  const asleep = !eating && (!playing || curtain || now - activity > NAP_MS)
  const mood: Face = eating ? 'eat' : asleep ? 'sleep' : happy ? 'happy' : blink ? 'blink' : 'open'

  return (
    <button
      type="button"
      className="pointer-events-auto absolute bottom-[10px] left-[15px] cursor-pointer focus-visible:outline-2 focus-visible:outline-style-primary"
      style={{ width: W * SCALE, height: H * SCALE }}
      title={t('mascot.feed')}
      aria-label={t('mascot.feed')}
      data-testid="mascot"
      data-mood={mood}
      onClick={() => feed(neko)}
    >
      {/* keyed by the activity, so each cheer restarts the hop */}
      <svg
        key={happy ? activity : 'still'}
        viewBox={`0 0 ${W} ${H}`}
        width={W * SCALE}
        height={H * SCALE}
        shapeRendering="crispEdges"
        className={cn(
          'origin-bottom drop-shadow-[0_2px_2px_rgba(0,0,0,0.6)]',
          asleep && 'animate-breathe',
          happy && !eating && 'animate-hop',
        )}
      >
        {paths[mood].map((p) => (
          <path key={p.fill} fill={p.fill} d={p.d} />
        ))}
      </svg>
      {asleep && (
        <>
          <span className="absolute -top-1 right-1 animate-snooze text-[13px] font-bold text-white/80">z</span>
          <span className="absolute -top-1 right-1 animate-snooze text-[10px] font-bold text-white/70 [animation-delay:1.2s]">
            z
          </span>
        </>
      )}
      {eating && (
        <svg
          key={fed.at}
          viewBox={`0 0 ${FISH[0].length} ${FISH.length}`}
          width={FISH[0].length * SCALE}
          height={FISH.length * SCALE}
          shapeRendering="crispEdges"
          className="absolute animate-gulp"
          style={{ left: (MOUTH.x - 2) * SCALE, top: (MOUTH.y - 1) * SCALE }}
        >
          {fish.map((p) => (
            <path key={p.fill} fill={p.fill} d={p.d} />
          ))}
        </svg>
      )}
    </button>
  )
}
