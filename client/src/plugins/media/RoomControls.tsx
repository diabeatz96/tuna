import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { selectIsAdmin, selectSession } from '@m1k1o/neko'
import { useTranslation } from 'react-i18next'
import { FastForwardIcon, PauseIcon, PlayIcon, RewindIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useNeko } from '@/state/provider'
import { IconButton } from '@/components/IconButton'
import { clock, control, media, now } from './store'

const SKIP = 10 // seconds per back / forward

// the room's play / pause and skip for the video in the browser, for everyone, without taking
// control of the desktop; next to the controls in the room bar, shown while there is a video
export function RoomControls() {
  const { t } = useTranslation()
  const neko = useNeko()
  const { enabled, state, at } = useStore(
    media(neko),
    useShallow((s) => ({ enabled: s.enabled, state: s.state, at: s.at })),
  )
  // the server's rule: admins, or members who may host while the controls are not locked
  const allowed = useStore(
    neko.client.store,
    (s) => selectIsAdmin(s) || (!!selectSession(s)?.profile.can_host && !s.settings.locked_controls),
  )
  const [, tick] = useState(0)
  const playing = !!state?.found && !state.paused
  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [playing])

  if (!enabled || !state?.found) return null
  const pos = now(state, at)
  const button = cn('px-[5px]', !allowed && 'opacity-40')
  return (
    <div
      className="mx-2.5 flex items-center gap-0.5 self-center rounded-full bg-background-secondary px-1.5 py-0.5"
      title={state.title}
      data-testid="room-controls"
    >
      <IconButton
        label={t('media.back', { s: SKIP })}
        className={cn(button, 'phone:hidden')}
        aria-disabled={!allowed}
        onClick={() => allowed && control(neko, 'seek', -SKIP)}
      >
        <RewindIcon className="size-5" />
      </IconButton>
      <IconButton
        label={t(state.paused ? 'media.play' : 'media.pause')}
        className={button}
        aria-disabled={!allowed}
        data-testid="room-toggle"
        onClick={() => allowed && control(neko, 'toggle')}
      >
        {state.paused ? <PlayIcon className="size-5" /> : <PauseIcon className="size-5" />}
      </IconButton>
      <IconButton
        label={t('media.forward', { s: SKIP })}
        className={cn(button, 'phone:hidden')}
        aria-disabled={!allowed}
        onClick={() => allowed && control(neko, 'seek', SKIP)}
      >
        <FastForwardIcon className="size-5" />
      </IconButton>
      <span
        className="phone:hidden ml-1 text-[11px] whitespace-nowrap text-text-muted tabular-nums"
        data-testid="room-time"
      >
        {clock(pos)}
        {state.duration > 0 && ` / ${clock(state.duration)}`}
      </span>
    </div>
  )
}
