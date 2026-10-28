// FICHIER GÉNÉRÉ par scripts/functions/bundle.mjs : ne pas modifier à la main.
// Source : supabase/functions/music/. Copier TOUT ce fichier dans l'éditeur Supabase.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { z } from 'npm:zod@4.6.7'

// ───── supabase/functions/_shared/http.ts ─────
// Utilitaires HTTP partagés par les Edge Functions (CORS restreint, réponses JSON).

export function allowedOrigins(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
}

export function corsHeaders(origin: string | null, allowed: string[]): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && allowed.includes(origin) ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

export function mustEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Variable d'environnement manquante : ${name}`)
  return v
}

export function clientIp(req: Request): string {
  return (
    (req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? 'unknown')
      .split(',')[0]
      ?.trim() ?? 'unknown'
  )
}

// ───── supabase/functions/music/lib.ts ─────
// Logique pure de l'Edge Function `music` : validation et normalisation des
// réponses Deezer / iTunes / Last.fm. Aucun accès réseau ici (testable).


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

// ───── supabase/functions/music/index.ts ─────
// Spectra · Edge Function « music »
// Relais vers Deezer (extraits 30 s, métadonnées), iTunes (secours) et Last.fm (tags).
// Tout passe par le cache en base : on ne redemande jamais deux fois la même chose.
//
// Déploiement : coller le fichier assemblé supabase/functions-bundled/music.ts
//   (Edge Functions → Deploy a new function → Via Editor, nom : music). Laisser « Verify JWT » ACTIVÉ.
// Secrets : ALLOWED_ORIGINS (déjà créé), LASTFM_API_KEY (facultatif : sans lui, pas de tags).





const SEARCH_TTL_MS = 7 * 24 * 3600 * 1000
const FETCH_TIMEOUT_MS = 8000
const TRACK_COLUMNS =
  'id, title, artist_name, album, cover_url, duration_s, release_year, deezer_id, itunes_id, preview_url, preview_source, preview_expires_at, explicit'

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly key: string,
  ) {
    super(key)
  }
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new HttpError(502, 'upstream_error')
  return await res.json()
}

