# Inventaire du dépôt

> Généré par `bun run inventory` — **ne pas modifier à la main**. `bun run verify` (et la CI) échouent si ce fichier est périmé.
> Il répond à « qu'est-ce qui existe déjà ? » sans lire tout le code. Les règles et le « pourquoi » sont dans [architecture.md](./architecture.md).

## Commandes Discord (31)

Rôle minimal par sous-commande ; `*` = option obligatoire. Ajouter : `bun run new command`.

| Commande | Rôle | Options | Fichier |
| --- | --- | --- | --- |
| `/economy balance` | member | member: membre | `apps/bot/src/discord/commands/economy/balance.ts` |
| `/economy work` | member | — | `apps/bot/src/discord/commands/economy/work.ts` |
| `/economy daily` | member | — | `apps/bot/src/discord/commands/economy/daily.ts` |
| `/economy deposit` | member | amount: entier, all: booléen | `apps/bot/src/discord/commands/economy/deposit.ts` |
| `/economy withdraw` | member | amount: entier, all: booléen | `apps/bot/src/discord/commands/economy/withdraw.ts` |
| `/economy history` | member | — | `apps/bot/src/discord/commands/economy/history.ts` |
| `/me stats` | member | member: membre, days: entier | `apps/bot/src/discord/commands/tracking/stats.ts` |
| `/me card` | member | — | `apps/bot/src/discord/commands/profile/card.ts` |
| `/me forget` | member | — | `apps/bot/src/discord/commands/tracking/forgetme.ts` |
| `/info user` | member | member: membre | `apps/bot/src/discord/commands/general/userinfo.ts` |
| `/info avatar` | member | member: membre | `apps/bot/src/discord/commands/general/avatar.ts` |
| `/info ping` | member | — | `apps/bot/src/discord/commands/general/ping.ts` |
| `/server info` | member | — | `apps/bot/src/discord/commands/general/serverinfo.ts` |
| `/server leaderboard` | member | category*: texte, days: entier | `apps/bot/src/discord/commands/tracking/leaderboard.ts` |
| `/server channels` | admin | days: entier | `apps/bot/src/discord/commands/tracking/channels.ts` |
| `/server stats` | admin | days: entier | `apps/bot/src/discord/commands/tracking/serverstats.ts` |
| `/server inactive` | admin | days: entier | `apps/bot/src/discord/commands/tracking/inactive.ts` |
| `/server health` | admin | — | `apps/bot/src/discord/commands/administration/health.ts` |
| `/mod warn` | moderator | member*: membre, reason*: texte | `apps/bot/src/discord/commands/moderation/warn.ts` |
| `/mod warnings` | moderator | member*: membre | `apps/bot/src/discord/commands/moderation/warnings.ts` |
| `/mod unwarn` | admin | id*: entier | `apps/bot/src/discord/commands/moderation/unwarn.ts` |
| `/mod timeout` | moderator | member*: membre, duration*: texte, reason*: texte | `apps/bot/src/discord/commands/moderation/timeout.ts` |
| `/mod untimeout` | moderator | member*: membre, reason: texte | `apps/bot/src/discord/commands/moderation/untimeout.ts` |
| `/mod kick` | moderator | member*: membre, reason*: texte | `apps/bot/src/discord/commands/moderation/kick.ts` |
| `/mod ban` | admin | member*: membre, reason*: texte, delete_days: entier | `apps/bot/src/discord/commands/moderation/ban.ts` |
| `/mod unban` | admin | user_id*: texte, reason: texte | `apps/bot/src/discord/commands/moderation/unban.ts` |
| `/mod purge` | moderator | count*: entier, member: membre | `apps/bot/src/discord/commands/moderation/purge.ts` |
| `/phaethon profile` | admin | member*: membre | `apps/bot/src/discord/commands/phaethon/profile.ts` |
| `/phaethon search` | admin | min_messages: entier, min_voice_hours: entier, night_owl: booléen, joined_within: entier, inactive_days: entier, game: texte, tag: texte, talks_to: membre, sort: texte | `apps/bot/src/discord/commands/phaethon/search.ts` |
| `/phaethon compare` | admin | member_a*: membre, member_b*: membre | `apps/bot/src/discord/commands/phaethon/compare.ts` |
| `/phaethon activity` | admin | member: membre | `apps/bot/src/discord/commands/administration/activity.ts` |

## Événements Discord (16)

