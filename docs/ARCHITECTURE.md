# Spectra : plan d'architecture (étape 1, à valider)

> Statut : **validé le 28/10/2026**, avec les arbitrages du §0bis (qui priment sur le reste du document).
> Sources de vérité : prompt principal + `ADDENDUM v3` (qui prévaut) + `supabase/seed/questions.json`.
> URL cible : `https://krokow.github.io/spectra/` (dépôt public `krokow/spectra`, `base` Vite = `/spectra/`).

---

## 0. Décisions structurantes (résumé)

| #   | Décision                                                                                                                                                                                                                                                                                                                                                                         | Pourquoi                                                                                                                                                                                                                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Le moteur de profilage vit dans Postgres (plpgsql)** : `submit_answer`, `recompute_profile`, `next_question` sont des RPC. Un **miroir TypeScript pur** (`src/engine`) sert au mode « avant compte » et à l'animation optimiste. Les deux implémentations passent les **mêmes fixtures de conformité** (`src/engine/fixtures/*.json`).                                         | 0 € : une réponse = 1 appel PostgREST, pas 1 invocation d'Edge Function (quota 500 k/mois). Le calcul reste côté serveur, comme demandé.                                                                                                                                                     |
| D2  | **Edge Functions réservées aux API externes** (Deezer, iTunes, Last.fm, features audio) + suppression de compte. Une seule fonction `music` routée (moins de cold starts), plus `account-delete`.                                                                                                                                                                                | Clés tierces uniquement dans les secrets des fonctions ; CORS restreint ; rate limit.                                                                                                                                                                                                        |
| D3  | **Cache d'abord** : le client lit `tracks`/`track_features` via PostgREST et n'appelle `music` que si la donnée manque ou si l'URL d'extrait a expiré.                                                                                                                                                                                                                           | Discipline de quota.                                                                                                                                                                                                                                                                         |
| D4  | **HashRouter** (`/#/spectre`) + Supabase Auth en **PKCE**.                                                                                                                                                                                                                                                                                                                       | GitHub Pages ne sait pas réécrire les URL ; le hash évite le hack `404.html` (qui renvoie un vrai statut 404) et marche dès le premier chargement d'un lien partagé. PKCE renvoie `?code=` en query, donc pas de conflit avec le hash. _À valider (alternative : BrowserRouter + 404.html)._ |
| D5  | **Avant compte : tout en local** (moteur TS + `localStorage`), puis RPC `import_local_answers` à l'inscription, qui valide et **rejoue** les réponses côté serveur.                                                                                                                                                                                                              | Conforme au prompt, pas de lignes en base pour des visiteurs anonymes. _Alternative : Supabase Anonymous Sign-ins (plus simple, mais compte des MAU et crée des utilisateurs fantômes)._                                                                                                     |
| D6  | **Mise à jour du profil = filtre de Kalman 1D du JSON**, exactement. Les duels « descriptifs » du JSON utilisent `sig`. J'ajoute un type généré **`track_duel`** (deux ancres qui diffèrent surtout sur la dimension la plus floue), mis à jour à partir des vraies features des morceaux : c'est la partie « Bradley-Terry » du prompt principal, exprimée dans le même modèle. | L'addendum prévaut, et la banque (30 questions) s'épuiserait vite sans questions générées.                                                                                                                                                                                                   |
| D7  | **Features audio : estimateur maison prioritaire** (tags Last.fm + genres + `bpm`/`rank`/date de Deezer), ReccoBeats **optionnel derrière un flag**.                                                                                                                                                                                                                             | Statut de ReccoBeats incertain (voir §6).                                                                                                                                                                                                                                                    |
| D8  | **Planification avec `pg_cron` + `pg_net`** (inclus dans Supabase Free) pour les précalculs : découverte du jour, défis hebdo, voisinage collaboratif. GitHub Actions seulement pour keepalive et sauvegarde.                                                                                                                                                                    | Pas de polling, pas de service payant.                                                                                                                                                                                                                                                       |
| D9  | **Validation unique** : schémas Zod (`src/schemas`) → JSON Schema généré → vérifié en base via `pg_jsonschema` (questions, payloads de réponses).                                                                                                                                                                                                                                | Le même contrat côté client, Edge Functions et SQL.                                                                                                                                                                                                                                          |
| D10 | Pas de LLM ni de service génératif : l'« ADN musical » (archétype) est produit par des **gabarits déterministes** (dimensions dominantes + genres).                                                                                                                                                                                                                              | 0 €, reproductible, testable.                                                                                                                                                                                                                                                                |

## 0bis. Arbitrages validés (28/10/2026)

