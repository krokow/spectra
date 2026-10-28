-- =============================================================================
-- Spectra · migration 0001 : fondations
--   identité (profils + réglages de confidentialité), amitiés (lecture seule),
--   limites de débit, codes de secours, connexion par pseudo, export RGPD,
--   suppression de compte, administrateurs.
--
-- Application : Supabase → SQL Editor → New query → coller TOUT le fichier → Run.
-- Une seule fois. Le fichier refuse de s'exécuter deux fois.
-- Tout le fichier s'exécute en une seule transaction : en cas d'erreur, rien n'est appliqué.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Suivi des migrations (schéma privé, jamais exposé par l'API)
-- ---------------------------------------------------------------------------
create schema if not exists ops;
revoke all on schema ops from public;

create table if not exists ops.schema_migrations (
  version    integer primary key,
  name       text        not null,
  applied_at timestamptz not null default now()
);

do $$
begin
  if exists (select 1 from ops.schema_migrations where version = 1) then
    raise exception 'La migration 0001 est déjà appliquée sur ce projet.';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Extensions (Supabase les range dans le schéma "extensions")
-- ---------------------------------------------------------------------------
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.visibility as enum ('public', 'friends', 'private');
create type public.friendship_status as enum ('pending', 'accepted', 'blocked');

-- ---------------------------------------------------------------------------
-- Limites de débit (utilisées par toutes les RPC sensibles)
-- ---------------------------------------------------------------------------
create table ops.rate_limits (
  key          text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 0,
  primary key (key, window_start)
);

-- IP du client telle que transmise par l'API Supabase (ou 'unknown').
create function ops.client_ip() returns text
language sql stable set search_path = '' as $$
  select coalesce(
    nullif(current_setting('request.headers', true), '')::json ->> 'cf-connecting-ip',
    split_part(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ',', 1),
    'unknown'
  )
$$;

-- Lève une erreur HTTP 429 (code PostgREST PT429) si la limite est dépassée.
create function ops.check_rate_limit(p_key text, p_limit integer, p_window interval)
returns void
language plpgsql volatile set search_path = '' as $$
declare
  v_start timestamptz := to_timestamp(
    floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window)
  );
  v_hits integer;
