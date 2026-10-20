import { createStore } from 'zustand/vanilla'
import { scoped } from '@/state/app'

export interface ChatLine {
  seq: number // unique and increasing: the React key, and what scrolling follows
  id: string
  name: string
  type: 'text' | 'event'
  content: string
  created: Date
}

export const createChatStore = () =>
  createStore(() => ({
    lines: [] as ChatLine[],
    // messages received, for the unread badge
    texts: 0,
    // chat/init: the server's chat plugin is on
    enabled: true,
    emojiReady: false,
    emojiRecent: [] as string[],
  }))
export type ChatStore = ReturnType<typeof createChatStore>
// the store of an instance (`chat(neko)`, `chat(useNeko())`)
export const chat = scoped(createChatStore)

// chat keeps the last CHAT_LIMIT lines in memory; the server sends its recent messages on connect
// (chat/init's history), so a late joiner sees what was said
const CHAT_LIMIT = 1000
let seq = 0
export function push(store: ChatStore, line: Omit<ChatLine, 'seq'>) {
  store.setState((s) => ({ lines: [...s.lines, { ...line, seq: ++seq }].slice(-CHAT_LIMIT) }))
}

// a message is the same one if its sender and its time are
const key = (l: Pick<ChatLine, 'id' | 'created'>) => `${l.id}|${l.created.getTime()}`

// the room's recent messages (chat/init after a connect), before what is shown already: the ones not
// shown yet, then a divider line; a reconnect sends the history again, and nothing is doubled
export function prependHistory(store: ChatStore, history: Omit<ChatLine, 'seq'>[], divider: string) {
  store.setState((s) => {
    const shown = new Set(s.lines.filter((l) => l.type === 'text').map(key))
    const fresh = history.filter((l) => !shown.has(key(l)))
    if (!fresh.length) return s
    const before = [...fresh, { id: '', name: '', type: 'event' as const, content: divider, created: new Date() }]
    return { lines: [...before.map((l) => ({ ...l, seq: ++seq })), ...s.lines].slice(-CHAT_LIMIT) }
  })
}
