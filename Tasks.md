# Sakutina — feuille de route

> Document de pilotage vivant. Seule la phase en cours est détaillée ; les phases suivantes tiennent en une ligne et seront détaillées quand elles démarrent.

## Vision

Bot Discord privé pour **un seul serveur** (Uwu Server, `1317931106993180763`) avec un panneau web d'administration. Il rend la communauté plus sûre et plus engageante et donne aux administrateurs une lecture fiable de l'activité.

## Décisions confirmées

| Sujet | Décision |
| --- | --- |
| Périmètre | **Mono-serveur Discord** (2026-11-04). `guildId` reste un paramètre des fonctions métier ; le multi-serveur est reporté tant qu'aucun second serveur n'est prévu. |
| Hébergement | Bot + API : Render (`https://sakutina.isweat.pro`, `GET /api/v1/health`). Panneau : Vercel (`https://panel.isweat.pro`). |
| Stockage | **PostgreSQL (Supabase) uniquement.** Redis, Cloudflare R2 et le temps réel Supabase sont reportés jusqu'à un besoin mesuré. |
| Données | Contenu des messages lu pour la modération mais **jamais conservé** ; suivi par membre de compteurs seulement (messages, caractères, réponses, pièces jointes, mentions, réactions, vocal par salon, arrivées/départs, invitations) + agrégat horaire anonyme + fiche de dates ; présence (statut, jeux) **uniquement si `TRACK_PRESENCE`**, voir Phaéthon ; conservation **30 jours** (fiche : 30 jours après le départ) ; consultation des données des autres réservée aux Owner et Administrateurs ; `/me forget` efface les données d'un membre à sa demande. Élargi le 2026-11-04 : le MVP excluait réactions, médias, réponses et profilage. |
| Phaéthon | **Profilage complet** (2026-11-05) : relations entre membres (réponses, mentions, réactions, vocal commun), rythme horaire par membre, historique d'identité (pseudo, nom, avatar, rôles, boost, timeout), présence et activités Discord (option `TRACK_PRESENCE`), dossier `/phaethon profile`, recherche `/phaethon search`, comparaison `/phaethon compare`, alertes dans `ALERT_CHANNEL_ID`. **Jamais de contenu de message conservé.** Détail 30 jours, **résumé mensuel durable** par membre (supprimé 30 jours après le départ). `/me forget` reste ouvert à tous et efface aussi ces données. Toute consultation admin est journalisée. |
| Rust (`napi-rs`) | **Réintégré** (2026-11-04) pour un cas réel : le rendu des cartes de profil (`/me card`), dans `packages/native`. Tout nouveau calcul natif doit aussi viser du travail CPU réel ; le contenu et les règles restent en TypeScript. |
| Licence | Privé, publication ultérieure sous GPL. |

