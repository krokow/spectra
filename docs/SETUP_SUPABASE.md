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

## 3. Authentification : e-mail + mot de passe + pseudo

Choix validé : inscription avec **e-mail + mot de passe + pseudo unique**, connexion avec **e-mail ou
pseudo + mot de passe**. Pas de fournisseur externe (GitHub, Discord, Google).
Les e-mails (confirmation d'adresse, mot de passe oublié) passent par un **compte Gmail dédié** utilisé
comme serveur SMTP : gratuit, sans carte, sans nom de domaine.

### 3.1 URL de l'app

**Authentication → URL Configuration** :

- **Site URL** : `https://krokow.github.io/spectra/`
- **Redirect URLs** (bouton **Add URL**, une entrée à la fois) :
  - `https://krokow.github.io/spectra/**`
  - `http://localhost:5173/**`

Les liens des e-mails (confirmation, réinitialisation) ramènent vers ces adresses.

### 3.2 Créer l'expéditeur Gmail (une seule fois)

> Le SMTP intégré de Supabase n'envoie qu'aux membres de ton équipe Supabase et quelques e-mails par heure :
> inutilisable pour de vrais utilisateurs. D'où un SMTP externe.

1. Crée un compte Gmail **dédié** (ex. `spectra.app.<quelque-chose>@gmail.com`), pas ton adresse perso.
2. Sur ce compte : `https://myaccount.google.com/security` → active la **Validation en deux étapes**
   (obligatoire pour l'étape suivante).
3. `https://myaccount.google.com/apppasswords` → nom `supabase-spectra` → **Créer**. Google affiche un
   **mot de passe d'application** de 16 lettres. Copie-le dans ton gestionnaire de mots de passe.
   Ne le colle nulle part ailleurs que dans Supabase (étape 3.3).

Limite Gmail : environ 500 e-mails par jour, largement suffisant au départ. Les e-mails partent
réellement de Gmail, donc ils sont authentifiés (SPF/DKIM) et arrivent rarement en spam.

### 3.3 Brancher le SMTP dans Supabase

**Authentication → Emails → SMTP Settings → Enable Custom SMTP** :

| Champ                           | Valeur                                                   |
| ------------------------------- | -------------------------------------------------------- |
| Sender email                    | l'adresse Gmail dédiée                                   |
| Sender name                     | `Spectra`                                                |
| Host                            | `smtp.gmail.com`                                         |
| Port                            | `465`                                                    |
| Username                        | l'adresse Gmail dédiée                                   |
| Password                        | le mot de passe d'application (16 lettres, sans espaces) |
| Minimum interval between emails | `60` secondes                                            |

Puis **Authentication → Rate Limits** : « Rate limit for sending emails » à `30` par heure (ajustable).

### 3.4 Provider Email

**Authentication → Sign In / Providers** :

- **Allow new users to sign up** : activé.
- **Allow anonymous sign-ins** : désactivé.
- **Email** : activé, avec :
  - **Confirm email** : ✅ activé (on vérifie que l'adresse appartient bien à la personne) ;
  - **Secure email change** : ✅ activé ;
  - **Minimum password length** : `10` ; **Password requirements** : minuscules, majuscules et chiffres.
- Tous les autres providers (GitHub, Google, Discord…) : désactivés.

Les textes des e-mails (Authentication → Emails → Templates) seront fournis en français à l'étape 3.

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
