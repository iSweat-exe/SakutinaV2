import { expect, test } from "bun:test";
import { parseEconomy } from "./economy-schema";

const row = {
  generated_at: "2026-11-05T10:00:00Z",
  coins_total: 2000,
  holders: 3,
  average: 667,
  earned_24h: 300,
  spent_24h: 100,
  circulation: [
    { day: "2026-11-04", coins: 1800 },
    { day: "2026-11-05", coins: 2000 },
  ],
  top: [{ member_id: "100000000000000001", coins: 1000, name: "Aiko", avatar: "abc" }],
  rules: { currency_name: "Gemmes", daily_reward: 250, starting_balance: 100, transfer_tax_percent: 5, bank_interest_permille: 5 },
};

test("parseEconomy accepte la forme de la fonction SQL", () => {
  expect(parseEconomy(row)).toEqual({
    coinsTotal: 2000,
    holders: 3,
    average: 667,
    earned24h: 300,
    spent24h: 100,
    circulation: [
      { day: "2026-11-04", coins: 1800 },
      { day: "2026-11-05", coins: 2000 },
    ],
    top: [{ memberId: "100000000000000001", coins: 1000, name: "Aiko", avatar: "abc" }],
    rules: { currencyName: "Gemmes", dailyReward: 250, startingBalance: 100, transferTaxPercent: 5, bankInterestPermille: 5 },
  });
});

test("parseEconomy accepte un serveur sans porteur", () => {
  expect(parseEconomy({ ...row, coins_total: 0, holders: 0, average: 0, top: [] })?.top).toEqual([]);
});

test("parseEconomy refuse ce qui n'a pas la forme attendue", () => {
  expect(parseEconomy(null)).toBeNull();
  expect(parseEconomy({ ...row, coins_total: -1 })).toBeNull();
  expect(parseEconomy({ ...row, holders: "3" })).toBeNull();
  expect(parseEconomy({ ...row, circulation: [] })).toBeNull();
  expect(parseEconomy({ ...row, circulation: [{ day: "hier", coins: 1 }] })).toBeNull();
  expect(parseEconomy({ ...row, top: [{ member_id: "../x", coins: 1 }] })).toBeNull();
  expect(parseEconomy({ ...row, rules: { ...row.rules, transfer_tax_percent: 26 } })).toBeNull();
  expect(parseEconomy({ ...row, rules: { ...row.rules, bank_interest_permille: 51 } })).toBeNull();
  expect(parseEconomy({ ...row, rules: { ...row.rules, bank_interest_permille: -1 } })).toBeNull();
  expect(parseEconomy({ ...row, rules: { ...row.rules, currency_name: " " } })).toBeNull();
  expect(parseEconomy({ ...row, rules: undefined })).toBeNull();
});

test("parseEconomy : un membre inconnu du bot n'a ni nom ni photo", () => {
  const parsed = parseEconomy({ ...row, top: [{ member_id: "100000000000000002", coins: 5, name: null, avatar: null }] });
  expect(parsed?.top).toEqual([{ memberId: "100000000000000002", coins: 5, name: null, avatar: null }]);
});

test("parseEconomy lit l'absence d'intérêt (base d'avant les intérêts) comme « désactivé »", () => {
  const { bank_interest_permille: _omitted, ...before } = row.rules;

  expect(parseEconomy({ ...row, rules: before })?.rules.bankInterestPermille).toBe(0);
});
