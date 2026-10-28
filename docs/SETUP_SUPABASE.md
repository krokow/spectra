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

## 3. Authentification : e-mail + mot de passe, aucun e-mail envoyé

Choix validé : inscription avec **e-mail + mot de passe + pseudo**, pas de fournisseur externe
(GitHub, Discord, Google) et **aucun e-mail envoyé** par Supabase.

### 3.1 URL de l'app

**Authentication → URL Configuration** :

- **Site URL** : `https://krokow.github.io/spectra/`
- **Redirect URLs** (bouton **Add URL**, une entrée à la fois) :
  - `https://krokow.github.io/spectra/**`
  - `http://localhost:5173/**`

> Sans e-mail ni OAuth, ces URL ne servent presque jamais (aucun lien de redirection n'est envoyé).
> Elles limitent seulement les adresses vers lesquelles Supabase accepterait de rediriger, si un jour
> on ajoute un fournisseur. La seconde sert au développement local.

### 3.2 Provider Email, sans confirmation

**Authentication → Sign In / Providers** :

- **Allow new users to sign up** : activé.
- **Allow anonymous sign-ins** : désactivé.
- **Email** : activé, avec :
  - **Confirm email** : ❌ **désactivé** (sinon Supabase enverrait un e-mail de confirmation) ;
  - **Secure email change** : ❌ désactivé (l'app ne proposera pas de changer d'e-mail au départ) ;
  - **Minimum password length** : `10` ; **Password requirements** : lettres minuscules, majuscules et chiffres.
- Tous les autres providers (GitHub, Google, Discord…) : désactivés.

**Authentication → Rate Limits** : garde les valeurs par défaut (elles limitent les inscriptions et
connexions par IP).

### 3.3 Conséquences à connaître

- **Mot de passe oublié** : impossible par e-mail. Spectra génère à l'inscription des **codes de
  secours** (à conserver par l'utilisateur, stockés hachés en base) qui permettent de choisir un
  nouveau mot de passe via une Edge Function.
- **Adresse non vérifiée** : n'importe qui peut s'inscrire avec une adresse qui n'est pas la sienne.
  L'e-mail sert seulement d'identifiant de connexion ; il n'est jamais affiché aux autres. Le **pseudo**
  (unique) est l'identité publique.
- **Robots** : les limites de Supabase suffisent au départ. Si des inscriptions automatisées apparaissent,
  on ajoutera Cloudflare Turnstile (gratuit, sans carte).

## 4. Extensions (étape 3 et suivantes)

Les migrations les activent elles-mêmes (`vector`, `pg_jsonschema`, `pg_cron`, `pg_net`). Si l'une échoue : **Database → Extensions**, recherche le nom, active-la.

## 5. Te déclarer administrateur (après ta première connexion)

**SQL Editor** :

```sql
insert into public.app_admins (user_id)
select id from auth.users where email = 'TON_EMAIL_ICI';
-- (requête à taper dans le SQL Editor de Supabase, jamais à commiter avec ta vraie adresse)
```

## 6. Ce qui viendra aux étapes suivantes

- Étape 4 : clé Last.fm (`https://www.last.fm/api/account/create`, usage non commercial) à déposer avec
  `supabase secrets set LASTFM_API_KEY=...` (je te donnerai la commande exacte) ; secret GitHub `SUPABASE_SECRET_KEY` pour l'analyseur audio.
- Étape 9 : sauvegardes chiffrées (`SUPABASE_DB_URL`, `BACKUP_AGE_RECIPIENT`).
