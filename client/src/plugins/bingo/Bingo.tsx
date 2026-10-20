import { useMemo } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { name } from '@/state/app'
import { useNeko } from '@/state/provider'
import { Button } from '@/components/ui/button'
import logo from '@/assets/images/logo.svg'
import { PixelCat } from '@/components/tuna/PixelCat'
import { FREE } from './card'
import { bingo, cardOf, end, mark, start } from './store'

// the bingo tab: start a round, then mark the tropes as they happen on screen
export function Bingo() {
  const { t } = useTranslation()
  const neko = useNeko()
  const { seed, by, marked, won, winners } = useStore(
    bingo(neko),
    useShallow((s) => ({ seed: s.seed, by: s.by, marked: s.marked, won: s.won, winners: s.winners })),
  )
  const me = useStore(neko.client.store, (s) => s.session_id)
  // the card is the round's and this session's: the same after a reload
  const card = useMemo(() => (seed && me ? cardOf(neko, seed) : []), [neko, seed, me])

  if (!seed)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-5 text-center" data-testid="bingo">
        <PixelCat frame="happy" hat="party" scale={2} />
        <p className="max-w-[260px] leading-5 text-text-muted">{t('bingo.intro')}</p>
        <Button data-testid="bingo-start" onClick={() => start(neko)}>
          {t('bingo.start')}
        </Button>
      </div>
    )

  return (
    // at most a card's width, also where the side panel spans the page (under the video)
    <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col gap-2.5 overflow-auto p-2.5" data-testid="bingo">
      <div className="flex items-center justify-between text-[12px] text-text-muted">
        <span>{t('bingo.round_by', { name: by === me ? t('you') : name(neko.client, by) })}</span>
        <span className="flex gap-1.5">
          <Button className="h-6 px-2 py-0 text-[11px] normal-case" onClick={() => start(neko)}>
            {t('bingo.new_round')}
          </Button>
          {by === me && (
            <Button className="h-6 px-2 py-0 text-[11px] normal-case" onClick={() => end(neko)}>
              {t('bingo.end')}
            </Button>
          )}
        </span>
      </div>
      {won && (
        <div className="animate-pop rounded-[5px] bg-style-primary py-1.5 text-center text-[20px] font-black text-white">
          🐾 BINGO! 🐾
        </div>
      )}
      {winners.length > 0 && (
        <div className="text-[12px] leading-4" data-testid="bingo-winners">
          🏆 {winners.join(', ')}
        </div>
      )}
      <div className="grid grid-cols-5 gap-1" role="grid" aria-label={t('bingo.tab')}>
        {card.map((trope, i) => {
          const free = i === FREE
          const on = free || marked.includes(i)
          return (
            <button
              key={i}
              type="button"
              disabled={free}
              aria-pressed={on}
              data-testid="bingo-square"
              className={cn(
                'relative flex aspect-square items-center justify-center overflow-hidden rounded-[4px] p-1 text-center text-[10px] leading-[1.15] break-words transition-colors',
                on ? 'bg-style-primary text-white' : 'bg-background-tertiary hover:bg-background-accent',
                free && 'cursor-default flex-col gap-0.5 font-bold',
              )}
              onClick={() => mark(neko, i)}
            >
              {free ? (
                <>
                  <img src={logo} alt="" className="h-1/2" />
                  {t('bingo.free')}
                </>
              ) : (
                <>
                  {/* a paw stamped on a marked square, behind its text */}
                  {on && (
                    <span className="absolute inset-0 flex animate-pop items-center justify-center text-[28px] opacity-30">
                      🐾
                    </span>
                  )}
                  <span className="relative">{trope}</span>
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
