import { expect, test } from "bun:test";
import type { WatchEntry } from "@/lib/panel-db/phaethon-schema";
import { ago, drawDossier, toEntity, when } from "./model";

const NOW = Date.parse("2026-11-06T10:00:00Z");
const days = Array.from({ length: 7 }, (_, i) => new Date(Date.UTC(2026, 9, 31 + i)).toISOString().slice(0, 10));

const entry = (over: Partial<WatchEntry> = {}): WatchEntry => ({
  memberId: "1082447199332210000",
  name: null,
  avatar: null,
  createdAt: "2026-11-05T09:00:00Z",
  joinedAt: "2026-11-06T07:12:00Z",
  lastActiveAt: "2026-11-06T09:30:00Z",
  points: [14, 20, 12, 0, 0, 0],
  delta: 46,
  confidence: 80,
  flags: ["new-account", "fresh-at-join", "join-cluster", "same-avatar", "sleepless"],
  review: null,
  banStatus: null,
  links: [
    { memberId: "1082447199332210001", name: "fox.shade_12", relations: ["avatar", "join"], score: 40, banned: false },
    { memberId: "1082447199332210002", name: null, relations: ["join"], score: 30, banned: false },
    { memberId: "1082447199332210003", name: "kaito", relations: ["after-ban"], score: null, banned: true },
  ],
  heat: days.map((day, d) => ({ day, hours: d === 5 ? Array(24).fill(10) : Array(24).fill(0) })),
  rate: Array.from({ length: 72 }, (_, i) => (i === 70 ? 40 : 1)),
  transfers: [],
  casino: { won: 0, played: 0 },
  events: [
    { at: "2026-11-06T07:12:00Z", kind: "join", change: null, rule: null, by: null },
    { at: "2026-11-06T08:00:00Z", kind: "automod.delete", change: null, rule: "links", by: null },
    { at: "2026-11-06T08:30:00Z", kind: "moderation.warn", change: null, rule: null, by: "Aiko" },
    { at: "2026-11-06T09:00:00Z", kind: "something.new", change: null, rule: null, by: null },
  ],
  ...over,
});

test("dates relatives, en UTC", () => {
  expect(ago("2026-11-06T01:00:00Z", NOW)).toBe("today");
  expect(ago("2026-11-03T10:00:00Z", NOW)).toBe("3 days ago");
  expect(ago(null, NOW)).toBe("unknown");
  expect(when("2026-11-06T03:12:00Z", NOW)).toBe("Today 03:12");
  expect(when("2026-11-05T22:10:00Z", NOW)).toBe("Yesterday 22:10");
  expect(when("2026-10-01T10:00:00Z", NOW)).toBe("Oct 1");
});

test("un compte du raid : nom de repli, étiquettes, catégories, verdict et faits expliqués", () => {
  const entity = toEntity(entry(), NOW);

  expect(entity.name).toBe("Member …0000");
  expect(entity.uid).toBe("1082 4471 9933 2210 000");
  expect(entity.score).toBe(46);
  expect(entity.tags).toEqual(["Joined together", "No sleep gap", "Same avatar"]);
  expect(entity.cats).toEqual(["Alt", "Automation"]);
  expect(entity.verdict).toBe(
    "Joined within two minutes of 2 other accounts. Shares its avatar or name with 1 account. The Discord account was created yesterday, just before it joined.",
  );
  expect(entity.events).toEqual([
    ["Today 07:12", "JOIN", "high", "Joined with an account created that same day"],
    ["Today 08:00", "AUTO", "med", "Message removed by the link filter"],
    ["Today 08:30", "MOD", "info", "Warned by Aiko"],
  ]);
  expect(entity.banReason).toBe("Phaethon: Joined together, No sleep gap, Same avatar");
  expect(entity.eco).toBeNull();
});

test("les graphiques suivent les vraies données ; un graphique vide est retiré", () => {
  const dossier = drawDossier(toEntity(entry(), NOW), 4);

  expect(dossier.heat?.labels).toEqual(["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"]);
  expect(dossier.heat?.cells).toHaveLength(168);
  expect(dossier.heat?.cells[5 * 24]?.o).toBe("1.00");
  expect(dossier.heat?.cells[0]?.o).toBe("0.07");
  expect(dossier.rate?.spikes).toHaveLength(1);
  expect(dossier.nodes.map((n) => [n.name, n.score, n.relation])).toEqual([
    ["fox.shade_12", "40", "Same avatar"],
    ["Member …0002", "30", "Same join minute"],
    ["kaito", "BAN", "Banned before it joined"],
  ]);

  const quiet = drawDossier(toEntity(entry({ heat: days.map((day) => ({ day, hours: Array(24).fill(0) })), rate: Array(72).fill(0), links: [] }), NOW), 4);
  expect(quiet).toEqual({ heat: null, rate: null, nodes: [] });
});

test("un compte seulement surveillé, sans signal", () => {
  const entity = toEntity(entry({ flags: [], points: [0, 0, 0, 0, 0, 0], review: "watch" }), NOW);

  expect(entity.verdict).toBe("No strong signal right now. It stays on the list because you are watching it.");
  expect(entity.banReason).toBe("Phaethon: flagged account");
});
