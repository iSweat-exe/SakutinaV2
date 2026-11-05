import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";

import type { Database } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { PostgresGuildStore } from "@/database/postgres/repositories/postgres-guild-store.ts";
import { MAX_BET } from "@/domain/casino/casino-rules.ts";
import { actAs, installFakeSupabaseAuth } from "../../support/fake-supabase.ts";

// Le refus des non-administrateurs est déjà vérifié pour toute fonction panel_* par
// panel-functions.test.ts : ici, le contenu et les garde-fous des réglages.
const ADMIN = "11111111-1111-1111-1111-111111111111";
let client: PGlite;
let db: Database;

type Game = { game: string; enabled: boolean; max_bet: number; default_max_bet: number; rounds_24h: number; house_net_24h: number };
type Casino = { generated_at: string; min_bet: number; bet_ceiling: number; games: Game[] };

beforeAll(async () => {
  client = new PGlite();
  db = drizzle(client) as unknown as Database;
  await migrate(db);
  await installFakeSupabaseAuth(client);
  await client.exec(`
    INSERT INTO auth.identities VALUES ('${ADMIN}', 'discord', 'd-admin');
    INSERT INTO panel_admin (guild_id, discord_id, role) VALUES ('g', 'd-admin', 'admin'), ('neuf', 'd-admin', 'admin');
    INSERT INTO treasury_entry (id, guild_id, amount, reason, member_id, created_at) VALUES
      (gen_random_uuid(), 'g', 300, 'casino:slots:loss', 'aiko', now() - interval '1 hour'),
      (gen_random_uuid(), 'g', -100, 'casino:slots:win', 'aiko', now() - interval '30 minutes'),
      (gen_random_uuid(), 'g', 999, 'casino:slots:loss', 'aiko', now() - interval '3 days'),
      -- Une main de blackjack : la mise entre, le gain sort ; elle ne compte qu'une fois.
      (gen_random_uuid(), 'g', 100, 'casino:blackjack:bet', 'aiko', now() - interval '20 minutes'),
      (gen_random_uuid(), 'g', -200, 'casino:blackjack:win', 'aiko', now() - interval '19 minutes'),
      (gen_random_uuid(), 'g', 50, 'tax', 'aiko', now() - interval '10 minutes'),
      (gen_random_uuid(), 'autre', 5000, 'casino:coinflip:loss', 'x', now());
  `);
});

afterAll(async () => {
  await client.close();
});

const casino = async (guild = "g") => {
  await actAs(client, ADMIN);
  return (await client.query<{ result: Casino }>("SELECT panel_casino($1) AS result", [guild])).rows[0]!.result;
};

const gameOf = (result: Casino, name: string) => result.games.find((game) => game.game === name)!;

test("un serveur sans réglages voit tout ouvert avec les plafonds historiques", async () => {
  const result = await casino("neuf");

  expect(result).toMatchObject({ min_bet: 10, bet_ceiling: 100_000, currency_name: "pièces" });
  expect(result.generated_at).toBeString();
  expect(result.games.map((game) => game.game)).toEqual(["slots", "blackjack", "roulette", "coinflip"]);

  for (const game of result.games) {
    expect(game).toMatchObject({
      enabled: true,
      max_bet: MAX_BET[game.game as keyof typeof MAX_BET],
      default_max_bet: MAX_BET[game.game as keyof typeof MAX_BET],
      rounds_24h: 0,
      house_net_24h: 0,
    });
  }
});

test("chaque jeu : parties et résultat du trésor des dernières 24 h, sans le reste ni les autres serveurs", async () => {
  const result = await casino();

  expect(gameOf(result, "slots")).toMatchObject({ rounds_24h: 2, house_net_24h: 200 });
  expect(gameOf(result, "blackjack")).toMatchObject({ rounds_24h: 1, house_net_24h: -100 });
  expect(gameOf(result, "roulette")).toMatchObject({ rounds_24h: 0, house_net_24h: 0 });
  expect(gameOf(result, "coinflip")).toMatchObject({ rounds_24h: 0, house_net_24h: 0 });
});

