import type { PGlite } from "@electric-sql/pglite";

/** Utilisateurs de démonstration : connexion en un clic sur /__dev. */
export const DEV_USERS = {
  owner: { id: "00000000-0000-4000-8000-000000000001", discordId: "900000000000000001", name: "Mika", username: "mika", role: "owner" },
  admin: { id: "00000000-0000-4000-8000-000000000002", discordId: "900000000000000002", name: "Aiko", username: "aiko", role: "admin" },
  stranger: { id: "00000000-0000-4000-8000-000000000003", discordId: "900000000000000003", name: "Visiteur", username: "visiteur", role: null },
} as const;

export type DevUserKey = keyof typeof DEV_USERS;

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
      "INSERT INTO member_profile (guild_id, member_id, first_seen_at, joined_at, left_at, last_active_at) VALUES ($1, $2, $3, $3, $4, $5)",
      [guildId, memberId(i), new Date(now - (10 + i * 4) * 24 * hour), left ? new Date(now - 3 * 24 * hour) : null, lastActive],
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
      "INSERT INTO activity_hourly (guild_id, day, hour, messages) VALUES ($1, $2::date, $3, $4) ON CONFLICT DO NOTHING",
      [guildId, at.toISOString().slice(0, 10), hourOfDay, messages],
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
}
