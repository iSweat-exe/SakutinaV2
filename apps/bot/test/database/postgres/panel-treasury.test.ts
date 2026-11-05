import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { actAs, installFakeSupabaseAuth } from "../../support/fake-supabase.ts";

// Le refus des non-administrateurs est déjà vérifié pour toute fonction panel_* par
// panel-functions.test.ts : ici, le contenu et les garde-fous du versement.
const ADMIN = "11111111-1111-1111-1111-111111111111";
let client: PGlite;

type Treasury = {
  balance: number;
  in_24h: number;
  out_24h: number;
  recent: { amount: number; reason: string; note: string | null; member_id: string | null; member_name: string | null; actor_name: string | null }[];
};

beforeAll(async () => {
  client = new PGlite();
  await migrate(drizzle(client) as unknown as Database);
  await installFakeSupabaseAuth(client);
  await client.exec(`
    INSERT INTO auth.identities VALUES ('${ADMIN}', 'discord', 'd-admin');
    INSERT INTO panel_admin (guild_id, discord_id, role) VALUES ('g', 'd-admin', 'admin');
    INSERT INTO member_profile (guild_id, member_id, first_seen_at, display_name, avatar) VALUES
      ('g', 'd-admin', now(), 'Chef', NULL), ('g', 'aiko', now(), 'Aiko', 'abc'), ('g', 'aimee', now(), 'Aimée', NULL),
      ('g', 'riche', now(), 'Riche', NULL), ('other', 'intrus', now(), 'Aiko Intrus', NULL);
    INSERT INTO guild_treasury (guild_id, balance) VALUES ('g', 1000), ('other', 5000);
    INSERT INTO treasury_entry (id, guild_id, amount, reason, member_id, created_at) VALUES
      (gen_random_uuid(), 'g', 999, 'tax', 'aiko', now() - interval '3 days'),
      (gen_random_uuid(), 'g', 400, 'tax', 'aiko', now() - interval '2 hours'),
      (gen_random_uuid(), 'g', 700, 'casino:slots:loss', 'aiko', now() - interval '1 hour'),
      (gen_random_uuid(), 'g', -100, 'casino:slots:win', 'aimee', now() - interval '30 minutes'),
      (gen_random_uuid(), 'other', 5000, 'tax', 'intrus', now());
    INSERT INTO economy_account (guild_id, member_id, wallet, bank) VALUES ('g', 'riche', 999999999990, 0);
  `);
});

afterAll(async () => {
  await client.close();
});

const treasury = async () => {
  await actAs(client, ADMIN);
  return (await client.query<{ result: Treasury }>("SELECT panel_treasury('g') AS result")).rows[0]!.result;
};

test("le trésor : solde, flux des dernières 24 h et derniers mouvements avec le nom des membres", async () => {
  const result = await treasury();

  expect(result.balance).toBe(1000);
  expect(result.in_24h).toBe(1100);
  expect(result.out_24h).toBe(100);
  expect(result.recent.map((entry) => entry.amount)).toEqual([-100, 700, 400, 999]);
  expect(result.recent[0]).toMatchObject({ reason: "casino:slots:win", member_name: "Aimée" });
});

test("un serveur sans trésor affiche zéro", async () => {
  await actAs(client, ADMIN);
  await client.exec("INSERT INTO panel_admin (guild_id, discord_id, role) VALUES ('vide', 'd-admin', 'admin')");
  const result = (await client.query<{ result: Treasury }>("SELECT panel_treasury('vide') AS result")).rows[0]!.result;

  expect(result).toMatchObject({ balance: 0, in_24h: 0, out_24h: 0, recent: [] });
});

