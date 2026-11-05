import { afterAll, beforeAll, expect, test } from "bun:test";

import { startBotMock } from "../dev-local/bot-mock.ts";
import { DEV_USERS } from "../dev-local/seed.ts";
import { devToken, startDevSupabase, type DevSupabase } from "../dev-local/supabase.ts";

const GUILD = "1317931106993180763";
let dev: DevSupabase;

beforeAll(async () => {
  dev = await startDevSupabase({ port: 0, panelUrl: "http://localhost:3000", guildId: GUILD });
});

afterAll(async () => {
  await dev.close();
});

const rpc = (fn: string, as: keyof typeof DEV_USERS | null, args: Record<string, unknown> = { p_guild_id: GUILD }) =>
  fetch(`${dev.url}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(as ? { authorization: `Bearer ${devToken(DEV_USERS[as])}` } : {}) },
    body: JSON.stringify(args),
  });

test("un administrateur lit la vue d'ensemble de démonstration, avec les vraies fonctions SQL", async () => {
  const response = await rpc("panel_overview", "owner");
  const overview = (await response.json()) as { messages_24h: number; members: number; hourly: unknown[] };

  expect(response.status).toBe(200);
  expect(overview.hourly).toHaveLength(24);
  expect(overview.messages_24h).toBeGreaterThan(0);
  expect(overview.members).toBeGreaterThan(50);
  expect(await (await rpc("panel_role", "owner")).json()).toBe("owner");
  expect(await (await rpc("panel_role", "admin")).json()).toBe("admin");
});

test("la base refuse un visiteur connecté (403) et un anonyme (401), comme PostgREST", async () => {
  const stranger = await rpc("panel_overview", "stranger");
  expect(stranger.status).toBe(403);
  expect(((await stranger.json()) as { code: string }).code).toBe("42501");

  expect((await rpc("panel_overview", null)).status).toBe(401);
  // Aucun rôle pour lui, mais pas d'erreur : c'est ce que le panneau attend de panel_role.
  expect(await (await rpc("panel_role", "stranger")).json()).toBeNull();
});

test("le journal d'audit de démonstration contient des sanctions, dont une refusée", async () => {
  const entries = (await (await rpc("panel_recent_audit", "owner", { p_guild_id: GUILD, p_limit: 20 })).json()) as Array<{ action: string; metadata: { result: string } }>;

  expect(entries.length).toBeGreaterThan(3);
  expect(entries.every((entry) => entry.action.startsWith("moderation."))).toBe(true);
  expect(entries.some((entry) => entry.metadata.result.startsWith("refused"))).toBe(true);
});

test("seules les fonctions panel_* sont appelables, avec des arguments p_*", async () => {
  expect((await rpc("economy_account", "owner")).status).toBe(404);
  expect((await rpc("panel_overview", "owner", { "p_guild_id; DROP TABLE x": "g" })).status).toBe(400);
  expect((await rpc("panel_inconnue", "owner")).status).toBe(404);
});

test("/auth/v1/user reconnaît le jeton, et /__dev/login pose le cookie que @supabase/ssr lit", async () => {
  const me = await fetch(`${dev.url}/auth/v1/user`, { headers: { authorization: `Bearer ${devToken(DEV_USERS.owner)}` } });
  expect(((await me.json()) as { user_metadata: { custom_claims: { global_name: string } } }).user_metadata.custom_claims.global_name).toBe("Mika");
  expect((await fetch(`${dev.url}/auth/v1/user`)).status).toBe(401);

  const login = await fetch(`${dev.url}/__dev/login?as=admin&to=/moderation`, { redirect: "manual" });
  expect(login.status).toBe(302);
  expect(login.headers.get("location")).toBe("http://localhost:3000/moderation");
  expect(login.headers.get("set-cookie")).toMatch(/^sb-localhost-auth-token=base64-[\w-]+; Path=\//);
});

test("le faux bot imite /api/v1/health, y compris « Discord déconnecté »", async () => {
  const bot = startBotMock(0);

  try {
    const ok = (await (await fetch(`http://localhost:${bot.port}/api/v1/health`)).json()) as { status: string; discord: { connected: boolean } };
    expect(ok).toMatchObject({ status: "ok", discord: { connected: true } });

    const down = await fetch(`http://localhost:${bot.port}/api/v1/ready?state=degraded`);
    expect(down.status).toBe(503);
  } finally {
    bot.close();
  }
});
