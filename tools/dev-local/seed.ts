import type { PGlite } from "@electric-sql/pglite";

/** Utilisateurs de démonstration : connexion en un clic sur /__dev. */
export const DEV_USERS = {
  owner: { id: "00000000-0000-4000-8000-000000000001", discordId: "900000000000000001", name: "Mika", username: "mika", role: "owner" },
  admin: { id: "00000000-0000-4000-8000-000000000002", discordId: "900000000000000002", name: "Aiko", username: "aiko", role: "admin" },
  stranger: { id: "00000000-0000-4000-8000-000000000003", discordId: "900000000000000003", name: "Visiteur", username: "visiteur", role: null },
} as const;

export type DevUserKey = keyof typeof DEV_USERS;

/** Rôles de démonstration (Profiling), du plus haut au plus bas. */
const DEMO_ROLES: ReadonlyArray<ReadonlyArray<string>> = [["Moderator", "Regular"], ["Regular"], ["Booster", "Member"], ["Member"], [], ["Admin", "Developer"]];

/** Second serveur de démonstration, où seule Aiko (admin) a accès. */
export const SECOND_GUILD_ID = "1400000000000000001";

/** Générateur pseudo-aléatoire reproductible : mêmes données à chaque démarrage. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Noms de démonstration ; un membre sur trois reste sans nom, comme un membre que le bot n'a pas encore vu. */
const DEMO_NAMES = ["Aiko", "Ren", "Sora", "Hana", "Yuki", "Kaito", "Mika", "Nami", "Rin", "Daichi", "Emi", "Haru"];

const memberId = (index: number) => String(100000000000000000n + BigInt(index));

