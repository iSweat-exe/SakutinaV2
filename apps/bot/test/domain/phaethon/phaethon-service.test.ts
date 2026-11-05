import { expect, test } from "bun:test";

import { MemoryActivityStore } from "@/database/in-memory/memory-activity-store.ts";
import { MemoryMemberStore } from "@/database/in-memory/memory-member-store.ts";
import { MemoryPhaethonStore } from "@/database/in-memory/memory-phaethon-store.ts";
import { ActivityService } from "@/domain/activity/activity-service.ts";
import { ActivityTracker } from "@/domain/activity/activity-tracker.ts";
import { MemberService } from "@/domain/members/member-service.ts";
import {
  contactsOf,
  nightShareOf,
  PhaethonService,
  rhythmSimilarity,
} from "@/domain/phaethon/phaethon-service.ts";
import { PhaethonTracker } from "@/domain/phaethon/phaethon-tracker.ts";
import type { EdgeSnapshot } from "@/domain/phaethon/phaethon-types.ts";

const now = new Date("2026-11-05T12:00:00.000Z");
const facts = { characters: 10, isReply: false, attachments: 0, mentions: 0 };
const at = (hour: number, daysBack = 0) => new Date(Date.UTC(2026, 10, 5 - daysBack, hour, 0, 0));

function setup() {
  const activityTracker = new ActivityTracker();
  const members = new MemoryMemberStore();
  const memberService = new MemberService(members, () => now);
  const activity = new ActivityService(activityTracker, new MemoryActivityStore(), members, () => now);
  const tracker = new PhaethonTracker();
  const store = new MemoryPhaethonStore();
  const service = new PhaethonService(tracker, store, activity, memberService, () => now);

  return { activityTracker, members, memberService, activity, tracker, store, service };
}

test("la part de nuit et la ressemblance de rythme se calculent sur 24 heures UTC", () => {
  const night = Array.from({ length: 24 }, (_, hour) => (hour === 23 ? 10 : 0));
  const day = Array.from({ length: 24 }, (_, hour) => (hour === 14 ? 10 : 0));

  expect(nightShareOf(night)).toBe(1);
  expect(nightShareOf(day)).toBe(0);
  expect(nightShareOf([])).toBe(0);
  expect(rhythmSimilarity(night, night)).toBeCloseTo(1);
  expect(rhythmSimilarity(night, day)).toBe(0);
  expect(rhythmSimilarity(night, [])).toBe(0);
});

test("les contacts regroupent envoyé, reçu et vocal, et sont classés par poids", () => {
  const edge = (memberId: string, targetId: string, values: Partial<EdgeSnapshot>): EdgeSnapshot => ({
    guildId: "g",
    memberId,
    targetId,
    day: "2026-11-05",
    replies: 0,
    mentions: 0,
    reactions: 0,
    voiceSeconds: 0,
    ...values,
  });

  const contacts = contactsOf(
    "me",
    [
      edge("me", "x", { replies: 2, voiceSeconds: 1_200 }),
      edge("x", "me", { reactions: 3 }),
      edge("y", "me", { mentions: 1 }),
      edge("me", "z", { voiceSeconds: 100 }),
    ],
    5,
  );

  expect(contacts.map((contact) => contact.otherId)).toEqual(["x", "y"]);
  expect(contacts[0]).toMatchObject({
    sent: { replies: 2, mentions: 0, reactions: 0 },
    received: { replies: 0, mentions: 0, reactions: 3 },
    voiceSeconds: 1_200,
    score: 7,
  });
});

