// Construit la bibliothèque d'ancrage : résout chaque ligne du CSV sur Deezer
// (secours iTunes), complète les dimensions avec les mesures (BPM, rang), puis écrit :
//   supabase/seed/anchors/anchors.json   (résultat détaillé, avec provenance)
//   supabase/seed/anchors/anchors.sql    (à coller dans le SQL Editor)
//   supabase/seed/anchors/REPORT.md      (morceaux introuvables, couverture)
// Nécessite un accès réseau à api.deezer.com et itunes.apple.com (tourne dans GitHub Actions).
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { cellOf, coverage, features, matchScore, parseCsv, type AnchorRow } from './lib.ts'
import { anchorsSql, type BuiltAnchor } from './sql.ts'

const dir = join(import.meta.dirname, '..', '..', 'supabase', 'seed', 'anchors')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function getJson(url: string, attempt = 0): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  })
  const body = (await res.json().catch(() => null)) as { error?: { code?: number } } | null
  // Deezer : code 4 = quota dépassé (réponse 200). On patiente et on réessaie.
  if ((!res.ok || body?.error?.code === 4) && attempt < 4) {
    await sleep(2000 * (attempt + 1))
    return getJson(url, attempt + 1)
  }
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return body
}

type DeezerHit = {
  id: number
  title: string
  rank?: number
  duration?: number
  explicit_lyrics?: boolean
  artist: { id: number; name: string; picture_medium?: string }
  album?: { title?: string; cover_xl?: string; cover_medium?: string }
}
type DeezerDetail = DeezerHit & {
  isrc?: string
  bpm?: number
  gain?: number
  release_date?: string
}

async function findDeezer(row: AnchorRow): Promise<{ hit: DeezerDetail; score: number } | null> {
  const queries = [`artist:"${row.artist}" track:"${row.title}"`, `${row.artist} ${row.title}`]
  for (const q of queries) {
    await sleep(150) // ≈ 6 requêtes/s, sous la limite Deezer (50 / 5 s)
    const body = (await getJson(
      `https://api.deezer.com/search?limit=15&q=${encodeURIComponent(q)}`,
    )) as { data?: DeezerHit[] }
    const scored = (body.data ?? [])
      .map((h) => ({ h, s: matchScore(row, { artist: h.artist.name, title: h.title }) }))
      .filter((x) => x.s >= 0.6)
      .sort((a, b) => b.s - a.s || (b.h.rank ?? 0) - (a.h.rank ?? 0))
    const best = scored[0]
    if (best) {
      await sleep(150)
      const detail = (await getJson(`https://api.deezer.com/track/${best.h.id}`)) as DeezerDetail
      return { hit: { ...best.h, ...detail }, score: best.s }
    }
  }
  return null
}

type ItunesHit = {
  trackId: number
  trackName: string
  artistName: string
  collectionName?: string
  artworkUrl100?: string
  releaseDate?: string
  trackTimeMillis?: number
}

async function findItunes(row: AnchorRow): Promise<{ hit: ItunesHit; score: number } | null> {
  await sleep(3200) // ≈ 20 requêtes/min
  const body = (await getJson(
    `https://itunes.apple.com/search?media=music&entity=song&limit=10&term=${encodeURIComponent(`${row.artist} ${row.title}`)}`,
  )) as { results?: ItunesHit[] }
  const best = (body.results ?? [])
    .map((h) => ({ hit: h, score: matchScore(row, { artist: h.artistName, title: h.trackName }) }))
    .filter((x) => x.score >= 0.6)
    .sort((a, b) => b.score - a.score)[0]
  return best ?? null
}

const { rows, errors } = parseCsv(readFileSync(join(dir, 'anchors.source.csv'), 'utf8'))
if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

const built: (BuiltAnchor & { source: AnchorRow; match: { provider: string; score: number } })[] =
  []
