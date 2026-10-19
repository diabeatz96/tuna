// what a member is doing, for the dot on their avatar and its tooltip: watching (the video stream is
// connected) or here without it (still connecting, the video off, private mode)
import type { Session } from '@m1k1o/neko'
import { t } from '@/i18n'

const clock = (iso?: string) => {
  const d = iso ? new Date(iso) : null
  return d && !isNaN(d.getTime()) ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
}

export function presence(m: Session) {
  if (!m.state.is_watching) return t('presence.idle')
  const since = clock(m.state.watching_since)
  return since ? t('presence.watching_since', { time: since }) : t('presence.watching')
}

// the dot on the avatar's lower left
export const dot = (watching: boolean) =>
  'absolute bottom-0 left-0 size-3.5 rounded-full border-2 border-background-tertiary ' +
  (watching ? 'bg-[#43b581]' : 'bg-[#faa61a]')