test("le dossier assemble activité, rythme, relations, présence, jeux, identité et mois", async () => {
  const { activityTracker, tracker, service, memberService } = setup();

  await memberService.markJoined("g", "me", at(8, 20));
  activityTracker.recordMessage("g", "me", "c1", at(23), facts);
  activityTracker.recordMessage("g", "me", "c1", at(14), facts);
  tracker.recordMessageHour("g", "me", at(23));
  tracker.recordMessageHour("g", "me", at(14));
  tracker.recordInteraction("g", "me", "ami", at(9), { replies: 1 });
  tracker.recordInteraction("g", "ami", "me", at(9), { reactions: 2 });
  tracker.recordStatusSeconds("g", "me", "online", 3_600, at(9));
  tracker.recordGameSeconds("g", "me", "Celeste", "playing", 1_800, at(9));
  tracker.recordIdentity({
    id: crypto.randomUUID(),
    guildId: "g",
    memberId: "me",
    kind: "nickname",
    oldValue: "Avant",
    newValue: "Après",
    at: at(10),
  });

  const dossier = await service.dossier("g", "me");

  expect(dossier.totals.messages).toBe(2);
  expect(dossier.textChannels).toEqual([{ channelId: "c1", value: 2 }]);
  expect(dossier.nightShare).toBe(0.5);
  expect(dossier.hours[23]).toBe(1);
  expect(dossier.contacts[0]).toMatchObject({ otherId: "ami", score: 3 });
  expect(dossier.presence.online).toBe(3_600);
  expect(dossier.games[0]).toMatchObject({ name: "Celeste", seconds: 1_800 });
  expect(dossier.identity[0]).toMatchObject({ kind: "nickname", newValue: "Après" });
  expect(dossier.profile?.joinedAt).toBeInstanceOf(Date);
});

test("la comparaison mesure les échanges, les contacts et les jeux partagés", async () => {
  const { tracker, service } = setup();

  tracker.recordInteraction("g", "a", "b", at(9), { replies: 2, mentions: 1 });
  tracker.recordInteraction("g", "b", "a", at(9), { reactions: 4 });
  tracker.recordInteraction("g", "a", "b", at(9), { voiceSeconds: 600 });
  tracker.recordInteraction("g", "a", "ami", at(9), { replies: 1 });
  tracker.recordInteraction("g", "b", "ami", at(9), { replies: 1 });
  tracker.recordGameSeconds("g", "a", "Celeste", "playing", 60, at(9));
  tracker.recordGameSeconds("g", "b", "celeste", "playing", 60, at(9));
  tracker.recordGameSeconds("g", "a", "Hades", "playing", 60, at(9));
  tracker.recordMessageHour("g", "a", at(23));
  tracker.recordMessageHour("g", "b", at(23));

  const comparison = await service.compare("g", "a", "b");

  expect(comparison.leftToRight).toEqual({ replies: 2, mentions: 1, reactions: 0 });
  expect(comparison.rightToLeft).toEqual({ replies: 0, mentions: 0, reactions: 4 });
  expect(comparison.voiceTogetherSeconds).toBe(600);
  expect(comparison.sharedContacts).toEqual(["ami"]);
  expect(comparison.sharedGames).toEqual(["Celeste"]);
  expect(comparison.rhythmSimilarity).toBeCloseTo(1);
});

test("la recherche combine les critères et trie", async () => {
  const { activityTracker, tracker, service, memberService } = setup();

  for (const id of ["nuit", "jour", "muet"]) {
    await memberService.markJoined("g", id, at(8, 3));
  }

  for (let i = 0; i < 30; i += 1) {
    activityTracker.recordMessage("g", "nuit", "c", at(23), facts);
    tracker.recordMessageHour("g", "nuit", at(23));
  }

  for (let i = 0; i < 25; i += 1) {
    activityTracker.recordMessage("g", "jour", "c", at(14), facts);
    tracker.recordMessageHour("g", "jour", at(14));
  }

  tracker.recordGameSeconds("g", "jour", "Hollow Knight", "playing", 600, at(9));
  tracker.recordInteraction("g", "jour", "nuit", at(9), { replies: 1 });

  const ids = async (criteria: Parameters<PhaethonService["search"]>[1]) =>
    (await service.search("g", criteria, 10)).map((hit) => hit.memberId);

  expect(await ids({ sort: "messages" })).toEqual(["nuit", "jour", "muet"]);
  expect(await ids({ sort: "messages", nightOwl: true })).toEqual(["nuit"]);
  expect(await ids({ sort: "messages", minMessages: 26 })).toEqual(["nuit"]);
  expect(await ids({ sort: "messages", game: "hollow" })).toEqual(["jour"]);
  expect(await ids({ sort: "messages", talksTo: "nuit" })).toEqual(["jour"]);
  expect(await ids({ sort: "messages", joinedWithinDays: 2 })).toEqual([]);
  expect(await ids({ sort: "messages", joinedWithinDays: 10, tag: "chatty" })).toEqual([]);
  expect(await ids({ sort: "recent", inactiveDays: 1 })).toEqual(expect.arrayContaining(["muet"]));
});

