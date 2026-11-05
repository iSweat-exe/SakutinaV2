# Outils internes

Tout part de la racine : `bun run <outil>`. Le code est dans [`tools/`](../tools) (TypeScript, aucune dépendance en dehors de PGlite). Pour les LLM : [`CLAUDE.md`](../CLAUDE.md) et les [fiches pas à pas](./playbooks).

| Outil | À quoi il sert |
| --- | --- |
| [`verify`](#verify) | Lancer en un coup tout ce que la CI vérifie, et seulement ce que le changement touche |
| [`new`](#new) | Générer une commande, un événement, une migration ou une fonction du panneau sans rien oublier |
| [`dev:local`](#devlocal) | Faire tourner le panneau complet sans Discord, sans Supabase, sans compte |
| [`inventory`](#inventory) | Carte à jour de ce qui existe (générée, vérifiée par la CI) |
| [`doctor`](#doctor) | Diagnostiquer l'environnement, avec le remède |

## verify

```bash
bun run verify               # types + tests + lint de tout
bun run verify --changed     # seulement ce que vos changements touchent (comparé à main)
bun run verify --full        # ajoute le build de production du panneau
bun run verify --only bot,panel:lint   # étapes ou familles précises
bun run verify --list        # les étapes
bun run verify --json        # résumé lisible par une machine (LLM, scripts)
```

Les étapes tournent en parallèle ; seule la sortie des étapes en échec est affichée. Les étapes sont déclarées dans [`tools/lib/steps.ts`](../tools/lib/steps.ts) : ajouter une vérification = une ligne.

## new

```bash
bun run new command economy shop --role member --description "Voir la boutique"
bun run new event GuildBanAdd
bun run new migration shop_items --table shop_item
bun run new panel-fn economy_summary
```

Chaque générateur calcule **tout en mémoire d'abord** : si une modification ne s'applique pas (motif introuvable), rien n'est écrit et le message dit quoi chercher ; un fichier existant n'est jamais écrasé. `--dry-run` montre sans écrire. Ensuite : inventaire régénéré, vérifications ciblées, et la liste de ce qu'il reste à écrire à la main.

| Générateur | Crée | Modifie |
| --- | --- | --- |
| `command` | fichier de commande, test | registre (import + section), `messages.ts`, test du registre |
| `event` | fichier d'événement, test | liste des événements |
| `migration` | `NNNN_nom.sql` ; avec `--table` : table + RLS + définition Drizzle | `schema/index.ts` |
| `panel-fn` | migration sécurisée `panel_<nom>`, test de base, lecteur serveur, validation et test côté panneau | — |

Les générateurs sont testés sur une copie jetable des fichiers réels ([`tools/test/generators.test.ts`](../tools/test/generators.test.ts)) : si la mise en forme du registre change, c'est ce test qui échoue.

## dev:local

```bash
bun run dev:local                  # panneau (3000) + faux Supabase (54321) + faux bot (3999)
bun run dev:local --no-panel       # seulement la base et le bot factices
bun run dev:local --panel-port 3100 --port 54400 --bot-port 3998
```

Ouvrir `http://localhost:54321/__dev`, puis se connecter comme **Mika** (propriétaire), **Aiko** (admin) ou **Visiteur** (doit être refusé). Ou directement : `http://localhost:54321/__dev/login?as=owner&to=/dashboard`.

Ce n'est pas une maquette : les **vraies** migrations et les **vraies** fonctions `panel_*` tournent sur PGlite, avec environ 80 membres, 72 h d'activité, une économie et des sanctions de démonstration. Un visiteur est donc refusé par la base elle-même. Un changement de migration ou de fonction se voit au redémarrage de la pile. Faux bot « Discord déconnecté » : `http://localhost:3999/api/v1/health?state=degraded`.

## inventory

`bun run inventory` écrit [`docs/inventory.md`](./inventory.md) : commandes (rôle, options, fichier), événements, migrations, tables et colonnes (RLS), fonctions `panel_*`, pages du panneau, sections branchées ou verrouillées, variables d'environnement, scripts. `--check` échoue s'il est périmé (`verify` et la CI l'utilisent), `--stdout` l'affiche sans l'écrire. Rendu déterministe : pas de date, pas de bruit dans les diffs.

## doctor

`bun run doctor` vérifie Bun, les dépendances, l'addon Rust, `apps/bot/.env` (avec la validation de configuration réelle du bot), la configuration du panneau et les ports ; chaque problème vient avec sa commande de réparation. Les secrets sont masqués. `--online` teste aussi la connexion à la base et la validité du jeton Discord.

## Garde-fous automatiques

Ajoutés avec ces outils, ils s'exécutent dans `bun test` du bot :

- **Dérive du schéma** (`schema-drift.test.ts`) : les tables et colonnes de `schema/` (Drizzle) doivent être identiques à celles des migrations. Une migration qui oublie `schema/` échoue avec le détail de l'écart.
- **Fonctions `panel_*`** (`panel-functions.test.ts`) : toute fonction, présente ou future, doit être `SECURITY DEFINER` avec `search_path` fixé, commencer par `PERFORM panel_assert_admin`, avoir `EXECUTE` retiré à `PUBLIC`, et refuser un inconnu, un anonyme et l'administrateur d'un autre serveur.
- **RLS partout** (`postgres.test.ts`) : toute table du schéma public a RLS, sans liste à maintenir.

## Brancher les fiches sur votre outil

Les fiches de [`docs/playbooks/`](./playbooks) sont des Markdown avec un en-tête `description` / `argument-hint`. Pour les utiliser comme commandes slash de Claude Code, copiez-les dans le dossier `commands` de la configuration de projet de l'outil (elles fonctionnent telles quelles). Elles restent lisibles par n'importe quel LLM ou développeur sans cela.
