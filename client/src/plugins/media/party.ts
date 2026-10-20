// the watch party: the ready check, prediction rounds, the diary and its awards. The server keeps the
// state (Tuna's media plugin); these send to it and work out what to show.
import type { NekoApp } from '@/state/app'
import { api } from '@/state/api'
import type { DiaryEntry } from '@/plugins/types'
import { media } from './store'

const send = ({ client }: NekoApp, event: string, payload?: unknown) => client.send(event, payload ?? {})

export const readyStart = (neko: NekoApp) => send(neko, 'media/ready/start')
export const readySet = (neko: NekoApp, ready: boolean) => send(neko, 'media/ready/set', { ready })
export const readyCancel = (neko: NekoApp) => send(neko, 'media/ready/cancel')

export const predictOpen = (neko: NekoApp) => send(neko, 'media/predict/open')
export const predictSubmit = (neko: NekoApp, text: string) => send(neko, 'media/predict/submit', { text })
export const predictReveal = (neko: NekoApp) => send(neko, 'media/predict/reveal')
export const predictClear = (neko: NekoApp) => send(neko, 'media/predict/clear')

export function rate(neko: NekoApp, id: string, stars: number) {
  send(neko, 'media/rating', { id, stars })
  const store = media(neko)
  if (store.getState().rate?.id === id) store.setState({ rate: null })
}

export async function loadDiary(neko: NekoApp) {
  try {
    const diary = await neko.client.api.req<DiaryEntry[]>('GET', '/media/diary')
    media(neko).setState({ diary: diary ?? [] })
  } catch {
    // an older server without the diary: nothing to show
  }
}

export const deleteEntry = (neko: NekoApp, id: string) => api(neko, 'DELETE', `/media/diary/${encodeURIComponent(id)}`)

// a diary entry the server sent: added, changed or removed, newest first
export function applyEntry(diary: DiaryEntry[], entry: DiaryEntry & { deleted?: boolean }) {
  const rest = diary.filter((e) => e.id !== entry.id)
  if (entry.deleted) return rest
  const at = diary.findIndex((e) => e.id === entry.id)
  if (at < 0) return [entry, ...rest]
  return [...diary.slice(0, at), entry, ...diary.slice(at + 1)]
}

// a tab's title without its site's name: "Frieren - Watch on Crunchyroll" -> "Frieren"
export const cleanTitle = (title: string) =>
  title
    .replace(/^[▶►]\s*/, '')
    .replace(/\s*[-|–—]\s*(Watch on Crunchyroll|Crunchyroll|YouTube|Plex|Netflix|Twitch)$/i, '')
    .trim() || title

export const average = (ratings: Record<string, number>) => {
  const stars = Object.values(ratings)
  return stars.length ? stars.reduce((a, b) => a + b, 0) / stars.length : 0
}

// the day of a date, in this viewer's calendar
const day = (date: string) => {
  const d = new Date(date)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

export interface Award {
  id: string
  icon: string
  winner: string
  detail: string
}

// the Tuna Awards, from the diary: who watched most, the longest run of days in a row, the kindest
// and the toughest critic (three ratings or more), who guessed most, the best-rated watch (two
// ratings or more), and the hours watched together
export function awards(diary: DiaryEntry[]): Award[] {
  const out: Award[] = []
  const best = <T>(rows: [string, T][], score: (v: T) => number, low = false) =>
    rows.sort((a, b) => (low ? score(a[1]) - score(b[1]) : score(b[1]) - score(a[1])) || a[0].localeCompare(b[0]))[0]

  const watched: Record<string, number> = {}
  const days: Record<string, Set<number>> = {}
  const given: Record<string, number[]> = {}
  const guessed: Record<string, number> = {}
  let minutes = 0
  for (const e of diary) {
    minutes += e.minutes
    for (const name of e.attendees) {
      watched[name] = (watched[name] ?? 0) + 1
      ;(days[name] ??= new Set()).add(day(e.date))
    }
    for (const [name, stars] of Object.entries(e.ratings ?? {})) (given[name] ??= []).push(stars)
    for (const p of e.predictions ?? []) guessed[p.name] = (guessed[p.name] ?? 0) + 1
  }

  const most = best(Object.entries(watched), (n) => n)
  if (most) out.push({ id: 'most', icon: '🏆', winner: most[0], detail: `${most[1]}` })

  const streak = (set: Set<number>) => {
    const sorted = [...set].sort((a, b) => a - b)
    let longest = 0
    let run = 0
    sorted.forEach((d, i) => {
      // a day is 23 to 25 hours across a clock change
      run = i && d - sorted[i - 1] <= 25 * 3600_000 ? run + 1 : 1
      longest = Math.max(longest, run)
    })
    return longest
  }
  const longest = best(
    Object.entries(days).map(([n, s]) => [n, streak(s)] as [string, number]),
    (n) => n,
  )
  if (longest && longest[1] > 1) out.push({ id: 'streak', icon: '🔥', winner: longest[0], detail: `${longest[1]}` })

  const critics = Object.entries(given)
    .filter(([, s]) => s.length >= 3)
    .map(([n, s]) => [n, s.reduce((a, b) => a + b, 0) / s.length] as [string, number])
  const kind = best([...critics], (n) => n)
  const tough = best([...critics], (n) => n, true)
  if (kind) out.push({ id: 'kind', icon: '😻', winner: kind[0], detail: kind[1].toFixed(1) })
  if (tough && critics.length > 1) out.push({ id: 'tough', icon: '😾', winner: tough[0], detail: tough[1].toFixed(1) })

  const seer = best(Object.entries(guessed), (n) => n)
  if (seer) out.push({ id: 'seer', icon: '🔮', winner: seer[0], detail: `${seer[1]}` })

  const top = diary
    .filter((e) => Object.keys(e.ratings ?? {}).length >= 2)
    .sort((a, b) => average(b.ratings) - average(a.ratings))[0]
  if (top) out.push({ id: 'top', icon: '⭐', winner: cleanTitle(top.title), detail: average(top.ratings).toFixed(1) })

  if (minutes) out.push({ id: 'hours', icon: '⏱️', winner: '', detail: (minutes / 60).toFixed(1) })
  return out
}
