// Unit tests of the emote keys: `npm test` (vitest). The browser is faked as far as the app store
// and showEmote need it (location, localStorage, document.visibilityState).
import { expect, test } from 'vitest'
import { fakeBrowser } from '@/test/browser'

fakeBrowser()
const { createAppStore } = await import('./app.ts')
const { showEmote, hideEmote, hideReaction } = await import('./emotes.ts')

const UID = /^[0-9a-f]{16}$/

test('each shown emote gets a key of its own, a 64-bit hex key (crypto.getRandomValues), and hideEmote drops it', () => {
  const app = createAppStore()
  showEmote(app, 'wave')
  showEmote(app, 'wave')
  const keys = Object.keys(app.getState().emotes)
  expect(keys).toHaveLength(2)
  for (const k of keys) expect(k).toMatch(UID)
  expect(keys[0]).not.toBe(keys[1])
  hideEmote(app, keys[0])
  expect(Object.keys(app.getState().emotes)).toEqual([keys[1]])
})

test('the tally: a burst of one emote from one member is one line, counted; others get lines of their own, the newest SHOWN kept', () => {
  const app = createAppStore()
  showEmote(app, 'wave', 'a')
  showEmote(app, 'wave', 'a')
  showEmote(app, 'clap', 'a')
  showEmote(app, 'wave', 'b')
  expect(app.getState().reactions.map((r) => [r.sender, r.emote, r.count])).toEqual([
    ['a', 'wave', 2],
    ['a', 'clap', 1],
    ['b', 'wave', 1],
  ])
  showEmote(app, 'love', 'c')
  expect(app.getState().reactions.map((r) => r.sender + ':' + r.emote)).toEqual(['a:clap', 'b:wave', 'c:love'])
})

test('the tally: a line fades unless it was counted again since', () => {
  const app = createAppStore()
  showEmote(app, 'wave', 'a')
  const [{ key, at }] = app.getState().reactions
  app.setState((s) => ({ reactions: s.reactions.map((r) => ({ ...r, at: at + 1 })) })) // counted again
  hideReaction(app, key, at)
  expect(app.getState().reactions).toHaveLength(1)
  hideReaction(app, key, at + 1)
  expect(app.getState().reactions).toHaveLength(0)
})

test('the tally: nothing when emotes are ignored', () => {
  const app = createAppStore()
  app.setState((s) => ({ settings: { ...s.settings, ignore_emotes: true } }))
  showEmote(app, 'wave', 'a')
  expect(app.getState().reactions).toEqual([])
})
