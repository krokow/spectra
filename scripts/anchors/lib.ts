// Bibliothèque d'ancrage : logique pure (lecture du CSV, dérivation des dimensions,
// contrôle de couverture). Utilisée par build.ts / validate.ts et testée par Vitest.
import { z } from 'zod'

export const DIMS = [
  'energy',
  'valence',
  'acoustic',
  'tempo',
  'dance',
  'complexity',
  'vocal',
  'bass',
  'polish',
  'warmth',
  'era',
  'niche',
] as const
export type Dim = (typeof DIMS)[number]
export const CSV_DIMS = DIMS.filter((d) => d !== 'era')

export const GENRES = [
  'pop',
  'rock',
  'indie',
  'metal',
  'punk',
  'hiphop',
  'rnb_soul',
  'funk_disco',
  'electro',
  'ambient',
  'jazz',
  'classical',
  'folk',
  'country',
  'reggae',
  'latin',
  'afro',
  'chanson',
  'kpop_jpop',
  'blues',
] as const
export type Genre = (typeof GENRES)[number]

const unit = z.number().min(0).max(1)

export const AnchorSource = z.object({
  artist: z.string().min(1),
  title: z.string().min(1),
  year: z.number().int().min(1900).max(2100),
  lang: z.string().regex(/^(-|[a-z]{2,3})$/),
  genres: z
    .partialRecord(z.enum(GENRES), unit)
    .refine((g) => Object.keys(g).length > 0, 'au moins un genre'),
  energy: unit,
  valence: unit,
  acoustic: unit,
  tempo: unit,
  dance: unit,
  complexity: unit,
  vocal: unit,
  bass: unit,
  polish: unit,
  warmth: unit,
  niche: unit,
})

export type AnchorRow = z.infer<typeof AnchorSource>

/** Lit le CSV (séparateur « ; », lignes « # » ignorées). Renvoie lignes valides et erreurs. */
export function parseCsv(text: string): { rows: AnchorRow[]; errors: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l, i) => ({ l: l.trim(), n: i + 1 }))
    .filter(({ l }) => l && !l.startsWith('#'))
  const [header, ...data] = lines
  const cols = header?.l.split(';') ?? []
  const expected = ['artist', 'title', 'year', 'lang', 'genres', ...CSV_DIMS]
  const errors: string[] = []
  if (cols.join(';') !== expected.join(';')) errors.push(`En-tête inattendu : ${cols.join(';')}`)
  const rows: AnchorRow[] = []
  for (const { l, n } of data) {
    const cells = l.split(';')
    if (cells.length !== expected.length) {
      errors.push(`ligne ${n} : ${cells.length} colonnes au lieu de ${expected.length}`)
      continue
    }
    const raw: Record<string, unknown> = {}
    expected.forEach((c, i) => (raw[c] = cells[i]?.trim()))
    raw.year = Number(raw.year)
    for (const d of CSV_DIMS) raw[d] = Number(raw[d])
    raw.genres = Object.fromEntries(
      String(raw.genres)
        .split('|')
        .map((p) => p.split(':'))
        .map(([g, w]) => [g?.trim(), Number(w)]),
    )
    const parsed = AnchorSource.safeParse(raw)
    if (parsed.success) rows.push(parsed.data)
    else
      errors.push(
        `ligne ${n} (${raw.artist} – ${raw.title}) : ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(', ')}`,
      )
  }
  return { rows, errors }
}

/** Échelle d'époque de questions.json (décennie → valeur), interpolée à l'année. */
const ERA_SCALE: [number, number][] = [
  [1960, 0],
  [1970, 0.1],
  [1980, 0.25],
  [1990, 0.45],
  [2000, 0.6],
  [2010, 0.8],
  [2020, 1],
]
export function eraFromYear(year: number): number {
  const first = ERA_SCALE[0]!
  const last = ERA_SCALE[ERA_SCALE.length - 1]!
  if (year <= first[0]) return 0
  if (year >= last[0]) return 1
  for (let i = 0; i < ERA_SCALE.length - 1; i++) {
    const [y0, v0] = ERA_SCALE[i]!
    const [y1, v1] = ERA_SCALE[i + 1]!
    if (year < y1) return round(v0 + ((year - y0) / (y1 - y0)) * (v1 - v0))
  }
  return 1
}

