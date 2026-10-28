import { afterAll, describe, expect, it } from 'vitest'
import { anchorsSql, type BuiltAnchor } from '../../../scripts/anchors/sql.ts'
import { admin, pool } from './helpers'

afterAll(() => pool.end())

const dims = {
  energy: 0.7,
  valence: 0.6,
  acoustic: 0.2,
  tempo: 0.5,
  dance: 0.8,
  complexity: 0.4,
  vocal: 0.9,
  bass: 0.6,
  polish: 0.8,
  warmth: 0.5,
  era: 0.86,
  niche: 0.1,
}
const anchor = (
  deezerId: number,
  title: string,
  patch: Partial<BuiltAnchor> = {},
): BuiltAnchor => ({
  lang: 'en',
  cell: 'pop|2010s|high',
  genres: { pop: 0.9 },
  features: dims,
  confidence: 0.6,
  track: {
    title,
    artist: { name: 'Ancre Test', deezer_id: 990001 },
    deezer_id: deezerId,
    release_year: 2013,
    rank: 500000,
  },
  ...patch,
})

describe('chargement de la bibliothèque d’ancrage (SQL généré)', () => {
  it('charge, peut être relancé, et n’écrase jamais une analyse audio', async () => {
    const a = anchor(880001, "L'ancre (n°1)")
    const b = anchor(880002, 'Instrumental', { lang: '-' })
    await admin(anchorsSql([a, b], '2026-10-28T00:00:00Z'))
    await admin(anchorsSql([a, b], '2026-10-28T00:00:00Z')) // idempotent

    const rows = await admin<{
      title: string
      language: string
      energy: number
      source: string
      cell: string
      active: boolean
    }>(
      `select t.title, t.language, f.energy, f.source, a.cell, a.active
       from public.tracks t join public.track_features f on f.track_id = t.id join public.anchor_tracks a on a.track_id = t.id
       where t.deezer_id in (880001, 880002) order by t.deezer_id`,
    )
    expect(rows).toEqual([
      {
        title: "L'ancre (n°1)",
        language: 'en',
        energy: expect.closeTo(0.7, 5),
        source: 'curated',
        cell: 'pop|2010s|high',
        active: true,
      },
      {
        title: 'Instrumental',
        language: 'zxx',
        energy: expect.closeTo(0.7, 5),
        source: 'curated',
        cell: 'pop|2010s|high',
        active: true,
      },
    ])

    // L'analyseur audio a mesuré une autre énergie : le rechargement ne doit pas l'écraser.
    await admin(`update public.track_features set energy = 0.33, source = 'analyzed'
                 where track_id = (select id from public.tracks where deezer_id = 880001)`)
    // Et une ancre retirée de la source est désactivée, pas supprimée.
    await admin(anchorsSql([a], '2026-10-29T00:00:00Z'))
    const after = await admin<{ deezer_id: string; energy: number; active: boolean }>(
      `select t.deezer_id, f.energy, a.active from public.tracks t
       join public.track_features f on f.track_id = t.id join public.anchor_tracks a on a.track_id = t.id
       where t.deezer_id in (880001, 880002) order by t.deezer_id`,
    )
    expect(after).toEqual([
      { deezer_id: '880001', energy: expect.closeTo(0.33, 5), active: true },
      { deezer_id: '880002', energy: expect.closeTo(0.7, 5), active: false },
    ])
  })

  it('refuse de tourner si la migration 0002 manque (message clair)', () => {
    expect(anchorsSql([], 'x')).toContain("Applique d''abord la migration 0002")
  })
})
