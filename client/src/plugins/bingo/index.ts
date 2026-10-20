import { useStore } from 'zustand'
import { PawPrintIcon } from '@phosphor-icons/react'
import { isMuted } from '@/state/app'
import { useNeko } from '@/state/provider'
import type { Plugin } from '@/plugins/types'
import { Bingo } from './Bingo'
import { bingo as store, onBroadcast } from './store'

// cat bingo: client-only, over the room's broadcasts (no server plugin), so its strings live
// in `common`
export const bingo: Plugin = {
  id: 'bingo',
  ns: 'common',
  tab: {
    id: 'bingo',
    icon: PawPrintIcon,
    label: 'bingo.tab',
    component: Bingo,
    useBadge: () => useStore(store(useNeko()), (s) => s.news),
  },
  init(neko) {
    const { client, app, bus } = neko
    client.events.on('receive.broadcast', (sender, subject, body) => {
      if (subject === 'bingo' && !app.getState().ignored[sender] && !isMuted(client, sender))
        onBroadcast(neko, sender, body)
    })
    // a newcomer asks for the round in progress
    client.store.subscribe(
      (s) => s.session_id,
      (id) => id && client.sendBroadcast('bingo', { type: 'hello' }),
    )
    bus.on('logout', () => store(neko).setState({ seed: '', by: '', marked: [], won: false, winners: [], news: 0 }))
  },
}
