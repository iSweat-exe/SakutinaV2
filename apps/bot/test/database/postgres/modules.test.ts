import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { PostgresGuildStore } from "@/database/postgres/repositories/postgres-guild-store.ts";
import { actAs, installFakeSupabaseAuth } from "../../support/fake-supabase.ts";

// Le refus des non-administrateurs est vérifié pour toute fonction panel_* par panel-functions.test.ts.
const ADMIN = "11111111-1111-1111-1111-111111111111";

let client: PGlite;
let db: Database;

const call = async <T>(query: string, params: unknown[] = []) => (await client.query<{ r: T }>(query, params)).rows[0]!.r;
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
  `);
});

afterAll(async () => {
  await client.close();
});

test("panel_modules : tout actif sauf l'anti-raid par défaut ; panel_set_module change un module et journalise", async () => {
  await actAs(client, ADMIN);
  expect(await call("SELECT panel_modules('g') AS r")).toEqual({ antiraid: false, casino: true, phaethon: true, profiling: true, raid_active: false });

  const after = await call<Record<string, boolean>>("SELECT panel_set_module('g', 'casino', false) AS r");
  expect(after).toMatchObject({ casino: false, phaethon: true });
  await call("SELECT panel_set_module('g', 'antiraid', true) AS r");
  expect(await code("SELECT panel_set_module('g', 'moderation', true)")).toBe("22023");
  expect(await code("SELECT panel_set_module('g', 'casino')")).toBe("22023");

  const { rows } = await client.query<{ metadata: Record<string, unknown>; actor_id: string }>(
    "SELECT metadata, actor_id FROM audit_event WHERE guild_id = 'g' AND action = 'settings.module' ORDER BY occurred_at",
  );
  expect(rows.map((r) => [r.metadata.module, r.metadata.enabled, r.actor_id])).toEqual([
    ["casino", false, "d-admin"],
    ["antiraid", true, "d-admin"],
  ]);
  expect(await call("SELECT panel_modules('autre') AS r")).toMatchObject({ casino: true, antiraid: false });

  // Le bot lit les interrupteurs.
  expect((await new PostgresGuildStore(db).getSettings("g"))?.modules).toEqual({ casino: false, phaethon: true, profiling: true });
});

test("salon d'alertes : seulement un salon où le bot écrit ; proposé et choisi dans panel_antiraid", async () => {
  await new PostgresGuildStore(db).replaceChannels("g", [
    { channelId: "c2", name: "logs", category: "Staff", position: 1002 },
    { channelId: "c1", name: "général", category: null, position: 1 },
  ]);
  await actAs(client, ADMIN);

  expect(await code("SELECT panel_set_alert_channel('g', 'inconnu')")).toBe("22023");
  const data = await call<{ settings: Record<string, unknown>; channels: unknown[] }>("SELECT panel_set_alert_channel('g', 'c2') AS r");
  expect(data.settings).toMatchObject({ alert_channel: true, alert_channel_id: "c2" });
  expect(data.channels).toEqual([
    { id: "c1", name: "général", category: null },
    { id: "c2", name: "logs", category: "Staff" },
  ]);
  expect((await new PostgresGuildStore(db).getSettings("g"))?.alertChannelId).toBe("c2");
  // Un salon d'un autre serveur est refusé.
  expect(await code("SELECT panel_set_alert_channel('autre', 'c2')")).toBe("22023");

  const cleared = await call<{ settings: Record<string, unknown> }>("SELECT panel_set_alert_channel('g', NULL) AS r");
  expect(cleared.settings).toMatchObject({ alert_channel: false, alert_channel_id: null });
});

test("le bot remplace la liste des salons et choisit le salon d'alertes", async () => {
  const store = new PostgresGuildStore(db);
  await store.replaceChannels("g", [{ channelId: "c3", name: "alertes", category: null, position: 0 }]);
  await store.setAlertChannel("neuf", "c9");

  const { rows } = await client.query<{ channel_id: string }>("SELECT channel_id FROM guild_channel WHERE guild_id = 'g'");
  expect(rows.map((r) => r.channel_id)).toEqual(["c3"]);
  expect((await store.getSettings("neuf"))?.alertChannelId).toBe("c9");
});

test("Profiling coupé : panel_profiling refuse ; actif : totaux depuis l'arrivée en plus des 30 jours", async () => {
  await client.exec(`
    INSERT INTO member_profile (guild_id, member_id, first_seen_at, display_name) VALUES ('g', '101', now(), 'Aiko');
    INSERT INTO activity_daily (guild_id, member_id, day, messages, voice_seconds) VALUES
      ('g', '101', current_date, 10, 600), ('g', '101', current_date - 35, 5, 0);
    INSERT INTO activity_monthly (guild_id, member_id, month, messages, voice_seconds) VALUES ('g', '101', '2026-01', 100, 6000);
  `);
  await actAs(client, ADMIN);

  const data = await call<{ members: Record<string, number>[] }>("SELECT panel_profiling('g') AS r");
  expect(data.members[0]).toMatchObject({ messages_30d: 10, voice_minutes_30d: 10, messages_total: 115, voice_minutes_total: 110 });

  await call("SELECT panel_set_module('g', 'profiling', false) AS r");
  expect(await code("SELECT panel_profiling('g')")).toBe("55000");
  await call("SELECT panel_set_module('g', 'profiling', true) AS r");
  expect(await code("SELECT panel_profiling('g')")).toBeNull();
});