/** Imite ce que Supabase fournit à la base : le schéma `auth`, `auth.uid()` et les identités Discord. */
export async function installAuth(client: PGlite): Promise<void> {
  await client.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.identities (user_id uuid NOT NULL, provider text NOT NULL, provider_id text NOT NULL);
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('dev.uid', true), '')::uuid $$;
  `);
}

/**
 * Peuple la base comme le bot l'aurait fait en quelques semaines d'activité sur un serveur
 * d'environ 80 membres : compteurs horaires et quotidiens, économie, sanctions, administrateurs.
 */
export async function seed(client: PGlite, guildId: string): Promise<void> {
  const random = rng(42);
  const now = Date.now();
  const hour = 3_600_000;

  for (const user of Object.values(DEV_USERS)) {
    await client.query("INSERT INTO auth.identities VALUES ($1, 'discord', $2)", [user.id, user.discordId]);

    if (user.role) {
      await client.query("INSERT INTO panel_admin (guild_id, discord_id, role) VALUES ($1, $2, $3)", [guildId, user.discordId, user.role]);
    }
  }

  // Multi-serveur : le bot est sur le serveur de démonstration (Mika propriétaire) et sur un second
  // qu'Aiko gère par ses rôles. Le Visiteur ne gère aucun des deux.
  await client.query(
    "INSERT INTO bot_guild (guild_id, name, owner_id, member_count) VALUES ($1, 'Uwu Server', $2, 80), ($3, 'Lantern Café', '900000000000000099', 318)",
    [guildId, DEV_USERS.owner.discordId, SECOND_GUILD_ID],
  );
  await client.query("INSERT INTO guild_manager (guild_id, member_id) VALUES ($1, $3), ($2, $3)", [
    guildId,
    SECOND_GUILD_ID,
    DEV_USERS.admin.discordId,
  ]);

  // Membres : 80 présents ou partis, la moitié environ actifs récemment.
  for (let i = 0; i < 80; i++) {
    const left = i >= 72;
    const lastActive = left ? null : new Date(now - Math.floor(random() * (i < 40 ? 20 : 90)) * hour);
    await client.query(
      "INSERT INTO member_profile (guild_id, member_id, first_seen_at, joined_at, left_at, last_active_at, display_name, avatar, username, role_names) VALUES ($1, $2, $3, $3, $4, $5, $6, NULL, $7, $8)",
      [
        guildId,
        memberId(i),
        new Date(now - (10 + i * 4) * 24 * hour),
        left ? new Date(now - 3 * 24 * hour) : null,
        lastActive,
        i % 3 === 2 ? null : DEMO_NAMES[i % DEMO_NAMES.length],
        i % 3 === 2 ? null : `${DEMO_NAMES[i % DEMO_NAMES.length]!.toLowerCase()}${i}`,
        DEMO_ROLES[i % DEMO_ROLES.length],
      ],
    );
  }

  // Messages par heure UTC sur 72 h : creux la nuit, pic en soirée.
  for (let h = 72; h >= 0; h--) {
    const at = new Date(now - h * hour);
    const hourOfDay = at.getUTCHours();
    const evening = Math.exp(-Math.pow(hourOfDay - 20, 2) / 18);
    const noon = 0.45 * Math.exp(-Math.pow(hourOfDay - 12, 2) / 14);
    const messages = Math.round(20 + 140 * (evening + noon) * (0.8 + 0.4 * random()));

    await client.query(
      "INSERT INTO activity_hourly (guild_id, day, hour, messages, voice_seconds) VALUES ($1, $2::date, $3, $4, $5) ON CONFLICT DO NOTHING",
      [guildId, at.toISOString().slice(0, 10), hourOfDay, messages, Math.round(messages * 0.6 * 60 * (0.7 + 0.6 * random()))],
    );
  }

  // Activité quotidienne des 30 derniers jours pour les membres les plus actifs.
  for (let d = 0; d < 30; d++) {
    const day = new Date(now - d * 24 * hour).toISOString().slice(0, 10);
    for (let i = 0; i < 25; i++) {
      await client.query(
        "INSERT INTO activity_daily (guild_id, member_id, day, messages, voice_seconds, characters) VALUES ($1, $2, $3::date, $4, $5, $6)",
        [guildId, memberId(i), day, Math.round(random() * (60 - i)), Math.round(random() * 3600), Math.round(random() * 4000)],
      );
    }
  }

  // Économie : un compte par membre présent, avec un petit grand livre.
  for (let i = 0; i < 72; i++) {
    const wallet = Math.round(random() * 5000);
    const bank = Math.round(random() * 40000 * (1 - i / 80));
    await client.query("INSERT INTO economy_account (guild_id, member_id, wallet, bank) VALUES ($1, $2, $3, $4)", [guildId, memberId(i), wallet, bank]);
  }

  // Grand livre des 7 derniers jours : gains (travail, récompense quotidienne) et dépenses, pour que la
  // circulation reconstituée par `panel_economy` varie d'un jour à l'autre.
  for (let n = 0; n < 220; n++) {
    const spend = random() < 0.3;
    const amount = spend ? 50 + Math.round(random() * 400) : 50 + Math.round(random() * 250);
    await client.query(
      `INSERT INTO economy_ledger (id, guild_id, member_id, kind, amount, wallet_after, bank_after, reason, idempotency_key, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $4, 0, $5, $6, $7)`,
      [
        guildId,
        memberId(Math.floor(random() * 72)),
        spend ? "spend" : "earn",
        amount,
        spend ? "démo : achat" : random() < 0.5 ? "work" : "daily",
        `demo-${n}`,
        new Date(now - Math.round(random() * 7 * 24 * hour)),
      ],
    );
  }

  // Trésor : la taxe et les mises du casino que le serveur a gardées, pour voir la carte du panneau.
  const treasuryEntries: Array<[number, string, number]> = [
    [30, "tax", 150], [14, "casino:slots:loss", 100], [9, "casino:roulette:loss", 250], [5, "casino:slots:win", -400], [2, "tax", 60],
  ];
  let treasuryBalance = 0;
  for (const [hoursAgo, reason, amount] of treasuryEntries) {
    treasuryBalance += amount;
    await client.query(
      "INSERT INTO treasury_entry (id, guild_id, amount, reason, member_id, created_at) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)",
      [guildId, amount, reason, memberId(Math.floor(random() * 40)), new Date(now - hoursAgo * hour)],
    );
  }
  // La réserve naît avec sa dotation de lancement (le déclencheur ouvre aussi le casino), puis garde ces mouvements.
  await client.query("INSERT INTO guild_treasury (guild_id) VALUES ($1)", [guildId]);
  await client.query("UPDATE guild_treasury SET balance = balance + $2 WHERE guild_id = $1", [guildId, treasuryBalance]);

  // Bourse : 30 jours de cours de l'action Casino (bougies de 15 min et du jour), une marche au hasard autour de
  // 100 pièces, et quelques actionnaires. Le compte du casino finit au dernier cours.
  const quarter = 15 * 60_000;
  const firstQuarter = Math.floor((now - 30 * 24 * hour) / quarter) * quarter;
  let priceCents = 10_000;
  const days = new Map<number, { o: number; h: number; l: number; c: number; v: number }>();
  for (let t = firstQuarter; t <= now; t += quarter) {
    const open = priceCents;
    priceCents = Math.max(1_000, Math.round(open * (1 + (random() - 0.48) * 0.012)));
    const high = Math.round(Math.max(open, priceCents) * (1 + random() * 0.004));
    const low = Math.round(Math.min(open, priceCents) * (1 - random() * 0.004));
    const volume = random() < 0.35 ? Math.round(random() * 12) : 0;
    await client.query(
      "INSERT INTO market_candle (guild_id, period, bucket, open, high, low, close, volume) VALUES ($1, '15m', $2, $3, $4, $5, $6, $7)",
      [guildId, new Date(t), open, high, low, priceCents, volume],
    );
    const dayStart = Math.floor(t / (24 * hour)) * 24 * hour;
    const day = days.get(dayStart);
    days.set(dayStart, day ? { ...day, h: Math.max(day.h, high), l: Math.min(day.l, low), c: priceCents, v: day.v + volume } : { o: open, h: high, l: low, c: priceCents, v: volume });
  }
  for (const [dayStart, day] of days) {
    await client.query(
      "INSERT INTO market_candle (guild_id, period, bucket, open, high, low, close, volume) VALUES ($1, '1d', $2, $3, $4, $5, $6, $7)",
      [guildId, new Date(dayStart), day.o, day.h, day.l, day.c, day.v],
    );
  }
  const holdings = [180, 95, 60, 40, 25];
  for (const [i, shares] of holdings.entries()) {
    await client.query("UPDATE economy_account SET casino_shares = $3 WHERE guild_id = $1 AND member_id = $2", [guildId, memberId(i * 3), shares]);
  }
  await client.query(
    "UPDATE casino_fund SET balance = $2, jackpot = 1840, server_shares = shares - $3, week_net = 3260 WHERE guild_id = $1",
    [guildId, Math.round((priceCents * 1000) / 100), holdings.reduce((sum, shares) => sum + shares, 0)],
  );

  // Modération : sanctions réussies et une tentative refusée, étalées sur trois jours.
  const actions: Array<[string, Record<string, string | number>]> = [
    ["moderation.timeout", { durationMinutes: 10, reason: "spam de mentions", result: "ok" }],
    ["moderation.warn", { reason: "hors sujet dans les annonces", result: "ok" }],
    ["moderation.ban", { reason: "contournement de bannissement", result: "refused:hierarchy" }],
    ["moderation.kick", { reason: "raid", result: "ok" }],
    ["moderation.timeout", { durationMinutes: 60, reason: "liens suspects", result: "ok" }],
    ["moderation.warn", { reason: "insultes", result: "ok" }],
    ["moderation.untimeout", { reason: "erreur", result: "ok" }],
    ["moderation.purge", { count: 25, result: "ok" }],
  ];

  for (const [index, [action, metadata]] of actions.entries()) {
    await client.query(
      "INSERT INTO audit_event (id, action, guild_id, occurred_at, actor_id, target_id, metadata) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)",
      [action, guildId, new Date(now - (index * 7 + 2) * 60_000 * 6), DEV_USERS.owner.discordId, action === "moderation.purge" ? null : memberId(10 + index), JSON.stringify(metadata)],
    );
  }

  for (let i = 0; i < 5; i++) {
    await client.query("INSERT INTO moderation_warning (guild_id, member_id, moderator_id, reason, created_at) VALUES ($1, $2, $3, $4, $5)", [
      guildId, memberId(20 + i), DEV_USERS.admin.discordId, "avertissement de démonstration", new Date(now - i * 24 * hour),
    ]);
  }

  // Sanctions actives : deux mutes (un du modérateur, un de l'auto-modération), un bannissement posé dans Discord
  // et un bannissement d'un administrateur. Les actions de modération d'aujourd'hui sont déjà dans l'audit ci-dessus.
  const minute = 60_000;
  const sanctions: Array<[number, "mute" | "ban", string | null, string, number, number | null]> = [
    [0, "mute", DEV_USERS.admin.discordId, "Spam de liens dans trois salons", -12, 48],
    [1, "mute", "sakutina", "Trop de personnes mentionnées d'un coup", -6, 54],
    [2, "ban", DEV_USERS.owner.discordId, "Contournement de bannissement", -60 * 30, null],
    [3, "ban", null, "Participation à un raid", -60 * 50, null],
  ];

  for (const [index, kind, moderator, reason, startMinutes, endMinutes] of sanctions) {
    await client.query(
      "INSERT INTO moderation_sanction (guild_id, member_id, kind, moderator_id, reason, created_at, ends_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [guildId, memberId(30 + index), kind, moderator, reason, new Date(now + startMinutes * minute), endMinutes === null ? null : new Date(now + endMinutes * minute)],
    );
  }

  await seedPhaethon(client, guildId, now);

  // Auto-modération : le filtre de spam et la limite de mentions sont allumés, avec deux mots interdits.
  await client.query(
    "INSERT INTO guild_settings (guild_id, automod_spam, automod_mentions, banned_words) VALUES ($1, true, true, ARRAY['arnaque', 'gratuit'])",
    [guildId],
  );
}

/** Identifiant Discord d'un compte créé il y a `days` jours : Phaéthon lit l'âge du compte dans l'identifiant. */
const accountId = (now: number, days: number, n: number) =>
  String(((BigInt(Math.floor(now - days * 86_400_000)) - 1420070400000n) << 22n) + BigInt(n));

/**
 * Phaéthon : quelques comptes qui ressortent sur la liste de surveillance, chacun pour une raison différente
 * (raid de comptes neufs, robot de spam, retour d'un banni, triche économique, abus de mentions), plus le rythme
 * ordinaire de membres anciens pour la médiane du serveur.
 */
async function seedPhaethon(client: PGlite, guildId: string, now: number): Promise<void> {
  const hour = 3_600_000;
  const day = 24 * hour;
  const utcDay = (at: number) => new Date(at).toISOString().slice(0, 10);
  const profile = (id: string, joinedAt: number, name: string, avatar: string | null = null, left: number | null = null) =>
    client.query(
      "INSERT INTO member_profile (guild_id, member_id, first_seen_at, joined_at, left_at, last_active_at, display_name, avatar) VALUES ($1, $2, $3, $3, $4, $5, $6, $7)",
      [guildId, id, new Date(joinedAt), left === null ? null : new Date(left), new Date(Math.min(now, joinedAt + 2 * hour)), name, avatar],
    );
  const messages = (id: string, at: number, count: number) =>
    client.query(
      "INSERT INTO member_hour_daily (guild_id, member_id, day, hour, messages) VALUES ($1, $2, $3::date, $4, $5) ON CONFLICT DO NOTHING",
      [guildId, id, utcDay(at), new Date(at).getUTCHours(), count],
    );
  const audit = (action: string, at: number, target: string, metadata: Record<string, string | number>, actor: string | null = null) =>
    client.query(
      "INSERT INTO audit_event (id, action, guild_id, occurred_at, actor_id, target_id, metadata) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)",
      [action, guildId, new Date(at), actor, target, JSON.stringify(metadata)],
    );
  let key = 0;
  const ledger = (id: string, kind: "earn" | "spend", amount: number, reason: string, at: number) =>
    client.query(
      `INSERT INTO economy_ledger (id, guild_id, member_id, kind, amount, wallet_after, bank_after, reason, idempotency_key, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $4, 0, $5, $6, $7)`,
      [guildId, id, kind, amount, reason, `phaethon-${key++}`, new Date(at)],
    );

  // Rythme ordinaire : 20 anciens membres écrivent le soir (la médiane d'une heure active du serveur).
  for (let i = 0; i < 20; i++) {
    for (let d = 0; d < 7; d++) {
      for (const h of [18, 19, 20, 21, 22]) {
        if ((i + d + h) % 3 !== 0) {
          await messages(memberId(i), Date.parse(`${utcDay(now - d * day)}T${h}:00:00Z`), 2 + ((i * 7 + d + h) % 6));
        }
      }
    }
  }

  // 1. Un raid : cinq comptes neufs, même avatar, arrivés dans la même minute il y a trois heures.
  const raidAt = now - 3 * hour;
  const raid = ["shadow.fox_88", "fox.shade_12", "shadow_fx88", "foxx_shadow", "sh4dow.fox"].map((name, n) => ({ id: accountId(now, 1 + (n % 2), 10 + n), name }));
  for (const [n, member] of raid.entries()) {
    await profile(member.id, raidAt + n * 15_000, member.name, "a1b2c3d4e5f60718293a4b5c6d7e8f90");
    await messages(member.id, raidAt + 8 * 60_000, n === 0 ? 72 : 18);
    if (n < 2) {
      await audit("automod.delete", raidAt + 10 * 60_000, member.id, { rule: "spam", result: "ok" });
    }
  }

  // 2. Un robot : il écrit à toute heure depuis trois jours, l'auto-modération retire ses liens.
  const bot = accountId(now, 5, 20);
  await profile(bot, now - 5 * day, "nova_trade");
  for (let h = 0; h < 72; h++) {
    await messages(bot, now - h * hour, 26 + (h % 5));
  }
  for (const h of [30, 22, 4]) {
    await audit("automod.delete", now - h * hour, bot, { rule: "links", result: "ok" });
  }
  await ledger(bot, "spend", 12_000, `pay:to:${raid[0]!.id}`, now - 20 * hour);
  await ledger(raid[0]!.id, "earn", 12_000, `pay:from:${bot}`, now - 20 * hour);

  // 3. Un retour de banni : « kaito » banni il y a deux jours, « kaito.alt2 » arrive trois minutes plus tard.
  const kaito = accountId(now, 700, 30);
  const alt = accountId(now, 9, 31);
  const banAt = now - 2 * day;
  await profile(kaito, now - 600 * day, "kaito", null, banAt);
  await client.query(
    "INSERT INTO moderation_sanction (guild_id, member_id, kind, moderator_id, reason, created_at) VALUES ($1, $2, 'ban', $3, 'Harcèlement', $4)",
    [guildId, kaito, DEV_USERS.owner.discordId, new Date(banAt)],
  );
  await audit("moderation.ban", banAt, kaito, { reason: "Harcèlement", result: "ok" }, DEV_USERS.owner.discordId);
  await profile(alt, banAt + 3 * 60_000, "kaito.alt2");
  for (let d = 0; d < 2; d++) {
    for (const h of [0, 1, 2, 3]) {
      await messages(alt, Date.parse(`${utcDay(now - d * day)}T0${h}:00:00Z`), 8 + h * 3);
    }
  }
  await client.query("INSERT INTO moderation_warning (guild_id, member_id, moderator_id, reason, created_at) VALUES ($1, $2, $3, 'Insultes', $4)", [
    guildId, alt, DEV_USERS.admin.discordId, new Date(now - 6 * hour),
  ]);
  await audit("moderation.warn", now - 6 * hour, alt, { reason: "Insultes", result: "ok" }, DEV_USERS.admin.discordId);

  // 4. Triche économique : récompense réclamée à la même seconde chaque jour, chance insolente au casino,
  //    pièces envoyées à d'autres comptes. Le score reste bas : un administrateur le surveille.
  const farmer = accountId(now, 41, 40);
  await profile(farmer, now - 38 * day, "pixel_ren");
  for (let d = 1; d <= 9; d++) {
    await ledger(farmer, "earn", 250, "salary:daily", Date.parse(`${utcDay(now - d * day)}T00:00:03Z`));
  }
  for (let g = 0; g < 33; g++) {
    await ledger(farmer, g < 31 ? "earn" : "spend", 200, `casino:slots:${g < 31 ? "win" : "loss"}`, now - (g * 5 + 1) * hour);
  }
  await ledger(farmer, "spend", 4_800, `pay:to:${memberId(3)}`, now - 30 * hour);
  await ledger(farmer, "spend", 6_200, `pay:to:${memberId(4)}`, now - 26 * hour);
  for (let d = 0; d < 7; d++) {
    for (const h of [0, 4, 8, 12, 16, 20]) {
      await messages(farmer, Date.parse(`${utcDay(now - d * day)}T${String(h).padStart(2, "0")}:00:00Z`), 12);
    }
  }
  await client.query("INSERT INTO phaethon_review (guild_id, member_id, status, score, reviewed_by) VALUES ($1, $2, 'watch', 10, $3)", [
    guildId, farmer, DEV_USERS.owner.discordId,
  ]);

  // 5. Abus de mentions : un ancien membre, plusieurs fois averti, que l'auto-modération a dû faire taire.
  const echo = accountId(now, 210, 50);
  await profile(echo, now - 190 * day, "echo.vale");
  await client.query("INSERT INTO activity_daily (guild_id, member_id, day, messages, mentions) VALUES ($1, $2, $3::date, 40, 64)", [guildId, echo, utcDay(now)]);
  for (const [h, kind] of [[50, "automod.timeout"], [26, "automod.delete"], [2, "automod.timeout"]] as const) {
    await audit(kind, now - h * hour, echo, { rule: "mentions", durationMinutes: 60, result: "ok" });
  }
  for (const d of [3, 20, 60]) {
    await client.query("INSERT INTO moderation_warning (guild_id, member_id, moderator_id, reason, created_at) VALUES ($1, $2, $3, 'Mentions de masse', $4)", [
      guildId, echo, DEV_USERS.admin.discordId, new Date(now - d * day),
    ]);
  }
  for (const [n, kind] of ["nickname", "avatar", "nickname", "display-name"].entries()) {
    await client.query(
      "INSERT INTO identity_event (id, guild_id, member_id, kind, old_value, new_value, occurred_at) VALUES (gen_random_uuid(), $1, $2, $3, NULL, NULL, $4)",
      [guildId, echo, kind, new Date(now - (n * 20 + 5) * hour)],
    );
  }
  await messages(echo, now - hour, 14);
}
