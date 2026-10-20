// Unit tests of the chat store: `npm test` (vitest)
import { test } from 'vitest'
import assert from 'node:assert/strict'
import { createChatStore, prependHistory, push } from './store.ts'

const chat = createChatStore()

const line = (content: string) => ({ id: 's1', name: 'A', type: 'text' as const, content, created: new Date(0) })

test('push appends a line with an increasing seq as a new array, and keeps the last 1000', () => {
  const before = chat.getState().lines
  let notified = 0
  const off = chat.subscribe(() => notified++)
  push(chat, line('a'))
  const after = chat.getState().lines
  assert.notEqual(after, before, 'a new array, the old one untouched')
  assert.deepEqual([before.length, after.length, notified], [0, 1, 1])
  assert.deepEqual(after[0], { ...line('a'), seq: 1 })
  chat.setState({ texts: 1 }) // another field: the lines are not replaced
  assert.equal(chat.getState().lines, after)
  for (let i = 2; i <= 1001; i++) push(chat, line(String(i)))
  const { lines } = chat.getState()
  assert.equal(lines.length, 1000)
  assert.deepEqual([lines[0].content, lines[0].seq, lines.at(-1)!.content, lines.at(-1)!.seq], ['2', 2, '1001', 1001])
  off()
})

test('prependHistory: the messages not shown yet go first, then the divider; a second history doubles nothing', () => {
  const store = createChatStore()
  const msg = (content: string, at: number, id = 'bob') => ({
    id,
    name: 'Bob',
    type: 'text' as const,
    content,
    created: new Date(at),
  })
  push(store, { id: 'me', name: 'You', type: 'event', content: 'connected', created: new Date(5) })
  push(store, msg('live', 4))
  prependHistory(store, [msg('old', 1), msg('older', 2, 'carol'), msg('live', 4)], 'before')
  assert.deepEqual(
    store.getState().lines.map((l) => [l.type, l.content]),
    [
      ['text', 'old'],
      ['text', 'older'],
      ['event', 'before'],
      ['event', 'connected'],
      ['text', 'live'],
    ],
  )
  const seqs = store.getState().lines.map((l) => l.seq)
  assert.equal(new Set(seqs).size, seqs.length, 'every line keeps a key of its own')
  const before = store.getState().lines
  prependHistory(store, [msg('old', 1), msg('live', 4)], 'before') // a reconnect
  assert.equal(store.getState().lines, before, 'nothing new: the store is left as it was')
})
