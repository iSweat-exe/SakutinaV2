/** Shapes returned by the panel_* database functions, and their validation (no I/O). */

export type HourlyMessages = Readonly<{
  /** ISO time at which the hour starts (UTC). */
  at: string;
  hour: number;
  messages: number;
  /** Minutes spent in voice channels during the hour, all members together. */
  voiceMinutes: number;
}>;

export type Overview = Readonly<{
  messages24h: number;
  activeMembers24h: number;
  members: number;
  coinsTotal: number;
  /** The last 24 UTC hours, oldest first. */
  hourly: ReadonlyArray<HourlyMessages>;
}>;

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

/** Validates the JSON returned by `panel_overview` instead of trusting its shape. */
export function parseOverview(value: unknown): Overview | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const v = value as Record<string, unknown>;
  const hourly = v.hourly;

  if (
    !isCount(v.messages_24h) ||
    !isCount(v.active_members_24h) ||
    !isCount(v.members) ||
    !isCount(v.coins_total) ||
    !Array.isArray(hourly)
  ) {
    return null;
  }

  const slots: HourlyMessages[] = [];

  for (const slot of hourly as unknown[]) {
    const s = slot as Record<string, unknown> | null;
    if (
      !s ||
      typeof s.at !== "string" ||
      Number.isNaN(Date.parse(s.at)) ||
      typeof s.hour !== "number" ||
      s.hour < 0 ||
      s.hour > 23 ||
      !isCount(s.messages)
    ) {
      return null;
    }
    // Absent until the database is migrated: read as no voice rather than breaking the dashboard.
    const voice = s.voice_minutes ?? 0;
    if (!isCount(voice)) {
      return null;
    }
    slots.push({ at: s.at, hour: s.hour, messages: s.messages, voiceMinutes: voice });
  }

  return {
    messages24h: v.messages_24h,
    activeMembers24h: v.active_members_24h,
    members: v.members,
    coinsTotal: v.coins_total,
    hourly: slots,
  };
}


export type AuditEntry = Readonly<{
  id: string;
  action: string;
  occurredAt: Date;
  actorId: string | null;
  targetId: string | null;
  /** Name and picture of the member, and name of the actor; null until the bot has seen them. */
  targetName: string | null;
  targetAvatar: string | null;
  actorName: string | null;
  metadata: Readonly<Record<string, unknown>>;
}>;

/** Validates the JSON returned by `panel_recent_audit`. */
export function parseAudit(value: unknown): ReadonlyArray<AuditEntry> | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const entries: AuditEntry[] = [];

  for (const item of value as unknown[]) {
    const e = item as Record<string, unknown> | null;
    const at = typeof e?.occurred_at === "string" ? new Date(e.occurred_at) : null;

    if (!e || typeof e.id !== "string" || typeof e.action !== "string" || !at || Number.isNaN(at.getTime())) {
      return null;
    }

    entries.push({
      id: e.id,
      action: e.action,
      occurredAt: at,
      actorId: typeof e.actor_id === "string" ? e.actor_id : null,
      targetId: typeof e.target_id === "string" ? e.target_id : null,
      targetName: typeof e.target_name === "string" && e.target_name.trim() ? e.target_name : null,
      targetAvatar: typeof e.target_avatar === "string" && e.target_avatar ? e.target_avatar : null,
      actorName: typeof e.actor_name === "string" && e.actor_name.trim() ? e.actor_name : null,
      metadata: typeof e.metadata === "object" && e.metadata !== null ? (e.metadata as Record<string, unknown>) : {},
    });
  }

  return entries;
}

