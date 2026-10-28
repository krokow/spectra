import { create } from 'zustand'
import type { CatalogTrack } from '@/providers/types'

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error'

type PlayerState = {
  queue: CatalogTrack[]
  index: number
  status: PlayerStatus
  /** Position et durée en secondes (un extrait fait ~30 s). */
  position: number
  duration: number
  expanded: boolean
  errorKey: string | null
  /** Demande de saut (consommée par le moteur audio). */
  seekTo: number | null

  current: () => CatalogTrack | null
  play: (track: CatalogTrack, queue?: CatalogTrack[]) => void
  toggle: () => void
  next: () => void
  previous: () => void
  seek: (seconds: number) => void
  setExpanded: (v: boolean) => void
  close: () => void
  /** Réservé au moteur audio. */
  _report: (
    patch: Partial<Pick<PlayerState, 'status' | 'position' | 'duration' | 'errorKey' | 'seekTo'>>,
  ) => void
  _replace: (track: CatalogTrack) => void
}

export const usePlayer = create<PlayerState>((set, get) => ({
  queue: [],
  index: -1,
  status: 'idle',
  position: 0,
  duration: 30,
  expanded: false,
  errorKey: null,
  seekTo: null,

  current: () => get().queue[get().index] ?? null,

  play: (track, queue) => {
    const list = queue && queue.some((t) => t.id === track.id) ? queue : [track]
    const index = list.findIndex((t) => t.id === track.id)
    const same = get().current()?.id === track.id
    if (same) {
      // Re-cliquer sur le morceau en cours : simple bascule lecture/pause.
      get().toggle()
      return
    }
    set({ queue: list, index, status: 'loading', position: 0, errorKey: null })
  },

  toggle: () => {
    const { status } = get()
    if (status === 'playing') set({ status: 'paused' })
    else if (status === 'paused' || status === 'error') set({ status: 'loading', errorKey: null })
  },

  next: () => {
    const { index, queue } = get()
    if (index < queue.length - 1)
      set({ index: index + 1, status: 'loading', position: 0, errorKey: null })
    else set({ status: 'paused', position: 0 })
  },

  previous: () => {
    const { index, position } = get()
    // Comme partout : au-delà de 3 s, « précédent » revient au début du morceau.
    if (position > 3 || index <= 0) set({ seekTo: 0, position: 0 })
    else set({ index: index - 1, status: 'loading', position: 0, errorKey: null })
  },

  seek: (seconds) => {
    const d = get().duration || 30
    const s = Math.max(0, Math.min(d, seconds))
    set({ seekTo: s, position: s })
  },

  setExpanded: (v) => set({ expanded: v }),
  close: () =>
    set({ queue: [], index: -1, status: 'idle', position: 0, expanded: false, errorKey: null }),
  _report: (patch) => set(patch),
  _replace: (track) => set({ queue: get().queue.map((t) => (t.id === track.id ? track : t)) }),
}))