async function rateLimit(db: SupabaseClient, key: string, limit: number, windowSeconds: number) {
  const { error } = await db.rpc('edge_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error)
    throw new HttpError(
      error.code === 'PT429' || error.hint === 'rate_limited' ? 429 : 500,
      error.code === 'PT429' || error.hint === 'rate_limited' ? 'rate_limited' : 'server_error',
    )
}

// Deezer limite à ~50 requêtes / 5 s par IP, partagées par toutes les Edge Functions.
async function deezer(db: SupabaseClient, path: string): Promise<unknown> {
  await rateLimit(db, 'deezer-global', 40, 5)
  const body = await getJson(`https://api.deezer.com${path}`)
  // Deezer répond 200 même en erreur (ex. quota dépassé, code 4).
  if (DeezerError.safeParse(body).success) throw new HttpError(502, 'upstream_error')
  return body
}

async function itunesSearch(
  db: SupabaseClient,
  term: string,
  limit: number,
): Promise<NormalizedTrack[]> {
  await rateLimit(db, 'itunes-global', 18, 60)
  const body = ItunesSearch.safeParse(
    await getJson(
      `https://itunes.apple.com/search?media=music&entity=song&limit=${limit}&term=${encodeURIComponent(term)}`,
    ),
  )
  return body.success ? parseItunesList(body.data.results) : []
}

async function upsert(db: SupabaseClient, tracks: NormalizedTrack[]): Promise<string[]> {
  if (tracks.length === 0) return []
  const { data, error } = await db.rpc('upsert_tracks', { p_tracks: tracks })
  if (error) throw new HttpError(500, 'server_error')
  return data as string[]
}

async function loadTracks(db: SupabaseClient, ids: string[]) {
  if (ids.length === 0) return []
  const { data, error } = await db.from('tracks').select(TRACK_COLUMNS).in('id', ids)
  if (error) throw new HttpError(500, 'server_error')
  const byId = new Map((data ?? []).map((t) => [t.id as string, t]))
  return ids.map((id) => byId.get(id)).filter(Boolean)
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
async function search(db: SupabaseClient, q: string) {
  const key = normalizeQuery(q)
  const cached = await db
    .from('search_cache')
    .select('track_ids, fetched_at')
    .eq('query', key)
    .maybeSingle()
  if (cached.data && Date.now() - Date.parse(cached.data.fetched_at) < SEARCH_TTL_MS) {
    return { tracks: await loadTracks(db, cached.data.track_ids as string[]), cached: true }
  }

  let found: NormalizedTrack[] = []
  try {
    const body = DeezerSearch.safeParse(
      await deezer(db, `/search?limit=20&q=${encodeURIComponent(q)}`),
    )
    if (body.success) found = parseDeezerList(body.data.data)
  } catch (e) {
    if (e instanceof HttpError && e.status === 429) throw e
    // Deezer indisponible : on se rabat sur iTunes.
  }
  if (found.length === 0) found = await itunesSearch(db, q, 20)

  const ids = await upsert(db, found)
  await db
    .from('search_cache')
    .upsert({ query: key, track_ids: ids, fetched_at: new Date().toISOString() })
  return { tracks: await loadTracks(db, ids), cached: false }
}

async function preview(db: SupabaseClient, trackId: string) {
  const { data: t, error } = await db
    .from('tracks')
    .select(`${TRACK_COLUMNS}`)
    .eq('id', trackId)
    .maybeSingle()
  if (error) throw new HttpError(500, 'server_error')
  if (!t) throw new HttpError(404, 'not_found')

  // Encore valable au moins 2 minutes : rien à faire.
  if (
    t.preview_url &&
    t.preview_expires_at &&
    Date.parse(t.preview_expires_at) > Date.now() + 120_000
  ) {
    return { track: t }
  }

  let fresh: NormalizedTrack | undefined
  if (t.deezer_id) {
    try {
      const parsed = DeezerTrack.safeParse(await deezer(db, `/track/${t.deezer_id}`))
      if (parsed.success) fresh = normalizeDeezer(parsed.data)
    } catch (e) {
      if (e instanceof HttpError && e.status === 429) throw e
    }
  }
  if (!fresh?.preview_url) {
    const candidates = await itunesSearch(db, `${t.artist_name} ${t.title}`, 5)
    const match = candidates.find(
      (c) =>
        c.preview_url &&
        sameTrack(
          { title: c.title, artist: c.artist.name },
          { title: t.title, artist: t.artist_name },
        ),
    )
    if (match) {
      // On garde l'identité Deezer du morceau, seul l'extrait vient d'iTunes.
      const { error: upd } = await db
        .from('tracks')
        .update({
          preview_url: match.preview_url,
          preview_source: 'itunes',
          preview_expires_at: match.preview_expires_at,
          itunes_id: t.itunes_id ?? match.itunes_id,
        })
        .eq('id', trackId)
      if (upd) throw new HttpError(500, 'server_error')
      return { track: (await loadTracks(db, [trackId]))[0] }
    }
    throw new HttpError(404, 'no_preview')
  }
  await upsert(db, [fresh])
  return { track: (await loadTracks(db, [trackId]))[0] }
}

async function tags(db: SupabaseClient, trackId: string) {
  const apiKey = Deno.env.get('LASTFM_API_KEY')
  const { data: t } = await db
    .from('tracks')
    .select('id, title, artist_name, tags')
    .eq('id', trackId)
    .maybeSingle()
  if (!t) throw new HttpError(404, 'not_found')
  if (Array.isArray(t.tags) && t.tags.length > 0) return { tags: t.tags }
  if (!apiKey) return { tags: [] }

  await rateLimit(db, 'lastfm-global', 4, 1)
  const url =
    `https://ws.audioscrobbler.com/2.0/?method=track.gettoptags&autocorrect=1&format=json` +
    `&artist=${encodeURIComponent(t.artist_name)}&track=${encodeURIComponent(t.title)}&api_key=${encodeURIComponent(apiKey)}`
  const list = normalizeTags(await getJson(url))
  if (list.length > 0) await db.from('tracks').update({ tags: list }).eq('id', trackId)
  return { tags: list }
}

// ---------------------------------------------------------------------------
// Serveur
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  const allowed = allowedOrigins()
  const origin = req.headers.get('origin')
  const cors = corsHeaders(origin, allowed)
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (!origin || !allowed.includes(origin))
    return jsonResponse(403, { error: 'origin_not_allowed' }, cors)
  if (req.method !== 'POST') return jsonResponse(405, { error: 'method_not_allowed' }, cors)

  try {
    // Identité vérifiée (signature du JWT), en plus de la vérification faite par la plateforme.
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    const anon = createClient(mustEnv('SUPABASE_URL'), mustEnv('SUPABASE_ANON_KEY'), {
      auth: { persistSession: false },
    })
    const claims = await anon.auth.getClaims(token)
    const userId = claims.data?.claims?.sub
    if (!userId || claims.data?.claims?.role !== 'authenticated')
      return jsonResponse(401, { error: 'unauthorized' }, cors)

    const parsed = MusicRequest.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return jsonResponse(400, { error: 'invalid_input' }, cors)
    const input = parsed.data

    const db = createClient(mustEnv('SUPABASE_URL'), mustEnv('SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const limits = { search: 30, preview: 120, tags: 60 } as const
    await rateLimit(db, `${input.action}:${userId}`, limits[input.action], 60)

    switch (input.action) {
      case 'search':
        return jsonResponse(200, await search(db, input.q), cors)
      case 'preview':
        return jsonResponse(200, await preview(db, input.trackId), cors)
      case 'tags':
        return jsonResponse(200, await tags(db, input.trackId), cors)
    }
  } catch (e) {
    if (e instanceof HttpError) return jsonResponse(e.status, { error: e.key }, cors)
    console.error(e)
    return jsonResponse(500, { error: 'server_error' }, cors)
  }
})
