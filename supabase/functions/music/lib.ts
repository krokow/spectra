// Logique pure de l'Edge Function `music` : validation et normalisation des
// réponses Deezer / iTunes / Last.fm. Aucun accès réseau ici (testable).
import { z } from 'npm:zod@4.6.7'

// ---------------------------------------------------------------------------
// Entrée
// ---------------------------------------------------------------------------
export const MusicRequest = z.discriminatedUnion('action', [
  z.object({ action: z.literal('search'), q: z.string().trim().min(1).max(100) }),
  z.object({ action: z.literal('preview'), trackId: z.uuid() }),
  z.object({ action: z.literal('tags'), trackId: z.uuid() }),
])
export type MusicRequest = z.infer<typeof MusicRequest>

/** Clé de cache d'une recherche : minuscules, espaces compactés, sans accents. */
export function normalizeQuery(q: string): string {
  return q.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// Morceau normalisé (format attendu par la RPC upsert_tracks)
// ---------------------------------------------------------------------------
export type NormalizedTrack = {
  title: string
  artist: { name: string; deezer_id?: number; image_url?: string }
  album?: string
  cover_url?: string
  duration_s?: number
  release_year?: number
  isrc?: string
  deezer_id?: number
  itunes_id?: number
  rank?: number
  bpm?: number
  gain?: number
  explicit?: boolean
  preview_url?: string
  preview_source?: 'deezer' | 'itunes'
  preview_expires_at?: string
}

/** Retire les clés `undefined` (le JSON envoyé à Postgres reste propre). */
function compact<T extends Record<string, unknown>>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T
}

// ---------------------------------------------------------------------------
// Deezer
// ---------------------------------------------------------------------------
export const DeezerError = z.object({
  error: z.object({
    code: z.number().optional(),
    message: z.string().optional(),
    type: z.string().optional(),
  }),
})

const DeezerArtist = z.object({
  id: z.number(),
  name: z.string(),
  picture_medium: z.string().optional(),
})
const DeezerAlbum = z.object({
  id: z.number().optional(),
  title: z.string().optional(),
  cover_medium: z.string().optional(),
  cover_xl: z.string().optional(),
  release_date: z.string().optional(),
})
export const DeezerTrack = z.object({
  id: z.number(),
  title: z.string(),
  readable: z.boolean().optional(),
  duration: z.number().optional(),
  rank: z.number().optional(),
  explicit_lyrics: z.boolean().optional(),
  preview: z.string().optional(),
  isrc: z.string().optional(),
  bpm: z.number().optional(),
  gain: z.number().optional(),
  release_date: z.string().optional(),
  artist: DeezerArtist,
  album: DeezerAlbum.optional(),
})
export type DeezerTrack = z.infer<typeof DeezerTrack>
export const DeezerSearch = z.object({ data: z.array(z.unknown()) })

/** Échéance d'une URL d'extrait Deezer signée (`hdnea=exp=<epoch>~...`). */
export function previewExpiry(url: string | undefined, now = Date.now()): string | undefined {
  if (!url) return undefined
  const m = /exp=(\d{9,11})/.exec(url)
  // Sans échéance lisible, on suppose une validité courte (rafraîchie à la lecture).
  const epochMs = m ? Number(m[1]) * 1000 : now + 60 * 60 * 1000
  return new Date(epochMs).toISOString()
}

function yearOf(date: string | undefined): number | undefined {
  const y = date ? Number(date.slice(0, 4)) : NaN
  return Number.isInteger(y) && y >= 1900 && y <= 2100 ? y : undefined
}

export function normalizeDeezer(t: DeezerTrack, now = Date.now()): NormalizedTrack {
  const preview = t.preview && t.preview.startsWith('https://') ? t.preview : undefined
  return compact({
    title: t.title,
    artist: compact({
      name: t.artist.name,
      deezer_id: t.artist.id,
      image_url: t.artist.picture_medium,
    }),
    album: t.album?.title,
    cover_url: t.album?.cover_xl ?? t.album?.cover_medium,
    duration_s: t.duration,
    release_year: yearOf(t.release_date ?? t.album?.release_date),
    isrc: t.isrc,
    deezer_id: t.id,
    rank: t.rank,
    // Deezer renvoie bpm = 0 quand il ne sait pas.
    bpm: t.bpm && t.bpm > 0 ? t.bpm : undefined,
    gain: t.gain,
    explicit: t.explicit_lyrics,
    preview_url: preview,
    preview_source: preview ? 'deezer' : undefined,
    preview_expires_at: preview ? previewExpiry(preview, now) : undefined,
  }) as NormalizedTrack
}

