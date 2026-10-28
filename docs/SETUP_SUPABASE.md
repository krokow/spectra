# Configuration Supabase (pas à pas)

> Règle d'or : **ne colle jamais un mot de passe, un token ou une clé secrète dans le chat, un fichier du dépôt ou une issue.**

Méthode retenue (même logique que Synapse, en plus traçable) : **aucun token ni mot de passe de base dans GitHub**.
Le schéma s'applique en collant des fichiers SQL dans le SQL Editor, les Edge Functions se déploient depuis le
tableau de bord, et l'authentification se fait par e-mail + mot de passe, sans envoi d'e-mail.

## 1. Créer le projet

| Champ                           | Valeur                                                     | Pourquoi                                                                                                          |
| ------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Organization                    | ton organisation **Free**                                  | 0 €                                                                                                               |
| GitHub (optional)               | **ne pas connecter**                                       | Le schéma est appliqué à la main, fichier par fichier (section 4).                                                |
| Project name                    | `spectra`                                                  |                                                                                                                   |
| Database password               | **Generate a password**                                    | À garder dans ton gestionnaire de mots de passe. Il ne va **nulle part** ailleurs.                                |
| Region                          | **Europe** (Paris `eu-west-3` si proposé, sinon Francfort) | Proche de tes utilisateurs, RGPD                                                                                  |
| Enable Data API                 | ✅ **coché**                                               | `supabase-js` passe par cette API REST                                                                            |
| Automatically expose new tables | ❌ **décoché**                                             | Aucune table n'est exposée sans `GRANT` explicite dans nos fichiers SQL. Une table oubliée reste fermée.          |
| Enable automatic RLS            | ✅ **coché**                                               | Filet de sécurité : toute nouvelle table a la RLS activée d'office (nos fichiers l'activent aussi explicitement). |

## 2. Variables GitHub (valeurs publiques)

`https://github.com/krokow/spectra/settings/variables/actions` → **New repository variable** :

| Variable                 | Où la trouver dans Supabase                                             |
| ------------------------ | ----------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Project Settings → Data API → Project URL (`https://<ref>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API Keys → **Publishable key** (`sb_publishable_…`)  |

⚠️ Jamais la _Secret key_ (`sb_secret_…`). Aucun **secret** GitHub n'est nécessaire à cette étape.

## 3. Authentification : e-mail + mot de passe + pseudo, aucun e-mail envoyé

### 3.1 URL de l'app

**Authentication → URL Configuration** :

- **Site URL** : `https://krokow.github.io/spectra/`
- **Redirect URLs** : `https://krokow.github.io/spectra/**` et `http://localhost:5173/**`

### 3.2 Provider Email

**Authentication → Sign In / Providers** :

- **Allow new users to sign up** : activé.
- **Allow anonymous sign-ins** : désactivé.
- **Email** : activé, avec :
  - **Confirm email** : ❌ **désactivé** (aucun e-mail envoyé ; le compte est utilisable tout de suite) ;
  - **Secure email change** : ❌ désactivé ;
  - **Minimum password length** : `10` ; **Password requirements** : minuscules, majuscules et chiffres.
- Tous les autres providers : désactivés.
- **Pas de SMTP personnalisé** (Authentication → Emails → SMTP Settings : laisser tel quel).

### 3.3 Ce que ça implique

- Connexion par **e-mail ou pseudo** + mot de passe. Le pseudo est l'identité publique ; l'e-mail n'est jamais
  montré aux autres.
- **Mot de passe oublié** : à l'inscription, l'app affiche des **codes de secours** à noter ; un code permet de
  choisir un nouveau mot de passe. (Si un jour tu veux la réinitialisation par e-mail, il suffira de brancher un
  SMTP gratuit, par exemple un Gmail dédié avec mot de passe d'application, et d'activer « Confirm email ».)
- Adresse non vérifiée : quelqu'un pourrait s'inscrire avec une adresse qui n'est pas la sienne. Sans
  conséquence ici, puisque l'e-mail ne sert qu'à se connecter.

## 4. Appliquer le schéma de la base (à chaque étape)

Les fichiers sont dans `supabase/migrations/`, numérotés (`0001_…sql`, `0002_…sql`…).

1. Ouvre le fichier sur GitHub, bouton **Copy raw file**.
2. Supabase → **SQL Editor → New query**, colle, **Run**.
3. Fais-les **dans l'ordre**, une seule fois chacun.

Chaque fichier s'enregistre lui-même dans la table privée `ops.schema_migrations` et refuse de s'exécuter si le
précédent manque. Pour voir où en est le projet :

```sql
select version, name, applied_at from ops.schema_migrations order by version;
```

Avant chaque fichier, il est testé en CI sur une base Supabase locale (tests des règles RLS inclus).

## 5. Edge Functions (à partir de l'étape 4)

Déploiement depuis le tableau de bord, comme pour Synapse : **Edge Functions → Deploy a new function → Via
Editor**, nom de la fonction, coller le fichier **déjà assemblé** que je fournirai (`supabase/functions-bundled/<nom>.ts`,
un seul fichier par fonction), **Deploy**. Les secrets de fonction se règlent dans **Edge Functions → Secrets**.

## 6. Te déclarer administrateur (après ta première inscription)

**SQL Editor** (à taper dans Supabase, jamais à commiter avec ta vraie adresse) :

```sql
insert into public.app_admins (user_id)
select id from auth.users where email = 'TON_EMAIL_ICI';
```

## 7. Plus tard (facultatif)

- Étape 4 : une clé Last.fm gratuite (secret de fonction `LASTFM_API_KEY`). L'analyseur audio nocturne aura
  besoin d'un secret GitHub (`SUPABASE_SECRET_KEY`) : je t'expliquerai pourquoi et comment à ce moment-là.
- Étape 9 : sauvegardes chiffrées (facultatif).
