import { expect, test } from "bun:test";
import { describeMovement, parseMemberHits, parsePayout, parseTreasury } from "./treasury-schema";

const row = {
  generated_at: "2026-11-05T10:00:00Z",
  balance: 750,
  in_24h: 1100,
  out_24h: 100,
  recent: [
    {
      id: "e1",
      amount: -250,
      reason: "payout",
      note: "Event prize",
      created_at: "2026-11-05T09:00:00Z",
      member_id: "100000000000000001",
      actor_id: "100000000000000009",
      member_name: "Aiko",
      member_avatar: "abc",
      actor_name: "Chef",
    },
    { id: "e2", amount: 40, reason: "tax", note: null, created_at: "2026-11-05T08:00:00Z", member_id: null, member_name: null, member_avatar: null },
  ],
};

test("parseTreasury accepte la forme de la fonction SQL", () => {
  expect(parseTreasury(row)).toEqual({
    generatedAt: "2026-11-05T10:00:00Z",
    balance: 750,
    in24h: 1100,
    out24h: 100,
    recent: [
      {
        id: "e1",
        amount: -250,
        reason: "payout",
        note: "Event prize",
        createdAt: "2026-11-05T09:00:00Z",
        memberId: "100000000000000001",
        memberName: "Aiko",
        memberAvatar: "abc",
      },
      { id: "e2", amount: 40, reason: "tax", note: null, createdAt: "2026-11-05T08:00:00Z", memberId: null, memberName: null, memberAvatar: null },
    ],
  });
});

test("parseTreasury accepte un trésor vide", () => {
  expect(parseTreasury({ ...row, balance: 0, in_24h: 0, out_24h: 0, recent: [] })?.recent).toEqual([]);
});

test("parseTreasury refuse ce qui n'a pas la forme attendue", () => {
  expect(parseTreasury(null)).toBeNull();
  expect(parseTreasury({ ...row, balance: -1 })).toBeNull();
  expect(parseTreasury({ ...row, generated_at: "demain" })).toBeNull();
  expect(parseTreasury({ ...row, recent: "x" })).toBeNull();
  expect(parseTreasury({ ...row, recent: [{ ...row.recent[0], amount: 0 }] })).toBeNull();
  expect(parseTreasury({ ...row, recent: [{ ...row.recent[0], member_id: "pas-un-id" }] })).toBeNull();
});

test("parseMemberHits garde nom et photo, refuse un identifiant ou un nom invalide", () => {
  expect(parseMemberHits([{ member_id: "100000000000000001", name: "Aiko", avatar: null }])).toEqual([
    { memberId: "100000000000000001", name: "Aiko", avatar: null },
  ]);
  expect(parseMemberHits([])).toEqual([]);
  expect(parseMemberHits([{ member_id: "x", name: "Aiko", avatar: null }])).toBeNull();
  expect(parseMemberHits([{ member_id: "100000000000000001", name: " ", avatar: null }])).toBeNull();
  expect(parseMemberHits({})).toBeNull();
});

test("parsePayout renvoie le solde restant", () => {
  expect(parsePayout({ balance: 500, amount: 250 })).toEqual({ balance: 500, amount: 250 });
  expect(parsePayout({ balance: "500", amount: 250 })).toBeNull();
  expect(parsePayout(null)).toBeNull();
});

test("describeMovement dit en mots d'où vient le mouvement", () => {
  expect(describeMovement("tax")).toBe("Transfer tax");
  expect(describeMovement("payout")).toBe("Pay out");
  expect(describeMovement("casino:slots:loss")).toBe("Slots · lost bet");
  expect(describeMovement("casino:slots:win")).toBe("Slots · prize paid");
  expect(describeMovement("casino:blackjack:bet")).toBe("Blackjack · stake");
  expect(describeMovement("casino:blackjack:blackjack")).toBe("Blackjack · prize paid");
  expect(describeMovement("autre")).toBe("Casino · prize paid");
});
