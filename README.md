# Sakutina

Bot Discord privé pour Uwu Server (mono-serveur), hébergé sur Render. Le panneau Next.js est isolé dans [`apps/panel/`](./apps/panel) et sera hébergé sur Vercel. Feuille de route : [`Tasks.md`](./Tasks.md) ; architecture : [`docs/architecture.md`](./docs/architecture.md).

## Démarrer le bot

Copier [`apps/bot/.env.example`](./apps/bot/.env.example) vers `apps/bot/.env`, renseigner le token Discord (et `DATABASE_URL` pour persister les données), puis :

```bash
bun install
bun run dev
```

Sans `DATABASE_URL`, le bot utilise un stockage mémoire (données perdues au redémarrage) ; en production, `DATABASE_URL` est obligatoire. Les migrations s'appliquent automatiquement au démarrage.

`GET /api/v1/health` est l'endpoint de liveness. `GET /api/v1/ready` répond `503` tant que la passerelle Discord n'est pas prête.

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
docs/          Architecture
```
