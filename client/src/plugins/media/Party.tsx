import { useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { selectIsAdmin } from '@m1k1o/neko'
import { useTranslation } from 'react-i18next'
import { StarIcon, TrashIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { ask } from '@/state/dialogs'
import { useNeko } from '@/state/provider'
import { Button } from '@/components/ui/button'
import { PixelCat, Toy } from '@/components/tuna/PixelCat'
import type { DiaryEntry } from '@/plugins/types'
import {
  average,
  awards,
  cleanTitle,
  deleteEntry,
  loadDiary,
  predictClear,
  predictOpen,
  predictReveal,
  predictSubmit,
  rate,
} from './party'
import { media } from './store'

type Section = 'predict' | 'diary' | 'awards'

// an empty page: Tuna asleep on it
function Napping({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center" data-testid="party-empty">
      <span className="relative">
        <PixelCat frame="sleep" scale={2} />
        <Toy toy="zzz" scale={2} className="absolute -top-1 right-0 animate-snooze" />
      </span>
      <p className="max-w-[260px] leading-5 text-text-muted">{text}</p>
    </div>
  )
}
const small = 'h-7 px-2.5 py-0 text-[12px] normal-case'

// the Watch Party tab: this episode's prediction round, the diary of what the room watched, the awards
export function Party() {
  const { t } = useTranslation()
  const neko = useNeko()
  const [section, setSection] = useState<Section>('predict')
  useEffect(() => void loadDiary(neko), [neko])
  return (
    <div className="flex min-w-0 flex-1 flex-col" data-testid="party">
      <div className="flex gap-1 px-2.5 pb-1.5">
        {(['predict', 'diary', 'awards'] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={cn(
              'flex-1 cursor-pointer rounded-[4px] py-1 text-[12px]',
              s === section ? 'bg-style-primary text-white' : 'bg-background-tertiary hover:bg-background-accent',
            )}
            data-testid={`party-${s}`}
            onClick={() => setSection(s)}
          >
            {t(`party.section_${s}`)}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto px-2.5 pb-2.5">
        {section === 'predict' && <Predictions />}
        {section === 'diary' && <Diary />}
        {section === 'awards' && <Awards />}
      </div>
    </div>
  )
}

function Predictions() {
  const { t } = useTranslation()
  const neko = useNeko()
  const { predict, title } = useStore(
    media(neko),
    useShallow((s) => ({ predict: s.predict, title: s.state?.title ?? '' })),
  )
  const { me, admin } = useStore(
    neko.client.store,
    useShallow((s) => ({ me: s.session_id, admin: selectIsAdmin(s) })),
  )
  const [text, setText] = useState('')
  useEffect(() => setText(predict?.mine ?? ''), [predict?.id, predict?.mine])

  if (!predict?.id)
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center" data-testid="predict-none">
        <PixelCat frame="wide" scale={2} />
        <p className="max-w-[260px] leading-5 text-text-muted">{t('party.predict_intro')}</p>
        <Button className={small} data-testid="predict-open" onClick={() => predictOpen(neko)}>
          {title ? t('party.predict_open_for', { title: cleanTitle(title) }) : t('party.predict_open')}
        </Button>
      </div>
    )

  const mine = predict.by === me || admin
  return (
    <div className="flex flex-col gap-2.5" data-testid="predict-round">
      <div className="text-[12px] text-text-muted">🔮 {cleanTitle(predict.title) || t('party.predict_title')}</div>
      {!predict.revealed ? (
        <>
          <textarea
            className="phone:text-base h-20 resize-none rounded-[5px] bg-background-tertiary p-2 text-text-normal outline-hidden placeholder:text-text-muted"
            maxLength={200}
            placeholder={t('party.predict_placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            data-testid="predict-text"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[12px] text-text-muted">
              {predict.names.length
                ? t('party.predict_in', { names: predict.names.join(', ') })
                : t('party.predict_none')}
            </span>
            <Button
              className={small}
              data-testid="predict-save"
              disabled={text.trim() === predict.mine}
              onClick={() => predictSubmit(neko, text)}
            >
              {predict.mine ? t('party.predict_update') : t('party.predict_save')}
            </Button>
          </div>
        </>
      ) : (
        <ul className="flex flex-col gap-1.5" data-testid="predict-entries">
          {(predict.entries ?? []).map((p, i) => (
            <li key={i} className="rounded-[5px] bg-background-tertiary p-2 leading-5">
              <b>{p.name}</b>: {p.text}
            </li>
          ))}
          {!predict.entries?.length && <li className="text-text-muted">{t('party.predict_none')}</li>}
        </ul>
      )}
      {mine && (
        <div className="flex gap-1.5">
          {!predict.revealed && (
            <Button className={small} data-testid="predict-reveal" onClick={() => predictReveal(neko)}>
              {t('party.predict_reveal')}
            </Button>
          )}
          <Button className={small} onClick={() => predictClear(neko)}>
            {t('party.predict_clear')}
          </Button>
        </div>
      )}
    </div>
  )
}

function Stars({ value, onRate }: { value: number; onRate?: (n: number) => void }) {
  return (
    <span className="inline-flex">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onRate}
          className={cn(onRate ? 'cursor-pointer' : 'cursor-default')}
          onClick={() => onRate?.(n)}
          aria-label={`${n}`}
        >
          <StarIcon className={cn('size-3.5', n <= Math.round(value) ? 'text-[#f5c518]' : 'text-text-muted/50')} />
        </button>
      ))}
    </span>
  )
}

function Diary() {
  const { t } = useTranslation()
  const neko = useNeko()
  const diary = useStore(media(neko), (s) => s.diary)
  const { myName, admin } = useStore(
    neko.client.store,
    useShallow((s) => ({
      myName: s.session_id ? s.sessions[s.session_id]?.profile.name : '',
      admin: selectIsAdmin(s),
    })),
  )
  if (!diary.length) return <Napping text={t('party.diary_empty')} />
  return (
    <ul className="flex flex-col gap-2" data-testid="diary">
      {diary.map((e) => (
        <Entry key={e.id} e={e} myName={myName ?? ''} admin={admin} />
      ))}
    </ul>
  )
}

// one watch: title, when, how long, who, the stars (everyone's and mine, which a click sets)
function Entry({ e, myName, admin }: { e: DiaryEntry; myName: string; admin: boolean }) {
  const { t } = useTranslation()
  const neko = useNeko()
  const avg = average(e.ratings)
  const count = Object.keys(e.ratings).length
  return (
    <li className="rounded-[5px] bg-background-tertiary p-2 leading-5" data-testid="diary-entry">
      <div className="flex items-start justify-between gap-2">
        <b className="min-w-0 break-words">{cleanTitle(e.title)}</b>
        {admin && (
          <button
            type="button"
            className="shrink-0 cursor-pointer text-text-muted hover:text-style-error"
            aria-label={t('party.diary_delete')}
            title={t('party.diary_delete')}
            onClick={() =>
              ask(neko.app, t('party.diary_delete'), cleanTitle(e.title)).then((ok) => ok && deleteEntry(neko, e.id))
            }
          >
            <TrashIcon className="size-3.5" />
          </button>
        )}
      </div>
      <div className="text-[12px] text-text-muted">
        {new Date(e.date).toLocaleDateString([], { dateStyle: 'medium' })} · {e.minutes} min
        {e.site && ` · ${e.site}`}
      </div>
      <div className="text-[12px] text-text-muted">👥 {e.attendees.join(', ')}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
        <span className="flex items-center gap-1">
          <Stars value={avg} />
          {count ? `${avg.toFixed(1)} (${count})` : t('party.no_ratings')}
        </span>
        {myName && (
          <span className="flex items-center gap-1 text-text-muted">
            {t('party.yours')} <Stars value={e.ratings[myName] ?? 0} onRate={(n) => rate(neko, e.id, n)} />
          </span>
        )}
      </div>
      {!!e.predictions?.length && (
        <details className="mt-1 text-[12px]">
          <summary className="cursor-pointer text-text-muted">
            🔮 {t('party.predictions', { n: e.predictions.length })}
          </summary>
          <ul className="mt-1 flex flex-col gap-0.5">
            {e.predictions.map((p, i) => (
              <li key={i}>
                <b>{p.name}</b>: {p.text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </li>
  )
}

function Awards() {
  const { t } = useTranslation()
  const diary = useStore(media(useNeko()), (s) => s.diary)
  const list = awards(diary)
  if (!list.length) return <Napping text={t('party.awards_empty')} />
  return (
    <ul className="flex flex-col gap-2" data-testid="awards">
      {list.map((a) => (
        <li key={a.id} className="flex items-center gap-2.5 rounded-[5px] bg-background-tertiary p-2">
          <span className="text-[24px]">{a.icon}</span>
          <span className="min-w-0 leading-5">
            <span className="block text-[12px] text-text-muted">{t(`party.award_${a.id}`)}</span>
            <b className="break-words">{a.winner || t(`party.award_${a.id}_value`, { value: a.detail })}</b>
            {a.winner && (
              <span className="ml-1.5 text-[12px] text-text-muted">
                {t(`party.award_${a.id}_value`, { value: a.detail })}
              </span>
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}