export function decadeOf(year: number): string {
  return year < 1960 ? '1960s' : `${Math.min(2020, Math.floor(year / 10) * 10)}s`
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
export const round = (x: number) => Math.round(x * 1000) / 1000

/** Singularité depuis le rang Deezer (0..~1 000 000, échelle log) : 1e6 → 0, ≤ 1e4 → 1. */
export function nicheFromRank(rank: number | undefined): number | undefined {
  if (!rank || rank <= 0) return undefined
  return round(clamp01(1 - (Math.log10(rank) - 4) / 2))
}

/** Tempo depuis le BPM Deezer : 60 → 0, 180 → 1. */
export function tempoFromBpm(bpm: number | undefined): number | undefined {
  if (!bpm || bpm < 30 || bpm > 300) return undefined
  return round(clamp01((bpm - 60) / 120))
}

export type Measured = {
  rank?: number | undefined
  bpm?: number | undefined
  releaseYear?: number | undefined
}

/**
 * Dimensions finales d'une ancre : annotation humaine, complétée par les mesures
 * objectives quand elles existent. Le BPM peut être doublé ou divisé par deux
 * par erreur : on le pondère à 60 % seulement.
 */
export function features(
  row: AnchorRow,
  m: Measured = {},
): Record<Dim, number> & { confidence: number } {
  const out = Object.fromEntries(CSV_DIMS.map((d) => [d, row[d]])) as Record<Dim, number>
  out.era = eraFromYear(row.year)
  const t = tempoFromBpm(m.bpm)
  if (t !== undefined) out.tempo = round(0.6 * t + 0.4 * row.tempo)
  const n = nicheFromRank(m.rank)
  if (n !== undefined) out.niche = round(0.5 * n + 0.5 * row.niche)
  const measured = (t !== undefined ? 1 : 0) + (n !== undefined ? 1 : 0)
  return { ...out, confidence: round(0.55 + measured * 0.05) }
}

export function primaryGenre(row: AnchorRow): Genre {
  return (Object.entries(row.genres) as [Genre, number][]).sort((a, b) => b[1] - a[1])[0]![0]
}

/** Cellule de couverture : genre principal | décennie | niveau d'énergie. */
export function cellOf(row: AnchorRow): string {
  const band = row.energy < 0.4 ? 'low' : row.energy < 0.7 ? 'mid' : 'high'
  return `${primaryGenre(row)}|${decadeOf(row.year)}|${band}`
}

// ---------------------------------------------------------------------------
// Contrôle de couverture de l'espace musical
// ---------------------------------------------------------------------------
export const RULES = {
  minPerGenre: 8, // morceaux dont le poids du genre ≥ 0.5
  minPerDecade: 20,
  minPerBucket: 8, // par cinquième de chaque dimension ([0,.2), [.2,.4)…)
  maxPerArtist: 3,
  minLanguages: 10,
} as const

export type Coverage = {
  errors: string[]
  warnings: string[]
  stats: {
    total: number
    perGenre: Record<string, number>
    perDecade: Record<string, number>
    perBucket: Record<string, number[]>
    languages: Record<string, number>
  }
}

export function coverage(rows: AnchorRow[]): Coverage {
  const errors: string[] = []
  const warnings: string[] = []
  const perGenre = Object.fromEntries(GENRES.map((g) => [g, 0])) as Record<string, number>
  const perDecade: Record<string, number> = {}
  const perBucket = Object.fromEntries(DIMS.map((d) => [d, [0, 0, 0, 0, 0]])) as Record<
    string,
    number[]
  >
  const languages: Record<string, number> = {}
  const artists = new Map<string, number>()
  const seen = new Set<string>()

  for (const r of rows) {
    const key = `${r.artist.toLowerCase()}|${r.title.toLowerCase()}`
    if (seen.has(key)) errors.push(`doublon : ${r.artist} – ${r.title}`)
    seen.add(key)
    artists.set(r.artist.toLowerCase(), (artists.get(r.artist.toLowerCase()) ?? 0) + 1)
    for (const [g, w] of Object.entries(r.genres))
      if ((w ?? 0) >= 0.5) perGenre[g] = (perGenre[g] ?? 0) + 1
    const dec = decadeOf(r.year)
    perDecade[dec] = (perDecade[dec] ?? 0) + 1
    languages[r.lang] = (languages[r.lang] ?? 0) + 1
    const f = features(r)
    for (const d of DIMS) perBucket[d]![Math.min(4, Math.floor(f[d] * 5))]! += 1
  }

  for (const [a, n] of artists)
    if (n > RULES.maxPerArtist)
      errors.push(`artiste sur-représenté : ${a} (${n} > ${RULES.maxPerArtist})`)
  for (const g of GENRES)
    if ((perGenre[g] ?? 0) < RULES.minPerGenre)
      errors.push(`genre ${g} : ${perGenre[g]} morceaux (< ${RULES.minPerGenre})`)
  for (const dec of ['1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'])
    if ((perDecade[dec] ?? 0) < RULES.minPerDecade)
      errors.push(`décennie ${dec} : ${perDecade[dec] ?? 0} morceaux (< ${RULES.minPerDecade})`)
  for (const d of DIMS)
    perBucket[d]!.forEach((n, i) => {
      if (n < RULES.minPerBucket)
        warnings.push(`${d} ∈ [${i / 5}, ${(i + 1) / 5}) : ${n} morceaux (< ${RULES.minPerBucket})`)
    })
  const langCount = Object.keys(languages).filter((l) => l !== '-').length
  if (langCount < RULES.minLanguages)
    errors.push(`${langCount} langues chantées (< ${RULES.minLanguages})`)

  return {
    errors,
    warnings,
    stats: { total: rows.length, perGenre, perDecade, perBucket, languages },
  }
}

// ---------------------------------------------------------------------------
// Correspondance avec les résultats Deezer
// ---------------------------------------------------------------------------
export function simplify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\(.*?\)|\[.*?\]/g, ' ')
      .replace(/\b(feat|ft|featuring)\b.*$/, ' ')
      .replace(/&/g, ' and ')
      // Toutes les écritures sont conservées (arabe, japonais…), seule la ponctuation saute.
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
  )
}