Quotas gratuits à revalider avant mise en production : Supabase (500 Mo de base, projets mis en pause après une semaine d'inactivité), Vercel Hobby (usage non commercial). Alerte à 70 % de la taille de base.

## Phase en cours — MVP

Objectif : santé, audit, compteurs d'activité, puis économie de base, sur Uwu Server.

### Fait

- [x] Monorepo Bun/TypeScript (`apps/bot`, `apps/panel`, `packages/config`), CI minimale (`check` + `test`).
- [x] Endpoints `GET /api/v1/health` et `/api/v1/ready`.
- [x] Commandes `/server health` et `/phaethon activity` (registre unique, contrôle de rôle, textes en français).
- [x] Suivi messages, vocal, arrivées et invitations, avec réhydratation du vocal au démarrage et points de contrôle.
- [x] Persistance PostgreSQL (migrations SQL, RLS activé), purge à 30 jours, arrêt propre avec écriture finale.
- [x] Économie de base : `/economy balance`, `/economy work`, `/economy deposit`, `/economy withdraw`, `/economy history` ; comptes portefeuille/banque, grand livre immuable (trigger SQL), idempotence par interaction, opérations atomiques et sérialisées par compte, délai et plafond.
- [x] Suivi des membres : 11 compteurs, détail par salon, heures de pointe, fiche (dernière activité), étiquettes explicables, inactivité ; commandes `/me stats`, `/server leaderboard`, `/server inactive`, `/server channels`, `/server stats`, `/me forget`.
- [x] Commandes générales (`/info ping`, `/info user`, `/server info`, `/info avatar`) et `/economy daily` avec série.
- [x] Design system **Components V2** (`discord/ui`) : toutes les réponses sont des panneaux cohérents (Container à couleur par catégorie, sections, galeries, séparateurs) ; interactions `discord/components` : menus, boutons, pagination, modale, confirmation (classement, stats, historique, solde, `/me forget`).
- [x] **Phaéthon** (`domain/phaethon`) : relations, rythme, identité, présence/jeux, résumés mensuels, `/phaethon profile`, `/phaethon search`, `/phaethon compare`, alertes (compte récent, identité changeante, membre régulier silencieux, pic d'activité), purge et effacement.
- [x] `/me card` : carte de profil PNG dessinée par l'addon Rust (avatar, activité, solde), avec mode dégradé sans addon.
- [x] Permissions par rôle (member < moderator < admin < owner), sans `Administrator` requis pour le bot.
- [x] Attribution d'invitation prudente (pas d'attribution en cas d'ambiguïté).

### À faire (dans l'ordre)

- [ ] **Déploiement continu** : suivre « Déploiement continu » du README (Blueprint `render.yaml`, projet Vercel avec racine `apps/panel`, règle de protection de `main` exigeant `bot`, `native`, `docker`, `panel` et `tools`).
- [ ] **Brancher la base** : créer le projet Supabase, renseigner `DATABASE_URL` sur Render, vérifier la reprise après pause.
- [ ] Définir `ADMIN_ROLE_IDS` / `MODERATOR_ROLE_IDS` sur Uwu Server.
- [ ] Publier les nouvelles commandes (6 commandes de premier niveau, 31 sous-commandes ; la publication remplace les anciennes commandes) et activer l'intention Discord « Guild Message Reactions » si besoin (non privilégiée).
- [ ] Valider sur Render le build Docker de l'addon Rust (non testé localement) puis `/me card` en réel.
- [ ] **Phaéthon** : définir `ALERT_CHANNEL_ID` ; pour la présence et les jeux, activer l'intention privilégiée « Presence » dans le portail développeur Discord **avant** de mettre `TRACK_PRESENCE=true` (sinon la connexion est refusée).
- [ ] Re-publier les commandes (`bun run commands:register`) après chaque changement de définition.
- [x] Modération de base : `/mod warn|warnings|unwarn|timeout|untimeout|kick|ban|unban|purge` ; chaque action journalisée dans `audit_event` (auteur, cible, motif, résultat), garde-fous de hiérarchie. Reste : donner au bot les permissions *Moderate Members*, *Kick Members*, *Ban Members* et *Manage Messages*.
- [ ] Économie : brancher une boutique qui utilise `EconomyService.spend` (la dépense existe dans le service mais n'a pas encore de commande) ; régler les montants (`/economy work` : 50–150 toutes les heures, plafond de solde 10¹²) ; afficher soldes et historique dans le panneau.
- [x] Panneau : design complet en React (login, serveurs, dashboard, Anti-Raid, Moderation, Phaethon, Balance, Casino, Profiling, Modules, design system), connexion Discord (Supabase), routes protégées (`proxy.ts`), statut du bot lu sur `/api/v1/health`. Le reste est **verrouillé** (cadenas) : voir `apps/panel/src/lib/features.ts`.
- [x] Panneau branché sur la base (pas d'API REST) : migration `0007_panel_access.sql` (`panel_admin`, fonctions `panel_role`, `panel_overview`, `panel_recent_audit`), couche `apps/panel/src/lib/panel-db`, dashboard alimenté (messages, pièces, membres actifs, activité horaire, dernières sanctions). Autorisation par la base (RLS/`panel_admin`).
- [ ] **Après le déploiement du bot** (la migration 0007 s'applique au démarrage) : `INSERT INTO panel_admin …` pour chaque administrateur (voir README), variables Vercel, test réel de la connexion.
- [ ] Panneau : faire remplir `panel_admin` par le bot (propriétaire, `Administrator`, `ADMIN_ROLE_IDS`) au lieu d'un `INSERT` manuel.
- [ ] Panneau : **noms des membres**. La base ne stocke que des identifiants ; il faut un annuaire (nom, pseudo, avatar) tenu par le bot, nécessaire à Moderation, Phaethon, Profiling et au dashboard (lignes « Muted …4457 »).
- [ ] Panneau, déverrouiller le reste (`apps/panel/src/lib/features.ts`) : fonctions `panel_*` pour Moderation (avertissements, audit), Balance (comptes, grand livre), Profiling ; scores de risque Phaethon (à calculer et écrire par le bot, absents aujourd'hui) ; table de réglages lue par le bot (modules, bascules) ; Anti-Raid et casino restent à construire ; table de commandes pour les actions (bannir…).
- [x] Outils internes (`tools/`, voir `docs/dev-tools.md`) : `verify` (tout ce que la CI vérifie, seulement ce que le changement touche), `new` (générer commande, événement, migration, fonction du panneau), `dev:local` (panneau complet sur de vraies migrations, sans Discord ni Supabase), `inventory` (carte générée de ce qui existe), `doctor` ; garde-fous automatiques (dérive du schéma Drizzle, sécurité de toute fonction `panel_*`, RLS partout) ; `CLAUDE.md` et fiches pas à pas pour les LLM ; jobs CI `panel` et `tools`.
- [x] Invariants de sécurité : une action économique ne déclenche jamais de sanction Discord (`domain/` n'importe pas `discord.js`) ; toute action de modération est journalisée.
- [ ] Étendre `/api/v1/health` à l'état de la base.

Critères de sortie : un administrateur voit l'état du bot et l'activité du serveur dans le panneau, modère avec traçabilité, et l'économie de base fonctionne sans perte de données au redémarrage.

## Phases suivantes (non détaillées)

1. **Anti-raid et lockdown réversible** : détection configurable, mode observation, capture atomique des permissions de salons, restauration exacte.
2. **Profilage et inactivité** : fait pour l'essentiel avec Phaéthon ; reste l'export administrateur limité et les vues du panneau web.
3. **Économie complète** : transferts, classement, casino, anti-triche explicable avec revue humaine (aucune sanction Discord possible).
4. **Communauté** : onboarding, cartes de bienvenue, salons vocaux temporaires, giveaways, interactions sociales.
5. **Intégrations** : osu!, Geometry Dash.
6. **Production** : sauvegardes, alertes, modes dégradés, tests de charge, runbooks.

## Journal des décisions

| Date | Décision | Impact |
| --- | --- | --- |
| 2026-11-02 | Hébergement, serveur pilote, politique de données (30 jours) et MVP définis. | Cadre le périmètre. |
| 2026-11-02 | Panneau déplacé dans `apps/panel` ; build Webpack (Turbopack échoue localement dans son worker CSS). | Build Vercel déterministe. |
| 2026-11-04 | Diagnostic d'architecture : mono-serveur, PostgreSQL seul, suppression des interfaces et paquets sans appelant, Rust sorti du workspace, registre de commandes unique, permissions par rôle. | Structure réduite à ce qui est utilisé. |
| 2026-11-05 | Phaéthon : profilage complet sans contenu de message ; présence derrière `TRACK_PRESENCE` ; résumé mensuel durable ; `/me forget` efface tout, relations comprises. | Élargit le suivi (réactions, médias… → relations, présence, identité). |
| 2026-11-05 | Commandes rangées en sections : `/economy`, `/me`, `/info`, `/server`, `/phaethon` (sous-commandes, rôle par sous-commande, scission automatique à 25 : `/casino`, `/casino2`). | Passe de 22 commandes à 5 dans la barre Discord ; aucune fonctionnalité retirée. |
| 2026-11-05 | Panneau : lecture directe de la base avec la session de l'admin, via des fonctions `panel_*` ; le bot écrit toutes les 60 s comme avant. Pas d'API REST. Volume (500 Mo) à optimiser seulement s'il pose problème. | Pas de secret de base côté Vercel ; autorisation dans la base ; actions Discord via une future table de commandes. |
| 2026-11-05 | Outils internes : générateurs plutôt que copier-coller, inventaire généré et vérifié par la CI, pile locale sur les vraies migrations, garde-fous en tests. Fiches pas à pas dans `docs/playbooks/` (tout LLM ou développeur) ; réglages propres à un outil d'agent non versionnés. | Ajouter une fonctionnalité devient un geste outillé et vérifié ; le panneau est enfin contrôlé par la CI. |
| 2026-11-05 | Modération de base (`/mod`) : journal d'audit pour chaque action, avertissements conservés un an hors du périmètre de `/me forget`. | Les sanctions restent traçables au-delà des 30 jours de l'audit grâce aux avertissements. |