Ajouter : `bun run new event`.

| Événement | Une fois | Fichier |
| --- | --- | --- |
| `clientReady` | oui | `apps/bot/src/discord/events/ready.ts` |
| `messageCreate` | non | `apps/bot/src/discord/events/message-create.ts` |
| `voiceStateUpdate` | non | `apps/bot/src/discord/events/voice-state-update.ts` |
| `guildMemberAdd` | non | `apps/bot/src/discord/events/guild-member-add.ts` |
| `guildMemberRemove` | non | `apps/bot/src/discord/events/guild-member-remove.ts` |
| `messageReactionAdd` | non | `apps/bot/src/discord/events/message-reaction-add.ts` |
| `guildMemberUpdate` | non | `apps/bot/src/discord/events/guild-member-update.ts` |
| `userUpdate` | non | `apps/bot/src/discord/events/user-update.ts` |
| `presenceUpdate` | non | `apps/bot/src/discord/events/presence-update.ts` |
| `interactionCreate` | non | `apps/bot/src/discord/events/interaction-create.ts` |
| `guildCreate` | non | `apps/bot/src/discord/events/guild-create.ts` |
| `guildUpdate` | non | `apps/bot/src/discord/events/guild-update.ts` |
| `guildDelete` | non | `apps/bot/src/discord/events/guild-delete.ts` |
| `roleCreate` | non | `apps/bot/src/discord/events/role-create.ts` |
| `roleUpdate` | non | `apps/bot/src/discord/events/role-update.ts` |
| `roleDelete` | non | `apps/bot/src/discord/events/role-delete.ts` |

## Migrations (9)

Les migrations font foi ; le dossier `schema/` (Drizzle) doit rester aligné (un test le vérifie). Ajouter : `bun run new migration`.

| Fichier | Rôle |
| --- | --- |
| `0001_init.sql` | Crée activity_daily, audit_event |
| `0002_economy.sql` | Crée economy_account, economy_ledger |
| `0003_tracking.sql` | Crée activity_channel_daily, activity_hourly, member_profile ; modifie activity_daily |
| `0004_daily_reward.sql` | modifie economy_account |
| `0005_phaethon.sql` | Phaéthon : relations, rythme, présence, jeux et identité. Uniquement des métadonnées : |
| `0006_moderation.sql` | Avertissements de modération. Conservés un an : contrairement à l'activité, ils servent de mémoire aux modérateurs. |
| `0007_panel_access.sql` | Accès du panneau web à la base. Le panneau (Vercel) lit la base avec la session Supabase |
| `0008_multi_server.sql` | Multi-serveur : le bot sert tous les serveurs qui l'invitent. |
| `0009_panel_guilds.sql` | Panneau multi-serveur : les serveurs que l'appelant peut gérer, et la fiche d'un serveur. |

## Tables (19)

Après application de toutes les migrations. RLS activé sans politique : seules les fonctions `panel_*` et le bot y accèdent. Clé primaire en **gras**.

### `activity_channel_daily`

- **guild_id** : text
- **member_id** : text
- **channel_id** : text
- **day** : date
- messages : integer
- voice_seconds : integer

### `activity_daily`

- **guild_id** : text
- **member_id** : text
- **day** : date
- messages : integer
- voice_seconds : integer
- joins : integer
- attributed_invites : integer
- characters : integer
- replies : integer
- attachments : integer
- mentions : integer
- reactions_given : integer
- reactions_received : integer
- leaves : integer

### `activity_hourly`

- **guild_id** : text
- **day** : date
- **hour** : smallint
- messages : integer

### `activity_monthly`

- **guild_id** : text
- **member_id** : text
- **month** : text
- active_days : integer
- messages : integer
- characters : integer
- replies : integer
- attachments : integer
- mentions : integer
- reactions_given : integer
- reactions_received : integer
- voice_seconds : integer
- joins : integer
- leaves : integer
- attributed_invites : integer

### `audit_event`

- **id** : uuid
- action : text
- guild_id : text
- occurred_at : timestamp with time zone
- actor_id : text, nullable
- target_id : text, nullable
- metadata : jsonb

### `bot_guild`

- **guild_id** : text
- name : text
- icon : text, nullable
- banner : text, nullable
- owner_id : text
- member_count : integer
- joined_at : timestamp with time zone
- updated_at : timestamp with time zone

### `economy_account`

