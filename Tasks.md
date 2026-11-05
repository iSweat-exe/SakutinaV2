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
| Données | Contenu des messages lu pour la modération mais **jamais conservé** ; suivi par membre de compteurs seulement (messages, caractères, réponses, pièces jointes, mentions, réactions, vocal par salon, arrivées/départs, invitations) + agrégat horaire anonyme + fiche de dates ; **pas de présence** ; conservation **30 jours** (fiche : 30 jours après le départ) ; consultation des données des autres réservée aux Owner et Administrateurs ; `/forgetme` efface les données d'un membre à sa demande. Élargi le 2026-11-04 : le MVP excluait réactions, médias, réponses et profilage. |
| Rust (`napi-rs`) | **Réintégré** (2026-11-04) pour un cas réel : le rendu des cartes de profil (`/card`), dans `packages/native`. Tout nouveau calcul natif doit aussi viser du travail CPU réel ; le contenu et les règles restent en TypeScript. |
| Licence | Privé, publication ultérieure sous GPL. |

Quotas gratuits à revalider avant mise en production : Supabase (500 Mo de base, projets mis en pause après une semaine d'inactivité), Vercel Hobby (usage non commercial). Alerte à 70 % de la taille de base.

## Phase en cours — MVP

Objectif : santé, audit, compteurs d'activité, puis économie de base, sur Uwu Server.

### Fait

- [x] Monorepo Bun/TypeScript (`apps/bot`, `apps/panel`, `packages/config`), CI minimale (`check` + `test`).
- [x] Endpoints `GET /api/v1/health` et `/api/v1/ready`.
- [x] Commandes `/health` et `/activity` (registre unique, contrôle de rôle, textes en français).
- [x] Suivi messages, vocal, arrivées et invitations, avec réhydratation du vocal au démarrage et points de contrôle.
- [x] Persistance PostgreSQL (migrations SQL, RLS activé), purge à 30 jours, arrêt propre avec écriture finale.
- [x] Économie de base : `/balance`, `/work`, `/deposit`, `/withdraw`, `/history` ; comptes portefeuille/banque, grand livre immuable (trigger SQL), idempotence par interaction, opérations atomiques et sérialisées par compte, délai et plafond.
- [x] Suivi des membres : 11 compteurs, détail par salon, heures de pointe, fiche (dernière activité), étiquettes explicables, inactivité ; commandes `/stats`, `/leaderboard`, `/inactive`, `/channels`, `/serverstats`, `/forgetme`.
- [x] Commandes générales (`/ping`, `/userinfo`, `/serverinfo`, `/avatar`) et `/daily` avec série.
- [x] Design system **Components V2** (`discord/ui`) : toutes les réponses sont des panneaux cohérents (Container à couleur par catégorie, sections, galeries, séparateurs) ; interactions `discord/components` : menus, boutons, pagination, modale, confirmation (classement, stats, historique, solde, `/forgetme`).
- [x] `/card` : carte de profil PNG dessinée par l'addon Rust (avatar, activité, solde), avec mode dégradé sans addon.
- [x] Permissions par rôle (member < moderator < admin < owner), sans `Administrator` requis pour le bot.
- [x] Attribution d'invitation prudente (pas d'attribution en cas d'ambiguïté).

### À faire (dans l'ordre)

- [ ] **Brancher la base** : créer le projet Supabase, renseigner `DATABASE_URL` sur Render, vérifier la reprise après pause.
- [ ] Définir `ADMIN_ROLE_IDS` / `MODERATOR_ROLE_IDS` sur Uwu Server.
- [ ] Publier les nouvelles commandes (19 au total) et activer l'intention Discord « Guild Message Reactions » si besoin (non privilégiée).
- [ ] Valider sur Render le build Docker de l'addon Rust (non testé localement) puis `/card` en réel.
- [ ] Re-publier les commandes (`bun run commands:register`) après chaque changement de définition.
- [ ] Modération de base : avertissement, timeout, kick, ban, purge ; chaque action journalisée dans `audit_event` (auteur, cible, motif, résultat).
- [ ] Économie : brancher une boutique qui utilise `EconomyService.spend` (la dépense existe dans le service mais n'a pas encore de commande) ; régler les montants (`/work` : 50–150 toutes les heures, plafond de solde 10¹²) ; afficher soldes et historique dans le panneau.
- [ ] Panneau : sélection du serveur pilote, vue d'ensemble (santé, activité, derniers logs), protection des routes.
- [ ] Invariants de sécurité : une action économique ne déclenche jamais de sanction Discord ; toute action administrative est journalisée.
- [ ] Étendre `/api/v1/health` à l'état de la base.

Critères de sortie : un administrateur voit l'état du bot et l'activité du serveur dans le panneau, modère avec traçabilité, et l'économie de base fonctionne sans perte de données au redémarrage.

## Phases suivantes (non détaillées)

1. **Anti-raid et lockdown réversible** : détection configurable, mode observation, capture atomique des permissions de salons, restauration exacte.
2. **Profilage et inactivité** : tags explicables, fiches membres, export administrateur limité.
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
