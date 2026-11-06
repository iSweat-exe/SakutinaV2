import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { actAs, installFakeSupabaseAuth } from "../../support/fake-supabase.ts";

// Le refus des non-administrateurs est déjà vérifié pour toute fonction panel_* par
// panel-functions.test.ts : ici, le contenu.
const ADMIN = "11111111-1111-1111-1111-111111111111";
let client: PGlite;

const NOW = Date.now();
/** Grand livre : +300 gagné il y a 2 h, −100 dépensé il y a 3 h, un dépôt neutre, +200 il y a 2 jours, +999 il y a 10 jours (hors des 7 jours), et un gain d'un autre serveur. */
type LedgerEvent = { hoursAgo: number; kind: "earn" | "spend" | "deposit"; amount: number; guild?: string };
const LEDGER: readonly LedgerEvent[] = [
  { hoursAgo: 2, kind: "earn", amount: 300 },
  { hoursAgo: 3, kind: "spend", amount: 100 },
  { hoursAgo: 1, kind: "deposit", amount: 50 },
  { hoursAgo: 48, kind: "earn", amount: 200 },
  { hoursAgo: 240, kind: "earn", amount: 999 },
  { hoursAgo: 1, kind: "earn", amount: 5000, guild: "other" },
];

type Economy = {
  coins_total: number;
  holders: number;
  average: number;
  earned_24h: number;
  spent_24h: number;
  circulation: { day: string; coins: number }[];
  top: { member_id: string; coins: number; name: string | null; avatar: string | null }[];
  rules: {
    currency_name: string;
    salary_budget_permille: number;
    starting_balance: number;
    transfer_tax_percent: number;
    bank_interest_permille: number;
    wealth_tax_permille: number;
    idle_tax_permille: number;
  };
  pools: { reserve: number; casino: number; jackpot: number; money_supply: number };
};

beforeAll(async () => {
  client = new PGlite();
  await migrate(drizzle(client) as unknown as Database);
  await installFakeSupabaseAuth(client);
  await client.exec(`
    INSERT INTO auth.identities VALUES ('${ADMIN}', 'discord', 'd-admin');
    INSERT INTO panel_admin (guild_id, discord_id, role) VALUES ('g', 'd-admin', 'admin');
    INSERT INTO member_profile (guild_id, member_id, first_seen_at, display_name, avatar) VALUES ('g', 'a', now(), 'Aiko', 'abc123'), ('other', 'b', now(), 'Intrus', 'zzz');

    -- Soldes actuels : 1000 + 600 + 400 (le porteur « zero » n'a rien), et un autre serveur à part.
    INSERT INTO economy_account (guild_id, member_id, wallet, bank) VALUES
      ('g', 'a', 700, 300), ('g', 'b', 100, 500), ('g', 'c', 400, 0), ('g', 'zero', 0, 0),
      ('other', 'z', 999999, 0);

  `);

  for (const [index, event] of LEDGER.entries()) {
    await client.query(
      `INSERT INTO economy_ledger (id, guild_id, member_id, kind, amount, wallet_after, bank_after, reason, idempotency_key, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 1, 1, 'test', $5, $6)`,
      [event.guild ?? "g", "a", event.kind, event.amount, `k${index}`, new Date(NOW - event.hoursAgo * 3_600_000).toISOString()],
    );
  }
});

afterAll(async () => {
  await client.close();
});

const economy = async () => {
  await actAs(client, ADMIN);
  return (await client.query<{ result: Economy }>("SELECT panel_economy('g') AS result")).rows[0]!.result;
};

test("totaux : pièces en circulation, porteurs et moyenne du serveur seulement", async () => {
  const result = await economy();

  expect(result.coins_total).toBe(2000);
  expect(result.holders).toBe(3);
  expect(result.average).toBe(667);
});

test("flux des dernières 24 h : gagné et dépensé, le dépôt et l'ancien gain exclus", async () => {
  const result = await economy();

  expect(result.earned_24h).toBe(300);
  expect(result.spent_24h).toBe(100);
});

test("circulation : 7 jours UTC, du plus ancien à aujourd'hui, déduite du grand livre", async () => {
  const { circulation } = await economy();
  const dayMs = 86_400_000;
  const todayStart = Math.floor(NOW / dayMs) * dayMs;

  expect(circulation).toHaveLength(7);
  expect(circulation.at(-1)?.day).toBe(new Date(todayStart).toISOString().slice(0, 10));

  // Attendu recalculé ici : le total actuel moins les flux survenus après la fin de chaque jour.
  const expected = circulation.map((_, index) => {
    const endOfDay = todayStart - (6 - index) * dayMs + dayMs;
    const after = LEDGER.filter((event) => event.guild === undefined && NOW - event.hoursAgo * 3_600_000 >= endOfDay)
      .reduce((sum, event) => sum + (event.kind === "earn" ? event.amount : event.kind === "spend" ? -event.amount : 0), 0);

    return 2000 - after;
  });

  expect(circulation.map((point) => point.coins)).toEqual(expected);
  expect(circulation.at(-1)?.coins).toBe(2000);
});

