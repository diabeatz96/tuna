import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { selectIsAdmin } from '@m1k1o/neko'
import { useTranslation } from 'react-i18next'
import { StarIcon, XIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { name } from '@/state/app'
import { useNeko } from '@/state/provider'
import { Button } from '@/components/ui/button'
import { cleanTitle, rate, readyCancel, readySet } from './party'
import { media } from './store'

const card = 'pointer-events-auto rounded-[8px] bg-background-floating/90 px-3 py-2 text-[13px] shadow-elevation-high'

// over the video: the ready check, its countdown, and the rating asked for near an episode's end
export function Overlay() {
  return (
    <>
      <ReadyBanner />
      <Countdown />
      <RateCard />
    </>
  )
}

function ReadyBanner() {
  const { t } = useTranslation()
  const neko = useNeko()
  const ready = useStore(media(neko), (s) => s.ready)
  const { me, admin } = useStore(
    neko.client.store,
    useShallow((s) => ({ me: s.session_id, admin: selectIsAdmin(s) })),
  )
  if (!ready?.active) return null
  const iAmReady = !!me && ready.ready.includes(me)
  const total = ready.ready.length + ready.waiting.length
  return (
    <div className="absolute inset-x-0 top-2.5 flex justify-center px-2" data-testid="ready-banner">
      <div className={cn(card, 'flex flex-wrap items-center gap-2.5')}>
        <span>
          ✋ {t('party.ready_check', { name: ready.by === me ? t('you') : name(neko.client, ready.by) })}
          <b className="ml-1.5">
            {ready.ready.length}/{total}
          </b>
        </span>
        {ready.waiting.length > 0 && (
          <span className="text-text-muted" title={t('party.waiting_for')}>
            ⏳ {ready.waiting.map((id) => (id === me ? t('you') : name(neko.client, id))).join(', ')}
          </span>
        )}
        <Button
          className="h-7 px-2.5 py-0 text-[12px] normal-case"
          data-testid="ready-me"
          onClick={() => readySet(neko, !iAmReady)}
        >
          {t(iAmReady ? 'party.not_ready' : 'party.im_ready')}
        </Button>
        {(ready.by === me || admin) && (
          <button
            type="button"
            className="cursor-pointer text-text-muted hover:text-text-normal"
            aria-label={t('party.cancel')}
            title={t('party.cancel')}
            onClick={() => readyCancel(neko)}
          >
            <XIcon className="size-4" />
          </button>
        )}
      </div>
    </div>
  )
}

// 3, 2, 1 until go_at, then gone
function Countdown() {
  const goAt = useStore(media(useNeko()), (s) => s.goAt)
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!goAt) return
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [goAt])
  const left = Math.ceil((goAt - now) / 1000)
  if (!goAt || left < 0 || now - goAt > 800) return null
  return (
    <div className="absolute inset-0 flex items-center justify-center" data-testid="countdown">
      <span
        key={left}
        className="animate-pop text-[96px] font-black text-white [text-shadow:0_4px_16px_rgba(0,0,0,0.8)]"
      >
        {left > 0 ? left : '▶'}
      </span>
    </div>
  )
}

function RateCard() {
  const { t } = useTranslation()
  const neko = useNeko()
  const ask = useStore(media(neko), (s) => s.rate)
  const [hover, setHover] = useState(0)
  if (!ask) return null
  return (
    <div className="absolute inset-x-0 bottom-14 flex justify-center px-2" data-testid="rate-card">
      <div className={cn(card, 'flex items-center gap-2.5')}>
        <span className="max-w-[260px] truncate">{t('party.rate', { title: cleanTitle(ask.title) })}</span>
        <span className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className="cursor-pointer p-0.5"
              aria-label={t('party.stars', { n })}
              data-stars={n}
              onMouseEnter={() => setHover(n)}
              onClick={() => rate(neko, ask.id, n)}
            >
              <StarIcon className={cn('size-5', n <= hover ? 'text-[#f5c518]' : 'text-text-muted')} />
            </button>
          ))}
        </span>
        <button
          type="button"
          className="cursor-pointer text-text-muted hover:text-text-normal"
          aria-label={t('party.later')}
          title={t('party.later')}
          onClick={() => media(neko).setState({ rate: null })}
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  )
}
