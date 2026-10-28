# Configuration Supabase (pas à pas)

> Règle d'or : **ne colle jamais un mot de passe, un token ou une clé secrète dans le chat, un fichier du dépôt ou une issue.**
> Les valeurs publiques (URL, clé publishable) vont dans les _variables_ GitHub ; les valeurs secrètes dans les _secrets_ GitHub.

## 1. Créer le projet

| Champ                           | Valeur                                                     | Pourquoi                                                                                                                                                                                       |
| ------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization                    | ton organisation **Free**                                  | 0 €                                                                                                                                                                                            |
| GitHub (optional)               | **ne pas connecter**                                       | Nos migrations et fonctions sont déployées par notre workflow `supabase-deploy.yml`, testées en CI avant. L'intégration Supabase déploierait en parallèle, sans nos tests ni notre ordre.      |
| Project name                    | `spectra`                                                  |                                                                                                                                                                                                |
| Database password               | **Generate a password**                                    | Copie-le immédiatement dans un gestionnaire de mots de passe (Bitwarden, 1Password, trousseau…). Il ira aussi dans le secret GitHub `SUPABASE_DB_PASSWORD`. Supabase ne te le remontrera plus. |
| Region                          | **Europe** (Paris `eu-west-3` si proposé, sinon Francfort) | Proche de tes utilisateurs, RGPD                                                                                                                                                               |
| Enable Data API                 | ✅ **coché**                                               | `supabase-js` passe par cette API REST                                                                                                                                                         |
| Automatically expose new tables | ❌ **décoché**                                             | Aucune table n'est exposée sans `GRANT` explicite : nos migrations accordent les droits table par table. Une table oubliée reste inaccessible au lieu d'être publique.                         |
| Enable automatic RLS            | ✅ **coché**                                               | Filet de sécurité : toute nouvelle table a la RLS activée d'office. Nos migrations l'activent de toute façon explicitement, et un test pgTAP vérifie qu'aucune table n'en est dépourvue.       |

Clique sur **Create new project** et attends 1 à 2 minutes.

## 2. Récupérer les identifiants → GitHub

Dans Supabase, **Project Settings** :

1. **General → Project ID** (le `ref`, ~20 lettres) → variable GitHub `SUPABASE_PROJECT_REF`.
2. **Data API → Project URL** (`https://<ref>.supabase.co`) → variable GitHub `VITE_SUPABASE_URL`.
3. **API Keys → Publishable key** (`sb_publishable_…`) → variable GitHub `VITE_SUPABASE_ANON_KEY`.
   ⚠️ **Ne prends jamais la _Secret key_** (`sb_secret_…`) pour cette variable.
4. Sur supabase.com, ton avatar → **Account preferences → Access Tokens → Generate new token** (nom : `github-actions-spectra`) → secret GitHub `SUPABASE_ACCESS_TOKEN`.
5. Le mot de passe de la base (étape 1) → secret GitHub `SUPABASE_DB_PASSWORD`.

Où les mettre sur GitHub : `https://github.com/krokow/spectra/settings/variables/actions` (variables) et `https://github.com/krokow/spectra/settings/secrets/actions` (secrets). Voir aussi `SETUP_GITHUB.md`.

## 3. Authentification : OAuth uniquement, aucun e-mail

### 3.1 URL de l'app

**Authentication → URL Configuration** :

- **Site URL** : `https://krokow.github.io/spectra/`
- **Redirect URLs** (Add URL, une par ligne) :
  - `https://krokow.github.io/spectra/**`
  - `http://localhost:5173/**`
  - `http://localhost:4173/**`

### 3.2 Couper l'e-mail

**Authentication → Sign In / Providers** :

- **Email** : désactive le provider (**Enable Email provider** décoché). Personne ne pourra s'inscrire par e-mail, donc Supabase n'en enverra jamais.
- Laisse **Allow new users to sign up** activé (sinon personne ne peut créer de compte via OAuth).

L'URL de callback à utiliser partout ci-dessous est affichée dans chaque provider Supabase (**Callback URL (for OAuth)**) ; elle a la forme :

```
https://<ref>.supabase.co/auth/v1/callback
```

### 3.3 GitHub

1. Va sur `https://github.com/settings/developers` → **OAuth Apps → New OAuth App**.
2. Application name : `Spectra` · Homepage URL : `https://krokow.github.io/spectra/` · Authorization callback URL : la callback Supabase.
3. **Register application**, puis **Generate a new client secret**.
4. Dans Supabase → **Sign In / Providers → GitHub** : active, colle **Client ID** et **Client Secret**, **Save**.

### 3.4 Discord

1. `https://discord.com/developers/applications` → **New Application** → nom `Spectra`.
2. Menu **OAuth2** → **Redirects → Add Redirect** : la callback Supabase → **Save Changes**.
3. Toujours dans **OAuth2** : copie **Client ID**, puis **Reset Secret** pour obtenir le **Client Secret**.
4. Supabase → **Discord** : active, colle les deux valeurs, **Save**.

### 3.5 Google (gratuit, sans carte bancaire)

1. `https://console.cloud.google.com/` → sélecteur de projet → **Nouveau projet** `spectra`.
2. **API et services → Écran de consentement OAuth** (ou « Google Auth Platform ») :
   - Type d'utilisateur **Externe** ; nom de l'app `Spectra` ; e-mail d'assistance = le tien ;
   - Domaines autorisés : `supabase.co` et `github.io` ;
   - Scopes : uniquement `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile` (scopes « non sensibles » : **aucune vérification Google requise**) ;
   - **Publier l'application** (passer de « Test » à « En production ») pour que tout le monde puisse se connecter.
3. **Identifiants → Créer des identifiants → ID client OAuth** → type **Application Web** :
   - Origines JavaScript autorisées : `https://krokow.github.io`
   - URI de redirection autorisés : la callback Supabase.
4. Supabase → **Google** : active, colle **Client ID** et **Client Secret**, **Save**.

## 4. Extensions (étape 3 et suivantes)

Les migrations les activent elles-mêmes (`vector`, `pg_jsonschema`, `pg_cron`, `pg_net`). Si l'une échoue : **Database → Extensions**, recherche le nom, active-la.

## 5. Te déclarer administrateur (après ta première connexion)

**SQL Editor** :

```sql
insert into public.app_admins (user_id)
select id from auth.users where email = 'TON_EMAIL_ICI';
```

## 6. Ce qui viendra aux étapes suivantes

- Étape 4 : clé Last.fm (`https://www.last.fm/api/account/create`, usage non commercial) à déposer avec
  `supabase secrets set LASTFM_API_KEY=...` (je te donnerai la commande exacte) ; secret GitHub `SUPABASE_SECRET_KEY` pour l'analyseur audio.
- Étape 9 : sauvegardes chiffrées (`SUPABASE_DB_URL`, `BACKUP_AGE_RECIPIENT`).
