import { type RefObject } from 'react'
import { useStore } from 'zustand'
import { useTranslation } from 'react-i18next'
import { useApp, useClient } from '@/state/provider'

// where a click lands on the picture, as fractions of it; null outside it
export function pointOnPicture(stage: HTMLElement | null, clientX: number, clientY: number) {
  const box = stage?.querySelector('[data-box]')?.getBoundingClientRect()
  if (!box?.width || !box.height) return null
  const x = (clientX - box.left) / box.width
  const y = (clientY - box.top) / box.height
  return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null
}

// the markers over the picture: a pulsing ring with the name of who dropped it
export function Pings({ stage }: { stage: RefObject<HTMLElement | null> }) {
  const { t } = useTranslation()
  const client = useClient()
  const pings = useStore(useApp(), (s) => s.pings)
  const sessions = useStore(client.store, (s) => s.sessions)
  const me = useStore(client.store, (s) => s.session_id)
  const root = stage.current?.getBoundingClientRect()
  const box = stage.current?.querySelector('[data-box]')?.getBoundingClientRect()
  if (!pings.length || !root || !box) return null
  return (
    <>
      {pings.map((p) => (
        <div
          key={p.key}
          className="pointer-events-none absolute"
          style={{ left: box.left - root.left + p.x * box.width, top: box.top - root.top + p.y * box.height }}
          data-testid="ping"
        >
          <span className="absolute -top-5 -left-5 size-10 animate-ping rounded-full border-4 border-style-primary" />
          <span className="absolute -top-2 -left-2 size-4 rounded-full border-2 border-white bg-style-primary shadow-elevation-high" />
          <span className="absolute top-3 left-3 rounded-full bg-black/70 px-2 py-0.5 text-[12px] whitespace-nowrap text-white">
            {p.sender && p.sender === me ? t('you') : sessions[p.sender]?.profile.name || t('somebody')}
          </span>
        </div>
      ))}
    </>
  )
}
