import { expect, test } from "bun:test";

import { countersWith } from "@/domain/activity/counters.ts";
import {
  ACTIVE_WITHIN_DAYS,
  CHATTY_MESSAGES_PER_DAY,
  INACTIVE_AFTER_DAYS,
  MEDIA_SHARER_ATTACHMENTS,
  SOCIAL_INTERACTIONS,
  TAG_WINDOW_DAYS,
  VOICE_REGULAR_SECONDS,
} from "@/domain/insights/insight-rules.ts";
import { computeTags } from "@/domain/insights/member-tags.ts";
import type { MemberProfile } from "@/domain/members/member-profile.ts";

const now = new Date("2026-11-30T12:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000);

const profile = (overrides: Partial<MemberProfile> = {}): MemberProfile => ({
  guildId: "g",
  memberId: "m",
  firstSeenAt: daysAgo(100),
  joinedAt: daysAgo(100),
  leftAt: null,
  lastActiveAt: daysAgo(1),
  ...overrides,
});

const ids = (input: Parameters<typeof computeTags>[0]) => computeTags(input).map((tag) => tag.id);

test("un membre récent et actif est « nouveau » et « actif »", () => {
  const tags = ids({
    totals: countersWith({}),
    profile: profile({ joinedAt: daysAgo(2), lastActiveAt: daysAgo(0) }),
    now,
  });

  expect(tags).toEqual(["new", "active"]);
});

test("l'inactivité se mesure depuis la dernière activité, ou la première observation", () => {
  expect(ids({ totals: countersWith({}), profile: profile({ lastActiveAt: daysAgo(INACTIVE_AFTER_DAYS) }), now })).toContain("inactive");
  expect(ids({ totals: countersWith({}), profile: profile({ lastActiveAt: daysAgo(INACTIVE_AFTER_DAYS - 1) }), now })).not.toContain("inactive");
  // Jamais vu actif : « inactif » seulement si la première observation est assez ancienne.
  expect(ids({ totals: countersWith({}), profile: profile({ lastActiveAt: null, firstSeenAt: daysAgo(20) }), now })).toContain("inactive");
  expect(ids({ totals: countersWith({}), profile: profile({ lastActiveAt: null, firstSeenAt: daysAgo(2) }), now })).not.toContain("inactive");
});

test("« actif » exige une activité observée, pas seulement une fiche récente", () => {
  const tags = ids({
    totals: countersWith({}),
    profile: profile({ lastActiveAt: null, firstSeenAt: daysAgo(1) }),
    now,
  });

  expect(tags).not.toContain("active");
  expect(ACTIVE_WITHIN_DAYS).toBeGreaterThan(1);
});

test("les seuils d'activité déclenchent les étiquettes, pas en dessous", () => {
  const at = {
    chatty: countersWith({ messages: CHATTY_MESSAGES_PER_DAY * TAG_WINDOW_DAYS }),
    voice: countersWith({ voiceSeconds: VOICE_REGULAR_SECONDS }),
    social: countersWith({ reactionsGiven: 60, replies: 30, mentions: SOCIAL_INTERACTIONS - 90 }),
    media: countersWith({ attachments: MEDIA_SHARER_ATTACHMENTS }),
  };

  expect(ids({ totals: at.chatty, profile: null, now })).toEqual(["chatty"]);
  expect(ids({ totals: at.voice, profile: null, now })).toEqual(["voice-regular"]);
  expect(ids({ totals: at.social, profile: null, now })).toEqual(["social"]);
  expect(ids({ totals: at.media, profile: null, now })).toEqual(["media-sharer"]);

  expect(
    ids({
      totals: countersWith({
        messages: CHATTY_MESSAGES_PER_DAY * TAG_WINDOW_DAYS - 1,
        voiceSeconds: VOICE_REGULAR_SECONDS - 1,
        attachments: MEDIA_SHARER_ATTACHMENTS - 1,
        reactionsGiven: SOCIAL_INTERACTIONS - 1,
      }),
      profile: null,
      now,
    }),
  ).toEqual([]);
});

test("chaque étiquette porte sa mesure et son seuil", () => {
  const [tag] = computeTags({
    totals: countersWith({ attachments: 25 }),
    profile: null,
    now,
  });

  expect(tag).toEqual({ id: "media-sharer", measured: 25, threshold: MEDIA_SHARER_ATTACHMENTS });
});
