import { describe, expect, test } from "bun:test";

import { INTEREST_BASE_CAP } from "@/domain/economy/economy-rules.ts";
import { emptyAccount } from "@/domain/economy/economy-types.ts";
import { creditInterest, planInterest } from "@/domain/economy/interest.ts";

const candidate = (memberId: string, bank: number, bankBefore = bank) => ({ memberId, bank, bankBefore });

describe("planInterest", () => {
  test("taux × la plus petite des trois banques (aujourd'hui, il y a 24 h, plafond), arrondi à l'inférieur", () => {
    const plan = planInterest([candidate("a", 1_999), candidate("b", 5_000, 2_000), candidate("c", 900_000), candidate("d", 5_000, 0)], 10, 1_000_000);

    expect(plan.payouts).toEqual([
      { memberId: "a", amount: 19 },
      { memberId: "b", amount: 20 },
      { memberId: "c", amount: (INTEREST_BASE_CAP * 10) / 1000 },
    ]);
    expect(plan.wanted).toBe(19 + 20 + 1_000);
    expect(plan.paid).toBe(plan.wanted);
  });

  test("les parts sont réduites dans la même proportion quand le trésor ne suffit pas", () => {
    const plan = planInterest([candidate("a", 30_000), candidate("b", 10_000)], 10, 100);

    // Budget : 25 % de 100 = 25 ; souhaité : 300 + 100 = 400.
    expect(plan.wanted).toBe(400);
    expect(plan.payouts).toEqual([
      { memberId: "a", amount: 18 },
      { memberId: "b", amount: 6 },
    ]);
    expect(plan.paid).toBe(24);
  });

  test("jamais plus que le budget, jamais de part négative, un trésor vide ne verse rien", () => {
    for (const treasury of [0, 3, 40, 1_000_000]) {
      const plan = planInterest([candidate("a", 7_777), candidate("b", 1_234), candidate("c", 99_999)], 33, treasury);

      expect(plan.paid).toBeLessThanOrEqual(Math.floor(treasury / 4));
      expect(plan.payouts.every((payout) => payout.amount > 0)).toBe(true);
    }
  });

  test("une part qui tombe à zéro n'est pas versée", () => {
    expect(planInterest([candidate("a", 99)], 10, 1_000).payouts).toEqual([]);
  });
});

describe("creditInterest", () => {
  const now = new Date("2026-11-05T00:30:00Z");

  test("verse au portefeuille avec une écriture dont la clé est propre au jour et au membre", () => {
    const credited = creditInterest({ ...emptyAccount("g", "m"), wallet: 5, bank: 900 }, 40, "2026-11-05", now)!;

    expect(credited.account).toMatchObject({ wallet: 45, bank: 900 });
    expect(credited.entry).toMatchObject({ kind: "earn", amount: 40, reason: "interest", walletAfter: 45, bankAfter: 900, idempotencyKey: "interest:2026-11-05:m" });
  });

  test("refuse de dépasser le plafond de solde", () => {
    expect(creditInterest({ ...emptyAccount("g", "m"), wallet: 1_000_000_000_000 }, 1, "2026-11-05", now)).toBeNull();
  });
});
