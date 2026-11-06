import { expect, test } from "bun:test";
import { parseAntiRaid, parseRequest, validPatch } from "./anti-raid-schema";

const raid = {
  id: "r1",
  started_at: "2026-11-05T21:14:00+00:00",
  trigger: "burst",
  started_by_name: null,
  joins: 38,
  action: "quarantine",
  actioned: 37,
  failed: 1,
  locked_channels: 12,
  verification_raised: true,
};
const response = {
  generated_at: "2026-11-06T10:00:00+00:00",
  settings: {
    enabled: true,
    join_threshold: 10,
    window_seconds: 30,
    min_account_age_days: 7,
    action: "kick",
    lock_channels: true,
    alert_admins: true,
    raise_verification: false,
    alert_channel: false,
  },
  active: null,
  joins_10m: 4,
  young_joins_10m: 1,
  joins_per_minute: [0, 0, 1, 0, 0, 0, 2, 0, 0, 1],
  raids_30d: 1,
  pending: null,
  last_failure: null,
  history: [{ ...raid, ended_at: "2026-11-05T21:20:00+00:00", window_seconds: 30, ended_by: null, ended_by_name: null }],
};

test("parseAntiRaid accepte la forme de la fonction SQL", () => {
  const parsed = parseAntiRaid(response);

  expect(parsed?.settings).toEqual({
    enabled: true,
    joinThreshold: 10,
    windowSeconds: 30,
    minAccountAgeDays: 7,
    action: "kick",
    lockChannels: true,
    alertAdmins: true,
    raiseVerification: false,
  });
  expect(parsed?.alertChannel).toBe(false);
  expect(parsed?.history[0]).toMatchObject({ joins: 38, actioned: 37, failed: 1, lockedChannels: 12, endedBy: null });

  const live = parseAntiRaid({
    ...response,
    active: { ...raid, trigger: "manual", started_by_name: "Mika" },
    pending: { action: "end", requested_at: "2026-11-06T09:59:00+00:00" },
    last_failure: { action: "start", error: "Missing Permissions", at: "2026-11-06T09:30:00+00:00" },
  });
  expect(live?.active).toMatchObject({ trigger: "manual", startedByName: "Mika", verificationRaised: true });
  expect(live?.pending?.action).toBe("end");
  expect(live?.lastFailure?.error).toBe("Missing Permissions");
});

test("parseAntiRaid refuse ce qui n'a pas la forme attendue", () => {
  expect(parseAntiRaid(null)).toBeNull();
  expect(parseAntiRaid({ ...response, settings: { ...response.settings, action: "nuke" } })).toBeNull();
  expect(parseAntiRaid({ ...response, settings: { ...response.settings, join_threshold: 2 } })).toBeNull();
  expect(parseAntiRaid({ ...response, joins_per_minute: [1, 2] })).toBeNull();
  expect(parseAntiRaid({ ...response, active: { ...raid, joins: -1 } })).toBeNull();
  expect(parseAntiRaid({ ...response, history: [raid] })).toBeNull();
  expect(parseAntiRaid({ ...response, pending: { action: "boom", requested_at: "x" } })).toBeNull();
});

test("validPatch ne laisse passer que des réglages connus et dans les bornes", () => {
  expect(validPatch({ enabled: true })).toBe(true);
  expect(validPatch({ joinThreshold: 50, windowSeconds: 5, minAccountAgeDays: 0, action: "watch" })).toBe(true);
  expect(validPatch({})).toBe(false);
  expect(validPatch({ joinThreshold: 51 })).toBe(false);
  expect(validPatch({ action: "nuke" })).toBe(false);
  expect(validPatch({ enabled: "yes" })).toBe(false);
  expect(validPatch({ alertChannel: true })).toBe(false);
  expect(parseRequest({ status: "pending" })).toBe("pending");
  expect(parseRequest({})).toBeNull();
});
