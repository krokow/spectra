-- =============================================================================
-- Spectra · migration 0002 : catalogue musical (cache)
--   artistes, morceaux, caractéristiques (12 dimensions), bibliothèque
--   d'ancrage, cache de recherche, outils pour l'Edge Function `music`.
--
-- Application : Supabase → SQL Editor → New query → coller TOUT le fichier → Run.
-- Prérequis : 0001. Tout le fichier s'exécute en une seule transaction.
-- =============================================================================

do $$
begin
  if not exists (select 1 from ops.schema_migrations where version = 1) then
    raise exception 'Applique d''abord la migration 0001.';
  end if;
  if exists (select 1 from ops.schema_migrations where version = 2) then
    raise exception 'La migration 0002 est déjà appliquée sur ce projet.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Artistes
-- ---------------------------------------------------------------------------
create table public.artists (
  id          uuid primary key default gen_random_uuid(),
  name        text not null constraint artist_name_length check (char_length(name) between 1 and 300),
  deezer_id   bigint unique,
  image_url   text,
  -- Tags Last.fm [{ "name": "...", "count": 0..100 }], et artistes similaires.
  tags        jsonb not null default '[]'::jsonb,
  similar_artists jsonb not null default '[]'::jsonb,
  fetched_at  timestamptz not null default now()
);
create index artists_name_idx on public.artists (lower(name));

