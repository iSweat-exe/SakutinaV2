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
bun run native:build   # compile l'addon Rust (nécessite cargo) ; sans lui, /card est désactivée
bun run check
bun run test
bun run native:test    # cargo test
```

## Commandes Discord

| Catégorie | Commandes | Accès |
| --- | --- | --- |
| Général | `/ping`, `/userinfo`, `/serverinfo`, `/avatar` | tous |
| Économie | `/balance`, `/work`, `/daily`, `/deposit`, `/withdraw`, `/history` | tous |
| Profil | `/card` (image dessinée par l'addon Rust), `/stats` (tes statistiques et étiquettes) | tous |
| Suivi | `/leaderboard economy`, `/forgetme` (avec confirmation) | tous |
| Suivi | `/stats member:…`, `/leaderboard messages|voice|reactions`, `/inactive`, `/channels`, `/serverstats` | admin et owner |
| Administration | `/health`, `/activity` | admin et owner |
| Phaéthon (profilage) | `/profile` (dossier complet), `/search` (recherche par critères), `/compare` (deux membres) — consultations journalisées | admin et owner |

Pour (re)publier les commandes sur le serveur pilote, renseigner `DISCORD_APPLICATION_ID` dans `apps/bot/.env`, puis :

```bash
bun run commands:register
```

Phaéthon : définir `ALERT_CHANNEL_ID` pour recevoir les alertes. `TRACK_PRESENCE=true` ajoute la présence et les jeux, mais exige d'abord d'activer l'intention privilégiée « Presence » dans le portail développeur Discord (sinon la connexion est refusée). Aucun contenu de message n'est conservé ; `/forgetme` efface aussi ces données.

Rôles : le propriétaire du serveur, les membres avec la permission Discord `Administrator` ou un rôle listé dans `ADMIN_ROLE_IDS` sont `admin` ; `Moderate Members` ou `MODERATOR_ROLE_IDS` donnent `moderator`.

## Structure

```text
apps/bot/      Bot : app/ (assemblage), domain/ (règles), discord/ (commandes, événements), database/, http/ — détail dans docs/architecture.md
apps/panel/    Panneau Next.js (Vercel)
packages/config/  Configuration validée
packages/native/  Addon Rust napi-rs : rendu des cartes (voir son README)
docs/          Architecture
```
