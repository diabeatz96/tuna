import { useRef, useState } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { selectControlling, selectIsAdmin } from '@m1k1o/neko'
import { useTranslation } from 'react-i18next'
import {
  ArrowsOutIcon,
  ClipboardIcon,
  CrosshairIcon,
  EyeSlashIcon,
  KeyboardIcon,
  MonitorIcon,
  MouseIcon,
  PictureInPictureIcon,
  PlayCircleIcon,
  SpeakerHighIcon,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useActions } from '@/state/actions'
import { useNeko } from '@/state/provider'
import { IconButton } from '@/components/IconButton'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverTrigger } from '@/components/ui/popover'
import { sendPing } from '@/state/pings'
import { Emote } from '@/features/emotes/Emote'
import { Reactions } from '@/features/emotes/Reactions'
import { Pings, pointOnPicture } from '@/features/ping/Pings'
import { Seats } from '@/features/seats/Seats'
import { Mascot } from '@/features/mascot/Mascot'
import { Resolution } from './Resolution'
import { Clipboard } from './Clipboard'
import { Player } from './Player'
import { useFullscreen } from './useFullscreen'
import { useClipboardSync, canReadClipboard } from './useClipboardSync'
import { usePip } from './usePip'

// the play / unmute button covering the video
const overlayClasses =
  'absolute inset-0 flex cursor-pointer items-center justify-center overflow-hidden rounded-none bg-black/20'