const missing: AnchorRow[] = []
for (const [i, row] of rows.entries()) {
  process.stdout.write(`[${i + 1}/${rows.length}] ${row.artist} – ${row.title} … `)
  try {
    const dz = await findDeezer(row)
    if (dz) {
      const h = dz.hit
      const year = Number((h.release_date ?? '').slice(0, 4)) || undefined
      const f = features(row, { bpm: h.bpm && h.bpm > 0 ? h.bpm : undefined, rank: h.rank })
      const { confidence, ...dims } = f
      built.push({
        source: row,
        match: { provider: 'deezer', score: dz.score },
        lang: row.lang,
        cell: cellOf(row),
        genres: row.genres as Record<string, number>,
        features: dims,
        confidence,
        track: {
          title: h.title,
          artist: {
            name: h.artist.name,
            deezer_id: h.artist.id,
            ...(h.artist.picture_medium ? { image_url: h.artist.picture_medium } : {}),
          },
          ...(h.album?.title ? { album: h.album.title } : {}),
          ...(h.album?.cover_xl || h.album?.cover_medium
            ? { cover_url: h.album.cover_xl ?? h.album.cover_medium }
            : {}),
          ...(h.duration ? { duration_s: h.duration } : {}),
          // Année de l'enregistrement de référence (une compilation récente fausserait l'époque).
          release_year: row.year,
          ...(h.isrc ? { isrc: h.isrc } : {}),
          deezer_id: h.id,
          ...(h.rank ? { rank: h.rank } : {}),
          ...(h.bpm && h.bpm > 0 ? { bpm: h.bpm } : {}),
          ...(h.gain !== undefined ? { gain: h.gain } : {}),
          explicit: !!h.explicit_lyrics,
        },
      })
      console.log(
        `Deezer ${h.id}${year && Math.abs(year - row.year) > 2 ? ` (édition ${year})` : ''}`,
      )
      continue
    }
    const it = await findItunes(row)
    if (it) {
      const h = it.hit
      const { confidence, ...dims } = features(row)
      built.push({
        source: row,
        match: { provider: 'itunes', score: it.score },
        lang: row.lang,
        cell: cellOf(row),
        genres: row.genres as Record<string, number>,
        features: dims,
        confidence,
        track: {
          title: h.trackName,
          artist: { name: h.artistName },
          ...(h.collectionName ? { album: h.collectionName } : {}),
          ...(h.artworkUrl100
            ? { cover_url: h.artworkUrl100.replace('100x100bb', '600x600bb') }
            : {}),
          ...(h.trackTimeMillis ? { duration_s: Math.round(h.trackTimeMillis / 1000) } : {}),
          release_year: row.year,
          itunes_id: h.trackId,
        },
      })
      console.log(`iTunes ${h.trackId}`)
      continue
    }
    missing.push(row)
    console.log('INTROUVABLE')
  } catch (e) {
    missing.push(row)
    console.log(`ERREUR ${(e as Error).message}`)
  }
}

const generatedAt = new Date().toISOString()
writeFileSync(
  join(dir, 'anchors.json'),
  JSON.stringify({ generated_at: generatedAt, count: built.length, anchors: built }, null, 1) +
    '\n',
)
writeFileSync(join(dir, 'anchors.sql'), anchorsSql(built, generatedAt))

const cov = coverage(built.map((b) => b.source))
const report = [
  `# Bibliothèque d'ancrage : rapport de construction`,
  ``,
  `Généré le ${generatedAt}. ${built.length} / ${rows.length} morceaux résolus ` +
    `(${built.filter((b) => b.match.provider === 'deezer').length} Deezer, ${built.filter((b) => b.match.provider === 'itunes').length} iTunes).`,
  ``,
  `## Introuvables (${missing.length})`,
  ...(missing.length ? missing.map((m) => `- ${m.artist} – ${m.title} (${m.year})`) : ['Aucun.']),
  ``,
  `## Couverture après résolution`,
  ...(cov.errors.length
    ? cov.errors.map((e) => `- ✗ ${e}`)
    : ['- ✓ toutes les règles de couverture sont respectées']),
  ...cov.warnings.map((w) => `- ⚠ ${w}`),
  ``,
].join('\n')
writeFileSync(join(dir, 'REPORT.md'), report)
console.log(
  `\n${built.length}/${rows.length} résolus, ${missing.length} introuvables. Voir supabase/seed/anchors/REPORT.md`,
)
