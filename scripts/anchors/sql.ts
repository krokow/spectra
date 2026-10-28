// Génère le SQL (idempotent) qui charge la bibliothèque d'ancrage dans Supabase.
// À coller dans le SQL Editor après la migration 0002.
import { DIMS, type Dim } from './lib.ts'

export type BuiltAnchor = {
  lang: string
  cell: string
  genres: Record<string, number>
  features: Record<Dim, number>
  confidence: number
  /** Format attendu par public.upsert_tracks (sans URL d'extrait : elles expirent). */
  track: {
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
  }
}

export function anchorsSql(anchors: BuiltAnchor[], generatedAt: string): string {
  const payload = JSON.stringify(
    anchors.map((a) => ({
      lang: a.lang,
      cell: a.cell,
      genres: a.genres,
      features: a.features,
      confidence: a.confidence,
      track: a.track,
    })),
  )
  if (payload.includes('$anchors$'))
    throw new Error('Délimiteur $anchors$ présent dans les données.')
  const cols = DIMS.join(', ')
  const values = DIMS.map((d) => `(a -> 'features' ->> '${d}')::real`).join(', ')
  const updates = DIMS.map((d) => `${d} = excluded.${d}`).join(', ')
  return `-- =============================================================================
-- Spectra · bibliothèque d'ancrage (${anchors.length} morceaux)
-- FICHIER GÉNÉRÉ par scripts/anchors/build.ts le ${generatedAt} : ne pas modifier à la main.
-- Application : Supabase → SQL Editor → coller TOUT le fichier → Run. Peut être relancé sans risque.
-- Les caractéristiques déjà calculées par l'analyseur audio ne sont jamais écrasées.
-- =============================================================================
do $do$
declare
  a     jsonb;
  v_id  uuid;
  v_ids uuid[] := '{}';
begin
  if not exists (select 1 from ops.schema_migrations where version = 2) then
    raise exception 'Applique d''abord la migration 0002 (catalogue).';
  end if;

  for a in select * from jsonb_array_elements($anchors$${payload}$anchors$::jsonb) loop
    v_id := (public.upsert_tracks(jsonb_build_array(a -> 'track')))[1];
    v_ids := v_ids || v_id;

    update public.tracks set language = case when a ->> 'lang' = '-' then 'zxx' else a ->> 'lang' end
    where id = v_id;

    insert into public.track_features (track_id, ${cols}, genre_weights, source, confidence, details)
    values (v_id, ${values}, a -> 'genres', 'curated', (a ->> 'confidence')::real,
            jsonb_build_object('anchor', true, 'generated_at', '${generatedAt}'))
    on conflict (track_id) do update
      set ${updates}, genre_weights = excluded.genre_weights, confidence = excluded.confidence,
          details = public.track_features.details || excluded.details, updated_at = now()
      where public.track_features.source in ('curated', 'estimated');

    insert into public.anchor_tracks (track_id, cell, active)
    values (v_id, a ->> 'cell', true)
    on conflict (track_id) do update set cell = excluded.cell, active = true;
  end loop;

  -- Les ancres retirées de la source sont désactivées (jamais supprimées).
  update public.anchor_tracks set active = false where not (track_id = any (v_ids));

  raise notice 'Bibliothèque d''ancrage : % morceaux chargés.', array_length(v_ids, 1);
end $do$;
`
}
