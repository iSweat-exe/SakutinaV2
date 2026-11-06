import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { PostgresGuildStore } from "@/database/postgres/repositories/postgres-guild-store.ts";
import { PostgresRaidStore } from "@/database/postgres/repositories/postgres-raid-store.ts";
import { actAs, installFakeSupabaseAuth } from "../../support/fake-supabase.ts";

// Le refus des non-administrateurs est vérifié pour toute fonction panel_* par panel-functions.test.ts.
const ADMIN = "11111111-1111-1111-1111-111111111111";
const DAY = 86_400_000;

type Panel = Readonly<{
  settings: Record<string, unknown>;
  active: Record<string, unknown> | null;
  joins_10m: number;
  young_joins_10m: number;
  joins_per_minute: number[];
  raids_30d: number;
  pending: { action: string } | null;
  last_failure: { action: string; error: string } | null;
  history: Record<string, unknown>[];
}>;

let client: PGlite;
let db: Database;

const panel = async (guild = "g") => (await client.query<{ r: Panel }>("SELECT panel_antiraid($1) AS r", [guild])).rows[0]!.r;
const code = async (query: string) => {
  try {
    await client.query(query);
    return null;
  } catch (failure) {
    return (failure as { code?: string }).code ?? "unknown";
  }
};

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client) as unknown as Database;
  await migrate(db);
  await installFakeSupabaseAuth(client);
  await client.exec(`
    INSERT INTO auth.identities VALUES ('${ADMIN}', 'discord', 'd-admin');
    INSERT INTO panel_admin (guild_id, discord_id, role) VALUES ('g', 'd-admin', 'admin'), ('autre', 'd-admin', 'admin');
    INSERT INTO member_profile (guild_id, member_id, first_seen_at, display_name) VALUES ('g', 'd-admin', now(), 'Mika');
  `);
});

afterAll(async () => {
  await client.close();
});

describe("PostgresRaidStore", () => {
  test("un seul raid ouvert par serveur, compteurs additifs, fin unique", async () => {
    const store = new PostgresRaidStore(db);
    const raid = await store.start({ id: crypto.randomUUID(), guildId: "s1", startedAt: new Date(), trigger: "burst", startedBy: null, joins: 5, windowSeconds: 30, action: "kick" });

    expect(raid).toMatchObject({ guildId: "s1", joins: 5, actioned: 0, endedAt: null });
    expect(await store.start({ id: crypto.randomUUID(), guildId: "s1", startedAt: new Date(), trigger: "manual", startedBy: "a", joins: 0, windowSeconds: 30, action: "kick" })).toBeNull();

    await store.addCounts(raid!.id, { joins: 2, actioned: 3, failed: 1, lockedChannels: 4 });
    expect(await store.find(raid!.id)).toMatchObject({ joins: 7, actioned: 3, failed: 1, lockedChannels: 4 });
    expect((await store.active()).map((r) => r.id)).toContain(raid!.id);

    expect(await store.end(raid!.id, new Date(), "admin")).toBe(true);
    expect(await store.end(raid!.id, new Date(), "admin")).toBe(false);
    expect((await store.active()).map((r) => r.id)).not.toContain(raid!.id);
  });

  test("l'état d'avant le verrouillage : enregistré d'un seul tenant, première copie gardée, retiré salon par salon", async () => {
    const store = new PostgresRaidStore(db);
    const raid = (await store.start({ id: crypto.randomUUID(), guildId: "s2", startedAt: new Date(), trigger: "manual", startedBy: "a", joins: 0, windowSeconds: 30, action: "watch" }))!;

    await store.saveLockdown(raid.id, "s2", [{ channelId: "c1", overwrite: null }, { channelId: "c2", overwrite: { allow: "1024", deny: "64" } }], 2);
    await store.saveLockdown(raid.id, "s2", [{ channelId: "c1", overwrite: { allow: "0", deny: "2048" } }], null);

    const saved = await store.lockdown(raid.id);
    expect(saved.verificationBefore).toBe(2);
    expect([...saved.channels].sort((a, b) => a.channelId.localeCompare(b.channelId))).toEqual([
      { channelId: "c1", overwrite: null },
      { channelId: "c2", overwrite: { allow: "1024", deny: "64" } },
    ]);

    await store.forgetChannel(raid.id, "c1");
    expect((await store.lockdown(raid.id)).channels.map((c) => c.channelId)).toEqual(["c2"]);
  });

  test("demandes du panneau et purge", async () => {
    const store = new PostgresRaidStore(db);
    await store.enqueueCommand("s3", "start", "admin");
    const [command] = (await store.pendingCommands(10)).filter((c) => c.guildId === "s3");

    expect(command).toMatchObject({ action: "start", requestedBy: "admin" });
    await store.finishCommand(command!.id, "done", new Date(Date.now() - 40 * DAY));

    const old = (await store.start({ id: crypto.randomUUID(), guildId: "s3", startedAt: new Date(Date.now() - 400 * DAY), trigger: "burst", startedBy: null, joins: 1, windowSeconds: 30, action: "ban" }))!;
    await store.end(old.id, new Date(Date.now() - 399 * DAY), null);

    expect(await store.purge(new Date(Date.now() - 365 * DAY), new Date(Date.now() - 30 * DAY))).toBe(2);
    expect(await store.find(old.id)).toBeNull();
  });
});

