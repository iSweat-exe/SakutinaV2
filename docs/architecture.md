# Architecture Sakutina

## Principes

- **Multi-serveur Discord** (depuis le 2026-11-05) : le bot sert tous les serveurs qui l'invitent. Toute donnée est rangée par `guild_id` ; une commande agit toujours sur le serveur de l'interaction (`discord/guild.ts`, `guildIdOf`), jamais sur un serveur fixé. Les réglages propres à chaque serveur (rôles du bot, salon d'alertes) sont dans `guild_settings`. Le bot tient `bot_guild` (ses serveurs) et `guild_manager` (qui peut gérer chaque serveur : Administrateur ou « Gérer le serveur ») à jour pour le panneau (`discord/guilds/guild-sync.ts`). `DISCORD_PRIMARY_GUILD_ID` ne sert plus qu'à reprendre les anciens réglages du serveur historique et à retirer ses anciennes commandes de serveur.
- **Rien sans appelant** : une interface, un paquet ou une dépendance est créé quand la première fonctionnalité en a besoin.
- **Un seul stockage** : PostgreSQL (Supabase). Redis, R2 et le temps réel Supabase attendent un besoin mesuré.
- **Rust seulement pour du travail CPU** : l'addon `packages/native` ne dessine que ; le contenu, les permissions et les règles restent en TypeScript.

## Où trouver quoi

```text
apps/bot/src/
  main.ts                       Point d'entrée : lit la config et démarre l'application
  app/                          Assemblage : fabrique les pièces et les relie
    start-application.ts          Orchestre le démarrage et l'arrêt propre
    storage.ts                    Choisit PostgreSQL ou la mémoire pour tous les stockages
    card-renderer.ts              Branche l'addon Rust (ou désactive /me card s'il manque)
    background-jobs.ts            Tâches périodiques : écriture de l'activité, purge à 30 jours
  domain/                       Règles métier pures : ni Discord, ni SQL, ni HTTP
    activity/                     Compteurs (11), tampon, suivi vocal par salon, analyses (classements, totaux)
    audit/                        Événements d'audit et interface de journal
    cards/                        Interface CardRenderer (le dessin est fait ailleurs)
    economy/                      Comptes, grand livre, règles (/economy work, dépôt, retrait, dépense)
    health/                       Instantané de santé du bot
    insights/                     Étiquettes explicables (actif, inactif, bavard…) et leurs seuils
    invites/                      Attribution d'une arrivée à une invitation
    moderation/                   Avertissements, durée de timeout, garde-fous de hiérarchie
    members/                      Fiche minimale d'un membre (dates) et détection d'inactivité
    phaethon/                     Profilage : relations, rythme, présence, identité, dossier, recherche, alertes
    permissions/                  Rôles du bot : member < moderator < admin < owner
  discord/                      Tout ce qui parle à Discord
    client.ts                     Création du client discord.js et des intents
    handler-context.ts            Dépendances fournies aux commandes et aux événements
    messages.ts                   Textes affichés aux utilisateurs (français)
    ui/                           Design system Components V2 : thème, panneaux, contrôles, envoi des réponses
    components/                   Boutons, menus et modales : identifiants, gestionnaires par espace de noms
    formatting.ts                 Montants, durées, temps vocal
    commands/                     Slash commands
      index.ts                      Liste unique des commandes
      command.ts                    Forme d'une commande (définition, rôle minimal, handler)
      administration/               /server health, /phaethon activity (admin et owner)
      economy/                      /economy balance, /economy work, /economy daily, /economy deposit, /economy withdraw, /economy history
      general/                      /info ping, /info user, /server info, /info avatar
      tracking/                     /me stats, /server leaderboard, /server inactive, /server channels, /server stats, /me forget
      phaethon/                     /phaethon profile, /phaethon search, /phaethon compare (admin et owner) et leurs panneaux
      profile/                      /me card et le contenu de la carte
    alerts/                       Publication des alertes de Phaéthon dans ALERT_CHANNEL_ID
    events/                       Un fichier par événement Discord (+ index.ts, la liste unique)
    invites/                      Lecture des invitations Discord (utilise discord.js)
  database/                     Implémentations des stockages définis dans domain/
    postgres/                     Production
      connection.ts                 Pool de connexions et type Database
      migrate.ts                    Applique les migrations SQL au démarrage
      migrations/                   NNNN_nom.sql, les migrations font foi
      schema/                       Tables Drizzle, un fichier par domaine
      repositories/                 PostgresActivityStore, PostgresMemberStore, PostgresAuditLog, PostgresEconomyStore
    in-memory/                    Développement et tests (données perdues au redémarrage)
  http/                         Serveur HTTP : /api/v1/health et /api/v1/ready
  shared/                       Utilitaires sans logique métier : logger, téléchargement borné
  scripts/                      register-commands.ts : publie les slash commands
tools/                          Outils internes : verify, new, dev:local, inventory, doctor (voir dev-tools.md)
packages/
  config/                       Configuration validée (variables d'environnement)
  native/                       Addon Rust : rendu des cartes (voir son README)
```

Les tests de `apps/bot/test/` reproduisent cette arborescence : `test/domain/economy/` teste `src/domain/economy/`.

## Règle de dépendance

| Dossier | Peut importer | Ne doit jamais importer |
| --- | --- | --- |
| `domain` | lui-même | `discord.js`, `discord`, `database`, `http`, `app`, `drizzle-orm`, `postgres` |
| `database` | `domain`, `shared` | `discord.js`, `discord`, `http`, `app` |
| `discord` | `domain`, `shared` | `database`, `http`, `app` |
| `http` | `domain`, `shared` | `discord.js`, `discord`, `database`, `app` |
| `shared` | lui-même | tous les autres dossiers |
| `app` | tout | — (c'est la seule couche qui assemble) |

`test/architecture.test.ts` applique ce tableau : un import interdit fait échouer les tests. Les interfaces de stockage vivent dans `domain` ; leurs implémentations dans `database`.

Quand une fonctionnalité grossit (modération, économie), elle gagne un dossier dans `domain/` et un dossier dans `discord/commands/` ; rien d'autre ne bouge.

## Flux de données de l'activité

1. Les événements Discord incrémentent `ActivityTracker` (tampon de deltas en mémoire).
2. Le vocal passe par `VoiceSessionTracker` (entrées/sorties → durées). Au démarrage, les membres déjà en vocal sont réhydratés.
3. Toutes les 60 s (et à l'arrêt), `app/background-jobs.ts` fait un point de contrôle vocal puis `ActivityService.flush` écrit les deltas de façon additive (`ON CONFLICT DO UPDATE`). Un échec remet les deltas en tampon.
4. Toutes les 6 h (et au démarrage), purge à 30 jours de `activity_daily` et `audit_event`.
5. `/phaethon activity` additionne le store et le tampon non encore écrit.

Sans `DATABASE_URL` (hors production uniquement), les stores mémoire sont utilisés ; la production refuse de démarrer sans base.

## Suivi des membres

Ce que le bot enregistre, par membre et par jour UTC (`domain/activity/counters.ts`) : messages, caractères écrits, réponses, pièces jointes, mentions, réactions données et reçues, temps vocal, arrivées, départs, invitations attribuées. S'y ajoutent le détail **par salon** (messages et vocal), un agrégat **anonyme par heure** (sans identifiant de membre) et une **fiche minimale** par membre (première observation, arrivée, départ, dernière activité).

**Jamais enregistré** : le contenu des messages, le contenu ou le nom des pièces jointes, les liens, le statut personnalisé. Seule la longueur d'un message passe, comme nombre. La présence (statut, jeux) n'est suivie que par Phaéthon, si `TRACK_PRESENCE` est activé (voir plus bas).

Flux : les événements Discord (`message-create`, `message-reaction-add`, `voice-state-update`, `guild-member-add`, `guild-member-remove`) alimentent `ActivityTracker` (tampon). Toutes les 60 s, `ActivityService.flush` écrit la présence (idempotente) puis les compteurs (additifs) ; un échec remet le lot en tampon. Au démarrage, le bot recharge les sessions vocales et crée les fiches des membres déjà présents.

Accès : chacun voit **ses propres** statistiques (`/me stats`, `/me card`) ; l'activité des autres, les classements d'activité, `/server inactive`, `/server channels`, `/server stats`, `/phaethon profile`, `/phaethon search` et `/phaethon compare` sont réservés aux administrateurs. Le classement de richesse est public (monnaie de jeu).

Conservation : compteurs, détails par salon et agrégats horaires sont purgés à 30 jours (le détail quotidien est d'abord résumé par mois, voir Phaéthon) ; la fiche d'un membre parti est purgée 30 jours après son départ. `/me forget confirm:true` efface à la demande les compteurs, les salons et la fiche du demandeur (l'économie et le journal d'audit sont conservés ; l'audit est purgé à 30 jours).

Étiquettes (`domain/insights`) : « nouveau », « actif », « inactif », « bavard », « pilier vocal », « sociable », « partageur de médias ». Chacune est calculée sur 30 jours avec des seuils écrits dans `insight-rules.ts` et s'affiche avec sa mesure et son seuil : ce sont des indications, pas des jugements.

## Phaéthon : le profilage du serveur

`domain/phaethon` réunit ce que le bot sait de chaque membre, **uniquement sous forme de métadonnées** : nombres, durées, noms publics, dates. Le contenu d'un message n'est lu que pour en mesurer la longueur et n'est jamais conservé ; le statut personnalisé et les détails d'activité (titre d'un morceau) sont ignorés.

| Donnée | Source | Table | Conservation |
| --- | --- | --- | --- |
| Relations (réponses, mentions, réactions, vocal commun) | `message-create`, `message-reaction-add`, `voice-state-update` | `social_edge_daily` | 30 j |
| Rythme (messages par heure UTC et par membre) | `message-create` | `member_hour_daily` | 30 j |
| Temps en ligne / absent / ne pas déranger | `presence-update` (si `TRACK_PRESENCE`) | `presence_status_daily` | 30 j |
| Activités Discord (jeu, musique, stream) | `presence-update` | `presence_game_daily` | 30 j |
| Changements de pseudo, nom, avatar, rôles, boost, timeout | `guild-member-update`, `user-update` | `identity_event` | 30 j |
| Résumé mensuel (les 11 compteurs + jours actifs) | purge du détail quotidien | `activity_monthly` | tant que le membre est présent, +30 j après son départ |
| Alertes déjà émises | `PhaethonService` | `phaethon_alert` | 30 j |

Flux : les événements alimentent `PhaethonTracker` (tampon de deltas, comme `ActivityTracker`) ; le vocal commun vient de `VoiceCoPresence` (temps crédité à chaque paire présente dans un salon d'au plus 25 membres) et la présence de `PresenceSessions`. Toutes les 60 s, `PhaethonService.flush` écrit les deltas de façon additive ; un échec remet le lot en tampon. La purge (toutes les 6 h) résume d'abord le détail quotidien par mois, dans la même transaction que sa suppression.

Consultation (admin et owner, toujours en privé et **journalisée** dans `audit_event` : `profile.viewed`, `profile.compared`, `profile.searched`) :
- `/phaethon profile member` : dossier complet (identité, activité, rythme, salons, relations, présence, jeux, chronologie d'identité, mois précédents, étiquettes) ;
- `/phaethon search` : membres par critères combinés (messages, vocal, oiseau de nuit, ancienneté, inactivité, jeu, étiquette, échanges avec un membre) ;
- `/phaethon compare` : deux membres côte à côte (activité, échanges entre eux, contacts et jeux en commun, ressemblance de rythme).

Alertes (`ALERT_CHANNEL_ID`, évaluées toutes les 30 min, jamais deux fois la même grâce à `phaethon_alert`) : compte Discord créé depuis moins de 7 jours qui rejoint, au moins 4 changements de nom ou d'avatar en 24 h, membre régulier sans aucune activité depuis 5 jours, pic de messages supérieur à 5 fois sa moyenne. Seuils dans `phaethon-rules.ts`, mesure et seuil toujours affichés.

Droit à l'effacement : `/me forget` reste ouvert à tous et efface aussi les données de Phaéthon du demandeur, **comme source et comme cible** des relations, ainsi que ses résumés mensuels. Les données des membres partis sont effacées 30 jours après leur départ.

Présence : l'intention privilégiée « Presence » doit être activée dans le portail développeur avant de mettre `TRACK_PRESENCE=true` ; sans elle, Discord refuse la connexion. Limite connue : l'auteur d'une réponse n'est connu que s'il est mentionné ou en cache (aucun appel réseau par message).

## Modération

Section `/mod` : `warn`, `warnings`, `unwarn`, `timeout`, `untimeout`, `kick`, `ban`, `unban`, `purge`. Modérateur pour `warn`, `warnings`, `timeout`, `untimeout`, `kick`, `purge` ; administrateur pour `ban`, `unban`, `unwarn`.

Toute sanction passe par `discord/commands/moderation/shared.ts` (`sanction`) : récupération de l'auteur et de la cible, **garde-fous** (`domain/moderation/moderation-rules.ts`), action Discord, journal d'audit, message privé à la cible, réponse privée au modérateur. Garde-fous : pas contre soi-même, le bot ou le propriétaire ; la cible doit avoir un rôle du bot **strictement inférieur** et un plus haut rôle Discord **strictement inférieur** (sauf pour le propriétaire du serveur) ; le bot doit pouvoir agir (`kickable`, `bannable`, `moderatable`). Un bannissement peut viser un utilisateur absent du serveur (par son identifiant). Une action n'est jamais tentée sans que son résultat soit journalisé : `ok`, `refused:<raison>` ou `failed`.

Journal : `audit_event` (`moderation.warn|unwarn|timeout|untimeout|kick|ban|unban|purge`) avec auteur, cible, motif et résultat ; purgé à 30 jours comme tout l'audit. Les **avertissements** sont à part (`moderation_warning`, migration 0006) car ils servent de mémoire aux modérateurs : conservés **un an** ou jusqu'à `/mod unwarn`, et **non effacés par `/me forget`** (comme l'économie et l'audit, c'est annoncé dans le dialogue d'effacement). Le message privé envoyé à la cible (avertissement, timeout, expulsion, bannissement) est au mieux : des messages privés fermés ne bloquent jamais la sanction. `purge` lit les derniers messages pour les supprimer, sans les conserver, et ne touche pas à ceux de plus de 14 jours (limite de Discord).

Invariant : `domain/` n'importe jamais `discord.js` (vérifié par test) ; une opération économique ne peut donc déclencher aucune sanction.

## Panneau web : lecture de la base

Le bot écrit en base (compteurs toutes les 60 s, comme décrit plus haut) ; le panneau (`apps/panel`) la **lit directement**, sans API REST. Choix du 2026-11-05 : la base est la seule source de vérité, et une API n'aurait montré que le tampon en mémoire du bot.

- **Aucun secret côté panneau.** Le panneau interroge Supabase avec la session de l'utilisateur connecté (Discord OAuth). Les tables ont RLS sans politique : elles restent illisibles pour `anon` et `authenticated`.
- **Une porte d'entrée : les fonctions `panel_*`** (`SECURITY DEFINER`, migration `0007`). Chacune appelle `panel_assert_admin(guild_id)` puis renvoie un agrégat prêt à afficher (`panel_overview`, `panel_recent_audit`). Le rôle de l'appelant vient de `auth.identities` (fournisseur Discord) croisé avec `panel_admin` (ajouts manuels, prioritaires), puis, si le bot est sur le serveur, avec `bot_guild.owner_id` (propriétaire) et `guild_manager` (gestionnaires synchronisés par le bot, migration `0008`) ; jamais avec `user_metadata` que l'utilisateur peut modifier. `EXECUTE` est retiré à `PUBLIC` et `anon`.
- **Côté panneau** : `src/lib/panel-db/` (appel des fonctions, validation de la réponse, jamais de confiance aveugle). Un refus de la base (`42501`) devient « accès refusé », toute autre panne « indisponible ».
- **Ajouter une vue** : une fonction `panel_*` dans une nouvelle migration (avec `panel_assert_admin` en première ligne et un test dans `test/database/postgres/panel-access.test.ts`), un lecteur dans `lib/panel-db`, puis passer la section à `wired: true` dans `apps/panel/src/lib/features.ts`.
- **Actions** (bannir, révoquer un mute…) : la base seule ne peut pas les exécuter, Discord n'est joignable que par le bot. Prévu : une table de commandes que le panneau écrit et que le bot consomme (à concevoir).

## Base de données

Migrations (0001 initiale, 0002 économie, 0003 suivi, 0004 récompense quotidienne, 0005 Phaéthon, 0006 modération, 0007 accès du panneau) SQL versionnées dans `database/postgres/migrations/` (`NNNN_nom.sql`, instructions séparées par `--> statement-breakpoint`), appliquées au démarrage et enregistrées dans `schema_migrations`. Le dossier `schema/` (Drizzle) doit rester aligné avec elles. Les tables ont RLS activé sans politique : la clé `anon` de Supabase ne peut rien lire ; seul le rôle de connexion du bot y accède.

Les tests de persistance tournent sur PGlite (PostgreSQL en WebAssembly), sans service externe.

## Économie

`domain/economy` : `EconomyService` (règles : `work`, `deposit`, `withdraw`, `spend`, historique) au-dessus d'un `EconomyStore` dont toute écriture passe par `transact`. `transact` verrouille le compte (`SELECT ... FOR UPDATE`), rejoue le résultat si la clé d'idempotence (l'ID de l'interaction Discord) est déjà connue, puis écrit le compte et l'entrée de grand livre dans la même transaction ; un refus métier (`EconomyError`) n'écrit rien.

Fichiers : `economy-rules.ts` (montants et délais), `economy-error.ts` (refus métier), `economy-types.ts` (compte et entrée de grand livre), `economy-store.ts` (interface), `economy-service.ts` (règles).

Garde-fous en base (migration `0002_economy.sql`) : soldes entre 0 et 10¹² (`CHECK`), montants de grand livre strictement positifs, clé d'idempotence unique par serveur, et trigger qui interdit `UPDATE` et `DELETE` sur `economy_ledger`. `seq` donne l'ordre d'insertion strict. Les montants sont des entiers JavaScript sûrs. `domain` n'importe jamais `discord.js` (vérifié par test) : une opération économique ne peut déclencher aucune sanction Discord.

Les données d'économie ne sont pas soumises à la purge de 30 jours (ce sont des comptes, pas de l'activité).

## Design des réponses (Components V2)

Toute réponse du bot est un **message Components V2** : un `Container` à couleur d'accent qui contient texte, sections, galerie d'images, séparateurs et contrôles. Un message V2 n'accepte ni `content` ni embed (drapeau `IS_COMPONENTS_V2`, irréversible sur un message) ; tout passe donc par des composants. Les commandes décrivent le contenu ; le style est décidé à un seul endroit, `discord/ui/`.

| Fichier | Rôle |
| --- | --- |
| `ui/theme.ts` | Nom du bot, couleurs sémantiques, **catégories** (général, économie, suivi, profil, administration) avec leur couleur, médailles du podium |
| `ui/panels.ts` | `createPanel` (seul constructeur de messages) et `successPanel` / `warningPanel` / `errorPanel` / `infoPanel` |
| `ui/controls.ts` | `button`, `buttonRow`, `selectRow` : un style de bouton par intention (principal, neutre, succès, danger) |
| `ui/blocks.ts` | Blocs de texte : `keyValue`, `bullets`, `ranking` (médailles), `codeBlock` |
| `ui/replies.ts` | `respond`, `respondPrivately`, `update` : seuls points d'envoi, gèrent réponse neuve, différée ou déjà envoyée |

Composants V2 utilisés : **Container** (couleur d'accent), **Section** avec vignette (avatar en en-tête) ou avec **bouton en accessoire** (lignes du solde), **Text Display** (Markdown, sous-titres `-#` en pied de page), **Separator**, **Media Gallery** (avatars, carte `/me card`), **Action Row** avec **boutons** et **menu de choix**, et une **modale** composée de `Label`, d'un menu et d'un champ de saisie.

Règles de cohérence :
- une catégorie fixe la couleur d'accent ; un ton (succès, avertissement, erreur) la remplace ;
- **pas d'emoji décoratif** : la hiérarchie vient de la typographie, pas de pictogrammes (seules les médailles du podium en sont, et un test le vérifie) ;
- l'en-tête est `-# nom du membre` puis `## Titre` ; chaque champ est un libellé en petites capitales grises (`-# LIBELLÉ`) suivi de sa valeur, tous empilés dans un seul bloc ;
- les nombres sont en gras devant leur nom (`**12** messages  ·  **4** caractères`) ; la monnaie s'écrit « pièces » ;
- l'avatar n'apparaît en vignette que là où il a un sens (profil, `/me stats`, `/info user`), pas sur chaque réponse ;
- le pied de page est toujours « Sakutina · Catégorie · complément » ; les données qui changent ajoutent un horodatage relatif ;
- les erreurs, les données sensibles (`/me stats`, `/economy history`, `/economy balance`, administration) et les refus sont **privés** ;
- les durées sont des horodatages Discord (`<t:…:R>`), affichés dans le fuseau de chaque lecteur ;
- le texte d'un message est borné à 4 000 caractères (limite prudente : la documentation consultée ne chiffre pas ce plafond) et 40 composants.

### Interactions : boutons, menus, modales

`discord/components/` gère ce que l'utilisateur actionne. L'identifiant d'un composant est `espace:action:propriétaire:arguments…` (`custom-id.ts`) : le **propriétaire** est celui qui a lancé la commande, et l'**état de la vue** (page, période, cible) voyage dans les arguments, donc le bot ne garde rien en mémoire entre deux clics. Le routeur (`events/interaction-create.ts`) vérifie le serveur et le propriétaire avant d'appeler le gestionnaire de l'espace de noms ; un autre utilisateur reçoit un refus privé.

| Espace | Commande | Contrôles |
| --- | --- | --- |
| `lb` | `/server leaderboard` | menu de classement, boutons de période (1 / 7 / 30 j) |
| `st` | `/me stats`, `/phaethon activity` | boutons de période (7 / 30 j) |
| `hi` | `/economy history` | pagination « Précédent » / « Suivant » |
| `ba` | `/economy balance` | « Tout déposer », « Tout retirer », modale « Montant précis… » |
| `fg` | `/me forget` | confirmation « Effacer mes données » / « Annuler » |

Sécurité des contrôles : les droits sont **revérifiés à chaque clic** (jamais déduits de l'identifiant) ; un administrateur qui choisit un classement d'activité depuis un message public reçoit la réponse **en privé** au lieu d'écraser le message public ; l'historique affiché est toujours celui du propriétaire ; un refus économique n'altère pas le message.

`test/architecture.test.ts` impose la règle : aucun fichier de `discord/` ne répond sans passer par `ui/replies.ts`, n'envoie de texte brut, n'utilise d'embed, ne fixe de couleur ni ne fabrique un identifiant de routage à la main.

## Commandes et événements Discord

`discord/commands/index.ts` est l'unique liste de commandes, rangées en **sections** : `/economy`, `/me`, `/info`, `/server`, `/phaethon`. Discord ne publie que ces 5 commandes de premier niveau ; chaque commande du code est une **sous-commande** (`/economy balance`). Un groupe (`CommandGroup`) donne son nom et sa description ; ses `commands` sont les sous-commandes. Le rôle minimal se règle **par sous-commande** (le routeur lit `interaction.options.getSubcommand()`), si bien qu'une section mêle sans problème membres et administrateurs. Discord limite une commande à 25 sous-commandes : `applicationCommands()` scinde seul un groupe plus grand en `/casino`, `/casino2`… sans rien changer d'autre. Ajouter une section = un groupe dans `groups`. `discord/events/index.ts` est la liste des événements. Une commande = `{ definition, requiredRole, execute }`, où `definition` est un `SlashCommandSubcommandBuilder` ; un événement = `{ name, once?, execute }`, créé avec `defineEvent` pour typer ses arguments. `discord/events/interaction-create.ts` contrôle le serveur puis le rôle (`domain/permissions`) avant d'exécuter la commande. Ajouter une commande ou un événement = un fichier + une ligne dans son index. Le bot n'a jamais besoin de la permission `Administrator`.

Attention : `scripts/register-commands.ts` publie réellement les commandes sur le serveur configuré dès qu'il est exécuté ou importé.

## Rust : cartes de profil

`/me card` génère un PNG (avatar rond, nom, activité, solde) avec l'addon `packages/native`. Flux : la commande lit l'activité et le compte du demandeur, télécharge son avatar (`shared/fetch-bytes.ts` : délai de 3 s, 1 Mo maximum, `null` au moindre problème), `discord/commands/profile/profile-card-content.ts` décide du contenu, puis l'addon dessine hors du thread principal (`AsyncTask`). La commande répond en différé (`deferReply`) car avatar + rendu peuvent dépasser les 3 s de Discord.

Mode dégradé : `loadNativeAddon()` ne lève jamais. Sans addon compilé, `HandlerContext.cardRenderer` vaut `null`, le bot démarre avec un avertissement et `/me card` répond que la génération d'images est indisponible. Une carte ne montre que l'activité du demandeur : celle des autres membres reste réservée aux administrateurs.

Le `Dockerfile` compile l'addon dans une étape Rust dédiée ; la CI exécute `cargo clippy`, `cargo test` puis compile l'addon avant les tests du bot pour que les tests natifs ne soient pas ignorés.