begin
  insert into ops.rate_limits as r (key, window_start, hits)
  values (p_key, v_start, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- Ménage opportuniste des vieilles fenêtres (≈ 1 appel sur 100).
  if random() < 0.01 then
    delete from ops.rate_limits where window_start < now() - interval '2 days';
  end if;

  if v_hits > p_limit then
    raise exception 'Trop de tentatives, réessaie dans un moment.'
      using errcode = 'PT429', hint = 'rate_limited';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Profils : carte publique (pseudo, nom affiché, avatar)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  -- Casse conservée à l'affichage, unicité insensible à la casse (index plus bas).
  username     text not null
               constraint username_format check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  display_name text constraint display_name_length check (char_length(btrim(display_name)) between 1 and 40),
  -- Graine de l'avatar généré (dégradé « spectre » + initiales) : aucun fichier stocké.
  avatar_seed  text not null default encode(extensions.gen_random_bytes(6), 'hex')
               constraint avatar_seed_format check (avatar_seed ~ '^[0-9a-f]{6,32}$'),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index profiles_username_key on public.profiles (lower(username));

comment on table public.profiles is 'Carte publique d''un utilisateur. L''e-mail n''y figure jamais.';

-- Réglages privés : visibles et modifiables par leur seul propriétaire.
create table public.profile_settings (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  locale              text not null default 'fr' constraint locale_supported check (locale in ('fr', 'en')),
  profile_visibility  public.visibility not null default 'friends',
  stats_visibility    public.visibility not null default 'friends',
  activity_visibility public.visibility not null default 'friends',
  searchable          boolean not null default true,
  twins_opt_in        boolean not null default false,
  birth_year          smallint constraint birth_year_range check (birth_year between 1920 and 2100),
  updated_at          timestamptz not null default now()
);

-- Pseudos réservés (stockés en minuscules).
create table ops.reserved_usernames (username text primary key check (username = lower(username)));
insert into ops.reserved_usernames (username) values
  ('admin'), ('administrator'), ('root'), ('spectra'), ('support'), ('help'), ('moderator'),
  ('modo'), ('system'), ('null'), ('undefined'), ('anonymous'), ('me'), ('settings'), ('api');

-- ---------------------------------------------------------------------------
-- Amitiés (les mutations arriveront à l'étape 7, uniquement via RPC)
--   « blocked » : requester = la personne qui bloque.
-- ---------------------------------------------------------------------------
create table public.friendships (
  id           bigint generated always as identity primary key,
  requester    uuid not null references auth.users (id) on delete cascade,
  addressee    uuid not null references auth.users (id) on delete cascade,
  status       public.friendship_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  constraint friendship_not_self check (requester <> addressee)
);
create unique index friendships_pair_key
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index friendships_addressee_idx on public.friendships (addressee);

-- ---------------------------------------------------------------------------
-- Administrateurs (rempli à la main dans le SQL Editor)
-- ---------------------------------------------------------------------------
create table public.app_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Codes de secours (hachés bcrypt ; jamais lisibles par l'API)
-- ---------------------------------------------------------------------------
create table public.recovery_codes (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  code_hash  text not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index recovery_codes_user_idx on public.recovery_codes (user_id) where used_at is null;

-- ---------------------------------------------------------------------------
-- Fonctions d'aide à la visibilité (security definer : lisent hors RLS,
-- ne renvoient qu'un booléen)
-- ---------------------------------------------------------------------------
create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid())
$$;

create function public.is_friend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and least(f.requester, f.addressee) = least(a, b)
      and greatest(f.requester, f.addressee) = greatest(a, b)
  )
$$;

create function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'blocked'
      and least(f.requester, f.addressee) = least(a, b)
      and greatest(f.requester, f.addressee) = greatest(a, b)
  )
$$;

-- La personne connectée peut-elle voir une donnée de `owner` au niveau `level` ?
create function public.can_view(owner uuid, level public.visibility) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when auth.uid() is null then false
    when owner = auth.uid() then true
    when public.is_blocked(owner, auth.uid()) then false
    when level = 'public' then true
    when level = 'friends' then public.is_friend(owner, auth.uid())
    else false
  end
$$;

-- Carte de profil visible : selon profile_visibility, ou si une demande d'ami
-- est en cours entre les deux (pour pouvoir l'afficher), sauf blocage.
create function public.can_view_profile(owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select
    public.can_view(owner, coalesce(
      (select s.profile_visibility from public.profile_settings s where s.user_id = owner),
      'private'
    ))
    or (
      auth.uid() is not null
      and not public.is_blocked(owner, auth.uid())
      and exists (
        select 1 from public.friendships f
        where f.status = 'pending'
          and least(f.requester, f.addressee) = least(owner, auth.uid())
          and greatest(f.requester, f.addressee) = greatest(owner, auth.uid())
      )
    )
$$;

create function public.can_view_stats(owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_view(owner, coalesce(
    (select s.stats_visibility from public.profile_settings s where s.user_id = owner),
    'private'
  ))
$$;

create function public.can_view_activity(owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.can_view(owner, coalesce(
    (select s.activity_visibility from public.profile_settings s where s.user_id = owner),
    'private'
  ))
$$;

-- ---------------------------------------------------------------------------
-- Pseudos : validation et disponibilité
-- ---------------------------------------------------------------------------
create function public.username_problem(p_username text) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when p_username is null or p_username !~ '^[A-Za-z0-9_]{3,20}$' then 'format'
    when exists (select 1 from ops.reserved_usernames r where r.username = lower(p_username)) then 'reserved'
    when exists (select 1 from public.profiles p where lower(p.username) = lower(p_username)) then 'taken'
    else null
  end
$$;

-- Appelée par le formulaire d'inscription (donc sans être connecté).
create function public.username_available(p_username text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform ops.check_rate_limit('username:' || ops.client_ip(), 60, interval '1 minute');
  return public.username_problem(p_username) is null;
end $$;

-- ---------------------------------------------------------------------------
-- Création automatique du profil à l'inscription
--   Le pseudo arrive dans les métadonnées d'inscription (options.data.username).
--   S'il est invalide ou pris, l'inscription échoue (le formulaire vérifie avant).
-- ---------------------------------------------------------------------------
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_username text := btrim(new.raw_user_meta_data ->> 'username');
  v_locale   text := coalesce(new.raw_user_meta_data ->> 'locale', 'fr');
  v_problem  text := public.username_problem(v_username);
begin
  if v_problem is not null then
    raise exception 'Pseudo invalide (%).', v_problem using errcode = '23514';
  end if;
  insert into public.profiles (id, username) values (new.id, v_username);
  insert into public.profile_settings (user_id, locale)
  values (new.id, case when v_locale in ('fr', 'en') then v_locale else 'fr' end);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at automatique
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger profile_settings_touch before update on public.profile_settings
  for each row execute function public.touch_updated_at();

-- Un changement de pseudo passe par les mêmes règles (réservés compris).
create function public.check_username_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.username is distinct from old.username then
    if exists (select 1 from ops.reserved_usernames r where r.username = lower(new.username)) then
      raise exception 'Pseudo réservé.' using errcode = '23514';
    end if;
    perform ops.check_rate_limit('rename:' || old.id::text, 5, interval '1 day');
  end if;
  return new;
end $$;

create trigger profiles_username_change before update of username on public.profiles
  for each row execute function public.check_username_change();

-- ---------------------------------------------------------------------------
-- Connexion par pseudo
--   Renvoie l'e-mail UNIQUEMENT si le mot de passe est correct : l'e-mail
--   d'un tiers ne peut donc jamais être découvert. Le client se connecte
--   ensuite normalement avec cet e-mail.
-- ---------------------------------------------------------------------------
create function public.login_email_for(p_username text, p_password text) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_email text;
  v_hash  text;
  -- Hash factice : même coût de calcul si le pseudo n'existe pas (pas d'oracle temporel).
  v_dummy constant text := '$2a$10$cPqOgGbZ67C8R68OVS6DyeennaoZvI/mmu0e0StUioLQSBLLuzY4G';
begin
  perform ops.check_rate_limit('login-ip:' || ops.client_ip(), 30, interval '15 minutes');
  perform ops.check_rate_limit('login-user:' || lower(coalesce(p_username, '')), 10, interval '15 minutes');

  select u.email, u.encrypted_password into v_email, v_hash
  from public.profiles p
  join auth.users u on u.id = p.id
  where lower(p.username) = lower(p_username);

  if v_hash is null then
    perform extensions.crypt(coalesce(p_password, ''), v_dummy);
    return null;
  end if;
  if extensions.crypt(coalesce(p_password, ''), v_hash) = v_hash then
    return v_email;
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- Codes de secours
-- ---------------------------------------------------------------------------
-- Génère 8 nouveaux codes (remplace les anciens) et les renvoie EN CLAIR une seule fois.
create function public.generate_recovery_codes() returns text[]
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid      uuid := auth.uid();
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sans 0/O/1/I
  v_codes    text[] := '{}';
  v_code     text;
  v_bytes    bytea;
begin
  if v_uid is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  perform ops.check_rate_limit('recovery-gen:' || v_uid::text, 5, interval '1 hour');

  delete from public.recovery_codes where user_id = v_uid;
  for i in 1..8 loop
    v_bytes := extensions.gen_random_bytes(8);
    v_code := '';
    for j in 0..7 loop
      v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, j) % 32) + 1, 1);
      if j = 3 then v_code := v_code || '-'; end if;
    end loop;
    v_codes := v_codes || v_code;
    insert into public.recovery_codes (user_id, code_hash)
    values (v_uid, extensions.crypt(v_code, extensions.gen_salt('bf', 8)));
  end loop;
  return v_codes;
end $$;

create function public.recovery_codes_remaining() returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.recovery_codes where user_id = auth.uid() and used_at is null
$$;

-- Réservé à l'Edge Function `account-recover` (rôle service_role).
-- Vérifie un code pour un e-mail ou un pseudo ; renvoie l'id du code valide, sinon null.
create function public.find_recovery_code(p_identifier text, p_code text, p_ip text)
returns table (user_id uuid, code_id bigint)
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid;
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  perform ops.check_rate_limit('recover-ip:' || coalesce(p_ip, 'unknown'), 20, interval '1 hour');
  perform ops.check_rate_limit('recover-id:' || lower(coalesce(p_identifier, '')), 5, interval '1 hour');

  if position('@' in coalesce(p_identifier, '')) > 0 then
    select u.id into v_uid from auth.users u where lower(u.email) = lower(btrim(p_identifier));
  else
    select p.id into v_uid from public.profiles p where lower(p.username) = lower(btrim(p_identifier));
  end if;
  if v_uid is null then
    return;
  end if;

  return query
    select rc.user_id, rc.id
    from public.recovery_codes rc
    where rc.user_id = v_uid
      and rc.used_at is null
      and extensions.crypt(v_code, rc.code_hash) = rc.code_hash
    limit 1;
end $$;

-- Marque le code comme utilisé (les sessions sont fermées par l'Edge Function
-- via l'API d'administration officielle).
create function public.consume_recovery_code(p_code_id bigint) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid;
begin
  update public.recovery_codes set used_at = now()
  where id = p_code_id and used_at is null
  returning user_id into v_uid;
  if v_uid is null then
    raise exception 'Code déjà utilisé.' using errcode = '22023';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RGPD : export de mes données et suppression de compte
--   (les migrations suivantes complètent export_my_data avec leurs tables)
-- ---------------------------------------------------------------------------
create function public.export_my_data() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'exported_at', now(),
    'format_version', 1,
    'account', (select jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at)
                from auth.users u where u.id = v_uid),
    'profile', (select to_jsonb(p) from public.profiles p where p.id = v_uid),
    'settings', (select to_jsonb(s) - 'user_id' from public.profile_settings s where s.user_id = v_uid),
    'friendships', coalesce((select jsonb_agg(to_jsonb(f) order by f.created_at)
                             from public.friendships f
                             where v_uid in (f.requester, f.addressee)), '[]'::jsonb),
    'recovery_codes_remaining', public.recovery_codes_remaining()
  );