-- ---------------------------------------------------------------------------
-- Morceaux
-- ---------------------------------------------------------------------------
create table public.tracks (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null constraint track_title_length check (char_length(title) between 1 and 300),
  artist_id          uuid not null references public.artists (id) on delete restrict,
  artist_name        text not null,
  album              text,
  cover_url          text,
  duration_s         integer constraint duration_positive check (duration_s is null or duration_s >= 0),
  release_year       smallint constraint release_year_range check (release_year is null or release_year between 1900 and 2100),
  language           text,
  isrc               text,
  deezer_id          bigint unique,
  itunes_id          bigint unique,
  -- Popularité Deezer (0..1 000 000), sert à la dimension « singularité ».
  rank               integer,
  bpm                real,
  gain               real,
  explicit           boolean not null default false,
  -- Les URL d'extraits Deezer sont signées et expirent : on garde l'échéance
  -- et on les rafraîchit à la lecture (action `preview` de l'Edge Function).
  preview_url        text,
  preview_source     text constraint preview_source_known check (preview_source in ('deezer', 'itunes')),
  preview_expires_at timestamptz,
  tags               jsonb not null default '[]'::jsonb,
  fetched_at         timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  constraint track_has_source check (deezer_id is not null or itunes_id is not null)
);
create index tracks_artist_idx on public.tracks (artist_id);
create index tracks_isrc_idx on public.tracks (isrc) where isrc is not null;

-- ---------------------------------------------------------------------------
-- Caractéristiques : les 12 dimensions du spectre sur [0, 1]
-- ---------------------------------------------------------------------------
create table public.track_features (
  track_id      uuid primary key references public.tracks (id) on delete cascade,
  energy        real not null check (energy     between 0 and 1),
  valence       real not null check (valence    between 0 and 1),
  acoustic      real not null check (acoustic   between 0 and 1),
  tempo         real not null check (tempo      between 0 and 1),
  dance         real not null check (dance      between 0 and 1),
  complexity    real not null check (complexity between 0 and 1),
  vocal         real not null check (vocal      between 0 and 1),
  bass          real not null check (bass       between 0 and 1),
  polish        real not null check (polish     between 0 and 1),
  warmth        real not null check (warmth     between 0 and 1),
  era           real not null check (era        between 0 and 1),
  niche         real not null check (niche      between 0 and 1),
  -- Poids par macro-genre, ex. {"electro": 0.8, "pop": 0.4}.
  genre_weights jsonb not null default '{}'::jsonb,
  -- curated = annoté à la main · estimated = métadonnées et tags · analyzed = analyse audio · fused = mélange pondéré
  source        text not null constraint features_source_known
                check (source in ('curated', 'estimated', 'analyzed', 'fused')),
  confidence    real not null default 0.5 check (confidence between 0 and 1),
  -- Détail par source (descripteurs bas niveau, version de l'analyseur…).
  details       jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Bibliothèque d'ancrage (~300 morceaux qui couvrent l'espace musical)
-- ---------------------------------------------------------------------------
create table public.anchor_tracks (
  track_id  uuid primary key references public.tracks (id) on delete cascade,
  -- Cellule de couverture (ex. "electro|2010s|high") pour garantir la répartition.
  cell      text not null,
  active    boolean not null default true,
  added_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Cache des recherches (évite de redemander la même chose à Deezer)
-- ---------------------------------------------------------------------------
create table public.search_cache (
  query      text primary key constraint query_length check (char_length(query) between 1 and 200),
  track_ids  uuid[] not null,
  fetched_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Outils réservés à l'Edge Function `music` (rôle service_role)
-- ---------------------------------------------------------------------------

-- Limite de débit utilisable depuis une Edge Function.
create function public.edge_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform ops.check_rate_limit('edge:' || p_key, p_limit, make_interval(secs => p_window_seconds));
end $$;

-- Enregistre (ou met à jour) une liste de morceaux normalisés, avec leurs
-- artistes, et renvoie leurs identifiants dans l'ordre reçu.
-- Format d'un élément : { title, artist: { name, deezer_id?, image_url? }, album?, cover_url?,
--   duration_s?, release_year?, isrc?, deezer_id?, itunes_id?, rank?, bpm?, gain?, explicit?,
--   preview_url?, preview_source?, preview_expires_at? }
create function public.upsert_tracks(p_tracks jsonb) returns uuid[]
language plpgsql volatile security definer set search_path = '' as $$
declare
  t         jsonb;
  v_artist  uuid;
  v_track   uuid;
  v_ids     uuid[] := '{}';
  v_adeezer bigint;
begin
  if jsonb_typeof(p_tracks) <> 'array' or jsonb_array_length(p_tracks) > 100 then
    raise exception 'p_tracks doit être un tableau de 100 éléments maximum.' using errcode = '22023';
  end if;

  for t in select * from jsonb_array_elements(p_tracks) loop
    v_adeezer := nullif(t -> 'artist' ->> 'deezer_id', '')::bigint;

    -- Artiste : par identifiant Deezer s'il existe, sinon par nom exact.
    if v_adeezer is not null then
      insert into public.artists (name, deezer_id, image_url)
      values (t -> 'artist' ->> 'name', v_adeezer, t -> 'artist' ->> 'image_url')
      on conflict (deezer_id) do update
        set name = excluded.name,
            image_url = coalesce(excluded.image_url, public.artists.image_url),
            fetched_at = now()
      returning id into v_artist;
    else
      select a.id into v_artist from public.artists a
      where lower(a.name) = lower(t -> 'artist' ->> 'name') limit 1;
      if v_artist is null then
        insert into public.artists (name, image_url)
        values (t -> 'artist' ->> 'name', t -> 'artist' ->> 'image_url')
        returning id into v_artist;
      end if;
    end if;

    -- Morceau : par identifiant Deezer, sinon iTunes.
    select tr.id into v_track from public.tracks tr
    where (t ? 'deezer_id' and tr.deezer_id = (t ->> 'deezer_id')::bigint)
       or (t ? 'itunes_id' and tr.itunes_id = (t ->> 'itunes_id')::bigint)
    limit 1;

    if v_track is null then
      insert into public.tracks (
        title, artist_id, artist_name, album, cover_url, duration_s, release_year, isrc,
        deezer_id, itunes_id, rank, bpm, gain, explicit, preview_url, preview_source, preview_expires_at
      ) values (
        t ->> 'title', v_artist, t -> 'artist' ->> 'name', t ->> 'album', t ->> 'cover_url',
        (t ->> 'duration_s')::integer, (t ->> 'release_year')::smallint, t ->> 'isrc',
        (t ->> 'deezer_id')::bigint, (t ->> 'itunes_id')::bigint, (t ->> 'rank')::integer,
        (t ->> 'bpm')::real, (t ->> 'gain')::real, coalesce((t ->> 'explicit')::boolean, false),
        t ->> 'preview_url', t ->> 'preview_source', (t ->> 'preview_expires_at')::timestamptz
      )
      returning id into v_track;
    else
      update public.tracks tr set
        title              = coalesce(t ->> 'title', tr.title),
        artist_id          = v_artist,
        artist_name        = coalesce(t -> 'artist' ->> 'name', tr.artist_name),
        album              = coalesce(t ->> 'album', tr.album),
        cover_url          = coalesce(t ->> 'cover_url', tr.cover_url),
        duration_s         = coalesce((t ->> 'duration_s')::integer, tr.duration_s),
        release_year       = coalesce((t ->> 'release_year')::smallint, tr.release_year),
        isrc               = coalesce(t ->> 'isrc', tr.isrc),
        deezer_id          = coalesce((t ->> 'deezer_id')::bigint, tr.deezer_id),
        itunes_id          = coalesce((t ->> 'itunes_id')::bigint, tr.itunes_id),
        rank               = coalesce((t ->> 'rank')::integer, tr.rank),
        bpm                = coalesce((t ->> 'bpm')::real, tr.bpm),
        gain               = coalesce((t ->> 'gain')::real, tr.gain),
        explicit           = coalesce((t ->> 'explicit')::boolean, tr.explicit),
        preview_url        = coalesce(t ->> 'preview_url', tr.preview_url),
        preview_source     = coalesce(t ->> 'preview_source', tr.preview_source),
        preview_expires_at = coalesce((t ->> 'preview_expires_at')::timestamptz, tr.preview_expires_at),
        fetched_at         = now()
      where tr.id = v_track;
    end if;

    v_ids := v_ids || v_track;
    v_artist := null;
    v_track := null;
  end loop;
  return v_ids;
end $$;

-- ---------------------------------------------------------------------------
-- RLS : le catalogue est lisible par toute personne connectée,
-- modifiable uniquement côté serveur (Edge Function / scripts).
-- ---------------------------------------------------------------------------
alter table public.artists        enable row level security;
alter table public.tracks         enable row level security;
alter table public.track_features enable row level security;
alter table public.anchor_tracks  enable row level security;
alter table public.search_cache   enable row level security;

create policy artists_read on public.artists for select to authenticated using (true);
create policy tracks_read on public.tracks for select to authenticated using (true);
create policy track_features_read on public.track_features for select to authenticated using (true);
create policy anchor_tracks_read on public.anchor_tracks for select to authenticated using (active);
-- search_cache : aucune policy → aucun accès via l'API pour les utilisateurs.

revoke all on public.artists, public.tracks, public.track_features, public.anchor_tracks, public.search_cache
  from public, anon, authenticated;
grant select on public.artists, public.tracks, public.track_features, public.anchor_tracks to authenticated;
grant select, insert, update, delete
  on public.artists, public.tracks, public.track_features, public.anchor_tracks, public.search_cache
  to service_role;

revoke execute on function public.edge_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.upsert_tracks(jsonb) from public, anon, authenticated;
grant execute on function public.edge_rate_limit(text, integer, integer) to service_role;
grant execute on function public.upsert_tracks(jsonb) to service_role;

insert into ops.schema_migrations (version, name) values (2, 'catalog');
