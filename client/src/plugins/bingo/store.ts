// the bingo round of an instance and what happens to it; the room talks over broadcasts (subject
// `bingo`): `start` (a new round's seed), `win`, `end`, and `hello` from a newcomer, which the
// round's starter answers with the seed
import { createStore } from 'zustand/vanilla'
import { isMuted, name, scoped, type NekoApp } from '@/state/app'
import { toast } from '@/state/dialogs'
import { showEmote } from '@/state/emotes'
import { fanfare } from '@/state/sound'
import { t } from '@/i18n'
import { uid } from '@/lib/utils'
import { deal, isBingo } from './card'

export const bingo = scoped(() =>
  createStore(() => ({
    seed: '',
    by: '', // who started the round
    marked: [] as number[],
    won: false,
    winners: [] as string[], // names, in order
    news: 0, // rounds and wins from the others, for the tab's badge
  })),
)

export const cardOf = ({ client }: NekoApp, seed: string) => deal(seed, client.state.session_id ?? '')

const who = ({ client }: NekoApp, id: string) => (id === client.state.session_id ? t('you') : name(client, id))

function celebrate(neko: NekoApp, id: string) {
  fanfare()
  for (let i = 0; i < 3; i++) setTimeout(() => showEmote(neko.app, 'celebrate', id), i * 250)
  neko.bus.emit('cue', { kind: 'bingo', name: who(neko, id) })
}

function newRound(neko: NekoApp, seed: string, by: string) {
  bingo(neko).setState((s) => ({ seed, by, marked: [], won: false, winners: [], news: s.news + 1 }))
}

export function start(neko: NekoApp) {
  const { client } = neko
  if (isMuted(client)) return
  const seed = uid()
  newRound(neko, seed, client.state.session_id ?? '')
  client.sendBroadcast('bingo', { type: 'start', seed })
}

export function end(neko: NekoApp) {
  bingo(neko).setState({ seed: '', by: '', marked: [], won: false, winners: [] })
  neko.client.sendBroadcast('bingo', { type: 'end' })
}

export function mark(neko: NekoApp, i: number) {
  const store = bingo(neko)
  const { marked, won } = store.getState()
  const next = marked.includes(i) ? marked.filter((x) => x !== i) : [...marked, i]
  store.setState({ marked: next })
  if (won || !isBingo(new Set(next))) return
  const me = neko.client.state.session_id ?? ''
  store.setState((s) => ({ won: true, winners: [...s.winners, t('you')] }))
  neko.client.sendBroadcast('bingo', { type: 'win' })
  celebrate(neko, me)
}

// the room's messages; called by the plugin's init
export function onBroadcast(neko: NekoApp, sender: string, body: any) {
  const store = bingo(neko)
  const { seed, by } = store.getState()
  const me = neko.client.state.session_id
  if (body?.type === 'start' && typeof body.seed === 'string' && body.seed && body.seed !== seed) {
    newRound(neko, body.seed, sender)
    if (!body.quiet) toast(t('bingo.started', { name: who(neko, sender) }))
  } else if (body?.type === 'win' && seed) {
    store.setState((s) => ({ winners: [...s.winners, who(neko, sender)], news: s.news + 1 }))
    toast(t('bingo.won', { name: who(neko, sender) }), undefined, 'success')
    celebrate(neko, sender)
  } else if (body?.type === 'end' && sender === by) {
    store.setState({ seed: '', by: '', marked: [], won: false, winners: [] })
  } else if (body?.type === 'hello' && seed && by === me) {
    // a newcomer: the round's starter deals them in, without a toast for the others
    neko.client.sendBroadcast('bingo', { type: 'start', seed, quiet: true })
  }
}