| Sujet                | Décision                                                                                                                                                                                                                                                                                                                      |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routage              | **HashRouter** + Auth en PKCE (D4 confirmé).                                                                                                                                                                                                                                                                                  |
| E-mails              | (mise à jour du 28/10) Inscription **e-mail + mot de passe + pseudo unique**, connexion par e-mail **ou** pseudo (Edge Function qui résout le pseudo, rate limitée, ne renvoie jamais l'e-mail). Pas d'OAuth. **Aucun e-mail envoyé** : « Confirm email » désactivé, pas de SMTP. Mot de passe oublié : **codes de secours**. |
| Accès                | **Pas de compte, pas d'accès** : la seule page publique est l'écran d'accueil/connexion. D5 (mode local + `import_local_answers`) est **supprimé**.                                                                                                                                                                           |
| Features audio       | **Calcul 100 % maison** par notre propre analyseur audio (§7bis), fusionné avec les métadonnées (date, popularité, tags). ReccoBeats est **abandonné**.                                                                                                                                                                       |
| Duels                | Duels descriptifs du JSON + `track_duel` générés (D6 confirmé).                                                                                                                                                                                                                                                               |
| Déploiement Supabase | **Manuel**, sans token dans GitHub : SQL Editor pour les migrations (traçées dans `ops.schema_migrations`), tableau de bord pour les Edge Functions. Les tests (pgTAP, RLS) tournent quand même en CI sur une base Supabase locale.                                                                                           |
| Moteur               | plpgsql (RPC) comme source de vérité, plus un miroir TS pur pour l'animation optimiste et les tests de propriétés (D1 confirmé).                                                                                                                                                                                              |

---

## 1. Arborescence

```
spectra/
├─ .github/workflows/
│  ├─ ci.yml                 # lint, typecheck, unit, build, gitleaks, tests SQL (pgTAP), e2e
│  ├─ deploy-pages.yml       # build + actions/deploy-pages (sur main)
│  ├─ keepalive.yml          # ping tous les 3 jours (anti-pause Supabase + anti-désactivation GitHub)
│  ├─ backup.yml             # pg_dump hebdo, chiffré (age, clé publique), artefact 30 j
│  ├─ anchors.yml            # manuel : (re)construit la bibliothèque d'ancrage (réseau Deezer)
│  └─ analyze.yml            # nocturne/manuel : analyse audio maison des morceaux en cache (§7bis)
├─ design/brand/             # SVG fournis (icône, maskable, wordmark)
├─ docs/
│  ├─ ARCHITECTURE.md        # ce document
│  ├─ PROFILE_ENGINE.md      # spec détaillée du moteur (étape 5)
│  ├─ FREE_TIER_BUDGET.md    # quotas, conso estimée, seuils, plan B
│  ├─ SETUP_SUPABASE.md      # pas à pas débutant (projet, auth, OAuth, secrets)
│  └─ SETUP_GITHUB.md        # Pages, variables, secrets, protections
├─ public/                   # icônes générées (non éditées à la main), robots.txt
├─ scripts/
│  ├─ brand/generate-icons.ts      # @vite-pwa/assets-generator + sharp depuis design/brand
│  ├─ anchors/build.ts             # résout les ancres via Deezer (+ features), écrit anchors.json
│  ├─ anchors/validate.ts          # couverture de l'espace, extraits joignables, doublons
│  ├─ seed/questions-to-sql.ts     # questions.json → SQL idempotent (upsert)
│  └─ schemas/export-jsonschema.ts # Zod → JSON Schema pour pg_jsonschema
├─ src/
│  ├─ app/                   # routes, providers (Query, i18n, thème, auth), layout, nav
│  ├─ components/ui/         # shadcn/ui (copiés, thémés)
│  ├─ components/            # Spectrum, RadarChart, SwipeCard, Player, ShareCard, LogoAnimated…
│  ├─ features/
│  │  ├─ onboarding/         # parcours 12 questions, révélation finale
│  │  ├─ questions/          # un composant par type (duel, vibes, slider, scenario, bubbles, era, languages, track_duel)
│  │  ├─ spectrum/           # Mon spectre, précision, timeline, édition manuelle, historique
│  │  ├─ discover/           # recos, swipe, découverte du jour, curseur bulle
│  │  ├─ friends/            # demandes, recherche, fil, envois, réactions, compatibilité, passerelles, devine
│  │  ├─ playlists/          # génération N amis, édition temps réel, votes, export
│  │  ├─ games/              # blind test, défis, badges, streaks, jumeaux
│  │  ├─ profile/            # compte, avatar, confidentialité, export RGPD, suppression
│  │  └─ admin/              # éditeur de questions (réservé aux admins)
│  ├─ engine/                # MIROIR TS PUR du moteur (aucune dépendance navigateur/Deno)
│  │  ├─ kalman.ts  genres.ts  replay.ts  nextQuestion.ts  vector.ts  archetype.ts
│  │  └─ fixtures/           # cas de conformité partagés TS ↔ SQL
│  ├─ providers/             # interface MusicProvider + clients (appellent l'Edge Function `music`)
│  ├─ player/                # store Zustand du lecteur global, waveform dérivée des features
│  ├─ lib/                   # supabase client, query keys, haptique, view transitions, csp helpers
│  ├─ schemas/               # Zod : questions, réponses, profils, réponses d'API
│  ├─ i18n/fr/*.json, en/*.json
│  └─ styles/tokens.css      # design tokens (dark par défaut + light)
├─ supabase/
│  ├─ config.toml
│  ├─ migrations/            # schéma versionné (une migration par étape fonctionnelle)
│  ├─ functions/
│  │  ├─ _shared/            # cors.ts, ratelimit.ts, zod schemas, provider adapters (Deno)
│  │  ├─ music/index.ts      # search | track | preview | artist-similar | tags | features
│  │  └─ account-delete/index.ts
│  ├─ seed/
│  │  ├─ questions.json      # banque fournie (source de vérité)
│  │  ├─ anchors/anchors.source.csv  # liste curée artiste/titre/langue/décennie/genres + estimations
│  │  └─ anchors/anchors.json        # sortie du build (ids Deezer, ISRC, features, provenance)
│  ├─ seed.sql               # seed de dev (généré à partir des fichiers ci-dessus + users de test)
│  └─ tests/*.test.sql       # pgTAP : RLS, moteur (fixtures), RPC
├─ tests/e2e/                # Playwright : onboarding anonyme → inscription ; swipe ; playlist commune
├─ .env.example  .gitignore  .gitleaks.toml  eslint.config.js  .prettierrc
├─ index.html  vite.config.ts  tailwind.config.ts  tsconfig*.json
└─ README.md
```

Types TS générés : `supabase gen types typescript --local > src/lib/database.types.ts` (script `npm run db:types`, vérifié en CI : échec si le fichier n'est pas à jour).

---

## 2. Schéma de données

Conventions : `uuid` partout, `created_at timestamptz default now()`, suppression de compte en `ON DELETE CASCADE` depuis `auth.users`. **RLS activée sur chaque table** ; les policies listées sont les seules existantes (refus par défaut).

### 2.1 Identité et confidentialité

| Table                | Colonnes clés                                                                                                                                                                                                                                                                         | RLS                                                                                                                                                            |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`           | `id` (= auth.uid), `username` citext unique, `display_name`, `avatar_url`, `locale`, `visibility` enum (`public`/`friends`/`private`), `stats_visibility` enum (idem), `activity_visibility`, `searchable` bool, `twins_opt_in` bool, `birth_year` (optionnel, sert à « tes 15 ans ») | select : soi, ou `can_view(id, visibility)` ; update : soi (colonnes limitées par `GRANT` colonne par colonne)                                                 |
| `app_admins`         | `user_id`                                                                                                                                                                                                                                                                             | aucun accès client ; lecture via `is_admin()` security definer. Rempli à la main en SQL par toi.                                                               |
| `friendships`        | `requester`, `addressee`, `status` (`pending`/`accepted`/`blocked`), contrainte d'unicité sur la paire ordonnée                                                                                                                                                                       | select : les deux parties ; insert : `requester = auth.uid()` ; update : `addressee` peut accepter/refuser, les deux peuvent supprimer ; `blocked` masque tout |
| `rate_limits`        | `key`, `window_start`, `count`                                                                                                                                                                                                                                                        | aucun accès client ; `check_rate_limit()` security definer                                                                                                     |
| `push_subscriptions` | `user_id`, `endpoint`, `keys`                                                                                                                                                                                                                                                         | soi uniquement                                                                                                                                                 |

Fonctions d'aide (toutes `security definer`, `stable`, `search_path` figé) :
`is_friend(a, b)`, `can_view(owner, level)` (public, ou ami accepté si `friends`, ou soi), `can_view_stats(owner)`, `is_admin()`.

### 2.2 Catalogue musical (cache)

| Table             | Colonnes clés                                                                                                                                                                                                                           | RLS                                                                     |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `artists`         | `id`, `name`, `deezer_id`, `lastfm_mbid`, `image_url`, `tags` jsonb, `similar` jsonb, `fetched_at`                                                                                                                                      | select : tous (même anonymes) ; écriture : service role (Edge Function) |
| `tracks`          | `id`, `title`, `artist_id`, `album`, `cover_url`, `duration`, `release_year`, `language`, `isrc`, `deezer_id`, `itunes_id`, `preview_url`, `preview_source`, `preview_expires_at`, `rank` (popularité Deezer), `explicit`, `fetched_at` | idem                                                                    |
| `track_features`  | `track_id`, 12 colonnes `0..1` (une par dimension), `genre_weights` jsonb, `source` (`curated`/`reccobeats`/`estimated`), `confidence` 0..1, `embedding vector(32)` (index HNSW)                                                        | idem                                                                    |
| `anchor_tracks`   | `track_id`, `cell` (cellule de couverture), `active`                                                                                                                                                                                    | idem                                                                    |
| `tag_feature_map` | `tag`, effets sur les dimensions et genres                                                                                                                                                                                              | select : tous ; écriture : admin                                        |

### 2.3 Moteur de profilage

| Table                | Colonnes clés                                                                                                                                                                                                                                                                                                                                         | RLS                                                                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `questions`          | `id` (`q01`…), `type`, `tier`, `payload` jsonb (validé par `pg_jsonschema`), `i18n` jsonb (fr/en), `active`, `version`                                                                                                                                                                                                                                | select : tous ; écriture : `is_admin()`                                                                                                                              |
| `question_options`   | `question_id`, `option_id`, `payload` jsonb (obs, genres, params, languages…), `position`                                                                                                                                                                                                                                                             | idem                                                                                                                                                                 |
| `answers`            | `id`, `user_id`, `question_id`, `question_version`, `kind` (`question`/`track_duel`/`swipe`/`manual_edit`), `payload` jsonb (choix, ids de morceaux, valeur du curseur…), `answered_at`, `revoked_at`, `replaced_by`                                                                                                                                  | select/insert/update : soi uniquement. Update limité à `revoked_at` (annulation). Jamais de delete client (historique conservé ; supprimé seulement avec le compte). |
| `taste_profiles`     | `user_id`, pour chaque dimension `<dim>_mean`, `<dim>_var` (24 colonnes lisibles), `genre_weights` jsonb, `subgenre_weights` jsonb, `genre_evidence` jsonb, `exclusions` text[], `params` jsonb (openness, nostalgia, languages), `precision` (0..1), `embedding vector(32)` (HNSW), `archetype` jsonb, `originality`, `answers_count`, `computed_at` | select : soi, ou `can_view_stats(user_id)` ; **aucune écriture client** : seules les RPC (security definer) écrivent                                                 |
| `taste_snapshots`    | `id`, `user_id`, `taken_at`, `reason` (`onboarding`/`retake`/`weekly`/`manual`), copie figée du profil                                                                                                                                                                                                                                                | select : comme `taste_profiles` ; écriture : RPC                                                                                                                     |
| `question_exposures` | `user_id`, `question_id`, `shown_at` (fraîcheur, sans compter comme réponse)                                                                                                                                                                                                                                                                          | soi                                                                                                                                                                  |

### 2.4 Recos, social, jeux

| Table                                                    | Rôle                                                                                              | RLS (résumé)                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `user_likes`                                             | like / save / plus / moins / skip sur un morceau                                                  | soi ; lecture amis si `stats_visibility` le permet            |
| `recommendations_log`                                    | reco servie, score, `reasons` jsonb, action prise                                                 | soi                                                           |
| `daily_discoveries`                                      | précalcul pg_cron de la découverte du jour                                                        | soi                                                           |
| `activity`                                               | fil (écrit par triggers : nouvel ami, badge, playlist, partage)                                   | select : auteur + amis selon `activity_visibility`            |
| `track_shares`                                           | envoi d'un morceau à un ami + mot                                                                 | expéditeur et destinataire                                    |
| `reactions`                                              | réactions sur `activity` / `track_shares`                                                         | auteur ; visibles de qui voit l'objet                         |
| `playlists`                                              | `owner`, `title`, `energy_curve` jsonb, `params`, `visibility`                                    | membres                                                       |
| `playlist_members`                                       | `playlist_id`, `user_id`, `role` (`owner`/`editor`)                                               | membres ; ajout seulement d'amis acceptés par le propriétaire |
| `playlist_tracks`                                        | `playlist_id`, `track_id`, `position` (fractionnelle), `added_by`, `fit` jsonb (score par membre) | membres (Realtime activé sur cette table)                     |
| `track_votes`                                            | `playlist_id`, `track_id`, `user_id`, `value` (−1/+1)                                             | membres ; écriture de son propre vote                         |
| `blind_tests`, `blind_test_rounds`, `blind_test_guesses` | parties entre amis                                                                                | participants                                                  |
| `guess_games`                                            | « devine les réponses de ton ami »                                                                | les deux joueurs                                              |
| `challenges`, `challenge_progress`                       | défis hebdo                                                                                       | challenges : lecture tous ; progression : soi                 |
| `badges`, `user_badges`                                  | badges et obtentions                                                                              | badges : tous ; obtentions : soi + amis selon visibilité      |
| `streaks`                                                | streak question du jour                                                                           | soi + amis selon visibilité                                   |
| `twin_matches`                                           | jumeaux musicaux (opt-in des **deux** côtés)                                                      | les deux personnes concernées                                 |

### 2.5 RPC principales (toutes validées, rate limitées, `security definer`)

`submit_answer(payload)` · `revoke_answer(id)` · `edit_answer(id, payload)` · `manual_adjust(dim, value)` · `next_question(mode)` (`onboarding`/`refine`/`daily`) · `retake_test()` · `get_recommendations(openness, limit, cursor)` · `log_reco_action(...)` · `compatibility(friend_id)` · `bridge_tracks(friend_id, limit)` · `generate_shared_playlist(member_ids, curve, length)` · `reorder_playlist(id)` · `export_my_data()` · `keepalive()`.

### 2.6 Tests des policies (pgTAP, `supabase test db`)

Pour chaque table : un fichier de test qui crée 4 utilisateurs (A, B ami accepté de A, C demande en attente, D inconnu) et vérifie, en se plaçant dans le rôle `authenticated` avec chaque JWT simulé :

- A lit/écrit ses données ; B lit seulement ce que A a rendu visible aux amis ; C et D ne voient rien de privé ; personne n'écrit chez quelqu'un d'autre ;
- `taste_profiles` et `taste_snapshots` ne sont modifiables que via RPC ;
- un utilisateur ne peut pas se rendre admin ni modifier `questions` ;
- `anon` ne lit que le catalogue et la banque de questions.

Ces tests tournent en CI (Docker est disponible sur les runners GitHub).

---

## 3. Spécification du modèle de profil

Implémente **exactement** le bloc `model` de `questions.json`.

### 3.1 Espace

12 dimensions sur `[0,1]` : `energy, valence, acoustic, tempo, dance, complexity, vocal, bass, polish, warmth, era, niche`.

> Note : le JSON remplace « organique ↔ produit » du prompt par `polish` (brut ↔ ultra poli) et ajoute `warmth` ; je suis le JSON.

- 20 macro-genres `g ∈ [-1,1]` (0 = inconnu), sous-genres idem (`subgenre_weights`).
- Paramètres : `openness` (sors de ma bulle), `nostalgia`, `languages`.

### 3.2 Mise à jour (Kalman 1D par dimension)

```
prior : mean = 0.5, var = 0.083          (variance d'une uniforme sur [0,1])
observation (cible c, fiabilité r) :
  v    = 0.12 · (1 − r) / r + 0.01
  K    = var / (var + v)
  mean = mean + K · (c − mean)
  var  = var · (1 − K)
confiance(dim) = 1 − var / 0.083
précision globale = moyenne des confiances (affichée en %)
```

Ordres de grandeur : un curseur (`r = 0.6`) fait passer une dimension de 0 % à ~48 % de confiance ; une édition manuelle (`r = 0.95`) à ~84 %.

Règles par type de réponse :

- **Choix multiples** (vibes, era, languages) : chaque observation voit sa fiabilité multipliée par `0.6`.
- **Duel descriptif** : choisir A ⇒ observations sur les clés de `A.sig` (fiabilité `r` de la question) ; les dimensions absentes ne bougent pas. `sig` vide ⇒ duel de genres seulement.
- **« Les deux »** : moyenne des signatures sur les clés communes, fiabilité `r · 0.5` ; deltas de genres des deux côtés divisés par 2.
- **« Aucun des deux »** : aucune mise à jour, réponse journalisée.
- **« Passer » / « Je ne sais pas »** : aucun signal, jamais négatif.
- **Édition manuelle** d'un curseur : observation de fiabilité `0.95`.
- **`track_duel`** (généré) : observations = features réelles du morceau choisi, fiabilité `0.5 × confiance des features`.
- **Swipe** : like `r = 0.35`, sauvegarder `0.4`, « plus comme ça » `0.5` (features du morceau comme cibles) ; « moins comme ça » : deltas de genres `−0.3` sur les genres du morceau et observations « miroir » (`c = mean − (f − mean)`, bornée) à `r = 0.3`, seulement sur les dimensions où `|f − mean| > 0.15` ; skip : aucun signal (sert seulement à ne pas reproposer).

### 3.3 Genres

```
g ← g + 0.35 · delta · (1 − |g|)        g ∈ [-1,1]
rejet (double-tap) : g ← min(g, −0.8)   et ajout aux exclusions
```

Bulles : toucher = `delta = on (0.5)`. Sous-genres : même règle sur `subgenre_weights`, plus un effet `delta/2` sur le macro-genre parent.
Confiance d'un genre (pour le gain d'information) : `1 − exp(−n/3)`, `n` = nombre de réponses qui l'ont touché.

### 3.4 Décroissance temporelle (sans rien supprimer)

Je l'implémente comme un **bruit de processus** de Kalman, en rejouant l'historique dans l'ordre :

```
entre deux réponses espacées de Δ jours : var ← min(0.083, var + 0.0005 · Δ)
puis, de la dernière réponse à maintenant : même chose
```

Conséquence voulue : une info ancienne est progressivement « diluée » par les plus récentes. La précision affichée peut baisser si tu ne réponds plus pendant des mois. C'est un levier d'engagement (« ton spectre s'estompe, une question du jour ? »).

### 3.5 Recalcul et versionnement

- `recompute_profile(user)` = **rejeu complet** des réponses non révoquées (quelques centaines de lignes, < 10 ms). Ça rend l'édition et l'annulation triviales et exactes.
- `submit_answer` applique la mise à jour incrémentale (rapide), et le rejeu complet n'a lieu que sur modification ou annulation.
- Snapshots : fin d'onboarding, « refaire le test », chaque semaine (pg_cron, seulement si le profil a changé). « Refaire le test » crée un nouveau snapshot de départ, et les anciennes réponses restent dans l'historique, pondérées par la décroissance.

### 3.6 Vecteur pgvector (32 dimensions)

```
utilisateur : [ (mean_d − 0.5)·2 · √conf_d  pour les 12 dims ] ++ [ g_k · 0.6  pour les 20 genres ]
morceau     : [ (f_d − 0.5)·2                pour les 12 dims ] ++ [ w_k · 0.6  pour les 20 genres ]
similarité  : cosinus (index HNSW, opérateur <=>)
```

Les dimensions incertaines pèsent moins, et les exclusions sont filtrées en dur (pas seulement pénalisées).

### 3.7 `next_question` (gain d'information attendu)

Pour chaque question candidate `q` (actives, hors exposition < 30 jours ; on relâche à 7 jours si la banque est épuisée) :

```
p(o)      ∝ exp(−‖cible_o − mean‖² / τ)       probabilité prédite de chaque option, τ = 0.15
gain(q)   = Σ_o p(o) · [ Σ_d (var_d − var_d|o) / 0.083  +  λ · Σ_k Δconf_genre_k|o ]
score(q)  = gain(q) · fraîcheur(q) · bonus_tier(mode)
```

Contraintes dures : jamais 3 questions du même type d'affilée ; un duel sans paire d'ancres disponible est écarté (repli sur la question suivante). Les `track_duel` sont des candidats générés à la volée : la dimension la moins confiante `d*`, plus deux ancres proches du profil sur les autres dimensions et éloignées sur `d*`.

- **onboarding** : `onboarding_order` (q01 → q12), dans cet ordre fixe.
- **refine** : 3 à 5 questions, gain maximal sur les dimensions les moins sûres ; la suggestion affichée nomme la zone (« ton goût pour l'électro est encore flou »).
- **daily** : une question par jour et par utilisateur, déterministe (graine = date + user), streak associé.

### 3.8 Tests du moteur

- Vitest + **fast-check** (propriétés) : la confiance ne diminue jamais après une observation informative ; `skip`/`none` laissent le profil identique ; `mean` reste dans `[0,1]` et `g` dans `[-1,1]` ; le rejeu équivaut à l'application incrémentale ; révoquer puis rejouer équivaut à ne jamais avoir répondu ; `next_question` respecte la contrainte « pas 3 types d'affilée ».
- Conformité : `src/engine/fixtures/*.json` (séquences de réponses → profil attendu à 1e-9 près) exécutés **à la fois** en Vitest et en pgTAP.

### 3.9 Archétype, originalité, compatibilité, passerelles

- **ADN musical** : les 2 dimensions les plus marquées (écart à 0.5 × confiance) et le genre dominant alimentent des gabarits FR/EN (ex. « Noctambule synthétique », « Romantique acoustique »). Couleur et forme du spectre en découlent.
- **Originalité** : distance moyenne du vecteur à la moyenne des utilisateurs (précalculée chaque nuit), plus le poids des dimensions `niche`/`complexity`.
- **Compatibilité A/B** : `0.6 · Σ_d w_d (1 − |m_A − m_B|) / Σ w_d + 0.4 · cos(genres_A, genres_B)` avec `w_d = min(conf_A, conf_B)`. Zones communes : écart < 0.15 avec confiance > 0.4 des deux côtés ; zones opposées : écart > 0.4.
- **Passerelles** : morceaux qui maximisent `min(sim(A,t), sim(B,t))` (maximin), avec un bonus pour ceux qui sont proches du milieu des deux vecteurs, sans exclusion de l'un ni de l'autre.
- **Playlist N amis** : score `moyenne(sim) − λ·écart-type(sim)` (équité), quota par membre, puis ordonnancement glouton qui suit la courbe d'énergie choisie, avec des transitions de tempo et d'énergie douces.
- **Recos** : `α·cos(profil, morceau) + β·genres + γ·artistes similaires aux likes + δ·filtrage collaboratif (co-likes, précalculé chaque nuit)`. Le curseur « bulle » déplace la **bande de similarité visée** (zone : top 10 %, bulle : 40e-70e percentile, en excluant les genres rejetés). Les `reasons` stockées donnent l'explication affichée (« énergie proche de la tienne, parce que tu aimes X »).

---

## 4. Front

- **Vite + React 18 + TS strict**, HashRouter, code splitting par route (`lazy`), TanStack Query (clés centralisées, pagination par curseur), Zustand pour le lecteur et l'état d'onboarding local.
- **Design system** : `tokens.css` (couleurs `#0B0A14`, `#8B5CF6`, `#22D3EE`, `#F472B6`, rayons, ombres, flous), Tailwind branché sur les tokens, shadcn/ui re-thémé, polices Fontsource **Sora** (titres) + **Inter** (texte, chiffres tabulaires), icônes Lucide.
- **Mouvement** : Framer Motion (ressorts), View Transitions API avec repli, tout désactivé sous `prefers-reduced-motion`. Haptique via `navigator.vibrate` quand dispo.
- **Composant signature `<Spectrum>`** : barres/ondes SVG dérivées du profil, réutilisé dans l'accueil, le profil, les cartes de partage et la comparaison (deux spectres superposés). Logo animé (7 barres qui respirent) pour le chargement, l'onboarding et le lecteur.
- **Visualisations** : Recharts (radar, répartitions, timeline) ; D3 seulement si un rendu n'est pas faisable en Recharts.
- **Lecteur global** : `<audio>` unique, mini-lecteur vers plein écran, raccourcis (espace, ←/→, L, S), attribution de la source (logo et lien Deezer ou Apple Music). Waveform **générée depuis les features** (CORS empêche l'analyse Web Audio des extraits).
- **Partage** : `html-to-image` vers PNG, plus Web Share API si dispo.
- **PWA** : `vite-plugin-pwa` (generateSW), manifest (`standalone`, `theme_color #0B0A14`, raccourcis Découvrir / Question du jour / Mon spectre), shell offline, bandeau « Nouvelle version disponible » (`registerType: 'prompt'`), **aucune mise en cache des extraits** (`NetworkOnly` sur les domaines audio), icônes générées par script.
- **i18n** : react-i18next, FR par défaut ; textes de questions dans `questions.i18n`.
- **CSP** : GitHub Pages ne permet pas d'en-têtes HTTP, donc CSP en `<meta http-equiv>` (pas de `frame-ancestors` possible ainsi, limite documentée) : `default-src 'self'`, `connect-src` vers Supabase (https + wss), `media-src` vers les CDN d'extraits Deezer et Apple, `img-src` vers les CDN de pochettes, pas de `unsafe-inline` pour les scripts.

---

## 5. Sécurité

- Aucun secret dans le dépôt : `.env*` ignorés sauf `.env.example`, **gitleaks** en CI (et conseillé en pre-commit).
- Le front ne reçoit que `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (variables du dépôt). La clé anon est publique par nature : la sécurité repose sur la RLS. Aucune `service_role` ni clé secrète côté front.
- Edge Functions : CORS limité à `https://krokow.github.io` (+ `http://localhost:5173` en dev, piloté par le secret `ALLOWED_ORIGINS`), JWT exigé sauf pour les lectures publiques du catalogue, Zod sur chaque entrée et sur chaque réponse d'API tierce, rate limit par utilisateur et par IP (`check_rate_limit`). Le CORS ne protège que des navigateurs, d'où le rate limit côté serveur en plus.
- RPC : `security definer` + `set search_path = ''`, vérifications explicites `auth.uid()`, validation `pg_jsonschema`, rate limit.
- RGPD : `export_my_data()` (JSON téléchargeable), suppression de compte via `account-delete` (seul endroit qui utilise la service role, côté serveur), cascade sur toutes les tables.
- Sauvegardes chiffrées avec **age** : seule la clé **publique** est dans GitHub, la clé privée reste chez toi. C'est indispensable sur un dépôt public, car les artefacts Actions y sont téléchargeables par n'importe quel compte GitHub.

---

## 6. Audit des API musicales et incompatibilités à signaler

> Vérifié le 28/10/2026 par recherche web. **Les sites officiels (developers.deezer.com, reccobeats.com, supabase.com, last.fm) ne sont pas joignables depuis cette session de travail** (réseau restreint), donc certains points restent à confirmer par toi ou à revérifier quand le réseau sera ouvert.

| Service                         | État                                                                                                                         | Points d'attention                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deezer API**                  | Endpoints publics (search, track, artist, chart) sans clé. Extraits 30 s. Pas de CORS, donc proxy via Edge Function (prévu). | ⚠️ Les URL d'extraits sont **signées et expirent** (`hdnea=exp=…`) : on stocke l'expiration et on rafraîchit à la lecture. ⚠️ La création de nouvelles applications OAuth Deezer est fermée depuis plusieurs années (à reconfirmer), donc **pas d'export de playlist vers Deezer** : export en lien, liste, CSV ou M3U. ⚠️ Limite d'environ 50 requêtes / 5 s par IP, partagée par toutes les Edge Functions, d'où le cache agressif. Attribution Deezer obligatoire. CGU : usage non commercial, ce qui correspond à Spectra, mais à relire.  |
| **iTunes Search API**           | Sans clé, extraits stables.                                                                                                  | ⚠️ Environ 20 requêtes/min par IP : secours uniquement. Badge ou lien Apple Music requis à côté de l'extrait.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Last.fm**                     | Clé gratuite (secret de l'Edge Function). Tags et artistes similaires.                                                       | ⚠️ **Usage non commercial uniquement** (CGU officielles). Spectra reste gratuite et sans pub, donc OK ; toute monétisation future exigerait un accord. Environ 5 req/s recommandées (non officiel), erreur 29 en cas de dépassement. Respecter les en-têtes de cache.                                                                                                                                                                                                                                                                          |
| **ReccoBeats** (features audio) | Annoncé comme gratuit, sans clé, avec rate limit (429 + Retry-After).                                                        | ❗ **Incertitude** : des sources le décrivent comme un service B2B payant et d'autres signalent un manque de fiabilité. Son lookup fonctionne surtout par **identifiants Spotify**, que nous n'avons pas, et l'alternative (envoyer l'extrait audio pour analyse) pose une question de droits sur les extraits Deezer. **Proposition** : provider optionnel désactivé par défaut ; source principale = estimateur maison (tags Last.fm → `tag_feature_map`, `bpm`/`gain`/`rank`/date Deezer) ; ancres annotées à la main (`source = curated`). |
| **Spotify**                     | Endpoint audio-features déprécié (fin 2024) ; mode développement très restreint.                                             | Non utilisé. Export vers Spotify : non prévu (incompatible 0 € et import non voulu).                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Essentia** (plan B features)  | Open source, auto-hébergé.                                                                                                   | Seulement en script hors ligne pour enrichir les ancres ; licence des modèles à vérifier (souvent non commerciale).                                                                                                                                                                                                                                                                                                                                                                                                                            |

**Supabase Free** (sources tierces convergentes, à confirmer sur la page officielle) : 2 projets, 500 Mo de base, 1 Go de stockage, environ 5 Go d'egress, 50 k MAU, 500 k invocations d'Edge Functions par mois, Realtime limité (environ 200 connexions simultanées), **pause après 7 jours d'inactivité**, pas de sauvegardes exploitables.

❗ **E-mails** : le SMTP intégré de Supabase est très limité (quelques e-mails par heure, et récemment réservé aux adresses de l'équipe du projet). Donc :

- OAuth **GitHub + Discord + Google** en principal (gratuits) ;
- e-mail + mot de passe avec **confirmation d'e-mail désactivée** au départ (à valider), et la réinitialisation de mot de passe impossible sans SMTP. Option : SMTP gratuit Brevo (300/jour, sans carte, mais expéditeur Gmail, donc délivrabilité médiocre sans domaine) ;
- magic link : option désactivée par défaut.

❗ **GitHub Actions planifiées** : GitHub désactive les workflows `schedule` d'un dépôt public après **60 jours sans activité**. `keepalive.yml` réactive aussi son propre workflow via l'API (`actions: write`), sans commit artificiel.

❗ **Clés Supabase** : les nouveaux projets reçoivent des clés `sb_publishable_…` / `sb_secret_…` à la place de `anon` / `service_role`. On garde le nom de variable `VITE_SUPABASE_ANON_KEY` et on y met la clé **publishable** (ou la clé anon legacy). Vérification précise à l'étape 3.

❗ **Réseau de cette session** : `api.deezer.com`, `itunes.apple.com` et `api.reccobeats.com` sont bloqués ici. Je peux écrire et tester le code (avec des réponses enregistrées), mais **la construction réelle de la bibliothèque d'ancrage** se fera via le workflow `anchors.yml` sur GitHub Actions (qui a accès au réseau) ou chez toi avec `npm run anchors:build`.

---

## 7. Bibliothèque d'ancrage (~300 morceaux)

1. `anchors.source.csv` : liste **curée à la main** (artiste, titre, langue, décennie, genres, sous-genres et estimations des 12 dimensions), construite pour couvrir une grille : 20 genres × 7 décennies × 3 niveaux d'énergie, au moins 6 langues.
2. `npm run anchors:build` : résolution Deezer (id, ISRC, `bpm`, `rank`, date, extrait disponible), repli iTunes, enrichissement Last.fm (tags), ReccoBeats si activé, puis fusion pondérée par confiance. Sortie dans `anchors.json` avec la provenance de chaque valeur.
3. `npm run anchors:validate` : au moins 15 morceaux par quintile de chaque dimension, au moins 8 par genre, au moins 20 par décennie, pas de doublons ni d'artiste sur-représenté (3 morceaux max), extrait joignable. Échec avec un rapport des trous à combler.
4. Le seed charge `anchors.json` dans `tracks`, `track_features` et `anchor_tracks`. On enrichit en ajoutant des lignes au CSV puis en relançant le workflow.

## 7bis. Analyseur audio maison (features calculées par Spectra)

Objectif : des caractéristiques fiables pour chaque morceau, **sans dépendre d'un service tiers**, avec 0 € et sans charger ni le client ni le quota d'Edge Functions.

**Où ça tourne** : dans **GitHub Actions** (minutes gratuites et illimitées sur dépôt public), workflow `analyze.yml` :

- planifié chaque nuit, ou lancé à la main ;
- il prend les morceaux en cache dont `features.source <> 'analyzed'` (nouvelles recos, ancres) ;
- il télécharge l'extrait de 30 s côté serveur, le décode avec `ffmpeg` (mono, 22 050 Hz) et l'analyse **en mémoire**. **Aucun fichier audio n'est conservé.**
- il écrit les features en base avec un secret de service stocké dans les secrets Actions (jamais côté front).

Entre la découverte d'un morceau et son analyse (moins de 24 h), une estimation provisoire (métadonnées + tags) sert de repli, avec une confiance plus basse.

**Bibliothèque** : `src/analysis/` (TS pur, testé avec Vitest sur des signaux synthétiques : sinus, clics à BPM connu, bruit blanc ou rose). Descripteurs bas niveau, puis mapping vers les 12 dimensions :

| Dimension    | Signal mesuré                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| `energy`     | loudness RMS / LUFS approx., flux spectral, densité d'onsets                                                         |
| `tempo`      | enveloppe d'onsets → autocorrélation / tempogramme (60-200 BPM, correction d'octave)                                 |
| `dance`      | saillance et régularité de la pulsation, tempo dans la zone 95-130 BPM                                               |
| `acoustic`   | platitude spectrale, ratio harmonique, absence de sub-bass synthétique                                               |
| `bass`       | part d'énergie 20-150 Hz                                                                                             |
| `polish`     | facteur de crête (compression), plancher de bruit, extension au-delà de 12 kHz                                       |
| `warmth`     | pente spectrale (200-800 Hz vs 2-6 kHz), centroïde                                                                   |
| `vocal`      | trames voisées (YIN, 80-1000 Hz) avec énergie dans les formants, continuité de pitch                                 |
| `valence`    | mode majeur/mineur (chroma + profils de Krumhansl), tempo, brillance (signal faible, fortement pondéré par les tags) |
| `complexity` | rythme harmonique (changements de chroma), entropie rythmique, nouveauté spectrale                                   |
| `era`        | année de sortie (métadonnée)                                                                                         |
| `niche`      | `rank` Deezer + auditeurs Last.fm (échelle log)                                                                      |

**Fusion et calibration** : pour chaque dimension, une moyenne pondérée par la confiance entre l'analyse audio et l'estimation par tags. Les poids sont **appris** par régression ridge sur les ancres annotées à la main, puis versionnés dans `supabase/seed/analysis-calibration.json`. Un rapport de validation croisée (erreur absolue moyenne par dimension) est produit à chaque recalibration : on sait ce que vaut chaque dimension au lieu de le supposer.

**Performance** : environ 0,3 s de CPU par extrait (FFT radix-2 maison, fenêtres de 2048 échantillons, hop 512), soit plusieurs milliers de morceaux par heure sur un runner gratuit.

> ⚠️ Point juridique à garder en tête : l'analyse télécharge temporairement des extraits Deezer/Apple pour en extraire des statistiques, sans les stocker ni les redistribuer. C'est l'usage le plus prudent possible, mais les CGU de ces services ne le mentionnent pas explicitement.

---

## 8. CI/CD

- `ci.yml` (PR et push) : `npm ci`, ESLint, Prettier check, `tsc --noEmit`, Vitest (couverture du moteur ≥ 90 %), build, gitleaks, `supabase start` + `supabase test db` (pgTAP), Playwright (stack Supabase locale, API musicales simulées par `page.route`).
- `deploy-pages.yml` : sur `main`, build avec les variables du dépôt, puis `actions/upload-pages-artifact` et `actions/deploy-pages`.
- **Base et Edge Functions déployées à la main** (choix du 28/10, comme Synapse) : fichiers `supabase/migrations/NNNN_*.sql` collés dans le SQL Editor, chacun s'enregistrant dans `ops.schema_migrations` et vérifiant que le précédent est appliqué ; fonctions assemblées en un seul fichier (`supabase/functions-bundled/`) pour le déploiement « Via Editor ». Aucun token ni mot de passe de base dans GitHub.
- `keepalive.yml` : `cron: '0 6 */3 * *'`, appel de la RPC `keepalive()` avec les variables publiques, puis réactivation de son propre workflow.
- `backup.yml` : hebdo, `pg_dump` (secret `SUPABASE_DB_URL`), chiffrement `age` avec la clé publique `BACKUP_AGE_RECIPIENT`, artefact 30 jours.

---

## 9. Étapes et commits

| Étape | Contenu                                                                                                                                                                                                               | Ce que tu configures                                             |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1     | Ce plan, assets de marque, banque de questions                                                                                                                                                                        | Valider ce plan, répondre aux questions du §11                   |
| 2     | Vite/React/TS, Tailwind/shadcn, tokens, polices, logo animé, PWA + icônes générées, i18n, ESLint/Prettier/Vitest, CI + Pages + gitleaks, `.env.example`                                                               | GitHub Pages en mode « GitHub Actions »                          |
| 3     | Migrations identité/social de base, RLS + helpers, pgTAP, Auth (OAuth + e-mail/mot de passe), profils, avatar (Storage), confidentialité, export RGPD, suppression                                                    | Projet Supabase, OAuth GitHub/Discord/Google, variables du dépôt |
| 4     | Catalogue + cache, Edge Function `music` (Deezer/iTunes/Last.fm/features), `MusicProvider`, lecteur global, bibliothèque d'ancrage + scripts + workflow                                                               | Clé Last.fm, `supabase secrets set`, lancer `anchors.yml`        |
| 5     | Moteur (SQL + miroir TS + fixtures), banque seedée, `next_question`, onboarding 12 questions + révélation, Mon spectre, précision, Affiner, question du jour, historique et édition, refaire le test, admin questions | Ajouter ton user dans `app_admins`                               |
| 6     | Recos hybrides, swipe, découverte du jour (pg_cron), curseur bulle, explications                                                                                                                                      | Activer pg_cron/pg_net (1 clic)                                  |
| 7     | Amis, recherche, fil, envois, réactions, compatibilité, spectres superposés, passerelles, « devine »                                                                                                                  | —                                                                |
| 8     | Playlists N amis + Realtime + votes + ordre + export ; blind test ; défis, badges, streaks ; jumeaux                                                                                                                  | Activer Realtime sur 3 tables (fait par migration si possible)   |
| 9     | Polish, a11y (axe en CI), Lighthouse > 90, cartes de partage, notifications push (optionnelles, clés VAPID en secret), README complet, `FREE_TIER_BUDGET.md`, keepalive et backup                                     | Générer les clés VAPID et age (commandes fournies)               |

Chaque étape fera l'objet d'au moins un commit sur `claude/affectionate-babbage-5y8dn7`, avec un résumé des choix et la liste de ce qui est à configurer de ton côté.

---

## 10. Ce que tu devras configurer (aperçu ; pas à pas détaillé dans `SETUP_*.md` à l'étape concernée)

**GitHub** (dépôt `krokow/spectra`, déjà public) :

1. _Settings → Pages → Build and deployment → Source : **GitHub Actions**_.
2. _Settings → Secrets and variables → Actions → Variables_ : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_REF`.
3. _Secrets_ : `SUPABASE_ACCESS_TOKEN` (supabase.com → Account → Access Tokens), `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL` (backup), `BACKUP_AGE_RECIPIENT` (clé publique age).
4. (Conseillé) protection de `main` : CI verte obligatoire.

**Supabase** :

1. Créer un compte et un projet **Free** (région `eu-west-3` Paris ou `eu-central-1`), garder le mot de passe de la base dans un gestionnaire de mots de passe.
2. _Authentication → URL Configuration_ : Site URL `https://krokow.github.io/spectra/` ; Redirect URLs `https://krokow.github.io/spectra/**` et `http://localhost:5173/**`.
3. Fournisseurs OAuth (pas à pas fourni à l'étape 3) :
   - **GitHub** : github.com → Settings → Developer settings → OAuth Apps → New ; callback `https://<ref>.supabase.co/auth/v1/callback` ; coller Client ID et Secret dans Supabase.
   - **Discord** : discord.com/developers → New Application → OAuth2 → ajouter la même callback.
   - **Google** : console.cloud.google.com → projet → écran de consentement « Externe » (scopes `email`, `profile` : pas de vérification payante) → identifiants OAuth « Application Web » avec la même callback.
4. _Database → Extensions_ : `vector`, `pg_jsonschema`, `pg_cron`, `pg_net` (les migrations tenteront de les activer elles-mêmes).
5. Last.fm : créer une clé sur last.fm/api/account/create (usage non commercial), puis `supabase secrets set LASTFM_API_KEY=… ALLOWED_ORIGINS=https://krokow.github.io`.
6. Après ta première connexion : `insert into app_admins(user_id) values ('<ton uuid>');` dans le SQL editor.

Je ne devinerai ni ne remplirai jamais ces valeurs moi-même.

---

## 11. Questions à valider

Toutes tranchées le 28/10/2026 : voir §0bis.