test("chercher un membre : par nom (sans casse), par identifiant, jamais ceux d'un autre serveur", async () => {
  await actAs(client, ADMIN);
  const find = async (query: string | null) =>
    (await client.query<{ result: { member_id: string; name: string }[] }>("SELECT panel_find_members('g', $1) AS result", [query])).rows[0]!.result;

  expect((await find("AI")).map((member) => member.member_id)).toEqual(["aiko", "aimee"]);
  expect((await find("aiko")).map((member) => member.member_id)).toEqual(["aiko"]);
  expect((await find("riche")).map((member) => member.name)).toEqual(["Riche"]);
  expect(await find("a")).toEqual([]);
  expect(await find(null)).toEqual([]);
});

test("verser : le trésor baisse, le membre reçoit, le grand livre, le journal et l'audit portent l'auteur", async () => {
  await actAs(client, ADMIN);
  const result = await client.query<{ result: { balance: number; amount: number } }>(
    "SELECT panel_treasury_pay_out('g', 'aiko', 250, '  Concours de dessin ') AS result",
  );

  expect(result.rows[0]!.result).toEqual({ balance: 750, amount: 250 });
  expect((await client.query<{ wallet: number }>("SELECT wallet FROM economy_account WHERE guild_id = 'g' AND member_id = 'aiko'")).rows[0]!.wallet).toBe(250);
  expect((await client.query("SELECT kind, amount, reason, wallet_after FROM economy_ledger WHERE guild_id = 'g' AND member_id = 'aiko'")).rows).toEqual([
    { kind: "earn", amount: 250, reason: "treasury:payout", wallet_after: 250 },
  ]);

  const latest = (await treasury()).recent[0]!;
  expect(latest).toMatchObject({ amount: -250, reason: "payout", note: "Concours de dessin", member_id: "aiko" });

  const audit = await client.query("SELECT action, actor_id, target_id, metadata FROM audit_event WHERE guild_id = 'g' AND action = 'treasury.payout'");
  expect(audit.rows).toEqual([
    { action: "treasury.payout", actor_id: "d-admin", target_id: "aiko", metadata: { amount: 250, note: "Concours de dessin", source: "panel" } },
  ]);
});

test("refus : trésor insuffisant, montant ou note hors limites, membre inconnu ou d'un autre serveur, plafond du portefeuille", async () => {
  await actAs(client, ADMIN);
  const calls = [
    ["insufficient treasury", "'g', 'aiko', 751"],
    ["invalid payout", "'g', 'aiko', 0"],
    ["invalid payout", "'g', 'aiko', -5"],
    ["invalid payout", "'g', 'aiko', NULL"],
    ["invalid payout", "'g', NULL, 10"],
    ["invalid note", `'g', 'aiko', 10, '${"x".repeat(101)}'`],
    ["invalid member", "'g', 'fantome', 10"],
    ["invalid member", "'g', 'intrus', 10"],
    ["balance limit", "'g', 'riche', 20"],
  ] as const;

  for (const [message, args] of calls) {
    await expect(client.query(`SELECT panel_treasury_pay_out(${args})`), args).rejects.toThrow(message);
  }

  // Rien n'a bougé : ni le trésor, ni les comptes.
  expect((await treasury()).balance).toBe(750);
  expect((await client.query("SELECT count(*)::int AS n FROM economy_ledger WHERE guild_id = 'g'")).rows[0]).toEqual({ n: 1 });
  expect((await client.query("SELECT balance FROM guild_treasury WHERE guild_id = 'other'")).rows[0]).toEqual({ balance: 5000 });
});

test("le journal du trésor ne se modifie pas", async () => {
  await expect(client.query("UPDATE treasury_entry SET amount = 1")).rejects.toThrow(/immutable/);
  await expect(client.query("DELETE FROM treasury_entry")).rejects.toThrow(/immutable/);
});

test("verser épuise le trésor sans le rendre négatif", async () => {
  await actAs(client, ADMIN);
  await client.query("SELECT panel_treasury_pay_out('g', 'aimee', 750)");

  expect((await treasury()).balance).toBe(0);
  await expect(client.query("SELECT panel_treasury_pay_out('g', 'aimee', 1)")).rejects.toThrow("insufficient treasury");
});
