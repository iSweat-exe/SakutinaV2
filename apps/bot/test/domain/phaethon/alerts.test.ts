import { expect, test } from "bun:test";

import { countersWith } from "@/domain/activity/counters.ts";
import { activitySpike, alertKey, goneQuiet, identityChurn, suspiciousAccount } from "@/domain/phaethon/phaethon-alerts.ts";
import type { MemberProfile } from "@/domain/members/member-profile.ts";

const now = new Date("2026-11-05T12:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);
const profile = (lastActiveAt: Date | null, leftAt: Date | null = null): MemberProfile => ({
  guildId: "g",
  memberId: "m",
  firstSeenAt: daysAgo(60),
  joinedAt: daysAgo(60),
  leftAt,
  lastActiveAt,
});

test("un compte créé il y a moins de 7 jours déclenche une alerte, pas un compte plus ancien", () => {
  expect(suspiciousAccount("m", daysAgo(2), now)).toMatchObject({ kind: "suspicious-account", measured: 2, threshold: 7 });
  expect(suspiciousAccount("m", daysAgo(7), now)).toBeNull();
});

test("l'alerte d'identité exige au moins 4 changements", () => {
  expect(identityChurn("m", 3, now)).toBeNull();
  expect(identityChurn("m", 4, now)).toMatchObject({ kind: "identity-churn", measured: 4 });
});

test("un membre régulier silencieux depuis 5 jours déclenche une alerte, pas un occasionnel", () => {
  const regular = countersWith({ messages: 200 });

  expect(goneQuiet(profile(daysAgo(6)), regular, now)).toMatchObject({ kind: "gone-quiet", measured: 6 });
  expect(goneQuiet(profile(daysAgo(4)), regular, now)).toBeNull();
  expect(goneQuiet(profile(daysAgo(6)), countersWith({ messages: 10 }), now)).toBeNull();
  expect(goneQuiet(profile(daysAgo(6)), countersWith({ voiceSeconds: 6 * 3_600 }), now)).not.toBeNull();
});

test("un membre parti ou jamais observé ne déclenche pas d'alerte de silence", () => {
  const regular = countersWith({ messages: 500 });

  expect(goneQuiet(profile(daysAgo(10), daysAgo(1)), regular, now)).toBeNull();
  expect(goneQuiet(profile(null), regular, now)).toBeNull();
});

test("un pic est mesuré contre la moyenne du membre, sans compter aujourd'hui", () => {
  // 300 messages en 30 jours dont 120 aujourd'hui : moyenne hors aujourd'hui = 6 / jour, seuil = max(100, 30).
  const window = countersWith({ messages: 300 });

  expect(activitySpike("m", 120, window, 30, now)).toMatchObject({ kind: "activity-spike", measured: 120, threshold: 100 });
  expect(activitySpike("m", 99, window, 30, now)).toBeNull();

  // Un bavard habituel (60 / jour) ne déclenche pas pour 200 messages : le seuil monte à 300.
  const chatty = countersWith({ messages: 60 * 29 + 200 });

  expect(activitySpike("m", 200, chatty, 30, now)).toBeNull();
});

test("les clés d'alerte dédoublonnent par période", () => {
  const spike = activitySpike("m", 150, countersWith({ messages: 150 }), 30, now)!;
  const later = { ...spike, at: new Date(now.getTime() + 3_600_000) };

  expect(alertKey(spike)).toBe(alertKey(later));
  expect(alertKey({ ...spike, at: daysAgo(1) })).not.toBe(alertKey(spike));
  expect(alertKey(suspiciousAccount("m", daysAgo(1), now)!)).toBe("suspicious-account:m");
  expect(alertKey(goneQuiet(profile(daysAgo(6)), countersWith({ messages: 500 }), now)!, profile(daysAgo(6)))).toBe(
    "gone-quiet:m:2025-10-30".replace("2025", "2026"),
  );
});
