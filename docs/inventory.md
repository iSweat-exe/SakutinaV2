# Inventaire du dépôt

> Généré par `bun run inventory` — **ne pas modifier à la main**. `bun run verify` (et la CI) échouent si ce fichier est périmé.
> Il répond à « qu'est-ce qui existe déjà ? » sans lire tout le code. Les règles et le « pourquoi » sont dans [architecture.md](./architecture.md).

## Commandes Discord (43)

Rôle minimal par sous-commande ; `*` = option obligatoire. Ajouter : `bun run new command`.

| Commande | Rôle | Options | Fichier |
| --- | --- | --- | --- |
| `/economy balance` | member | member: membre | `apps/bot/src/discord/commands/economy/balance.ts` |
| `/economy work` | member | — | `apps/bot/src/discord/commands/economy/work.ts` |
| `/economy daily` | member | — | `apps/bot/src/discord/commands/economy/daily.ts` |
| `/economy deposit` | member | amount: entier, all: booléen | `apps/bot/src/discord/commands/economy/deposit.ts` |
| `/economy withdraw` | member | amount: entier, all: booléen | `apps/bot/src/discord/commands/economy/withdraw.ts` |
| `/economy history` | member | — | `apps/bot/src/discord/commands/economy/history.ts` |
| `/economy pay` | member | member*: membre, amount*: entier | `apps/bot/src/discord/commands/economy/pay.ts` |
| `/casino slots` | member | bet*: entier | `apps/bot/src/discord/commands/casino/slots.ts` |
| `/casino blackjack` | member | bet*: entier | `apps/bot/src/discord/commands/casino/blackjack.ts` |
| `/casino roulette` | member | bet*: entier, on*: texte, number: entier | `apps/bot/src/discord/commands/casino/roulette.ts` |
| `/casino coinflip` | member | bet*: entier, side*: texte | `apps/bot/src/discord/commands/casino/coinflip.ts` |
| `/market view` | member | — | `apps/bot/src/discord/commands/market/view.ts` |
| `/market buy` | member | count*: entier | `apps/bot/src/discord/commands/market/buy.ts` |
| `/market sell` | member | count*: entier | `apps/bot/src/discord/commands/market/sell.ts` |
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
| `/server treasury` | member | — | `apps/bot/src/discord/commands/general/treasury.ts` |
| `/server lockdown` | admin | — | `apps/bot/src/discord/commands/anti-raid/lockdown.ts` |
| `/server unlock` | admin | — | `apps/bot/src/discord/commands/anti-raid/unlock.ts` |
| `/server alerts` | admin | channel: salon, remove: booléen | `apps/bot/src/discord/commands/administration/alerts.ts` |
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

## Événements Discord (21)

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
| `guildBanAdd` | non | `apps/bot/src/discord/events/guild-ban-add.ts` |
| `guildBanRemove` | non | `apps/bot/src/discord/events/guild-ban-remove.ts` |
| `channelCreate` | non | `apps/bot/src/discord/events/channel-create.ts` |
| `channelUpdate` | non | `apps/bot/src/discord/events/channel-update.ts` |
| `channelDelete` | non | `apps/bot/src/discord/events/channel-delete.ts` |

