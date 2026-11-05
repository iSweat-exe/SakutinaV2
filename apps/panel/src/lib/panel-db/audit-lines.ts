import type { AuditEntry } from "./schema";

export type AuditTarget = Readonly<{ memberId: string; name: string | null; avatar: string | null }>;

export type AuditLine = Readonly<{
  id: string;
  tag: string;
  /** "Muted", "Removed a warning from"… */
  verb: string;
  /** The member the action was about; null for an action without one (a purge). */
  target: AuditTarget | null;
  /** What follows the member, connector included: " for 10 min · mention spam · by Mika", " · spam". Empty when there is nothing to add. */
  suffix: string;
  /** The whole line as plain text, for assistive technology and tests. */
  text: string;
  occurredAt: Date;
}>;

const ACTIONS: Record<string, { tag: string; verb: string; hasTarget: boolean }> = {
  "moderation.warn": { tag: "Warn", verb: "Warned", hasTarget: true },
  "moderation.unwarn": { tag: "Warn", verb: "Removed a warning from", hasTarget: true },
  "moderation.timeout": { tag: "Mute", verb: "Muted", hasTarget: true },
  "moderation.untimeout": { tag: "Mute", verb: "Unmuted", hasTarget: true },
  "moderation.kick": { tag: "Kick", verb: "Kicked", hasTarget: true },
  "moderation.ban": { tag: "Ban", verb: "Banned", hasTarget: true },
  "moderation.unban": { tag: "Ban", verb: "Unbanned", hasTarget: true },
  "moderation.purge": { tag: "Purge", verb: "Purged messages", hasTarget: false },
  "automod.delete": { tag: "Auto", verb: "Deleted a message from", hasTarget: true },
  "automod.timeout": { tag: "Auto", verb: "Muted", hasTarget: true },
};

/** The auto-moderation rule behind an `automod.*` action. */
const RULES: Record<string, string> = {
  spam: "spam filter",
  links: "link filter",
  words: "banned word",
  mentions: "mention limit",
};

/** "Member …4457" when the bot has not seen the member (the audit log only stores the Discord id). */
export const memberLabel = (target: AuditTarget) => target.name ?? `Member …${target.memberId.slice(-4)}`;

/**
 * Turns an audit entry into a dashboard line, e.g. "Muted Aiko for 10 min · mention spam · by Mika".
 * Entries of an unknown kind are skipped (null) rather than shown half-understood.
 */
export function toAuditLine(entry: AuditEntry): AuditLine | null {
  const action = ACTIONS[entry.action];

  if (!action) {
    return null;
  }

  const { metadata } = entry;
  const target: AuditTarget | null =
    action.hasTarget && entry.targetId ? { memberId: entry.targetId, name: entry.targetName, avatar: entry.targetAvatar } : null;
  const parts: string[] = [];

  if (entry.action === "moderation.timeout" && typeof metadata.durationMinutes === "number") {
    parts.push(`for ${metadata.durationMinutes} min`);
  } else if (entry.action === "automod.timeout" && typeof metadata.durationMinutes === "number") {
    parts.push(`for ${metadata.durationMinutes} min`);
  }

  const rule = typeof metadata.rule === "string" ? RULES[metadata.rule] : undefined;

  if (rule) {
    parts.push(rule);
  }

  if (typeof metadata.reason === "string" && metadata.reason.trim() && entry.action !== "moderation.purge" && metadata.source !== "panel") {
    parts.push(metadata.reason.trim());
  }

  // Who did it: a moderator by name, or the panel when an administrator acted from there.
  if (!entry.action.startsWith("automod.")) {
    if (entry.actorName) {
      parts.push(`by ${entry.actorName}`);
    }

    if (metadata.source === "panel") {
      parts.push("via the panel");
    }
  }

  // The bot logs refused and failed attempts too: never show them as if they had succeeded.
  if (typeof metadata.result === "string" && metadata.result !== "ok") {
    parts.push(metadata.result.startsWith("refused") ? "refused" : "failed");
  }

  const suffix = parts.length === 0 ? "" : `${parts[0]?.startsWith("for ") ? " " : " · "}${parts.join(" · ")}`;
  const head = target ? `${action.verb} ${memberLabel(target)}` : action.verb;

  return {
    id: entry.id,
    tag: action.tag,
    verb: action.verb,
    target,
    suffix,
    text: `${head}${suffix}`,
    occurredAt: entry.occurredAt,
  };
}

export function toAuditLines(entries: ReadonlyArray<AuditEntry>): ReadonlyArray<AuditLine> {
  return entries.flatMap((entry) => {
    const line = toAuditLine(entry);
    return line ? [line] : [];
  });
}
