import { expect, test } from "bun:test";
import { parseCasino } from "./casino-schema";

const game = (name: string, extra: Record<string, unknown> = {}) => ({
  game: name,
  enabled: true,
  max_bet: 500,
  default_max_bet: 500,
  rounds_24h: 3,
  house_net_24h: -40,
  ...extra,
});

const casino = (games: unknown[] = ["slots", "blackjack", "roulette", "coinflip"].map((name) => game(name))) => ({
  generated_at: "2026-11-05T10:00:00Z",
  currency_name: "pièces",
  min_bet: 10,
  bet_ceiling: 100_000,
  games,
});

test("parseCasino accepte la forme de la fonction SQL", () => {
  const parsed = parseCasino(casino());

  expect(parsed).toMatchObject({ generatedAt: "2026-11-05T10:00:00Z", currencyName: "pièces", minBet: 10, betCeiling: 100_000 });
  expect(parsed?.games.map((item) => item.game)).toEqual(["slots", "blackjack", "roulette", "coinflip"]);
  expect(parsed?.games[0]).toEqual({ game: "slots", enabled: true, maxBet: 500, defaultMaxBet: 500, rounds24h: 3, houseNet24h: -40 });
});

test("parseCasino refuse ce qui n'a pas la forme attendue", () => {
  expect(parseCasino(null)).toBeNull();
  expect(parseCasino({})).toBeNull();
  expect(parseCasino({ ...casino(), generated_at: 1 })).toBeNull();
  expect(parseCasino({ ...casino(), currency_name: "  " })).toBeNull();
  expect(parseCasino({ ...casino(), min_bet: -1 })).toBeNull();
  expect(parseCasino({ ...casino(), games: "slots" })).toBeNull();
});

test("parseCasino exige les quatre jeux, chacun une fois, dans l'ordre", () => {
  const four = ["slots", "blackjack", "roulette", "coinflip"].map((name) => game(name));

  expect(parseCasino(casino(four.slice(0, 3)))).toBeNull();
  expect(parseCasino(casino([four[1], four[0], four[2], four[3]]))).toBeNull();
  expect(parseCasino(casino([four[0], four[0], four[2], four[3]]))).toBeNull();
  expect(parseCasino(casino([...four.slice(0, 3), game("poker")]))).toBeNull();
});

test("parseCasino refuse un jeu mal formé ou un plafond hors limites", () => {
  const bad = (extra: Record<string, unknown>) =>
    parseCasino(casino(["slots", "blackjack", "roulette", "coinflip"].map((name) => (name === "slots" ? game(name, extra) : game(name)))));

  expect(bad({ enabled: "yes" })).toBeNull();
  expect(bad({ max_bet: 9 })).toBeNull();
  expect(bad({ max_bet: 100_001 })).toBeNull();
  expect(bad({ max_bet: 12.5 })).toBeNull();
  expect(bad({ rounds_24h: -1 })).toBeNull();
  expect(bad({ house_net_24h: "1" })).toBeNull();
  expect(bad({ house_net_24h: 0.5 })).toBeNull();
  expect(bad({})).not.toBeNull();
});