## Migrations (22)

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
| `0010_panel_economy.sql` | Panneau : économie d'un serveur. Lecture seule, réservée aux administrateurs du serveur. |
| `0011_economy_rules_and_identity.sql` | 1. Nom affiché et photo des membres (Top Holders, sanctions, avertissements du panneau). |
| `0012_moderation_panel.sql` | Panneau de modération : sanctions actives (mutes et bannissements), file d'actions du panneau vers le bot, |
| `0013_audit_names.sql` | Journal du tableau de bord : le nom et la photo des membres au lieu de bouts d'identifiants, et les actions de |
| `0014_treasury.sql` | Trésor du serveur : ce que le serveur garde au lieu de le détruire. Il reçoit la taxe des paiements et la |
| `0015_bank_interest.sql` | Intérêts de la banque. Le serveur choisit un taux par jour (en pour mille, 0 = désactivé, 50 au plus = 5 %) ; les |
| `0016_hourly_voice.sql` | Temps vocal par heure UTC : le graphique d'activité du panneau montre enfin le vocal, pas seulement les messages. |
| `0017_panel_casino.sql` | Casino : un administrateur ouvre ou ferme chaque jeu et règle sa mise maximale depuis le panneau. |
| `0018_closed_economy.sql` | Économie en circuit fermé (SB-CLE). Plus aucune pièce n'est créée à partir de rien : |
| `0019_panel_phaethon.sql` | Panneau : Phaéthon. Liste de surveillance, score de risque expliqué, dossier de chaque compte, et les décisions |
| `0020_panel_profiling.sql` | Panneau : Profiling. La fiche de chaque membre : nom, nom d'utilisateur, photo, rôles, date d'arrivée, messages et |
| `0021_anti_raid.sql` | Anti-raid. Le bot repère une rafale d'arrivées (fenêtre glissante, les comptes Discord récents comptent double), |
| `0022_modules_and_alerts.sql` | Modules et salon d'alertes. |

## Tables (33)

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
- voice_seconds : integer

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

### `casino_entry`

- seq : bigint
- **id** : uuid
- guild_id : text
- pool : text
- amount : bigint
- reason : text
- member_id : text, nullable
- created_at : timestamp with time zone

### `casino_fund`

- **guild_id** : text
- balance : bigint
- jackpot : bigint
- shares : bigint
- server_shares : bigint
- day : date, nullable
- day_start : bigint
- day_net : bigint
- week_net : bigint
- carried_loss : bigint
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
- casino_shares : bigint

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

### `economy_week_run`

- **guild_id** : text
- **week** : date
- members_taxed : integer
- threshold : bigint
- wealth_tax : bigint
- profit : bigint
- dividends : bigint
- casino_tax : bigint
- carried_loss : bigint
- created_at : timestamp with time zone

### `guild_channel`

- **guild_id** : text
- **channel_id** : text
- name : text
- category : text, nullable
- position : integer

### `guild_manager`

- **guild_id** : text
- **member_id** : text

### `guild_settings`

- **guild_id** : text
- admin_role_ids : ARRAY
- moderator_role_ids : ARRAY
- alert_channel_id : text, nullable
- updated_at : timestamp with time zone
- currency_name : text
- starting_balance : integer
- transfer_tax_percent : integer
- automod_spam : boolean
- automod_links : boolean
- automod_words : boolean
- automod_mentions : boolean
- banned_words : ARRAY
- default_mute_minutes : integer
- bank_interest_permille : integer
- casino_slots_enabled : boolean
- casino_slots_max_bet : integer
- casino_blackjack_enabled : boolean
- casino_blackjack_max_bet : integer
- casino_roulette_enabled : boolean
- casino_roulette_max_bet : integer
- casino_coinflip_enabled : boolean
- casino_coinflip_max_bet : integer
- salary_budget_permille : integer
- wealth_tax_permille : integer
- idle_tax_permille : integer
- antiraid_enabled : boolean
- antiraid_join_threshold : integer
- antiraid_window_seconds : integer
- antiraid_min_account_age_days : integer
- antiraid_action : text
- antiraid_lock_channels : boolean
- antiraid_alert : boolean
- antiraid_raise_verification : boolean
- casino_enabled : boolean
- phaethon_enabled : boolean
- profiling_enabled : boolean

### `guild_treasury`

- **guild_id** : text
- balance : bigint
- updated_at : timestamp with time zone
- salary_day : date, nullable
- salary_budget : bigint, nullable
- salary_paid : bigint
- salary_active : integer

### `identity_event`

- **id** : uuid
- guild_id : text
- member_id : text
- kind : text
- old_value : text, nullable
- new_value : text, nullable
- occurred_at : timestamp with time zone

### `interest_run`

- **guild_id** : text
- **day** : date
- members : integer
- wanted : bigint
- paid : bigint
- created_at : timestamp with time zone