test("les alertes ne sont émises qu'une fois, qu'elles soient de période ou d'arrivée", async () => {
  const { tracker, service, memberService } = setup();

  const first = await service.checkNewcomer("g", "neuf", new Date(now.getTime() - 86_400_000));
  const second = await service.checkNewcomer("g", "neuf", new Date(now.getTime() - 86_400_000));
  const old = await service.checkNewcomer("g", "ancien", new Date(now.getTime() - 400 * 86_400_000));

  expect(first?.kind).toBe("suspicious-account");
  expect(second).toBeNull();
  expect(old).toBeNull();

  await memberService.markJoined("g", "caméléon", at(8, 10));

  for (let i = 0; i < 4; i += 1) {
    tracker.recordIdentity({
      id: crypto.randomUUID(),
      guildId: "g",
      memberId: "caméléon",
      kind: "nickname",
      oldValue: String(i),
      newValue: String(i + 1),
      at: new Date(now.getTime() - 3_600_000),
    });
  }

  const alerts = await service.evaluateAlerts("g");
  expect(alerts.map((alert) => `${alert.kind}:${alert.memberId}`)).toEqual(["identity-churn:caméléon"]);
  expect(await service.evaluateAlerts("g")).toEqual([]);
});

test("une alerte de pic et une alerte de silence sortent de l'activité réelle", async () => {
  const { activityTracker, members, service } = setup();

  for (let i = 0; i < 120; i += 1) {
    activityTracker.recordMessage("g", "pic", "c", at(10), facts);
  }

  for (let day = 7; day <= 20; day += 1) {
    for (let i = 0; i < 12; i += 1) {
      activityTracker.recordMessage("g", "absent", "c", at(10, day), facts);
    }
  }

  await members.markJoined("g", "absent", at(8, 25));
  await members.touch([{ guildId: "g", memberId: "absent", at: at(10, 7) }]);
  await members.markJoined("g", "pic", at(8, 25));

  const alerts = await service.evaluateAlerts("g");
  const summary = alerts.map((alert) => `${alert.kind}:${alert.memberId}`).sort();

  expect(summary).toEqual(["activity-spike:pic", "gone-quiet:absent"]);
});

test("forget efface tout ce que Phaéthon sait d'un membre, en attente comme enregistré", async () => {
  const { tracker, service, store } = setup();

  tracker.recordInteraction("g", "a", "b", at(9), { replies: 1 });
  tracker.recordInteraction("g", "b", "a", at(9), { replies: 1 });
  tracker.recordMessageHour("g", "a", at(9));
  await service.flush();
  tracker.recordInteraction("g", "a", "c", at(9), { replies: 1 });

  await service.forget("g", "a");

  expect(await store.edgesForMember("g", "a", "2026-01-01")).toEqual([]);
  expect((await service.dossier("g", "a")).contacts).toEqual([]);
  expect((await service.dossier("g", "b")).contacts).toEqual([]);
});

test("la purge retire le détail de plus de 30 jours et les données des membres partis", async () => {
  const { tracker, service, members, store } = setup();

  tracker.recordInteraction("g", "a", "b", at(9, 40), { replies: 1 });
  tracker.recordInteraction("g", "a", "b", at(9, 1), { replies: 1 });
  tracker.recordInteraction("g", "parti", "a", at(9, 1), { replies: 1 });
  await service.flush();
  await members.markLeft("g", "parti", at(9, 45));

  expect(await service.purgeExpired(now)).toBe(1);
  expect(await service.purgeDeparted()).toBe(1);
  expect((await store.edgesForMember("g", "parti", "2026-01-01"))).toEqual([]);
  expect((await store.edgesForMember("g", "a", "2026-01-01"))).toHaveLength(1);
});
