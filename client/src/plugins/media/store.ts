import { createStore } from 'zustand/vanilla'
import { scoped, type NekoApp } from '@/state/app'
import type { DiaryEntry, MediaState, PredictRound, ReadyCheck } from '@/plugins/types'

// the video in the room's browser, as the server last reported it, and when it arrived (to count
// the time on while it plays); and the watch party around it: the ready check (go_at, while the
// countdown runs), the prediction round, the diary and a rating asked for
export const media = scoped(() =>
  createStore(() => ({
    enabled: false,
    state: null as MediaState | null,
    at: 0,
    ready: null as ReadyCheck | null,
    goAt: 0,
    predict: null as PredictRound | null,
    diary: [] as DiaryEntry[],
    rate: null as { id: string; title: string } | null,
  })),
)

// where the video is now: the reported time, plus the time since while it plays
export const now = (state: MediaState, at: number, clock = Date.now()) =>
  Math.min(state.duration || Infinity, state.time + (state.paused ? 0 : (clock - at) / 1000))

// 1:05, 12:34, 1:02:03
export function clock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const mm = String(Math.floor(s / 60) % 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${mm.padStart(2, '0')}:${ss}` : `${mm}:${ss}`
}

export type MediaAction = 'play' | 'pause' | 'toggle' | 'seek'
export const control = ({ client }: NekoApp, action: MediaAction, seconds?: number) =>
  client.send('media/control', seconds ? { action, seconds } : { action })
