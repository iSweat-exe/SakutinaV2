import { expect, test } from "bun:test";
import { axisLabels, compact, formatUptime, hourRangeTitle, signed, timeAgo } from "../format";
import { toAuditLine } from "./audit-lines";
import { parseAudit, parseOverview } from "./schema";

const slot = (hour: number, messages = 0) => ({ hour, messages, at: `2026-11-05T${String(hour).padStart(2, "0")}:00:00Z` });
const overview = {
  messages_24h: 15,
  active_members_24h: 3,
  members: 10,
  coins_total: 550,
  hourly: Array.from({ length: 24 }, (_, hour) => slot(hour, hour)),
};

test("parseOverview accepts the database shape", () => {
  const parsed = parseOverview(overview);
  expect(parsed?.messages24h).toBe(15);
  expect(parsed?.hourly).toHaveLength(24);
});

test("parseOverview rejects anything unexpected instead of guessing", () => {
  expect(parseOverview(null)).toBeNull();
  expect(parseOverview({ ...overview, coins_total: "550" })).toBeNull();
  expect(parseOverview({ ...overview, members: -1 })).toBeNull();
  expect(parseOverview({ ...overview, hourly: [{ hour: 30, messages: 1 }] })).toBeNull();
  expect(parseOverview({ ...overview, hourly: "nope" })).toBeNull();
  expect(parseOverview({ ...overview, hourly: [{ hour: 1, messages: 1, at: "pas une date" }] })).toBeNull();
});

test("parseAudit turns rows into entries and rejects malformed ones", () => {
  const row = { id: "1", action: "moderation.ban", occurred_at: "2026-11-05T10:00:00Z", actor_id: "a", target_id: "t", metadata: { reason: "spam" } };
  expect(parseAudit([row])?.[0]?.occurredAt.toISOString()).toBe("2026-11-05T10:00:00.000Z");
  expect(parseAudit([])).toEqual([]);
  expect(parseAudit([{ ...row, occurred_at: "not a date" }])).toBeNull();
  expect(parseAudit({})).toBeNull();
});

const entry = (action: string, extra: Partial<{ targetId: string | null; metadata: Record<string, unknown> }> = {}) => ({
  id: "1",
  action,
  occurredAt: new Date("2026-11-05T10:00:00Z"),
  actorId: "mod",
  targetId: "123456789012344457" as string | null,
  metadata: {},
  ...extra,
});

test("audit lines read like the dashboard design", () => {
  expect(toAuditLine(entry("moderation.timeout", { metadata: { durationMinutes: 10, reason: "mention spam", result: "ok" } }))?.text).toBe(
    "Muted …4457 for 10 min · mention spam",
  );
  expect(toAuditLine(entry("moderation.ban", { metadata: { reason: "ban evasion" } }))).toMatchObject({ tag: "Ban", text: "Banned …4457 · ban evasion" });
  expect(toAuditLine(entry("moderation.purge", { targetId: null, metadata: { reason: "x" } }))?.text).toBe("Purged messages");
});

test("refused and failed attempts are never shown as successes", () => {
  expect(toAuditLine(entry("moderation.kick", { metadata: { result: "refused:hierarchy" } }))?.text).toBe("Kicked …4457 · refused");
  expect(toAuditLine(entry("moderation.kick", { metadata: { result: "failed" } }))?.text).toBe("Kicked …4457 · failed");
});

test("unknown actions are skipped", () => {
  expect(toAuditLine(entry("profile.viewed"))).toBeNull();
});

test("number and time formatting", () => {
  expect(compact(1_204_000)).toBe("1.2M");
  expect(compact(950)).toBe("950");
  const now = new Date("2026-11-05T12:00:00Z");
  expect(timeAgo(new Date("2026-11-05T11:59:50Z"), now)).toBe("just now");
  expect(timeAgo(new Date("2026-11-05T11:58:00Z"), now)).toBe("2 min ago");
  expect(timeAgo(new Date("2026-11-05T09:00:00Z"), now)).toBe("3 h ago");
  expect(timeAgo(new Date("2026-11-01T12:00:00Z"), now)).toBe("4 days ago");
  expect(formatUptime(14 * 86_400 + 6 * 3_600)).toBe("14 days, 6 hours");
});

test("axisLabels ajoute des décimales jusqu'à ce que chaque graduation soit distincte", () => {
  expect(axisLabels([0, 500, 1000])).toEqual(["0", "500", "1K"]);
  expect(axisLabels([1_010_000, 1_015_000, 1_020_000])).toEqual(["1.01M", "1.015M", "1.02M"]);
});

test("signed et hourRangeTitle", () => {
  expect(signed(120)).toBe("+120");
  expect(signed(-45)).toBe("-45");
  expect(signed(0)).toBe("0");
  expect(hourRangeTitle("2026-11-05T23:00:00Z")).toBe("Thu, Nov 5 · 23:00–00:00 UTC");
});
