import { expect, test } from "bun:test";
import { parseProfiling } from "./profiling-schema";

const member = {
  member_id: "101",
  name: "Aiko",
  username: "aiko",
  avatar: null,
  joined_at: "2025-03-01T10:00:00+00:00",
  last_active_at: "2026-11-05T21:14:00+00:00",
  roles: ["Moderator", "Regular"],
  messages_30d: 42,
  voice_minutes_30d: 60,
  messages_total: 900,
  voice_minutes_total: 600,
  balance: 2000,
  warnings: 0,
  days: [
    { day: "2026-11-04", messages: 30, voice_minutes: 0 },
    { day: "2026-11-05", messages: 12, voice_minutes: 60 },
  ],
};
const response = { generated_at: "2026-11-05T22:00:00+00:00", query: null, members_present: 2, members: [member] };

test("parseProfiling accepte la forme de la fonction SQL", () => {
  const parsed = parseProfiling(response);

  expect(parsed?.membersPresent).toBe(2);
  expect(parsed?.query).toBeNull();
  expect(parsed?.members[0]).toMatchObject({
    memberId: "101",
    name: "Aiko",
    username: "aiko",
    roles: ["Moderator", "Regular"],
    messages30d: 42,
    voiceMinutes30d: 60,
    messagesTotal: 900,
    voiceMinutesTotal: 600,
    balance: 2000,
  });
  expect(parsed?.members[0]?.days[1]).toEqual({ day: "2026-11-05", messages: 12, voiceMinutes: 60 });
  expect(parseProfiling({ ...response, query: "aik", members: [{ ...member, name: null, username: null, last_active_at: null }] })?.members[0]?.name).toBeNull();
});

test("parseProfiling refuse ce qui n'a pas la forme attendue", () => {
  expect(parseProfiling(null)).toBeNull();
  expect(parseProfiling({})).toBeNull();
  expect(parseProfiling({ ...response, members: "x" })).toBeNull();
  expect(parseProfiling({ ...response, members: [{ ...member, roles: [1] }] })).toBeNull();
  expect(parseProfiling({ ...response, members: [{ ...member, balance: -1 }] })).toBeNull();
  expect(parseProfiling({ ...response, members: [{ ...member, messages_total: -5 }] })).toBeNull();
  expect(parseProfiling({ ...response, members: [{ ...member, joined_at: "hier" }] })).toBeNull();
  expect(parseProfiling({ ...response, members: [{ ...member, days: [{ day: "05/11", messages: 1, voice_minutes: 0 }] }] })).toBeNull();
});