end $$;

-- Suppression définitive : toutes les tables suivent par ON DELETE CASCADE.
create function public.delete_my_account(p_confirm_username text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = v_uid and lower(username) = lower(p_confirm_username)
  ) then
    raise exception 'Le pseudo de confirmation ne correspond pas.' using errcode = '22023';
  end if;
  delete from auth.users where id = v_uid;
end $$;

-- ---------------------------------------------------------------------------
-- RLS : activée partout, refus par défaut, policies explicites
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.profile_settings enable row level security;
alter table public.friendships      enable row level security;
alter table public.app_admins       enable row level security;
alter table public.recovery_codes   enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (public.can_view_profile(id));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy settings_select_own on public.profile_settings
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy settings_update_own on public.profile_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Un blocage n'est visible que par la personne qui bloque.
create policy friendships_select_own on public.friendships
  for select to authenticated
  using (
    requester = (select auth.uid())
    or (addressee = (select auth.uid()) and status <> 'blocked')
  );

-- app_admins et recovery_codes : aucune policy → aucun accès via l'API.

-- ---------------------------------------------------------------------------
-- Droits : rien n'est exposé par défaut, on accorde au cas par cas
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.profile_settings, public.friendships,
              public.app_admins, public.recovery_codes
  from public, anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, avatar_seed, username) on public.profiles to authenticated;
