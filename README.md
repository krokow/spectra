# Spectra

PWA de découverte musicale sociale. Un questionnaire adaptatif et ludique construit ton **spectre musical**, sans importer ton historique ; Spectra te recommande ensuite des morceaux et te compare à tes amis.

- Plan d'architecture : [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Configuration GitHub : [`docs/SETUP_GITHUB.md`](docs/SETUP_GITHUB.md)
- Configuration Supabase : [`docs/SETUP_SUPABASE.md`](docs/SETUP_SUPABASE.md)
- Marque : `design/brand/` · Banque de questions (source de vérité) : `supabase/seed/questions.json`

## Démarrage local

Prérequis : Node.js ≥ 22.

```bash
npm install
```

```bash
cp .env.example .env.local   # puis remplis avec TES valeurs Supabase (étape 3)
```

```bash
npm run dev                  # http://localhost:5173
```

## Scripts

| Commande                          | Rôle                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run dev`                     | serveur de dev (régénère les icônes si besoin)                                     |
| `npm run build`                   | icônes, typecheck, build de production dans `dist/`                                |
| `npm run preview`                 | sert le build sur `http://localhost:4173/spectra/`                                 |
| `npm run icons`                   | génère les icônes PWA depuis `design/brand/*.svg` (`-- --force` pour tout refaire) |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                                  |
| `npm run typecheck`               | TypeScript strict                                                                  |
| `npm test`                        | tests unitaires (Vitest)                                                           |
| `npm run test:e2e`                | parcours Playwright (sur le build)                                                 |

## Sécurité

- Aucun secret dans le dépôt : `.env*` ignorés (sauf `.env.example`), **gitleaks** en CI sur tout l'historique.
- Le front ne reçoit que l'URL Supabase et la clé publique ; la sécurité repose sur la RLS.
- CSP stricte injectée au build (`<meta>`, car GitHub Pages ne permet pas d'en-têtes HTTP).

## État

Étape 3 / 9 : comptes (e-mail ou pseudo + mot de passe, sans envoi d'e-mail), codes de secours, profils, confidentialité, export et suppression RGPD, RLS testée.