describe("réglages", () => {
  test("le bot lit les réglages de l'anti-raid de guild_settings", async () => {
    await client.exec("INSERT INTO guild_settings (guild_id, antiraid_enabled, antiraid_action, antiraid_join_threshold) VALUES ('lu', true, 'ban', 20)");
    const settings = await new PostgresGuildStore(db).getSettings("lu");

    expect(settings?.antiRaid).toEqual({
      enabled: true,
      joinThreshold: 20,
      windowSeconds: 30,
      minAccountAgeDays: 7,
      action: "ban",
      lockChannels: true,
      alertAdmins: true,
      raiseVerification: false,
    });
  });

  test("la base refuse des réglages hors bornes", async () => {
    expect(await code("INSERT INTO guild_settings (guild_id, antiraid_join_threshold) VALUES ('x1', 2)")).toBe("23514");
    expect(await code("INSERT INTO guild_settings (guild_id, antiraid_action) VALUES ('x2', 'nuke')")).toBe("23514");
  });
});

describe("fonctions du panneau", () => {
  test("panel_antiraid : valeurs par défaut sans réglages, aucun raid", async () => {
    await actAs(client, ADMIN);
    const data = await panel();

    expect(data.settings).toMatchObject({ enabled: false, join_threshold: 10, window_seconds: 30, action: "quarantine", alert_channel: false });
    expect(data.active).toBeNull();
    expect(data.joins_per_minute).toHaveLength(10);
    expect(data.history).toEqual([]);
  });

  test("panel_set_antiraid change seulement ce qui est donné, valide et journalise", async () => {
    await actAs(client, ADMIN);
    await client.query("SELECT panel_set_antiraid('g', p_enabled => true, p_action => 'kick', p_join_threshold => 15)");
    const data = await panel();

    expect(data.settings).toMatchObject({ enabled: true, action: "kick", join_threshold: 15, window_seconds: 30, lock_channels: true });
    expect(await code("SELECT panel_set_antiraid('g', p_window_seconds => 500)")).toBe("22023");
    expect(await code("SELECT panel_set_antiraid('g', p_action => 'nuke')")).toBe("22023");

    const { rows } = await client.query<{ actor_id: string; metadata: Record<string, unknown> }>(
      "SELECT actor_id, metadata FROM audit_event WHERE guild_id = 'g' AND action = 'settings.antiraid'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actor_id: "d-admin", metadata: { enabled: true, action: "kick", join_threshold: 15, source: "panel" } });
    // L'autre serveur n'a pas bougé.
    expect((await panel("autre")).settings).toMatchObject({ enabled: false, action: "quarantine" });
  });

  test("arrivées des 10 dernières minutes, minute par minute, comptes récents à part", async () => {
    const young = String(((BigInt(Date.now() - 2 * DAY) - 1_420_070_400_000n) << 22n) + 1n);
    const old = String(((BigInt(Date.now() - 900 * DAY) - 1_420_070_400_000n) << 22n) + 2n);
    await client.exec(`
      INSERT INTO audit_event (id, action, guild_id, occurred_at, target_id, metadata) VALUES
        (gen_random_uuid(), 'member.joined', 'g', now() - interval '30 seconds', '${young}', '{}'),
        (gen_random_uuid(), 'member.joined', 'g', now() - interval '40 seconds', '${old}', '{}'),
        (gen_random_uuid(), 'member.joined', 'g', now() - interval '5 minutes 30 seconds', '${old}', '{}'),
        (gen_random_uuid(), 'member.joined', 'g', now() - interval '20 minutes', '${old}', '{}'),
        (gen_random_uuid(), 'member.joined', 'autre', now() - interval '10 seconds', '${young}', '{}');
    `);
    await actAs(client, ADMIN);
    const data = await panel();

    expect(data.joins_10m).toBe(3);
    expect(data.young_joins_10m).toBe(1);
    expect(data.joins_per_minute[9]).toBe(2);
    expect(data.joins_per_minute[4]).toBe(1);
    expect(data.joins_per_minute.reduce((a, b) => a + b, 0)).toBe(3);
  });

  test("panel_request_raid : verrouiller, refusé pendant un raid ; lever, refusé sans raid", async () => {
    await actAs(client, ADMIN);
    expect(await code("SELECT panel_request_raid('g', 'end')")).toBe("22023");
    expect(await code("SELECT panel_request_raid('g', 'nuke')")).toBe("22023");

    await client.query("SELECT panel_request_raid('g', 'start')");
    await client.query("SELECT panel_request_raid('g', 'start')");
    expect((await panel()).pending).toMatchObject({ action: "start" });
    const { rows } = await client.query<{ n: number }>("SELECT count(*)::int AS n FROM raid_command WHERE guild_id = 'g'");
    expect(rows[0]!.n).toBe(1);

    // Le bot l'exécute : un raid manuel est ouvert.
    const store = new PostgresRaidStore(db);
    const [command] = (await store.pendingCommands(10)).filter((c) => c.guildId === "g");
    const raid = (await store.start({ id: crypto.randomUUID(), guildId: "g", startedAt: new Date(), trigger: "manual", startedBy: command!.requestedBy, joins: 0, windowSeconds: 30, action: "kick" }))!;
    await store.finishCommand(command!.id, "done", new Date());

    await actAs(client, ADMIN);
    expect(await code("SELECT panel_request_raid('g', 'start')")).toBe("22023");
    const live = await panel();
    expect(live.active).toMatchObject({ id: raid.id, trigger: "manual", started_by_name: "Mika", action: "kick" });
    expect(live.pending).toBeNull();

    await client.query("SELECT panel_request_raid('g', 'end')");
    const [end] = (await store.pendingCommands(10)).filter((c) => c.guildId === "g");
    await store.addCounts(raid.id, { joins: 12, actioned: 11, failed: 1, lockedChannels: 6 });
    await store.end(raid.id, new Date(), end!.requestedBy);
    await store.finishCommand(end!.id, "failed", new Date(), "Missing Permissions");

    await actAs(client, ADMIN);
    const after = await panel();
    expect(after.active).toBeNull();
    expect(after.raids_30d).toBe(1);
    expect(after.last_failure).toMatchObject({ action: "end", error: "Missing Permissions" });
    expect(after.history[0]).toMatchObject({ joins: 12, actioned: 11, failed: 1, locked_channels: 6, ended_by_name: "Mika", trigger: "manual" });
    expect((await panel("autre")).history).toEqual([]);
  });
});