- **guild_id** : text
- **member_id** : text
- wallet : bigint
- bank : bigint
- last_work_at : timestamp with time zone, nullable
- created_at : timestamp with time zone
- updated_at : timestamp with time zone
- last_daily_at : timestamp with time zone, nullable
- daily_streak : integer

### `economy_ledger`

- seq : bigint
- **id** : uuid
- guild_id : text
- member_id : text
- kind : text
- amount : bigint
- wallet_after : bigint
- bank_after : bigint
- reason : text
- idempotency_key : text
- created_at : timestamp with time zone

### `guild_manager`

- **guild_id** : text
- **member_id** : text

### `guild_settings`

- **guild_id** : text
- admin_role_ids : ARRAY
- moderator_role_ids : ARRAY
- alert_channel_id : text, nullable
- updated_at : timestamp with time zone

### `identity_event`

- **id** : uuid
- guild_id : text
- member_id : text
- kind : text
- old_value : text, nullable
- new_value : text, nullable
- occurred_at : timestamp with time zone

### `member_hour_daily`

- **guild_id** : text
- **member_id** : text
- **day** : date
- **hour** : smallint
- messages : integer

### `member_profile`

- **guild_id** : text
- **member_id** : text
- first_seen_at : timestamp with time zone
- joined_at : timestamp with time zone, nullable
- left_at : timestamp with time zone, nullable
- last_active_at : timestamp with time zone, nullable

### `moderation_warning`

- **id** : integer
- guild_id : text
- member_id : text
- moderator_id : text
- reason : text
- created_at : timestamp with time zone

### `panel_admin`

- **guild_id** : text
- **discord_id** : text
- role : text
- created_at : timestamp with time zone

### `phaethon_alert`

- **guild_id** : text
- **key** : text
- created_at : timestamp with time zone

### `presence_game_daily`

- **guild_id** : text
- **member_id** : text
- **day** : date
- **kind** : text
- **name** : text
- seconds : integer

### `presence_status_daily`

- **guild_id** : text
- **member_id** : text
- **day** : date
- **status** : text
- seconds : integer

### `social_edge_daily`

- **guild_id** : text
- **member_id** : text
- **target_id** : text
- **day** : date
- replies : integer
- mentions : integer
- reactions : integer
- voice_seconds : integer

## Fonctions du panneau (7)

Seule porte d'entrée du panneau vers la base. Ajouter : `bun run new panel-fn`.

| Fonction | Arguments | SECURITY DEFINER |
| --- | --- | --- |
| `panel_assert_admin` | `p_guild_id text` | oui |
| `panel_assert_signed_in` | `` | oui |
| `panel_guild` | `p_guild_id text` | oui |
| `panel_my_guilds` | `` | oui |
| `panel_overview` | `p_guild_id text` | oui |
| `panel_recent_audit` | `p_guild_id text, p_limit integer DEFAULT 6` | oui |
| `panel_role` | `p_guild_id text` | oui |

## Pages du panneau (13)

Routes de `apps/panel/src/app`.

| Route | Fichier |
| --- | --- |
| `/auth/callback` | `apps/panel/src/app/auth/callback/route.ts` |
| `/auth/signout` | `apps/panel/src/app/auth/signout/route.ts` |
| `/design` | `apps/panel/src/app/design/page.tsx` |
| `/login` | `apps/panel/src/app/login/page.tsx` |
| `/servers` | `apps/panel/src/app/servers/(picker)/page.tsx` |
| `/servers/[guildId]/anti-raid` | `apps/panel/src/app/servers/[guildId]/anti-raid/page.tsx` |
| `/servers/[guildId]/balance` | `apps/panel/src/app/servers/[guildId]/balance/page.tsx` |
| `/servers/[guildId]/casino` | `apps/panel/src/app/servers/[guildId]/casino/page.tsx` |
| `/servers/[guildId]/dashboard` | `apps/panel/src/app/servers/[guildId]/dashboard/page.tsx` |
| `/servers/[guildId]/moderation` | `apps/panel/src/app/servers/[guildId]/moderation/page.tsx` |
| `/servers/[guildId]/modules` | `apps/panel/src/app/servers/[guildId]/modules/page.tsx` |
| `/servers/[guildId]/phaethon` | `apps/panel/src/app/servers/[guildId]/phaethon/page.tsx` |
| `/servers/[guildId]/profiling` | `apps/panel/src/app/servers/[guildId]/profiling/page.tsx` |

