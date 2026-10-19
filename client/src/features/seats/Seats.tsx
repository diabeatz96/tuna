import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { Session } from '@m1k1o/neko'
import { cn } from '@/lib/utils'
import { useApp, useClient } from '@/state/provider'
import { Avatar } from '@/components/Avatar'

// a cheer this recent makes the seat hop
const HOP_MS = 1200

// the theater row along the bottom of the video (a viewer setting, off by default: it covers the
// bottom of the picture, where subtitles are): one seat per member here, the avatar hops when they
// cheer (an emote, a sound, a ping) and slumps while they are not watching
export function Seats() {
  const app = useApp()
  const client = useClient()
  const { on, cheers } = useStore(
    app,
    useShallow((s) => ({ on: s.settings.theater_seats, cheers: s.cheers })),
  )
  const members = useStore(
    client.store,
    useShallow((s) => Object.values(s.sessions).filter((m) => m.state.is_connected)),
  )
  if (!on || !members.length) return null
  return (
    <ul className="absolute inset-x-0 bottom-0 flex justify-center gap-1 px-2" data-testid="seats">
      {members.map((m) => (
        <Seat key={m.id} m={m} cheered={cheers[m.id] ?? 0} />
      ))}
    </ul>
  )
}

function Seat({ m, cheered }: { m: Session; cheered: number }) {
  const hopping = Date.now() - cheered < HOP_MS
  const watching = m.state.is_watching
  return (
    <li className="relative flex w-11 flex-col items-center" title={m.profile.name} data-testid="seat">
      {/* keyed by the cheer, so each one restarts the hop */}
      <div
        key={cheered}
        className={cn(
          'relative z-0 transition-all duration-500',
          hopping && 'animate-hop',
          !watching && 'translate-y-2 rotate-12 opacity-60 grayscale',
        )}
      >
        <Avatar seed={m.profile.name} avatar={m.profile.avatar} size={32} />
      </div>
      {/* the seat's back, in front of the avatar's lower half */}
      <div className="relative z-10 -mt-3 h-5 w-11 rounded-t-[10px] bg-black/85 shadow-[0_-1px_0_rgba(255,255,255,0.08)]" />
    </li>
  )
}
