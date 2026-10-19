import { useEffect } from 'react'
import { useStore } from 'zustand'
import { useTranslation } from 'react-i18next'
import { hideReaction, type Reaction } from '@/state/emotes'
import { useApp, useClient } from '@/state/provider'
import './sprites.css'

// how long a tally line stays after its last count
const FADE = 4000

// the tally over the video's lower left: who sent which emote lately, a burst counted on one line
export function Reactions() {
  const { t } = useTranslation()
  const client = useClient()
  const reactions = useStore(useApp(), (s) => s.reactions)
  const sessions = useStore(client.store, (s) => s.sessions)
  const me = useStore(client.store, (s) => s.session_id)
  if (!reactions.length) return null
  return (
    <ul className="absolute bottom-[15px] left-[15px] flex flex-col items-start gap-1" data-testid="reactions">
      {reactions.map((r) => (
        <Line
          key={r.key}
          r={r}
          name={r.sender && r.sender === me ? t('you') : sessions[r.sender]?.profile.name || t('somebody')}
        />
      ))}
    </ul>
  )
}

function Line({ r, name }: { r: Reaction; name: string }) {
  const app = useApp()
  // each new count restarts the line's time
  useEffect(() => {
    const id = setTimeout(() => hideReaction(app, r.key, r.at), FADE)
    return () => clearTimeout(id)
  }, [app, r.key, r.at])
  return (
    <li
      className="flex animate-pop items-center gap-1.5 rounded-full bg-black/60 py-1 pr-2.5 pl-1 text-[12px] leading-4 text-white"
      data-testid="reaction"
    >
      <div className={`emote ${r.emote} size-5`} aria-hidden />
      <span className="max-w-[120px] truncate">{name}</span>
      {r.count > 1 && (
        // keyed by the count so the number pops each time it grows
        <b key={r.count} className="animate-pop">
          ×{r.count}
        </b>
      )}
    </li>
  )
}
