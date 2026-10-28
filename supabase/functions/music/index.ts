// Spectra · Edge Function « music »
// Relais vers Deezer (extraits 30 s, métadonnées), iTunes (secours) et Last.fm (tags).
// Tout passe par le cache en base : on ne redemande jamais deux fois la même chose.
//
// Déploiement : coller le fichier assemblé supabase/functions-bundled/music.ts
//   (Edge Functions → Deploy a new function → Via Editor, nom : music). Laisser « Verify JWT » ACTIVÉ.
// Secrets : ALLOWED_ORIGINS (déjà créé), LASTFM_API_KEY (facultatif : sans lui, pas de tags).

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { allowedOrigins, corsHeaders, jsonResponse, mustEnv } from '../_shared/http.ts'
import {
  DeezerError,
  DeezerSearch,
  DeezerTrack,
  ItunesSearch,
  MusicRequest,
  normalizeDeezer,
  normalizeQuery,
  normalizeTags,
  parseDeezerList,
  parseItunesList,
  sameTrack,
  type NormalizedTrack,
} from './lib.ts'

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
