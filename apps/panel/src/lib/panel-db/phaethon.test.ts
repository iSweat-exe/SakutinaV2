import { expect, test } from "bun:test";
import { parseBanRequest, parsePhaethon, parsePhaethonTop, parseReview } from "./phaethon-schema";

const ID = "1082447199332210000";

const rawEntry = (over: Record<string, unknown> = {}) => ({
  member_id: ID,
  name: "shadow.fox_88",
  avatar: null,
  created_at: "2026-11-04T10:00:00Z",
  joined_at: "2026-11-05T03:12:00Z",
  last_active_at: "2026-11-06T09:00:00Z",
  points: [14, 20, 0, 5, 0, 0],
  delta: 39,
  confidence: 71,
  flags: ["new-account", "join-cluster", "same-avatar", "from-the-future"],
  review: null,
  ban_status: null,
  links: [{ member_id: "1082447199332210001", name: "fox.shade_12", relations: ["join", "avatar"], score: 31, banned: false }],
  heat: Array.from({ length: 7 }, (_, i) => ({ day: new Date(Date.UTC(2026, 9, 31 + i)).toISOString().slice(0, 10), hours: Array(24).fill(i) })),
  rate: Array(72).fill(0),
  transfers: [{ member_id: "1082447199332210002", name: null, direction: "in", coins: 12000 }],
  casino: { won: 0, played: 0 },
  events: [{ at: "2026-11-05T03:12:00Z", kind: "join", detail: {} }],
  ...over,
});

const raw = (over: Record<string, unknown> = {}) => ({
  generated_at: "2026-11-06T10:00:00Z",
  members_tracked: 80,
  banned_7d: 2,
  dismissed_7d: 1,
  server_median: 4.5,
  entries: [rawEntry()],
  ...over,
});

test("parsePhaethon accepte la forme de la fonction SQL et écarte les signaux inconnus", () => {
  const parsed = parsePhaethon(raw());
  const entry = parsed?.entries[0];

  expect(parsed?.membersTracked).toBe(80);
  expect(parsed?.serverMedian).toBe(4.5);
  expect(entry?.flags).toEqual(["new-account", "join-cluster", "same-avatar"]);
  expect(entry?.links[0]).toEqual({ memberId: "1082447199332210001", name: "fox.shade_12", relations: ["join", "avatar"], score: 31, banned: false });
  expect(entry?.transfers[0]).toEqual({ memberId: "1082447199332210002", name: null, direction: "in", coins: 12000 });
  expect(entry?.events[0]).toEqual({ at: "2026-11-05T03:12:00Z", kind: "join", change: null, rule: null, by: null });
});

test("parsePhaethon refuse ce qui n'a pas la forme attendue", () => {
  expect(parsePhaethon(null)).toBeNull();
  expect(parsePhaethon({})).toBeNull();
  expect(parsePhaethon(raw({ generated_at: 1 }))).toBeNull();
  expect(parsePhaethon(raw({ entries: [rawEntry({ member_id: "../x" })] }))).toBeNull();
  expect(parsePhaethon(raw({ entries: [rawEntry({ points: [1, 2, 3] })] }))).toBeNull();
  expect(parsePhaethon(raw({ entries: [rawEntry({ rate: Array(71).fill(0) })] }))).toBeNull();
  expect(parsePhaethon(raw({ entries: [rawEntry({ heat: [] })] }))).toBeNull();
  expect(parsePhaethon(raw({ entries: [rawEntry({ transfers: [{ member_id: ID, direction: "sideways", coins: 1 }] })] }))).toBeNull();
});

test("les réponses des actions", () => {
  expect(parseReview({ status: "watch" })).toBe("watch");
  expect(parseReview({ status: null })).toBe("clear");
  expect(parseReview({ status: "ban" })).toBeNull();
  expect(parseBanRequest({ status: "pending" })).toBe("pending");
  expect(parseBanRequest({})).toBeNull();
});

test("parsePhaethonTop : le résumé du tableau de bord", () => {
  expect(parsePhaethonTop({ count: 4, top: [{ member_id: ID, name: null, avatar: null, score: 64, flags: ["sleepless"] }] })).toEqual({
    count: 4,
    top: [{ memberId: ID, name: null, avatar: null, score: 64, flags: ["sleepless"] }],
  });
  expect(parsePhaethonTop({ count: 1, top: [{ member_id: ID, score: -1, flags: [] }] })).toBeNull();
  expect(parsePhaethonTop({ top: [] })).toBeNull();
});
