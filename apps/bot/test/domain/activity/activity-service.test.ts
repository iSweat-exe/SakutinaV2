import { expect, test } from "bun:test";

import { MemoryActivityStore } from "@/database/in-memory/memory-activity-store.ts";
import { MemoryMemberStore } from "@/database/in-memory/memory-member-store.ts";
import {
  ActivityService,
  retentionCutoff,
  windowStart,
} from "@/domain/activity/activity-service.ts";
import type { ActivityStore } from "@/domain/activity/activity-store.ts";
import { ActivityTracker } from "@/domain/activity/activity-tracker.ts";
import type { MemberStore } from "@/domain/members/member-store.ts";

const now = new Date("2026-11-30T10:00:00.000Z");
const facts = { characters: 10, isReply: false, attachments: 0, mentions: 0 };

function setup(overrides: { store?: ActivityStore; members?: MemberStore } = {}) {
  const tracker = new ActivityTracker();
  const members = overrides.members ?? new MemoryMemberStore();
  const store = overrides.store ?? new MemoryActivityStore();
  const service = new ActivityService(tracker, store, members, () => now);

  return { tracker, members, store, service };
}

test("totalsForMember additionne le store et le tampon", async () => {
  const { tracker, service } = setup();

  tracker.recordMessage("g", "m", "c", now, facts);
  expect(await service.flush()).toBe(true);
  tracker.recordMessage("g", "m", "c", now, facts);
  tracker.recordVoiceSeconds("g", "m", "v", 30, now);

  expect(await service.totalsForMember("g", "m")).toMatchObject({
    messages: 2,
    characters: 20,
    voiceSeconds: 30,
  });
});

test("flush enregistre aussi la dernière activité du membre", async () => {
  const { tracker, members, service } = setup();

  tracker.recordMessage("g", "m", "c", now, facts);
  await service.flush();

  expect((await members.find("g", "m"))?.lastActiveAt).toEqual(now);
});

test("un échec d'écriture remet le lot en tampon, sans perte ni doublon", async () => {
  class FlakyStore extends MemoryActivityStore {
    failing = true;

    override async add(batch: Parameters<ActivityStore["add"]>[0]): Promise<void> {
      if (this.failing) {
        throw new Error("db down");
      }

      return super.add(batch);
    }
  }

  const store = new FlakyStore();
  const { tracker, service } = setup({ store });

  tracker.recordMessage("g", "m", "c", now, facts);
  expect(await service.flush()).toBe(false);
  store.failing = false;
  expect(await service.flush()).toBe(true);

  expect((await service.totalsForMember("g", "m")).messages).toBe(1);
});

test("une fenêtre de N jours exclut les jours plus anciens", async () => {
  const { tracker, service } = setup();
  const threeDaysAgo = new Date("2026-11-27T10:00:00.000Z");

  tracker.recordMessage("g", "m", "c", threeDaysAgo, facts);
  tracker.recordMessage("g", "m", "c", now, facts);
  await service.flush();

  expect((await service.totalsForMember("g", "m", 1)).messages).toBe(1);
  expect((await service.totalsForMember("g", "m", 3)).messages).toBe(1);
  expect((await service.totalsForMember("g", "m", 4)).messages).toBe(2);
  expect(windowStart(now, 1)).toBe("2026-11-30");
  expect(windowStart(now, 999)).toBe("2026-11-01"); // plafonné à 30 jours
});

test("les analyses voient les données même non encore écrites", async () => {
  const { tracker, service } = setup();

  tracker.recordMessage("g", "a", "c1", now, facts);
  tracker.recordMessage("g", "a", "c1", now, facts);
  tracker.recordMessage("g", "b", "c2", now, facts);

  expect(await service.leaderboard("g", "messages", 7, 10)).toEqual([
    { memberId: "a", value: 2 },
    { memberId: "b", value: 1 },
  ]);
  expect((await service.serverTotals("g", 7)).activeMembers).toBe(2);
  expect(await service.topChannels("g", "messages", 7, 1)).toEqual([{ channelId: "c1", value: 2 }]);
  expect((await service.hourlyMessages("g", 7))[10]).toBe(3);
});

test("la purge supprime les jours antérieurs à 30 jours et garde les autres", async () => {
  const { tracker, service } = setup();
  const old = new Date("2026-10-30T10:00:00.000Z"); // 31 jours avant
  const edge = new Date("2026-10-31T10:00:00.000Z"); // 30 jours avant

  tracker.recordMessage("g", "m", "c", old, facts);
  tracker.recordMessage("g", "m", "c", edge, facts);
  tracker.recordMessage("g", "m", "c", now, facts);
  await service.flush();

  // 3 lignes quotidiennes + 3 lignes par salon + 3 lignes horaires, dont 1 de chaque est périmée.
  expect(await service.purgeExpired(now)).toBe(3);
  expect(retentionCutoff(now).toISOString()).toBe("2026-10-31T10:00:00.000Z");
});

test("forget efface les données individuelles, écrites ou en attente", async () => {
  const { tracker, service } = setup();

  tracker.recordMessage("g", "m", "c", now, facts);
  await service.flush();
  tracker.recordMessage("g", "m", "c", now, facts);
  tracker.recordMessage("g", "other", "c", now, facts);

  await service.forget("g", "m");

  expect((await service.totalsForMember("g", "m")).messages).toBe(0);
  expect((await service.totalsForMember("g", "other")).messages).toBe(1);
});
