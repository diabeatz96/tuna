import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { feed, HATS, level as levelOf, pet, score, throwBall, tummy, wear } from '@/state/mascot'
import { useNeko } from '@/state/provider'
import { setSetting } from '@/state/settings'
import { PopoverContent } from '@/components/ui/popover'
import { HATS as HAT_ART, PixelCat, PixelSprite, Toy } from '@/components/tuna/PixelCat'
import { mood } from './brain'

// a meter of ten pixel blocks
function Meter({ value, color, label }: { value: number; color: string; label: string }) {
  const lit = Math.round(value / 10)
  return (
    <div className="flex items-center gap-2" title={`${label}: ${Math.round(value)}%`}>
      <span className="w-12 shrink-0 text-[10px] uppercase">{label}</span>
      <span className="flex gap-[2px]">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="h-2.5 w-[11px]" style={{ background: i < lit ? color : '#3d332b' }} />
        ))}
      </span>
    </div>
  )
}

const button =
  'pixel-button flex cursor-pointer flex-col items-center gap-1 px-1 py-1.5 text-[10px] uppercase disabled:opacity-40'

// Tuna's menu: her level, her tummy and mood, playing with her, her hats, the room's points
export function Menu({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const neko = useNeko()
  const { belly, fed, petted, ball, hat, points, talks } = useStore(
    neko.app,
    useShallow((s) => ({
      belly: s.tummy,
      fed: s.fed.at,
      petted: s.petted.at,
      ball: s.ball.at,
      hat: s.hat.name,
      points: s.points,
      talks: s.settings.tuna_talks,
    })),
  )
  const { sessions, me } = useStore(
    neko.client.store,
    useShallow((s) => ({ sessions: s.sessions, me: s.session_id })),
  )
  const now = Date.now()

  // the room's players, best first; only the members here
  const here = Object.entries(points).filter(([id]) => sessions[id]?.state.is_connected || id === me)
  const total = here.reduce((n, [, p]) => n + score(p), 0)
  const lv = levelOf(total)
  const board = here
    .map(([id, p]) => ({ id, p, name: id === me ? t('you') : sessions[id]?.profile.name || t('somebody') }))
    .filter((x) => score(x.p) > 0)
    .sort((a, b) => score(b.p) - score(a.p))
    .slice(0, 5)

  return (
    <PopoverContent
      side="top"
      align="start"
      sideOffset={10}
      className="pixel-box w-[256px] p-3 font-mono text-[12px] text-[#e9dfd1]"
      data-testid="mascot-menu"
    >
      <div className="mb-3 flex items-center gap-2.5">
        <PixelCat frame="happy" hat={hat} scale={1.5} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between">
            <b className="text-[14px] tracking-widest">TUNA</b>
            <span className="text-[10px] uppercase" data-testid="mascot-level">
              {t('mascot.level', { n: lv.level })}
            </span>
          </div>
          <div className="mt-1 h-1.5 bg-[#3d332b]" title={t('mascot.level_hint')}>
            <div className="h-full bg-[#e8c547]" style={{ width: `${Math.round(lv.progress * 100)}%` }} />
          </div>
        </div>
      </div>

      <div className="mb-3 flex flex-col gap-1.5">
        <Meter value={tummy(belly, now)} color="#c2bd5c" label={t('mascot.tummy')} />
        <Meter
          value={mood(tummy(belly, now), Math.max(fed, petted, ball), now)}
          color="#d68f87"
          label={t('mascot.mood')}
        />
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <button type="button" className={button} data-testid="mascot-feed" onClick={() => feed(neko)}>
          <Toy toy="fish" scale={2} />
          {t('mascot.feed')}
        </button>
        <button type="button" className={button} data-testid="mascot-pet" onClick={() => pet(neko)}>
          <Toy toy="heart" scale={2} />
          {t('mascot.pet')}
        </button>
        <button type="button" className={button} data-testid="mascot-ball" onClick={() => throwBall(neko) && onClose()}>
          <Toy toy="yarn" scale={2} />
          {t('mascot.ball')}
        </button>
      </div>

      <div className="mb-1 text-[10px] uppercase">{t('mascot.hats')}</div>
      <div className="mb-3 grid grid-cols-6 gap-1.5" data-testid="mascot-hats">
        {HATS.map((h) => (
          <button
            key={h || 'none'}
            type="button"
            className={cn(button, 'h-9 justify-center p-0', h === hat && 'bg-[#7f6b58]')}
            title={t(`mascot.hat_${h || 'none'}`)}
            aria-label={t(`mascot.hat_${h || 'none'}`)}
            aria-pressed={h === hat}
            data-hat={h || 'none'}
            onClick={() => wear(neko, h)}
          >
            {h ? <PixelSprite grid={HAT_ART[h]} scale={2} /> : <span className="text-[14px] leading-none">✕</span>}
          </button>
        ))}
      </div>

      <div className="mb-1 text-[10px] uppercase">{t('mascot.points')}</div>
      {board.length ? (
        <ol className="mb-3 flex flex-col gap-1" data-testid="mascot-points">
          {board.map((x, i) => (
            <li
              key={x.id}
              className="flex justify-between gap-2"
              title={`🐟 ${x.p.feed} · ♥ ${x.p.pet} · 🧶 ${x.p.ball}`}
            >
              <span className="truncate">
                {i + 1}. {x.name}
              </span>
              <span className="font-bold">{score(x.p)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mb-3 text-[11px] opacity-70">{t('mascot.no_points')}</div>
      )}

      <div className="flex items-center justify-between gap-2 border-t-2 border-[#3d332b] pt-2 text-[10px] uppercase">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            className="size-3 cursor-pointer accent-[#c2bd5c]"
            checked={talks}
            onChange={(e) => setSetting(neko, 'tuna_talks', e.target.checked)}
          />
          {t('mascot.talks')}
        </label>
        <button
          type="button"
          className="cursor-pointer uppercase opacity-80 hover:opacity-100"
          onClick={() => (onClose(), setSetting(neko, 'show_mascot', false))}
        >
          {t('mascot.hide')}
        </button>
      </div>
    </PopoverContent>
  )
}
