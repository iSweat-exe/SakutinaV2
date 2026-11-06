/** Shape returned by `panel_profiling`, and its validation (no I/O). */

/** Longest search the database accepts. */
export const PROFILING_QUERY_MAX = 100;

export type ProfileDay = Readonly<{ day: string; messages: number; voiceMinutes: number }>;

export type MemberProfile = Readonly<{
  memberId: string;
  /** Name shown on the server (nickname, else display name, else username); null when the bot never saw it. */
  name: string | null;
  /** Discord username ("@aiko"); null when unknown. */
  username: string | null;
  /** Avatar hash on Discord's CDN. */
  avatar: string | null;
  /** When they joined the server (or when the bot first saw them). */
  joinedAt: string;
  lastActiveAt: string | null;
  /** Highest role first, @everyone left out. */
  roles: ReadonlyArray<string>;
  /** Over the last 30 days: how long the bot keeps activity. */
  messages30d: number;
  voiceMinutes30d: number;
  /** Wallet and bank together. */
  balance: number;
  warnings: number;
  /** The last 7 UTC days, oldest first; the last one is today. */
  days: ReadonlyArray<ProfileDay>;
}>;

export type Profiling = Readonly<{
  generatedAt: string;
  /** The search the list answers (trimmed, lower case), or null for the most active members. */
  query: string | null;
  membersPresent: number;
  members: ReadonlyArray<MemberProfile>;
}>;

type Json = Record<string, unknown>;

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0;
const isDate = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));
const isTextOrNull = (value: unknown): value is string | null => value === null || typeof value === "string";
const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

function parseDay(value: unknown): ProfileDay | null {
  if (!isObject(value) || typeof value.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.day) || !isCount(value.messages) || !isCount(value.voice_minutes)) {
    return null;
  }

  return { day: value.day, messages: value.messages, voiceMinutes: value.voice_minutes };
}

function parseMember(value: unknown): MemberProfile | null {
  if (!isObject(value)) {
    return null;
  }

  const v = value;

  if (
    typeof v.member_id !== "string" ||
    !isTextOrNull(v.name) ||
    !isTextOrNull(v.username) ||
    !isTextOrNull(v.avatar) ||
    !isDate(v.joined_at) ||
    !(v.last_active_at === null || isDate(v.last_active_at)) ||
    !Array.isArray(v.roles) ||
    !v.roles.every((role) => typeof role === "string") ||
    !isCount(v.messages_30d) ||
    !isCount(v.voice_minutes_30d) ||
    !isCount(v.balance) ||
    !isCount(v.warnings) ||
    !Array.isArray(v.days)
  ) {
    return null;
  }

  const days: ProfileDay[] = [];

  for (const entry of v.days) {
    const day = parseDay(entry);
    if (!day) {
      return null;
    }
    days.push(day);
  }

  return {
    memberId: v.member_id,
    name: v.name,
    username: v.username,
    avatar: v.avatar,
    joinedAt: v.joined_at,
    lastActiveAt: v.last_active_at,
    roles: v.roles as string[],
    messages30d: v.messages_30d,
    voiceMinutes30d: v.voice_minutes_30d,
    balance: v.balance,
    warnings: v.warnings,
    days,
  };
}

/** Validates the JSON returned by `panel_profiling`; anything off-shape is refused (null), never guessed at. */
export function parseProfiling(value: unknown): Profiling | null {
  if (!isObject(value)) {
    return null;
  }

  const v = value;

  if (!isDate(v.generated_at) || !isTextOrNull(v.query) || !isCount(v.members_present) || !Array.isArray(v.members)) {
    return null;
  }

  const members: MemberProfile[] = [];

  for (const entry of v.members) {
    const member = parseMember(entry);
    if (!member) {
      return null;
    }
    members.push(member);
  }

  return { generatedAt: v.generated_at, query: v.query, membersPresent: v.members_present, members };
}
