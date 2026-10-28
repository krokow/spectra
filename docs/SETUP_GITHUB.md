# Configuration GitHub (pas à pas)

> Tout se fait dans l'interface web de GitHub, sur le dépôt `krokow/spectra`.
> Aucune valeur secrète ne doit jamais être écrite dans un fichier du dépôt.

## 1. Activer GitHub Pages (à faire maintenant)

1. Ouvre `https://github.com/krokow/spectra/settings/pages`.
2. Dans **Build and deployment → Source**, choisis **GitHub Actions** (pas « Deploy from a branch »).
3. C'est tout : au prochain push sur `main`, le workflow **Déploiement GitHub Pages** publie le site sur
   `https://krokow.github.io/spectra/`.

> Tant que la branche de travail n'est pas fusionnée dans `main`, rien n'est déployé.

## 2. Variables du dépôt (à faire à l'étape 3, quand le projet Supabase existe)

`Settings → Secrets and variables → Actions → onglet Variables → New repository variable` :

| Nom                      | Où la trouver                                                                                          | Nature                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase → Project Settings → API → Project URL                                                        | publique                                 |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → clé **publishable** (`sb_publishable_…`) ou clé `anon` legacy | publique (la sécurité repose sur la RLS) |
| `SUPABASE_PROJECT_REF`   | l'identifiant dans l'URL du projet (`https://<ref>.supabase.co`)                                       | publique                                 |

## 3. Secrets du dépôt (étapes 3, 4 et 9)

`Settings → Secrets and variables → Actions → onglet Secrets → New repository secret` :

| Nom                     | Sert à                                                                         | Étape |
| ----------------------- | ------------------------------------------------------------------------------ | ----- |
| `SUPABASE_ACCESS_TOKEN` | déployer migrations et Edge Functions (supabase.com → Account → Access Tokens) | 3     |
| `SUPABASE_DB_PASSWORD`  | `supabase db push` (mot de passe choisi à la création du projet)               | 3     |
| `SUPABASE_SECRET_KEY`   | analyseur audio nocturne (écriture des features) : clé **secret** Supabase     | 4     |
| `SUPABASE_DB_URL`       | sauvegarde hebdomadaire                                                        | 9     |
| `BACKUP_AGE_RECIPIENT`  | clé **publique** age pour chiffrer les sauvegardes                             | 9     |

> Les secrets ne sont jamais visibles dans les logs ni accessibles aux PR de forks.

## 4. Protection de `main` (conseillé)

`Settings → Branches → Add branch ruleset` : cible `main`, cocher **Require status checks to pass**
et sélectionner `Lint, types, tests, build`, `Parcours e2e (Playwright)` et `Scan de secrets (gitleaks)`.
