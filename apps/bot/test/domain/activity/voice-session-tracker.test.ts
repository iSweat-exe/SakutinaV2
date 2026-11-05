import { expect, test } from "bun:test";

import { VoiceSessionTracker } from "@/domain/activity/voice-session-tracker.ts";

type Credit = { memberId: string; channelId: string; seconds: number };

function setup() {
  const credits: Credit[] = [];
  const tracker = new VoiceSessionTracker((_guildId, memberId, channelId, seconds) => {
    credits.push({ memberId, channelId, seconds });
  });

  return { tracker, credits };
}

const t = (seconds: number) => new Date(Date.UTC(2026, 10, 2, 12, 0, seconds));
const total = (credits: Credit[]) => credits.reduce((sum, credit) => sum + credit.seconds, 0);

test("crédite la durée entre l'entrée et la sortie, dans le salon", () => {
  const { tracker, credits } = setup();

  tracker.join("g", "m", "v1", t(0));
  tracker.leave("g", "m", t(90));

  expect(credits).toEqual([{ memberId: "m", channelId: "v1", seconds: 90 }]);
  expect(tracker.activeCount).toBe(0);
});

test("une sortie sans entrée et un double join sont inoffensifs", () => {
  const { tracker, credits } = setup();

  tracker.leave("g", "ghost", t(10));
  tracker.join("g", "m", "v1", t(0));
  tracker.join("g", "m", "v1", t(50));
  tracker.leave("g", "m", t(60));

  expect(credits).toEqual([{ memberId: "m", channelId: "v1", seconds: 60 }]);
});

test("un déplacement crédite l'ancien salon puis continue dans le nouveau", () => {
  const { tracker, credits } = setup();

  tracker.join("g", "m", "v1", t(0));
  tracker.move("g", "m", "v2", t(40));
  tracker.move("g", "m", "v2", t(50)); // même salon : sans effet
  tracker.leave("g", "m", t(100));

  expect(credits).toEqual([
    { memberId: "m", channelId: "v1", seconds: 40 },
    { memberId: "m", channelId: "v2", seconds: 60 },
  ]);
});

test("un déplacement sans session ouverte démarre une session", () => {
  const { tracker, credits } = setup();

  tracker.move("g", "m", "v2", t(0));
  tracker.leave("g", "m", t(30));

  expect(credits).toEqual([{ memberId: "m", channelId: "v2", seconds: 30 }]);
});

test("checkpoint crédite sans doubler le temps à la sortie", () => {
  const { tracker, credits } = setup();

  tracker.join("g", "m", "v1", t(0));
  tracker.checkpoint(t(60));
  tracker.leave("g", "m", t(100));

  expect(total(credits)).toBe(100);
});

test("closeAll crédite toutes les sessions ouvertes", () => {
  const { tracker, credits } = setup();

  tracker.join("g", "a", "v1", t(0));
  tracker.join("g", "b", "v2", t(10));
  tracker.closeAll(t(70));

  expect(credits.sort((x, y) => x.memberId.localeCompare(y.memberId))).toEqual([
    { memberId: "a", channelId: "v1", seconds: 70 },
    { memberId: "b", channelId: "v2", seconds: 60 },
  ]);
  expect(tracker.activeCount).toBe(0);
});

test("hydrate compte les membres déjà en vocal au démarrage", () => {
  const { tracker, credits } = setup();

  tracker.hydrate([{ guildId: "g", memberId: "m", channelId: "v9" }], t(0));
  tracker.leave("g", "m", t(45));

  expect(credits).toEqual([{ memberId: "m", channelId: "v9", seconds: 45 }]);
});
