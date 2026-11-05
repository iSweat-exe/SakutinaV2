import { expect, test } from "bun:test";
import { timeUntil } from "../format";
import { parseAutomod, parseModeration, parseRevoke } from "./moderation-schema";

const automod = { spam: true, links: false, words: true, mentions: true, banned_words: ["arnaque"], mute_minutes: 60 };
const sanction = {
  id: "mute:12",
  kind: "mute",
  member_id: "100000000000000001",
  name: "Aiko",
  avatar: "abc",
  reason: "spam",
  by: "Mika",
  created_at: "2026-11-05T10:00:00Z",
  ends_at: "2026-11-05T11:00:00Z",
  revoke_status: null,
};
const row = {
  generated_at: "2026-11-05T10:30:00Z",
  actions_24h: 9,
  actions_by_bot_24h: 4,
  warnings_7d: 3,
  warned_members_2plus: 1,
  sanctions: [sanction],
  automod,
};

test("parseModeration accepte la forme de la fonction SQL", () => {
  expect(parseModeration(row)).toEqual({
    generatedAt: "2026-11-05T10:30:00Z",
    actions24h: 9,
    actionsByBot24h: 4,
    warnings7d: 3,
    warnedMembers2plus: 1,
    sanctions: [
      {
        id: "mute:12",
        kind: "mute",
        memberId: "100000000000000001",
        name: "Aiko",
        avatar: "abc",
        reason: "spam",
        by: "Mika",
        endsAt: "2026-11-05T11:00:00Z",
        revokeStatus: null,
      },
    ],
    automod: { spam: true, links: false, words: true, mentions: true, bannedWords: ["arnaque"], muteMinutes: 60 },
  });
});

test("un bannissement n'a pas de fin ; un membre inconnu n'a ni nom ni photo ; l'état de la levée est conservé", () => {
  const parsed = parseModeration({
    ...row,
    sanctions: [{ ...sanction, id: "ban:3", kind: "ban", name: null, avatar: null, ends_at: null, revoke_status: "pending" }, { ...sanction, revoke_status: "failed" }],
  });

  expect(parsed?.sanctions[0]).toMatchObject({ kind: "ban", endsAt: null, name: null, avatar: null, revokeStatus: "pending" });
  expect(parsed?.sanctions[1]?.revokeStatus).toBe("failed");
});

test("parseModeration refuse ce qui n'a pas la forme attendue, une seule entrée invalide invalidant tout", () => {
  expect(parseModeration(null)).toBeNull();
  expect(parseModeration({ ...row, actions_24h: -1 })).toBeNull();
  expect(parseModeration({ ...row, generated_at: "hier" })).toBeNull();
  expect(parseModeration({ ...row, sanctions: "non" })).toBeNull();
  expect(parseModeration({ ...row, sanctions: [sanction, { ...sanction, id: "kick:1" }] })).toBeNull();
  expect(parseModeration({ ...row, sanctions: [{ ...sanction, member_id: "../x" }] })).toBeNull();
  expect(parseModeration({ ...row, automod: { ...automod, mute_minutes: 0 } })).toBeNull();
});

test("parseAutomod et parseRevoke", () => {
  expect(parseAutomod(automod)?.bannedWords).toEqual(["arnaque"]);
  expect(parseAutomod({ ...automod, spam: "oui" })).toBeNull();
  expect(parseAutomod({ ...automod, banned_words: [1] })).toBeNull();
  expect(parseAutomod({ ...automod, mute_minutes: 40_321 })).toBeNull();
  expect(parseRevoke({ status: "done" })).toBe("done");
  expect(parseRevoke({ status: "pending" })).toBe("pending");
  expect(parseRevoke({ status: "autre" })).toBeNull();
  expect(parseRevoke(null)).toBeNull();
});

test("timeUntil : minutes, heures puis jours, jamais moins d'une minute", () => {
  const now = Date.parse("2026-11-05T10:00:00Z");

  expect(timeUntil("2026-11-05T10:52:00Z", now)).toBe("52 min");
  expect(timeUntil("2026-11-05T13:00:00Z", now)).toBe("3 h");
  expect(timeUntil("2026-11-11T10:00:00Z", now)).toBe("6 days");
  expect(timeUntil("2026-11-06T10:00:00Z", now)).toBe("1 day");
  expect(timeUntil("2026-11-05T09:00:00Z", now)).toBe("1 min");
});
