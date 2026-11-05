# Sakutina — guide pour les développeurs et les LLM

Bot Discord privé **mono-serveur** (Uwu Server) + panneau d'administration web. Monorepo Bun/TypeScript :
`apps/bot` (Render), `apps/panel` (Next.js 16, Vercel), `packages/config`, `packages/native` (Rust, cartes de profil), `tools/` (outils internes).

## Se repérer

- **[docs/inventory.md](docs/inventory.md)** : ce qui existe (commandes, événements, migrations, tables et colonnes, fonctions `panel_*`, pages et sections verrouillées du panneau, variables d'environnement). Généré : le lire plutôt que d'explorer le code.
- [docs/architecture.md](docs/architecture.md) : les règles et leur « pourquoi » (couches, données conservées, panneau, modération).
- [Tasks.md](Tasks.md) : feuille de route et décisions. [docs/dev-tools.md](docs/dev-tools.md) : les outils ci-dessous en détail.
- [docs/playbooks/](docs/playbooks) : une fiche pas à pas par tâche courante (ajouter une commande, une migration, une fonction du panneau, une page ; vérifier ; lancer la pile locale). **Les lire avant de commencer la tâche correspondante.**

## Les commandes à connaître

| Besoin | Commande |
| --- | --- |
| Vérifier avant de conclure (types, tests, lint, inventaire) | `bun run verify --changed` (ajouter `--full` pour le build du panneau) |
| Ajouter une commande Discord | `bun run new command <section> <nom> --role <rôle>` |
| Ajouter un événement Discord | `bun run new event <Événement>` |
| Changer la base | `bun run new migration <nom> [--table <table>]` |
| Exposer une donnée au panneau | `bun run new panel-fn <nom>` |
| Voir le panneau sans Discord ni Supabase | `bun run dev:local` puis ouvrir `http://localhost:54321/__dev` |
| Diagnostiquer l'environnement | `bun run doctor` (`--online` teste la base et le jeton) |
| Régénérer l'inventaire | `bun run inventory` (la CI échoue s'il est périmé) |

Tous les générateurs acceptent `--dry-run`. Ils créent les fichiers, branchent l'enregistrement, mettent à jour les tests et l'inventaire, vérifient, puis listent ce qu'il reste à écrire. **Les utiliser plutôt que de copier un fichier existant à la main.**

## Règles qui ne se négocient pas

- **Couches** (`apps/bot/src`) : `domain` n'importe ni `discord.js`, ni base, ni HTTP ; `discord` n'importe pas `database`. `test/architecture.test.ts` le vérifie.
- **Textes** : tout texte affiché à un utilisateur du bot est en **français** dans `discord/messages.ts` ; la mise en forme est dans `discord/ui/` (Components V2, pas d'embed, pas d'emoji décoratif, couleurs par catégorie). Toute réponse passe par `ui/replies.ts`.
- **Données** : le contenu d'un message n'est **jamais** conservé. Activité conservée 30 jours (purge dans `app/background-jobs.ts`) ; `/me forget` doit pouvoir tout effacer.
- **Migrations** : `apps/bot/src/database/postgres/migrations/` fait foi. Une migration appliquée **ne se modifie jamais** (en écrire une nouvelle). Toute table active RLS. `schema/` (Drizzle) reste identique : `schema-drift.test.ts` échoue sinon.
- **Panneau ↔ base** : le panneau n'a **aucun secret de base** et ne lit **aucune table**. Il appelle uniquement des fonctions SQL `panel_*` avec la session de l'administrateur. Chaque fonction : `SECURITY DEFINER`, `search_path` fixé, première instruction `PERFORM panel_assert_admin(p_guild_id)`, `EXECUTE` retiré à `PUBLIC` (`panel-functions.test.ts` le vérifie pour toute fonction, présente ou future). L'identité vient de `auth.identities`, jamais de `user_metadata`.
- **Sanctions** : une action économique ne déclenche jamais de sanction Discord ; toute modération est journalisée dans `audit_event`.
- **Déploiement** : tout ce qui arrive sur `main` part en production (Render pour le bot, Vercel pour le panneau). Passer par une branche et une PR. `bun run commands:register` publie **réellement** les commandes sur le serveur : ne jamais l'exécuter sans demande explicite.

## Panneau (`apps/panel`) — Next.js 16

Ce n'est pas le Next.js de votre mémoire. Lire `apps/panel/node_modules/next/dist/docs/` avant d'écrire du code Next (voir `apps/panel/AGENTS.md`). En bref : `middleware` s'appelle `proxy.ts` ; `cacheComponents` est actif, donc tout accès aux cookies/à la session se fait **sous `<Suspense>`** ; la page précédente reste montée (`<Activity>`).

- Le design est entièrement construit ; ce qui n'a pas encore de données est enveloppé dans `<Locked feature="…">` (registre `src/lib/features.ts`). Brancher une section = lui donner des données via `lib/panel-db/`, puis `wired: true`.
- Les composants de vue reçoivent leurs données **en paramètres** (voir `components/dashboard/dashboard-data.tsx` → `dashboard-body.tsx`) : le serveur charge, le client affiche.
- Textes du panneau en **anglais** (c'est le design). Tailwind 4 via PostCSS, jetons de couleur dans `globals.css`.

## Vérifier un changement d'interface

`bun run dev:local` démarre le panneau avec un faux Supabase qui exécute les **vraies** migrations et fonctions `panel_*` sur des données de démonstration. `http://localhost:54321/__dev/login?as=owner` (ou `admin`, `stranger`) ouvre une session directement ; Playwright (installé dans l'environnement distant) peut le piloter. Pour l'état « bot en panne » : `http://localhost:3999/api/v1/health?state=degraded`.

## Pièges connus

- Les tests de base tournent sur PGlite (PostgreSQL en WebAssembly) : le schéma `auth` de Supabase y est imité par `test/support/fake-supabase.ts`.
- `apps/panel/bun.lock` est un vestige : la source de vérité est `bun.lock` à la racine.
- Le build de production du panneau est `next build --webpack` (pas Turbopack) ; `next dev` utilise Turbopack.
- Supabase gratuit : 500 Mo, projet mis en pause après une semaine sans activité.