## Sections du panneau : branchées ou verrouillées

`apps/panel/src/lib/features.ts`. Une section verrouillée affiche sa maquette derrière un cadenas.

| Fonctionnalité | État | Ce qui manque |
| --- | --- | --- |
| `guilds` | branchée | — |
| `settings` | verrouillée | Needs a settings table the bot reads |
| `antiRaid` | verrouillée | Anti-Raid is not built yet |
| `moderation` | verrouillée | Needs moderation functions in the database |
| `phaethon` | verrouillée | Needs Phaethon scores and member names in the database |
| `economy` | verrouillée | Needs economy functions in the database |
| `casino` | verrouillée | The casino is not built yet |
| `profiling` | verrouillée | Needs member names and stats functions in the database |
| `giveaways` | verrouillée | Giveaways are not built yet |

## Variables d'environnement

Valeurs d'exemple uniquement ; les vraies valeurs ne sont jamais dans le dépôt.

### `apps/bot/.env.example`

| Variable | Exemple | Rôle |
| --- | --- | --- |
| `DISCORD_TOKEN` | — | Discord application token. Never commit a real token. |
| `DISCORD_APPLICATION_ID` | `1566435489974845590` | Required only when registering guild slash commands manually. |
| `DISCORD_PRIMARY_GUILD_ID` | `1317931106993180763` | Facultatif. Le bot est multi-serveur : il sert tous les serveurs qui l'invitent. Serveur historique (Uwu Server) : ses anciens réglages ci-dessous sont repris une fois dans la table guild_settings, et ses anciennes commandes de serveur sont retirées à l'enregistrement. |
| `ADMIN_ROLE_IDS` | — | Anciens réglages du serveur historique (IDs séparés par des virgules), repris une fois dans guild_settings puis ignorés : les réglages se font désormais par serveur. |
| `MODERATOR_ROLE_IDS` | — | — |
| `ALERT_CHANNEL_ID` | — | — |
| `TRACK_PRESENCE` | `false` | Suivi de la présence (statut, jeux). Active l'intention privilégiée « Presence » : l'activer d'abord dans le portail développeur Discord (Bot > Privileged Gateway Intents), sinon la connexion est refusée. Désactivé par défaut. |
| `DATABASE_URL` | — | Chaîne de connexion PostgreSQL (Supabase, mode « session pooler » ou directe). Obligatoire en production ; sans elle, stockage en mémoire (données perdues au redémarrage). |
| `PORT` | `3000` | Render supplies PORT automatically; 3000 is the local default. |
| `NODE_ENV` | `development` | — |

### `apps/panel/.env.example`

| Variable | Exemple | Rôle |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | — | Supabase project used for sign-in (Discord OAuth). Public values. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | — |
| `BOT_API_URL` | `https://sakutina.isweat.pro` | Where the panel reads the bot's health (GET /api/v1/health). Server-side only. |
| `NEXT_PUBLIC_DISCORD_APPLICATION_ID` | — | Optional. The bot's Discord application id: enables the "Add Bot" button on /servers. Without it the servers you administer are listed without a button. The panel is multi-server: a server opens to its owner and to members with Administrator or Manage Server (synced by the bot), plus manual entries in the `panel_admin` table. |

## Scripts (racine)

`bun run <nom>`. Détail des outils : [dev-tools.md](./dev-tools.md).

| Script | Commande |
| --- | --- |
| `dev` | `bun run --cwd apps/bot dev` |
| `start` | `bun run --cwd apps/bot start` |
| `check` | `bun run --cwd apps/bot check` |
| `test` | `bun run --cwd apps/bot test` |
| `commands:register` | `bun run --cwd apps/bot commands:register` |
| `db:migrate` | `bun run --cwd apps/bot db:migrate` |
| `panel:dev` | `bun run --cwd apps/panel dev` |
| `panel:build` | `bun run --cwd apps/panel build` |
| `native:build` | `bun run --cwd packages/native build` |
| `native:test` | `bun run --cwd packages/native test` |
| `verify` | `bun tools/verify.ts` |
| `new` | `bun tools/new.ts` |
| `inventory` | `bun tools/inventory.ts` |
| `doctor` | `bun tools/doctor.ts` |
| `dev:local` | `bun tools/dev-local/main.ts` |
| `tools:test` | `bun run --cwd tools test` |