test("plus gros soldes : les 5 premiers, ordre décroissant, sans les soldes nuls", async () => {
  const { top } = await economy();

  expect(top).toEqual([
    { member_id: "a", coins: 1000, name: "Aiko", avatar: "abc123" },
    { member_id: "b", coins: 600, name: null, avatar: null },
    { member_id: "c", coins: 400, name: null, avatar: null },
  ]);
});

test("un serveur sans économie renvoie des zéros, pas d'erreur", async () => {
  await client.exec(`INSERT INTO panel_admin (guild_id, discord_id, role) VALUES ('vide', 'd-admin', 'admin')`);
  await actAs(client, ADMIN);
  const { rows } = await client.query<{ result: Economy }>("SELECT panel_economy('vide') AS result");
  const result = rows[0]!.result;

  expect(result).toMatchObject({ coins_total: 0, holders: 0, average: 0, earned_24h: 0, spent_24h: 0, top: [] });
  expect(result.circulation.every((point) => point.coins === 0)).toBe(true);
});

test("règles : valeurs par défaut sans réglages, puis celles du serveur", async () => {
  const defaults = (await economy()).rules;
  expect(defaults).toEqual({
    currency_name: "pièces",
    salary_budget_permille: 10,
    starting_balance: 0,
    transfer_tax_percent: 0,
    bank_interest_permille: 0,
    wealth_tax_permille: 5,
    idle_tax_permille: 20,
  });
});

test("panel_set_economy_rules : met à jour, renvoie les règles, journalise l'auteur ; NULL ne change rien", async () => {
  await actAs(client, ADMIN);
  const set = async (args: string) =>
    (await client.query<{ result: Economy["rules"] }>(`SELECT panel_set_economy_rules('g', ${args}) AS result`)).rows[0]!.result;

  expect(await set("'Gemmes', 25, 1000, 10, NULL, 8, 30")).toEqual({
    currency_name: "Gemmes",
    salary_budget_permille: 25,
    starting_balance: 1000,
    transfer_tax_percent: 10,
    bank_interest_permille: 0,
    wealth_tax_permille: 8,
    idle_tax_permille: 30,
  });
  // Un seul champ : les autres restent.
  expect(await set("NULL, NULL, NULL, 5")).toEqual({
    currency_name: "Gemmes",
    salary_budget_permille: 25,
    starting_balance: 1000,
    transfer_tax_percent: 5,
    bank_interest_permille: 0,
    wealth_tax_permille: 8,
    idle_tax_permille: 30,
  });
  expect((await economy()).rules.currency_name).toBe("Gemmes");

  const audit = await client.query<{ actor_id: string; metadata: Record<string, unknown> }>(
    "SELECT actor_id, metadata FROM audit_event WHERE action = 'settings.economy' AND guild_id = 'g' ORDER BY occurred_at DESC LIMIT 1",
  );
  expect(audit.rows[0]).toEqual({ actor_id: "d-admin", metadata: { transfer_tax_percent: 5, source: "panel" } });
});

test("panel_set_economy_rules règle l'intérêt de la banque (0 à 50 ‰) sans toucher au reste, journalisé", async () => {
  await actAs(client, ADMIN);
  const set = async (args: string) =>
    (await client.query<{ result: Economy["rules"] }>(`SELECT panel_set_economy_rules('g', ${args}) AS result`)).rows[0]!.result;

  expect((await set("NULL, NULL, NULL, NULL, 5")).bank_interest_permille).toBe(5);
  expect((await economy()).rules).toMatchObject({ bank_interest_permille: 5, currency_name: "Gemmes", transfer_tax_percent: 5 });

  for (const value of [-1, 51]) {
    await expect(client.query(`SELECT panel_set_economy_rules('g', NULL, NULL, NULL, NULL, ${value})`)).rejects.toThrow(/invalid bank interest/);
  }

  expect((await set("NULL, NULL, NULL, NULL, 0")).bank_interest_permille).toBe(0);

  const audit = await client.query<{ metadata: Record<string, unknown> }>(
    "SELECT metadata FROM audit_event WHERE action = 'settings.economy' AND guild_id = 'g' AND metadata ? 'bank_interest_permille' ORDER BY occurred_at, id",
  );
  expect(audit.rows.map((row) => row.metadata)).toEqual([
    { bank_interest_permille: 5, source: "panel" },
    { bank_interest_permille: 0, source: "panel" },
  ]);
});

test("panel_set_economy_rules refuse les valeurs hors limites sans rien changer, et un non-administrateur", async () => {
  await actAs(client, ADMIN);

  for (const args of [
    "'', NULL, NULL, NULL",
    "NULL, -1, NULL, NULL",
    "NULL, 101, NULL, NULL",
    "NULL, NULL, 1000001, NULL",
    "NULL, NULL, NULL, 26",
    "NULL, NULL, NULL, NULL, NULL, 51",
    "NULL, NULL, NULL, NULL, NULL, NULL, 101",
    `'${"x".repeat(25)}', NULL, NULL, NULL`,
  ]) {
    await expect(client.query(`SELECT panel_set_economy_rules('g', ${args})`)).rejects.toThrow(/invalid/);
  }

  expect((await economy()).rules.transfer_tax_percent).toBe(5);

  await actAs(client, null);
  await expect(client.query("SELECT panel_set_economy_rules('g', 'Pirate')")).rejects.toThrow(/forbidden/);
});