/** Score de ressemblance [0, 1] entre une ligne source et un résultat. */
// Versions à écarter : karaoké, hommages, reprises « à la manière de », medleys, berceuses…
const JUNK_ARTIST =
  /karaoke|tribute|made famous|in the style of|originally performed|hello i'?m|sing to|cover band|lullaby|baby/i
const JUNK_TITLE =
  /karaoke|tribute|medley|instrumental version|8-?bit|lullaby|cover version|baby'?s brain|mozart effect|remake/i

export function isJunk(
  cand: { artist: string; title: string },
  row?: { artist: string; title: string },
): boolean {
  // Un mot « suspect » présent dans la source elle-même n'est pas un motif de rejet.
  const artistJunk = JUNK_ARTIST.test(cand.artist) && !(row && JUNK_ARTIST.test(row.artist))
  const titleJunk = JUNK_TITLE.test(cand.title) && !(row && JUNK_TITLE.test(row.title))
  return artistJunk || titleJunk
}

export function matchScore(
  row: { artist: string; title: string },
  cand: { artist: string; title: string },
): number {
  if (isJunk(cand, row)) return 0
  // Un titre vide après simplification ne doit correspondre à rien.
  if (!simplify(row.title) || !simplify(cand.title) || !simplify(cand.artist)) return 0
  const ta = simplify(row.title)
  const tb = simplify(cand.title)
  const aa = simplify(row.artist)
  const ab = simplify(cand.artist)
  const title =
    ta === tb
      ? 1
      : tb.startsWith(ta) || ta.startsWith(tb)
        ? 0.8
        : tb.includes(ta) || ta.includes(tb)
          ? 0.6
          : 0
  const artist = aa === ab ? 1 : ab.includes(aa) || aa.includes(ab) ? 0.8 : 0
  return title * artist
}
