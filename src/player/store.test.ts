import { beforeEach, describe, expect, it } from 'vitest'
import type { CatalogTrack } from '@/providers/types'
import { usePlayer } from './store'

const t = (n: number): CatalogTrack => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  title: `T${n}`,
  artist_name: 'A',
})
const queue = [t(1), t(2), t(3)]

beforeEach(() => usePlayer.getState().close())

describe('lecteur', () => {
  it('lance un morceau dans sa file', () => {
    usePlayer.getState().play(t(2), queue)
    const s = usePlayer.getState()
    expect(s.current()?.title).toBe('T2')
    expect(s.status).toBe('loading')
  })

  it('re-cliquer sur le morceau en cours met en pause puis relance', () => {
    const p = usePlayer.getState()
    p.play(t(1), queue)
    p._report({ status: 'playing' })
    p.play(t(1), queue)
    expect(usePlayer.getState().status).toBe('paused')
    p.play(t(1), queue)
    expect(usePlayer.getState().status).toBe('loading')
  })

  it('suivant / précédent, avec retour au début après 3 s', () => {
    const p = usePlayer.getState()
    p.play(t(1), queue)
    p.next()
    expect(usePlayer.getState().current()?.title).toBe('T2')
    p._report({ position: 10 })
    p.previous()
    expect(usePlayer.getState().current()?.title).toBe('T2')
    expect(usePlayer.getState().seekTo).toBe(0)
    p._report({ position: 1 })
    p.previous()
    expect(usePlayer.getState().current()?.title).toBe('T1')
  })

  it('fin de file : pause sur le dernier morceau', () => {
    const p = usePlayer.getState()
    p.play(t(3), queue)
    p.next()
    expect(usePlayer.getState().status).toBe('paused')
    expect(usePlayer.getState().current()?.title).toBe('T3')
  })

  it('un morceau hors file devient une file à lui seul', () => {
    usePlayer.getState().play(t(9), queue)
    expect(usePlayer.getState().queue).toHaveLength(1)
  })

  it('le saut est borné à la durée', () => {
    const p = usePlayer.getState()
    p.play(t(1))
    p._report({ duration: 30 })
    p.seek(99)
    expect(usePlayer.getState().seekTo).toBe(30)
    p.seek(-5)
    expect(usePlayer.getState().seekTo).toBe(0)
  })
})