test("fermer un jeu et régler sa mise maximale : renvoyé à jour, les autres jeux ne bougent pas", async () => {
  await actAs(client, ADMIN);
  const closed = (await client.query<{ result: Casino }>("SELECT panel_set_casino_game('g', 'slots', false, NULL) AS result")).rows[0]!.result;

  expect(gameOf(closed, "slots")).toMatchObject({ enabled: false, max_bet: MAX_BET.slots });
  expect(gameOf(closed, "slots").rounds_24h).toBe(2);
  expect(gameOf(closed, "coinflip")).toMatchObject({ enabled: true, max_bet: MAX_BET.coinflip });

  const raised = (await client.query<{ result: Casino }>("SELECT panel_set_casino_game('g', 'coinflip', NULL, 1234) AS result")).rows[0]!.result;

  expect(gameOf(raised, "coinflip")).toMatchObject({ enabled: true, max_bet: 1234 });
  expect(gameOf(raised, "slots").enabled).toBe(false);

  // Les deux à la fois ; rouvrir sans toucher au plafond.
  await client.query("SELECT panel_set_casino_game('g', 'roulette', false, 80)");
  const reopened = (await client.query<{ result: Casino }>("SELECT panel_set_casino_game('g', 'slots', true, NULL) AS result")).rows[0]!.result;

  expect(gameOf(reopened, "slots")).toMatchObject({ enabled: true, max_bet: MAX_BET.slots });
  expect(gameOf(reopened, "roulette")).toMatchObject({ enabled: false, max_bet: 80 });
  expect((await casino("neuf")).games.every((game) => game.enabled)).toBe(true);
});

test("le bot lit ces réglages tels que le panneau les a écrits", async () => {
  const settings = await new PostgresGuildStore(db).getSettings("g");

  expect(settings?.casino).toEqual({
    slots: { enabled: true, maxBet: MAX_BET.slots },
    blackjack: { enabled: true, maxBet: MAX_BET.blackjack },
    roulette: { enabled: false, maxBet: 80 },
    coinflip: { enabled: true, maxBet: 1234 },
  });
});

test("chaque changement est journalisé avec son auteur ; un appel sans changement n'écrit rien", async () => {
  await actAs(client, ADMIN);
  const before = (await client.query("SELECT 1 FROM audit_event WHERE guild_id = 'g' AND action = 'settings.casino'")).rows.length;
  await client.query("SELECT panel_set_casino_game('g', 'blackjack', NULL, NULL)");
  const after = (await client.query("SELECT 1 FROM audit_event WHERE guild_id = 'g' AND action = 'settings.casino'")).rows.length;

  expect(after).toBe(before);

  const audit = await client.query("SELECT actor_id, metadata FROM audit_event WHERE guild_id = 'g' AND action = 'settings.casino' ORDER BY occurred_at, id");

  expect(audit.rows).toHaveLength(4);
  expect(audit.rows).toContainEqual({ actor_id: "d-admin", metadata: { game: "slots", enabled: false, source: "panel" } });
  expect(audit.rows).toContainEqual({ actor_id: "d-admin", metadata: { game: "roulette", enabled: false, max_bet: 80, source: "panel" } });
});

test("refus : jeu inconnu, plafond hors limites, et rien n'est écrit", async () => {
  await actAs(client, ADMIN);

  for (const [message, args] of [
    ["invalid game", "'g', 'poker', true, NULL"],
    ["invalid game", "'g', NULL, true, NULL"],
    ["invalid max bet", "'g', 'slots', NULL, 9"],
    ["invalid max bet", "'g', 'slots', NULL, 100001"],
    ["invalid max bet", "'g', 'slots', NULL, -5"],
  ] as const) {
    await expect(client.query(`SELECT panel_set_casino_game(${args})`), args).rejects.toThrow(message);
  }

  const result = await casino();

  expect(gameOf(result, "slots")).toMatchObject({ enabled: true, max_bet: MAX_BET.slots });
});

test("la base refuse elle-même un plafond hors limites, même sans passer par la fonction", async () => {
  await expect(client.exec("UPDATE guild_settings SET casino_slots_max_bet = 5 WHERE guild_id = 'g'")).rejects.toThrow();
  await expect(client.exec("UPDATE guild_settings SET casino_coinflip_max_bet = 100001 WHERE guild_id = 'g'")).rejects.toThrow();
});

test("un serveur dont on n'est pas administrateur ne peut ni être lu ni être changé", async () => {
  await actAs(client, ADMIN);

  await expect(client.query("SELECT panel_casino('inconnu')")).rejects.toThrow();
  await expect(client.query("SELECT panel_set_casino_game('inconnu', 'slots', false, NULL)")).rejects.toThrow();
});
