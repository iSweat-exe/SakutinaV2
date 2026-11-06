/** Shape returned by `panel_antiraid`, and its validation (no I/O). */

/** What the bot does to accounts that join during a raid. "watch" only alerts (observation mode). */
export const RAID_ACTIONS = ["watch", "quarantine", "kick", "ban"] as const;
export type RaidAction = (typeof RAID_ACTIONS)[number];

/** Same bounds as the database (migration 0021). */
export const LIMITS = {
  joinThreshold: { min: 3, max: 50 },
  windowSeconds: { min: 5, max: 120 },
  minAccountAgeDays: { min: 0, max: 30 },
} as const;

export type AntiRaidSettings = Readonly<{
  enabled: boolean;
  joinThreshold: number;
  windowSeconds: number;
  minAccountAgeDays: number;
  action: RaidAction;
  lockChannels: boolean;
  alertAdmins: boolean;
  raiseVerification: boolean;
}>;

export type SettingsPatch = Partial<AntiRaidSettings>;

export type ActiveRaid = Readonly<{
  id: string;
  startedAt: string;
  trigger: "burst" | "manual";
  startedByName: string | null;
  joins: number;
  action: RaidAction;
  actioned: number;
  failed: number;
  lockedChannels: number;
  verificationRaised: boolean;
}>;

export type RaidRecord = ActiveRaid &
  Readonly<{
    endedAt: string;
    windowSeconds: number;
    /** Null when the raid ended by itself (two minutes without a join). */
    endedBy: string | null;
    endedByName: string | null;
  }>;

export type AntiRaid = Readonly<{
  generatedAt: string;
  settings: AntiRaidSettings;
  /** Whether the server has an alert channel; without one, alerts are only logged. */
  alertChannel: boolean;
  alertChannelId: string | null;
  /** Channels the bot can write in, kept up to date by the bot: the choices for the alert channel. */
  channels: ReadonlyArray<Readonly<{ id: string; name: string; category: string | null }>>;
  active: ActiveRaid | null;
  joins10m: number;
  /** Joins of the last 10 minutes from accounts younger than the minimum age. */
  youngJoins10m: number;
  /** Joins per minute over the last 10 minutes, oldest first; the last one is the current minute. */
  joinsPerMinute: ReadonlyArray<number>;
  raids30d: number;
  /** A request from the panel the bot has not run yet. */
  pending: Readonly<{ action: "start" | "end"; requestedAt: string }> | null;
  /** A request that failed within the last hour. */
  lastFailure: Readonly<{ action: "start" | "end"; error: string | null; at: string }> | null;
  history: ReadonlyArray<RaidRecord>;
}>;

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isDate = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));
const isTextOrNull = (value: unknown): value is string | null => value === null || typeof value === "string";
const isAction = (value: unknown): value is RaidAction => (RAID_ACTIONS as readonly unknown[]).includes(value);
const isRequest = (value: unknown): value is "start" | "end" => value === "start" || value === "end";
const within = (value: unknown, { min, max }: Readonly<{ min: number; max: number }>): value is number =>
  isCount(value) && value >= min && value <= max;

function parseSettings(v: Json): AntiRaidSettings | null {
  if (
    typeof v.enabled !== "boolean" ||
    !within(v.join_threshold, LIMITS.joinThreshold) ||
    !within(v.window_seconds, LIMITS.windowSeconds) ||
    !within(v.min_account_age_days, LIMITS.minAccountAgeDays) ||
    !isAction(v.action) ||
    typeof v.lock_channels !== "boolean" ||
    typeof v.alert_admins !== "boolean" ||
    typeof v.raise_verification !== "boolean"
  ) {
    return null;
  }

  return {
    enabled: v.enabled,
    joinThreshold: v.join_threshold,
    windowSeconds: v.window_seconds,
    minAccountAgeDays: v.min_account_age_days,
    action: v.action,
    lockChannels: v.lock_channels,
    alertAdmins: v.alert_admins,
    raiseVerification: v.raise_verification,
  };
}

function parseRaid(v: unknown): ActiveRaid | null {
  if (
    !isObject(v) ||
    typeof v.id !== "string" ||
    !isDate(v.started_at) ||
    (v.trigger !== "burst" && v.trigger !== "manual") ||
    !isTextOrNull(v.started_by_name ?? null) ||
    !isCount(v.joins) ||
    !isAction(v.action) ||
    !isCount(v.actioned) ||
    !isCount(v.failed) ||
    !isCount(v.locked_channels) ||
    typeof v.verification_raised !== "boolean"
  ) {
    return null;
  }

  return {
    id: v.id,
    startedAt: v.started_at,
    trigger: v.trigger,
    startedByName: (v.started_by_name as string | null | undefined) ?? null,
    joins: v.joins,
    action: v.action,
    actioned: v.actioned,
    failed: v.failed,
    lockedChannels: v.locked_channels,
    verificationRaised: v.verification_raised,
  };
}

