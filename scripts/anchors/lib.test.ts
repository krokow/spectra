import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  cellOf,
  coverage,
  eraFromYear,
  features,
  matchScore,
  nicheFromRank,
  parseCsv,
  tempoFromBpm,
} from './lib'

const HEADER =
  'artist;title;year;lang;genres;energy;valence;acoustic;tempo;dance;complexity;vocal;bass;polish;warmth;niche'
const row =
  'Daft Punk;Get Lucky;2013;en;funk_disco:0.7|electro:0.5;0.75;0.85;0.3;0.55;0.9;0.35;0.85;0.65;0.95;0.8;0.03'

describe('lecture du CSV', () => {
  it('lit une ligne valide et ignore les commentaires', () => {
    const { rows, errors } = parseCsv(`# commentaire\n${HEADER}\n${row}\n`)
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({
      artist: 'Daft Punk',
      year: 2013,
      genres: { funk_disco: 0.7, electro: 0.5 },
      dance: 0.9,
    })
  })

  it('signale les lignes invalides avec leur numéro', () => {
    const { rows, errors } = parseCsv(
      `${HEADER}\n${row.replace('0.75', '1.5')}\nX;Y;2000;en;inconnu:1;${'0.5;'.repeat(10)}0.5\nTrop;court`,
    )
    expect(rows).toEqual([])
    expect(errors).toHaveLength(3)
    expect(errors[0]).toMatch(/ligne 2.*energy/)
    expect(errors[1]).toMatch(/ligne 3/)
    expect(errors[2]).toMatch(/ligne 4 : 2 colonnes/)
  })
})

describe('dimensions dérivées', () => {
  it('époque : échelle de questions.json, interpolée', () => {
    expect(eraFromYear(1950)).toBe(0)
    expect(eraFromYear(1980)).toBe(0.25)
    expect(eraFromYear(1985)).toBe(0.35)
    expect(eraFromYear(2024)).toBe(1)
  })

  it('singularité depuis le rang Deezer (log)', () => {
    expect(nicheFromRank(1_000_000)).toBe(0)
    expect(nicheFromRank(100_000)).toBe(0.5)
    expect(nicheFromRank(5_000)).toBe(1)
    expect(nicheFromRank(0)).toBeUndefined()
  })

  it('tempo depuis le BPM, valeurs absurdes ignorées', () => {
    expect(tempoFromBpm(120)).toBe(0.5)
    expect(tempoFromBpm(0)).toBeUndefined()
    expect(tempoFromBpm(999)).toBeUndefined()
  })

  it('les mesures complètent l’annotation sans l’écraser', () => {
    const r = parseCsv(`${HEADER}\n${row}`).rows[0]!
    const f = features(r, { bpm: 116, rank: 900_000 })
    expect(f.tempo).toBeCloseTo(0.6 * ((116 - 60) / 120) + 0.4 * 0.55, 2)
    expect(f.niche).toBeCloseTo((nicheFromRank(900_000)! + 0.03) / 2, 2)
    expect(f.era).toBe(0.86)
    expect(f.confidence).toBe(0.65)
    expect(features(r).confidence).toBe(0.55)
  })

  it('cellule de couverture', () => {
    expect(cellOf(parseCsv(`${HEADER}\n${row}`).rows[0]!)).toBe('funk_disco|2010s|high')
  })
})

describe('correspondance Deezer', () => {
  it('tolère « feat. », accents et esperluettes', () => {
    expect(
      matchScore(
        { artist: 'Simon & Garfunkel', title: 'The Sound of Silence' },
        { artist: 'Simon and Garfunkel', title: 'The Sound of Silence' },
      ),
    ).toBe(1)
    expect(
      matchScore(
        { artist: 'Beyoncé', title: 'Crazy in Love' },
        { artist: 'Beyonce', title: 'Crazy In Love (feat. Jay-Z)' },
      ),
    ).toBe(1)
    expect(
      matchScore(
        { artist: 'Daft Punk', title: 'Get Lucky' },
        { artist: 'Daft Punk', title: 'Lose Yourself to Dance' },
      ),
    ).toBe(0)
  })
})

describe('la bibliothèque réelle', () => {
  const text = readFileSync(
    join(import.meta.dirname, '../../supabase/seed/anchors/anchors.source.csv'),
    'utf8',
  )
  const { rows, errors } = parseCsv(text)

  it('se lit sans erreur', () => {
    expect(errors).toEqual([])
    expect(rows.length).toBeGreaterThanOrEqual(300)
  })

  it('couvre tous les genres, toutes les décennies, sans artiste sur-représenté', () => {
    expect(coverage(rows).errors).toEqual([])
  })
})
