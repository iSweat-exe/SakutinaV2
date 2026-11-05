/** Shape returned by `panel_moderation`, and its validation (no I/O). */
export type SanctionKind = "mute" | "ban" | "warn";

export type ActiveSanction = Readonly<{
  /** `kind:id`, e.g. `mute:12`: what `panel_revoke_sanction` takes apart. */
  id: string;
  kind: SanctionKind;
  memberId: string;
  /** Null until the bot has seen the member. */
  name: string | null;
  avatar: string | null;
  reason: string;
  /** "Sakutina" (auto-moderation), "Discord" (done in Discord itself) or the moderator's name. */
  by: string;
  /** ISO time; null for a ban, which lasts until it is lifted. */
  endsAt: string | null;
  /** Set while a revoke asked from the panel waits for the bot, or when the bot could not do it. */
  revokeStatus: "pending" | "failed" | null;
}>;

export type Automod = Readonly<{
  spam: boolean;
  links: boolean;
  words: boolean;
  mentions: boolean;
  bannedWords: ReadonlyArray<string>;
  muteMinutes: number;
}>;

export type Moderation = Readonly<{
  /** Time of the snapshot (ISO): "ends in 52 min" is measured from it, so server and browser agree. */
  generatedAt: string;
  actions24h: number;
  actionsByBot24h: number;
  warnings7d: number;
  warnedMembers2plus: number;
  sanctions: ReadonlyArray<ActiveSanction>;
  automod: Automod;
}>;

/** Limits enforced by the database; the form uses the same ones. */
export const AUTOMOD_LIMITS = {
  muteMinutes: { min: 1, max: 40_320 },
  bannedWords: { count: 100, length: 32 },
} as const;

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const isDate = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));

function parseSanction(value: unknown): ActiveSanction | null {
  const v = value as Record<string, unknown> | null;

  if (
    !v ||
    typeof v.id !== "string" ||
    !/^(mute|ban|warn):\d+$/.test(v.id) ||
    (v.kind !== "mute" && v.kind !== "ban" && v.kind !== "warn") ||
    typeof v.member_id !== "string" ||
    !/^\d{5,25}$/.test(v.member_id) ||
    typeof v.reason !== "string" ||
    typeof v.by !== "string"
  ) {
    return null;
  }

  return {
    id: v.id,
    kind: v.kind,
    memberId: v.member_id,
    name: typeof v.name === "string" && v.name.trim() ? v.name : null,
    avatar: typeof v.avatar === "string" && v.avatar ? v.avatar : null,
    reason: v.reason,
    by: v.by,
    endsAt: isDate(v.ends_at) ? v.ends_at : null,
    revokeStatus: v.revoke_status === "pending" || v.revoke_status === "failed" ? v.revoke_status : null,
  };
}

/** The settings object of `panel_moderation` and `panel_set_automod`. */
export function parseAutomod(value: unknown): Automod | null {
  const v = value as Record<string, unknown> | null;

  if (
    !v ||
    typeof v.spam !== "boolean" ||
    typeof v.links !== "boolean" ||
    typeof v.words !== "boolean" ||
    typeof v.mentions !== "boolean" ||
    !Array.isArray(v.banned_words) ||
    !v.banned_words.every((word) => typeof word === "string") ||
    typeof v.mute_minutes !== "number" ||
    !Number.isInteger(v.mute_minutes) ||
    v.mute_minutes < AUTOMOD_LIMITS.muteMinutes.min ||
    v.mute_minutes > AUTOMOD_LIMITS.muteMinutes.max
  ) {
    return null;
  }

  return {
    spam: v.spam,
    links: v.links,
    words: v.words,
    mentions: v.mentions,
    bannedWords: v.banned_words as string[],
    muteMinutes: v.mute_minutes,
  };
}

/** The result of `panel_revoke_sanction`: a warning is removed at once, a mute or ban waits for the bot. */
export function parseRevoke(value: unknown): "done" | "pending" | null {
  const status = (value as Record<string, unknown> | null)?.status;

  return status === "done" || status === "pending" ? status : null;
}

/** Validates the JSON of `panel_moderation`; `null` for anything that does not have the expected shape. */
export function parseModeration(value: unknown): Moderation | null {
  const v = value as Record<string, unknown> | null;

  if (!v || typeof v !== "object" || !Array.isArray(v.sanctions)) {
    return null;
  }

  const sanctions = v.sanctions.map(parseSanction);
  const automod = parseAutomod(v.automod);

  if (
    sanctions.some((sanction) => sanction === null) ||
    !automod ||
    !isDate(v.generated_at) ||
    !isCount(v.actions_24h) ||
    !isCount(v.actions_by_bot_24h) ||
    !isCount(v.warnings_7d) ||
    !isCount(v.warned_members_2plus)
  ) {
    return null;
  }

  return {
    generatedAt: v.generated_at,
    actions24h: v.actions_24h,
    actionsByBot24h: v.actions_by_bot_24h,
    warnings7d: v.warnings_7d,
    warnedMembers2plus: v.warned_members_2plus,
    sanctions: sanctions as ActiveSanction[],
    automod,
  };
}
