import { expect, test } from "bun:test";

import { ActivityTracker } from "@/domain/activity/activity-tracker.ts";
import { isEmptyBatch } from "@/domain/activity/activity-types.ts";
import { countersWith, sumCounters } from "@/domain/activity/counters.ts";

const at = new Date("2026-11-02T12:34:00.000Z");
const facts = { characters: 42, isReply: false, attachments: 0, mentions: 0 };

test("un message alimente les compteurs, le salon, l'heure et la présence", () => {
  const tracker = new ActivityTracker();

  tracker.recordMessage("g", "m", "c1", at, { characters: 42, isReply: true, attachments: 2, mentions: 1 });
  const batch = tracker.drain();

  expect(batch.daily).toEqual([
    {
      guildId: "g",
      memberId: "m",
      day: "2026-11-02",
      ...countersWith({ messages: 1, characters: 42, replies: 1, attachments: 2, mentions: 1 }),
    },
  ]);
  expect(batch.channels).toEqual([
    { guildId: "g", memberId: "m", channelId: "c1", day: "2026-11-02", messages: 1, voiceSeconds: 0 },
  ]);
  expect(batch.hourly).toEqual([{ guildId: "g", day: "2026-11-02", hour: 12, messages: 1 }]);
  expect(batch.presences).toEqual([{ guildId: "g", memberId: "m", at }]);
});

test("le vocal est compté par salon, tronqué à la seconde, et ignore les durées invalides", () => {
  const tracker = new ActivityTracker();

  tracker.recordVoiceSeconds("g", "m", "v1", 90.8, at);
  tracker.recordVoiceSeconds("g", "m", "v1", -5, at);
  tracker.recordVoiceSeconds("g", "m", "v1", Number.NaN, at);
  tracker.recordVoiceSeconds("g", "m", "v2", 10, at);
  const batch = tracker.drain();

  expect(sumCounters(batch.daily).voiceSeconds).toBe(100);
  expect(batch.channels.map((c) => [c.channelId, c.voiceSeconds]).sort()).toEqual([
    ["v1", 90],
    ["v2", 10],
  ]);
});

test("réactions, arrivées, départs et invitations ont leurs compteurs ; seules certaines marquent une présence", () => {
  const tracker = new ActivityTracker();

  tracker.recordReactionGiven("g", "a", at);
  tracker.recordReactionReceived("g", "b", at);
  tracker.recordJoin("g", "c", at);
  tracker.recordLeave("g", "c", at);
  tracker.recordInviteAttribution("g", "c", at);
  const batch = tracker.drain();
  const byMember = Object.fromEntries(batch.daily.map((row) => [row.memberId, row]));

  expect(byMember.a?.reactionsGiven).toBe(1);
  expect(byMember.b?.reactionsReceived).toBe(1);
  expect(byMember.c).toMatchObject({ joins: 1, leaves: 1, attributedInvites: 1 });
  // Réagir est une activité ; recevoir une réaction, arriver ou partir n'en est pas une.
  expect(batch.presences.map((p) => p.memberId)).toEqual(["a"]);
});

test("la présence garde la date la plus récente", () => {
  const tracker = new ActivityTracker();
  const later = new Date(at.getTime() + 60_000);

  tracker.recordMessage("g", "m", "c", later, facts);
  tracker.recordMessage("g", "m", "c", at, facts);

  expect(tracker.drain().presences[0]?.at).toEqual(later);
});

test("drain vide le tampon et restore le réintègre sans perte", () => {
  const tracker = new ActivityTracker();
  tracker.recordMessage("g", "m", "c", at, facts);
  tracker.recordVoiceSeconds("g", "m", "v", 30, at);

  const drained = tracker.drain();
  expect(isEmptyBatch(tracker.drain())).toBe(true);

  tracker.recordMessage("g", "m", "c", at, facts);
  tracker.restore(drained);
  const merged = tracker.drain();

  expect(sumCounters(merged.daily)).toMatchObject({ messages: 2, voiceSeconds: 30, characters: 84 });
  expect(merged.channels.find((c) => c.channelId === "c")?.messages).toBe(2);
  expect(merged.hourly[0]?.messages).toBe(2);
});

test("pendingForMember et forget ne concernent que le membre visé", () => {
  const tracker = new ActivityTracker();
  tracker.recordMessage("g", "a", "c", at, facts);
  tracker.recordMessage("g", "b", "c", at, facts);

  expect(tracker.pendingForMember("g", "a")).toHaveLength(1);

  tracker.forget("g", "a");
  const batch = tracker.drain();

  expect(batch.daily.map((row) => row.memberId)).toEqual(["b"]);
  expect(batch.channels.map((row) => row.memberId)).toEqual(["b"]);
  expect(batch.presences.map((row) => row.memberId)).toEqual(["b"]);
  // L'agrégat horaire est anonyme : il n'est pas touché.
  expect(batch.hourly[0]?.messages).toBe(2);
});