function parseRecord(v: unknown): RaidRecord | null {
  const raid = parseRaid(v);

  if (!raid || !isObject(v) || !isDate(v.ended_at) || !isCount(v.window_seconds) || !isTextOrNull(v.ended_by) || !isTextOrNull(v.ended_by_name)) {
    return null;
  }

  return { ...raid, endedAt: v.ended_at, windowSeconds: v.window_seconds, endedBy: v.ended_by, endedByName: v.ended_by_name };
}

/** Validates the JSON returned by `panel_antiraid`; anything off-shape is refused (null), never guessed at. */
export function parseAntiRaid(value: unknown): AntiRaid | null {
  if (!isObject(value) || !isObject(value.settings)) {
    return null;
  }

  const v = value;
  const settings = parseSettings(value.settings);
  const active = v.active === null ? null : parseRaid(v.active);

  if (
    !settings ||
    typeof value.settings.alert_channel !== "boolean" ||
    !isDate(v.generated_at) ||
    (v.active !== null && !active) ||
    !isCount(v.joins_10m) ||
    !isCount(v.young_joins_10m) ||
    !Array.isArray(v.joins_per_minute) ||
    v.joins_per_minute.length !== 10 ||
    !v.joins_per_minute.every(isCount) ||
    !isCount(v.raids_30d) ||
    !Array.isArray(v.history)
  ) {
    return null;
  }

  let pending: AntiRaid["pending"] = null;
  if (v.pending !== null) {
    if (!isObject(v.pending) || !isRequest(v.pending.action) || !isDate(v.pending.requested_at)) return null;
    pending = { action: v.pending.action, requestedAt: v.pending.requested_at };
  }

  let lastFailure: AntiRaid["lastFailure"] = null;
  if (v.last_failure !== null) {
    if (!isObject(v.last_failure) || !isRequest(v.last_failure.action) || !isTextOrNull(v.last_failure.error) || !isDate(v.last_failure.at)) return null;
    lastFailure = { action: v.last_failure.action, error: v.last_failure.error, at: v.last_failure.at };
  }

  // Absent until the database is migrated (0022): no choice offered, the current state only.
  const alertChannelId = value.settings.alert_channel_id ?? null;
  const rawChannels = v.channels ?? [];
  if (!isTextOrNull(alertChannelId) || !Array.isArray(rawChannels)) return null;
  const channels: { id: string; name: string; category: string | null }[] = [];
  for (const entry of rawChannels) {
    if (!isObject(entry) || typeof entry.id !== "string" || typeof entry.name !== "string" || !isTextOrNull(entry.category ?? null)) return null;
    channels.push({ id: entry.id, name: entry.name, category: (entry.category as string | null | undefined) ?? null });
  }

  const history: RaidRecord[] = [];
  for (const entry of v.history) {
    const record = parseRecord(entry);
    if (!record) return null;
    history.push(record);
  }

  return {
    generatedAt: v.generated_at,
    settings,
    alertChannel: value.settings.alert_channel,
    alertChannelId,
    channels,
    active,
    joins10m: v.joins_10m,
    youngJoins10m: v.young_joins_10m,
    joinsPerMinute: v.joins_per_minute as number[],
    raids30d: v.raids_30d,
    pending,
    lastFailure,
    history,
  };
}

/** Refuses a change the database would refuse: unknown keys, wrong types, values out of bounds. */
export function validPatch(patch: unknown): patch is SettingsPatch {
  if (!isObject(patch) || Object.keys(patch).length === 0) {
    return false;
  }

  return Object.entries(patch).every(([key, value]) => {
    switch (key) {
      case "enabled":
      case "lockChannels":
      case "alertAdmins":
      case "raiseVerification":
        return typeof value === "boolean";
      case "joinThreshold":
      case "windowSeconds":
      case "minAccountAgeDays":
        return within(value, LIMITS[key]);
      case "action":
        return isAction(value);
      default:
        return false;
    }
  });
}

export const parseRequest = (value: unknown): "pending" | null => (isObject(value) && value.status === "pending" ? "pending" : null);
