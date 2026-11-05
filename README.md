# Sakutina

Bot Discord multi-serveur (né sur Uwu Server), hébergé sur Render. Le panneau Next.js est isolé dans [`apps/panel/`](./apps/panel) et sera hébergé sur Vercel. Feuille de route : [`Tasks.md`](./Tasks.md) ; architecture : [`docs/architecture.md`](./docs/architecture.md).

## Démarrer le bot

Copier [`apps/bot/.env.example`](./apps/bot/.env.example) vers `apps/bot/.env`, renseigner le token Discord (et `DATABASE_URL` pour persister les données), puis :

```bash
bun install
bun run dev
```

Sans `DATABASE_URL`, le bot utilise un stockage mémoire (données perdues au redémarrage) ; en production, `DATABASE_URL` est obligatoire. Les migrations s'appliquent automatiquement au démarrage.

`GET /api/v1/health` est l'endpoint de liveness. `GET /api/v1/ready` répond `503` tant que la passerelle Discord n'est pas prête.

## Déploiement continu

Tout ce qui arrive sur `main` part en production, une fois la CI verte : le bot sur Render (via le `Dockerfile`), le panneau sur Vercel. Les fichiers qui le configurent sont [`render.yaml`](./render.yaml), [`apps/panel/vercel.json`](./apps/panel/vercel.json) et [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) (qui construit aussi l'image Docker).

**Bot (Render)** — *New > Blueprint*, choisir ce dépôt : Render lit `render.yaml`. Il redéploie à chaque push sur `main` **après** la réussite des contrôles GitHub (`autoDeployTrigger: checksPass`) et seulement si le bot a changé (`buildFilter`). Renseigner ensuite dans le tableau de bord les variables sans valeur (`DISCORD_TOKEN`, `DATABASE_URL`…). Le blueprint utilise le plan gratuit (sans carte bancaire) : il s'endort après 15 min sans requête, donc un moniteur externe (UptimeRobot, toutes les 5 min) doit appeler `/api/v1/health` ; le plan `starter` (payant) reste allumé sans moniteur. Si le service existe déjà, régler les mêmes options dans *Settings* : *Auto-Deploy* = *After CI checks pass*, *Health Check Path* = `/api/v1/health`, *Build Filters* comme dans le fichier.

**Panneau (Vercel)** — *Add New > Project*, choisir ce dépôt, **Root Directory** = `apps/panel`, branche de production = `main`. `vercel.json` fixe les commandes et saute le build quand `apps/panel` n'a pas changé. Renseigner dans *Settings > Environment Variables* les variables de [`apps/panel/.env.example`](./apps/panel/.env.example) (Supabase ; `BOT_API_URL` pour lire la santé du bot). Les sections du panneau dont les données n'existent pas encore sont affichées derrière un cadenas (`apps/panel/src/lib/features.ts`).

**Panneau et base de données** — le panneau ne passe pas par une API du bot : il lit la base Supabase avec la session de l'administrateur connecté (aucun secret de base côté Vercel). Les tables restent fermées ; le panneau n'appelle que les fonctions SQL `panel_*` (migrations `0007` à `0009`, appliquées au démarrage du bot : **redéployer le bot sur Render** pour qu'elles existent). Chacune vérifie d'abord que l'appelant peut gérer le serveur.

Le panneau est **multi-serveur** : `/servers` liste les serveurs où Sakutina est présent et que la personne peut gérer, `/servers/<id>/dashboard` ouvre l'un d'eux. L'accès est automatique pour le propriétaire du serveur et les membres ayant Administrateur ou « Gérer le serveur » (le bot synchronise la liste dans `guild_manager`). Pour un accès manuel en plus (*SQL editor* de Supabase) :

```sql
INSERT INTO panel_admin (guild_id, discord_id, role) VALUES ('<id du serveur>', '<id Discord>', 'owner');
``` Variables du panneau : voir [`apps/panel/.env.example`](./apps/panel/.env.example). Dans Supabase, *Authentication > URL Configuration* doit lister `https://<domaine>/auth/callback` et le fournisseur Discord doit être activé.

**Verrou sur `main`** — GitHub : *Settings > Branches > Add rule* sur `main`, cocher *Require a pull request* et *Require status checks* (`bot`, `native`, `docker`, `panel`, `tools`). Sans cela, un push direct peut encore partir en production.

Les migrations de la base s'appliquent seules au démarrage du bot ; les commandes Discord, elles, doivent être republiées à la main (`bun run commands:register`) quand leur définition change.

## Outils de développement

`bun run verify --changed` (tout ce que la CI vérifie), `bun run new …` (générer une commande, un événement, une migration, une fonction du panneau), `bun run dev:local` (le panneau complet sans Discord ni Supabase), `bun run doctor`, `bun run inventory`. Détail : [`docs/dev-tools.md`](./docs/dev-tools.md). Carte de ce qui existe : [`docs/inventory.md`](./docs/inventory.md). Guide pour les LLM : [`CLAUDE.md`](./CLAUDE.md).

## Vérifier

```bash
bun run native:build   # compile l'addon Rust (nécessite cargo) ; sans lui, /me card est désactivée
bun run check
bun run test
bun run native:test    # cargo test
```

## Commandes Discord

Les commandes sont rangées en 6 sections (`/<section> <commande> <options>`) :

| Section | Sous-commandes | Accès |
| --- | --- | --- |
| `/economy` | `balance`, `work`, `daily`, `deposit`, `withdraw`, `history` | tous |
| `/me` | `stats` (tes statistiques et étiquettes), `card` (image dessinée par l'addon Rust), `forget` (avec confirmation) | tous |
| `/info` | `user`, `avatar`, `ping` | tous |
| `/server` | `info`, `leaderboard economy` | tous |
| `/server` | `leaderboard messages\|voice\|reactions`, `channels`, `stats`, `inactive`, `health` | admin et owner |
| `/me` | `stats member:…` (statistiques d'un autre membre) | admin et owner |
| `/mod` | `warn`, `warnings`, `timeout`, `untimeout`, `kick`, `purge` | modérateur et plus |
| `/mod` | `ban`, `unban`, `unwarn` | admin et owner |
| `/phaethon` | `profile` (dossier complet), `search` (recherche par critères), `compare` (deux membres), `activity` — consultations journalisées | admin et owner |

Le rôle se règle par sous-commande. Discord limite une commande à 25 sous-commandes : au-delà, une section est scindée automatiquement (`/casino`, `/casino2`…).

Modération : permissions Discord à donner au bot (sans `Administrator`) : *Moderate Members* (timeout), *Kick Members*, *Ban Members*, *Manage Messages* (purge). Le bot refuse toute sanction contre soi-même, le propriétaire, un rôle égal ou supérieur, ou un membre que son propre rôle ne domine pas. Chaque action (réussie, refusée ou échouée) est journalisée dans `audit_event` avec l'auteur, la cible, le motif et le résultat.

Pour (re)publier les commandes sur le serveur pilote, renseigner `DISCORD_APPLICATION_ID` dans `apps/bot/.env`, puis :

```bash
bun run commands:register
```

Phaéthon : définir `ALERT_CHANNEL_ID` pour recevoir les alertes. `TRACK_PRESENCE=true` ajoute la présence et les jeux, mais exige d'abord d'activer l'intention privilégiée « Presence » dans le portail développeur Discord (sinon la connexion est refusée). Aucun contenu de message n'est conservé ; `/me forget` efface aussi ces données.

Rôles : le propriétaire du serveur, les membres avec la permission Discord `Administrator` ou un rôle listé dans `ADMIN_ROLE_IDS` sont `admin` ; `Moderate Members` ou `MODERATOR_ROLE_IDS` donnent `moderator`.

## Structure

```text
apps/bot/      Bot : app/ (assemblage), domain/ (règles), discord/ (commandes, événements), database/, http/ — détail dans docs/architecture.md
apps/panel/    Panneau Next.js (Vercel)
packages/config/  Configuration validée
packages/native/  Addon Rust napi-rs : rendu des cartes (voir son README)
tools/         Outils internes (verify, new, dev:local, inventory, doctor)
docs/          Architecture, inventaire généré, outils, fiches pas à pas
```