### `market_candle`

- **guild_id** : text
- **period** : text
- **bucket** : timestamp with time zone
- open : bigint
- high : bigint
- low : bigint
- close : bigint
- volume : bigint

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
- display_name : text, nullable
- avatar : text, nullable
- username : text, nullable
- role_names : ARRAY

### `moderation_command`

- **id** : uuid
- guild_id : text
- sanction_id : integer, nullable
- requested_by : text
- requested_at : timestamp with time zone
- status : text
- processed_at : timestamp with time zone, nullable
- error : text, nullable
- action : text
- member_id : text, nullable
- reason : text, nullable

### `moderation_sanction`

- **id** : integer
- guild_id : text
- member_id : text
- kind : text
- moderator_id : text, nullable
- reason : text
- created_at : timestamp with time zone
- ends_at : timestamp with time zone, nullable
- revoked_at : timestamp with time zone, nullable
- revoked_by : text, nullable

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

### `phaethon_review`

- **guild_id** : text
- **member_id** : text
- status : text
- score : integer
- reviewed_by : text
- reviewed_at : timestamp with time zone

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

### `raid_command`

- **id** : uuid
- guild_id : text
- action : text
- requested_by : text
- requested_at : timestamp with time zone
- status : text
- processed_at : timestamp with time zone, nullable
- error : text, nullable

### `raid_event`

- **id** : uuid
- guild_id : text
- started_at : timestamp with time zone
- ended_at : timestamp with time zone, nullable
- trigger : text
- started_by : text, nullable
- ended_by : text, nullable
- joins : integer
- window_seconds : integer
- action : text
- actioned : integer
- failed : integer
- locked_channels : integer
- verification_before : smallint, nullable

### `raid_lockdown_channel`

- **raid_id** : uuid
- guild_id : text
- **channel_id** : text
- had_overwrite : boolean
- allow : text
- deny : text

### `social_edge_daily`

- **guild_id** : text
- **member_id** : text
- **target_id** : text
- **day** : date
- replies : integer
- mentions : integer
- reactions : integer
- voice_seconds : integer

### `treasury_entry`

- seq : bigint
- **id** : uuid
- guild_id : text
- amount : bigint
- reason : text
- member_id : text, nullable
- actor_id : text, nullable
- note : text, nullable
- created_at : timestamp with time zone

## Fonctions du panneau (31)

Seule porte d'entrée du panneau vers la base. Ajouter : `bun run new panel-fn`.