/** Parse une liste Deezer en ignorant les éléments mal formés (sans faire échouer la recherche). */
export function parseDeezerList(items: unknown[], now = Date.now()): NormalizedTrack[] {
  const out: NormalizedTrack[] = []
  for (const item of items) {
    const parsed = DeezerTrack.safeParse(item)
    if (parsed.success && parsed.data.readable !== false)
      out.push(normalizeDeezer(parsed.data, now))
  }
  return out
}

// ---------------------------------------------------------------------------
// iTunes (secours)
// ---------------------------------------------------------------------------
export const ItunesResult = z.object({
  trackId: z.number(),
  trackName: z.string(),
  artistName: z.string(),
  collectionName: z.string().optional(),
  artworkUrl100: z.string().optional(),
  previewUrl: z.string().optional(),
  releaseDate: z.string().optional(),
  trackTimeMillis: z.number().optional(),
  trackExplicitness: z.string().optional(),
  kind: z.string().optional(),
})
export const ItunesSearch = z.object({ results: z.array(z.unknown()) })

export function normalizeItunes(r: z.infer<typeof ItunesResult>): NormalizedTrack {
  const preview = r.previewUrl?.startsWith('https://') ? r.previewUrl : undefined
  return compact({
    title: r.trackName,
    artist: { name: r.artistName },
    album: r.collectionName,
    // Pochette agrandie (l'API renvoie 100×100 par défaut).
    cover_url: r.artworkUrl100?.replace('100x100bb', '600x600bb'),
    duration_s: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : undefined,
    release_year: yearOf(r.releaseDate),
    itunes_id: r.trackId,
    explicit: r.trackExplicitness === 'explicit',
    preview_url: preview,
    preview_source: preview ? 'itunes' : undefined,
    // Les extraits iTunes n'expirent pas : on les revérifie tout de même chaque mois.
    preview_expires_at: preview
      ? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
      : undefined,
  }) as NormalizedTrack
}

export function parseItunesList(items: unknown[]): NormalizedTrack[] {
  const out: NormalizedTrack[] = []
  for (const item of items) {
    const parsed = ItunesResult.safeParse(item)
    if (parsed.success && (parsed.data.kind ?? 'song') === 'song')
      out.push(normalizeItunes(parsed.data))
  }
  return out
}

// ---------------------------------------------------------------------------
// Correspondance « même morceau » (pour choisir le bon résultat iTunes)
// ---------------------------------------------------------------------------
export function simplify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\b(feat|ft|featuring)\b.*$/, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function sameTrack(
  a: { title: string; artist: string },
  b: { title: string; artist: string },
): boolean {
  const ta = simplify(a.title)
  const tb = simplify(b.title)
  const aa = simplify(a.artist)
  const ab = simplify(b.artist)
  const titleOk = ta === tb || ta.startsWith(tb) || tb.startsWith(ta)
  const artistOk = aa === ab || aa.includes(ab) || ab.includes(aa)
  return titleOk && artistOk && ta.length > 0
}

// ---------------------------------------------------------------------------
// Last.fm (tags)
// ---------------------------------------------------------------------------
export const LastfmTopTags = z.object({
  toptags: z.object({
    tag: z
      .array(z.object({ name: z.string(), count: z.union([z.number(), z.string()]) }))
      .or(z.object({ name: z.string(), count: z.union([z.number(), z.string()]) })),
  }),
})

export function normalizeTags(raw: unknown, max = 15): { name: string; count: number }[] {
  const parsed = LastfmTopTags.safeParse(raw)
  if (!parsed.success) return []
  const list = Array.isArray(parsed.data.toptags.tag)
    ? parsed.data.toptags.tag
    : [parsed.data.toptags.tag]
  return list
    .map((t) => ({
      name: t.name.trim().toLowerCase(),
      count: Math.max(0, Math.min(100, Number(t.count) || 0)),
    }))
    .filter((t) => t.name.length > 0 && t.name.length <= 60 && t.count > 0)
    .slice(0, max)
}
