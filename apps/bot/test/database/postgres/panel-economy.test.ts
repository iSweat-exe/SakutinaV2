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
  top: { member_id: string; coins: number }[];
};

beforeAll(async () => {
  client = new PGlite();
  await migrate(drizzle(client) as unknown as Database);
  await installFakeSupabaseAuth(client);
  await client.exec(`
    INSERT INTO auth.identities VALUES ('${ADMIN}', 'discord', 'd-admin');
    INSERT INTO panel_admin (guild_id, discord_id, role) VALUES ('g', 'd-admin', 'admin');

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
    { member_id: "a", coins: 1000 },
    { member_id: "b", coins: 600 },
    { member_id: "c", coins: 400 },
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