| Fonction | Arguments | SECURITY DEFINER |
| --- | --- | --- |
| `panel_antiraid` | `p_guild_id text` | oui |
| `panel_assert_admin` | `p_guild_id text` | oui |
| `panel_assert_signed_in` | `` | oui |
| `panel_automod_json` | `p_guild_id text` | oui |
| `panel_caller_discord_id` | `` | oui |
| `panel_casino` | `p_guild_id text` | oui |
| `panel_economy` | `p_guild_id text` | oui |
| `panel_find_members` | `p_guild_id text, p_query text DEFAULT NULL::text` | oui |
| `panel_guild` | `p_guild_id text` | oui |
| `panel_market` | `p_guild_id text, p_period text DEFAULT '1H'::text` | oui |
| `panel_moderation` | `p_guild_id text` | oui |
| `panel_modules` | `p_guild_id text` | oui |
| `panel_my_guilds` | `` | oui |
| `panel_overview` | `p_guild_id text` | oui |
| `panel_phaethon` | `p_guild_id text` | oui |
| `panel_phaethon_top` | `p_guild_id text, p_limit integer DEFAULT 3` | oui |
| `panel_profiling` | `p_guild_id text, p_query text DEFAULT NULL::text` | oui |
| `panel_recent_audit` | `p_guild_id text, p_limit integer DEFAULT 6` | oui |
| `panel_request_ban` | `p_guild_id text, p_member_id text DEFAULT NULL::text, p_reason text DEFAULT NULL::text` | oui |
| `panel_request_raid` | `p_guild_id text, p_action text DEFAULT NULL::text` | oui |
| `panel_revoke_sanction` | `p_guild_id text, p_kind text DEFAULT NULL::text, p_id integer DEFAULT NULL::integer` | oui |
| `panel_role` | `p_guild_id text` | oui |
| `panel_set_alert_channel` | `p_guild_id text, p_channel_id text DEFAULT NULL::text` | oui |
| `panel_set_antiraid` | `p_guild_id text, p_enabled boolean DEFAULT NULL::boolean, p_join_threshold integer DEFAULT NULL::integer, p_window_seconds integer DEFAULT NULL::integer, p_min_account_age_days integer DEFAULT NULL::integer, p_action text DEFAULT NULL::text, p_lock_channels boolean DEFAULT NULL::boolean, p_alert_admins boolean DEFAULT NULL::boolean, p_raise_verification boolean DEFAULT NULL::boolean` | oui |
| `panel_set_automod` | `p_guild_id text, p_spam boolean DEFAULT NULL::boolean, p_links boolean DEFAULT NULL::boolean, p_words boolean DEFAULT NULL::boolean, p_mentions boolean DEFAULT NULL::boolean, p_banned_words text[] DEFAULT NULL::text[], p_mute_minutes integer DEFAULT NULL::integer` | oui |
| `panel_set_casino_game` | `p_guild_id text, p_game text DEFAULT NULL::text, p_enabled boolean DEFAULT NULL::boolean, p_max_bet integer DEFAULT NULL::integer` | oui |
| `panel_set_economy_rules` | `p_guild_id text, p_currency_name text DEFAULT NULL::text, p_salary_budget_permille integer DEFAULT NULL::integer, p_starting_balance integer DEFAULT NULL::integer, p_transfer_tax_percent integer DEFAULT NULL::integer, p_bank_interest_permille integer DEFAULT NULL::integer, p_wealth_tax_permille integer DEFAULT NULL::integer, p_idle_tax_permille integer DEFAULT NULL::integer` | oui |
| `panel_set_module` | `p_guild_id text, p_module text DEFAULT NULL::text, p_enabled boolean DEFAULT NULL::boolean` | oui |
| `panel_set_phaethon_review` | `p_guild_id text, p_member_id text DEFAULT NULL::text, p_status text DEFAULT NULL::text` | oui |
| `panel_treasury` | `p_guild_id text` | oui |
| `panel_treasury_pay_out` | `p_guild_id text, p_member_id text DEFAULT NULL::text, p_amount bigint DEFAULT NULL::bigint, p_note text DEFAULT NULL::text` | oui |

## Pages du panneau (15)

Routes de `apps/panel/src/app`.

| Route | Fichier |
| --- | --- |
| `/auth/callback` | `apps/panel/src/app/auth/callback/route.ts` |
| `/auth/signout` | `apps/panel/src/app/auth/signout/route.ts` |
| `/design` | `apps/panel/src/app/design/page.tsx` |
| `/login` | `apps/panel/src/app/login/page.tsx` |
| `/` | `apps/panel/src/app/page.tsx` |
| `/servers` | `apps/panel/src/app/servers/(picker)/page.tsx` |
| `/servers/[guildId]/anti-raid` | `apps/panel/src/app/servers/[guildId]/anti-raid/page.tsx` |
| `/servers/[guildId]/balance` | `apps/panel/src/app/servers/[guildId]/balance/page.tsx` |
| `/servers/[guildId]/casino` | `apps/panel/src/app/servers/[guildId]/casino/page.tsx` |
| `/servers/[guildId]/dashboard` | `apps/panel/src/app/servers/[guildId]/dashboard/page.tsx` |
| `/servers/[guildId]/market` | `apps/panel/src/app/servers/[guildId]/market/page.tsx` |
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
| `antiRaid` | branchée | — |
| `moderation` | branchée | — |
| `phaethon` | branchée | — |
| `economy` | branchée | — |
| `profiling` | branchée | — |
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
