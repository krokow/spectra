import { describe, expect, it } from 'vitest'
import { previewIsFresh, sourceLink, type CatalogTrack } from './types'

const base: CatalogTrack = {
  id: '4f0c2a7e-1b2d-4c3e-9f10-0a1b2c3d4e5f',
  title: 'T',
  artist_name: 'A',
}
const NOW = Date.parse('2026-10-28T12:00:00Z')

describe('fraîcheur des extraits', () => {
  it('sans URL ou sans échéance : à rafraîchir', () => {
    expect(previewIsFresh(base, NOW)).toBe(false)
    expect(previewIsFresh({ ...base, preview_url: 'https://x' }, NOW)).toBe(false)
  })
  it('expire dans moins d’une minute : à rafraîchir', () => {
    expect(
      previewIsFresh(
        { ...base, preview_url: 'https://x', preview_expires_at: '2026-10-28T12:00:30Z' },
        NOW,
      ),
    ).toBe(false)
    expect(
      previewIsFresh(
        { ...base, preview_url: 'https://x', preview_expires_at: '2026-10-28T13:00:00Z' },
        NOW,
      ),
    ).toBe(true)
  })
})

describe('attribution', () => {
  it('pointe vers la page du morceau chez la bonne source', () => {
    expect(sourceLink({ ...base, preview_source: 'deezer', deezer_id: 3135556 })).toEqual({
      label: 'Deezer',
      href: 'https://www.deezer.com/track/3135556',
    })
    expect(sourceLink({ ...base, preview_source: 'itunes', itunes_id: 42 })?.label).toBe(
      'Apple Music',
    )
    expect(sourceLink(base)).toBeNull()
  })
})