grant select on public.profile_settings to authenticated;
grant update (locale, profile_visibility, stats_visibility, activity_visibility,
              searchable, twins_opt_in, birth_year)
  on public.profile_settings to authenticated;
grant select on public.friendships to authenticated;

-- Les fonctions sont exécutables par PUBLIC par défaut dans Postgres : on retire tout.
revoke execute on all functions in schema public from public, anon, authenticated;
revoke all on all tables in schema ops from public, anon, authenticated;
revoke execute on all functions in schema ops from public, anon, authenticated;

grant execute on function public.username_available(text)          to anon, authenticated;
grant execute on function public.login_email_for(text, text)       to anon;
grant execute on function public.generate_recovery_codes()          to authenticated;
grant execute on function public.recovery_codes_remaining()         to authenticated;
grant execute on function public.export_my_data()                   to authenticated;
grant execute on function public.delete_my_account(text)            to authenticated;
-- Utilisées dans les policies : doivent être exécutables par le rôle qui lit.
grant execute on function public.can_view_profile(uuid)             to authenticated;
grant execute on function public.can_view_stats(uuid)               to authenticated;
grant execute on function public.can_view_activity(uuid)            to authenticated;
grant execute on function public.is_admin()                         to authenticated;
-- Edge Function de récupération uniquement.
grant execute on function public.find_recovery_code(text, text, text) to service_role;
grant execute on function public.consume_recovery_code(bigint)        to service_role;

insert into ops.schema_migrations (version, name) values (1, 'foundation');