export function Stage({ hideControls, extraControls }: { hideControls: boolean; extraControls: boolean }) {
  const { t } = useTranslation()
  const neko = useNeko()
  const { client, overlay, app } = neko
  const actions = useActions()
  // the next click or tap on the picture drops a ping (Alt+click always does)
  const [pingMode, setPingMode] = useState(false)
  // the mouse events a browser makes up after a tap, which must not reach the remote desktop
  const swallowUntil = useRef(0)
  const { admin, hosting, hosted, implicit, lockedControls, curtain, video } = useStore(
    client.store,
    useShallow((s) => ({
      admin: selectIsAdmin(s),
      hosting: selectControlling(s),
      hosted: s.control.host_id !== null,
      implicit: s.settings.implicit_hosting,
      lockedControls: s.settings.locked_controls,
      // private mode pauses the stream of everyone but the admins
      curtain: s.settings.private_mode && !selectIsAdmin(s),
      video: s.video,
    })),
  )
  const emotes = useStore(app, (s) => s.emotes)
  const player = useRef<HTMLDivElement>(null)
  const { fullscreen, request: requestFullscreen } = useFullscreen(player)
  const syncClipboard = useClipboardSync()
  const pip = usePip()

  const controlLocked = lockedControls && !admin
  const { playing, playable, muted, mutedByAutoplay } = video
  // usually the extra controls are only shown on a phone
  const extra = extraControls ? '' : 'phone:block hidden'

  // a ping instead of input for the remote desktop: these run in the capture phase, before the
  // overlay's own listeners, and stop the event there
  const ping = (e: React.SyntheticEvent, clientX: number, clientY: number) => {
    e.preventDefault()
    e.stopPropagation()
    const p = pointOnPicture(player.current, clientX, clientY)
    if (p) sendPing(neko, p.x, p.y)
    setPingMode(false)
    swallowUntil.current = Date.now() + 700
  }
  const swallow = (e: React.SyntheticEvent) => {
    if (Date.now() >= swallowUntil.current) return false
    e.preventDefault()
    e.stopPropagation()
    return true
  }

  return (
    <div className="relative h-full w-full">
      <div ref={player} className="absolute inset-0 flex items-center justify-center bg-black">
        <div
          className={cn('absolute inset-0', pingMode && 'cursor-crosshair')}
          data-testid="player"
          onMouseEnter={syncClipboard}
          onMouseDownCapture={(e) => {
            if (swallow(e)) return
            if (e.button === 0 && (e.altKey || pingMode)) ping(e, e.clientX, e.clientY)
          }}
          onMouseUpCapture={swallow}
          onClickCapture={swallow}
          onTouchStartCapture={(e) => pingMode && ping(e, e.touches[0].clientX, e.touches[0].clientY)}
        >
          <Player transport={client.transport} />
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Object.entries(emotes).map(([id, type]) => (
              <Emote key={id} id={id} type={type} />
            ))}
            {!hideControls && <Seats />}
            {!hideControls && <Mascot />}
            {!hideControls && <Reactions />}
            <Pings stage={player} />
          </div>
          {curtain && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background-floating text-center"
              data-testid="curtain-down"
            >
              <EyeSlashIcon className="size-12 text-text-muted" />
              <span className="text-[18px] font-bold">{t('curtain.down')}</span>
              <span className="text-text-muted">{t('curtain.down_hint')}</span>
            </div>
          )}
          {!playing && playable ? (
            <IconButton
              label="Play"
              className={overlayClasses}
              data-testid="player-overlay"
              onClick={() => (client.unmute(), client.play().catch(() => {}))}
            >
              <PlayCircleIcon className="size-[120px]" />
            </IconButton>
          ) : (
            // only for the mute that autoplay forced; a user who muted on purpose keeps the desktop
            playing &&
            muted &&
            mutedByAutoplay && (
              <IconButton
                label="Unmute"
                className={overlayClasses}
                data-testid="player-overlay"
                onClick={() => client.unmute()}
              >
                <SpeakerHighIcon className="size-[120px]" />
              </IconButton>
            )
          )}
        </div>
        {!fullscreen && !hideControls && (
          <ul className="absolute top-[15px] right-5">
            <li className="mb-2.5 last:mb-0">
              <IconButton variant="video" label="Fullscreen" onClick={requestFullscreen}>
                <ArrowsOutIcon className="size-4" />
              </IconButton>
            </li>
            <li className="mb-2.5 last:mb-0">
              <IconButton
                variant="video"
                label={t('ping.button')}
                className={cn(pingMode && 'bg-style-primary text-white')}
                aria-pressed={pingMode}
                data-testid="ping-mode"
                onClick={() => setPingMode(!pingMode)}
              >
                <CrosshairIcon className="size-4" />
              </IconButton>
            </li>
            {admin && (
              <li className="mb-2.5 last:mb-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <IconButton variant="video" label="Screen resolution" data-testid="resolution-open">
                      <MonitorIcon className="size-4" />
                    </IconButton>
                  </DropdownMenuTrigger>
                  <Resolution />
                </DropdownMenu>
              </li>
            )}
            {/* only in the video-only layouts: everywhere else the room bar has it, a phone's too */}
            {!controlLocked && !implicit && extraControls && (
              <li className="mb-2.5 last:mb-0">
                <IconButton
                  variant="video"
                  label={hosting ? t('controls.release') : t('controls.request')}
                  className={cn(
                    hosted && !hosting && 'text-style-error/40',
                    !hosted && !hosting && 'text-text-normal/40',
                  )}
                  onClick={() => playable && actions.toggleControl()}
                >
                  <MouseIcon className="size-4" />
                </IconButton>
              </li>
            )}
          </ul>
        )}
        {!fullscreen && !hideControls && (
          <ul className="absolute right-5 bottom-[15px]">
            {hosting && !canReadClipboard && (
              <li className="mb-2.5 last:mb-0">
                {/* modal: the overlay takes the keyboard focus when the mouse enters the video,
                    which would close the popover and send its Ctrl+C to the remote */}
                <Popover modal>
                  <PopoverTrigger asChild>
                    <IconButton variant="video" label="Clipboard" data-testid="clipboard-open">
                      <ClipboardIcon className="size-4" />
                    </IconButton>
                  </PopoverTrigger>
                  <Clipboard />
                </Popover>
              </li>
            )}
            {pip.canPip && (
              <li className="mb-2.5 last:mb-0">
                <IconButton variant="video" label="Picture-in-Picture" onClick={pip.request}>
                  <PictureInPictureIcon className="size-4" />
                </IconButton>
              </li>
            )}
            {hosting && client.isTouchDevice && (
              <li className={cn('mb-2.5 last:mb-0', extra)}>
                <IconButton
                  variant="video"
                  label="Keyboard"
                  data-testid="keyboard-toggle"
                  onMouseDown={(e) => e.preventDefault()} // tapping the button must not take the focus the keyboard needs
                  onClick={() => overlay.mobileKeyboardToggle()}
                >
                  <KeyboardIcon className="size-4" />
                </IconButton>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  )
}
