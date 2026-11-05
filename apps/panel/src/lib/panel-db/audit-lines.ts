import type { AuditEntry } from "./schema";

export type AuditLine = Readonly<{ id: string; tag: string; text: string; occurredAt: Date }>;

const ACTIONS: Record<string, { tag: string; verb: string; hasTarget: boolean }> = {
  "moderation.warn": { tag: "Warn", verb: "Warned", hasTarget: true },
  "moderation.unwarn": { tag: "Warn", verb: "Removed a warning from", hasTarget: true },
  "moderation.timeout": { tag: "Mute", verb: "Muted", hasTarget: true },
  "moderation.untimeout": { tag: "Mute", verb: "Unmuted", hasTarget: true },
  "moderation.kick": { tag: "Kick", verb: "Kicked", hasTarget: true },
  "moderation.ban": { tag: "Ban", verb: "Banned", hasTarget: true },
  "moderation.unban": { tag: "Ban", verb: "Unbanned", hasTarget: true },
  "moderation.purge": { tag: "Purge", verb: "Purged messages", hasTarget: false },
};

/** "…4457": the audit log only stores Discord ids, not names (yet). */
const shortId = (id: string) => `…${id.slice(-4)}`;

/**
 * Turns an audit entry into a dashboard line, e.g. "Muted …4457 for 10 min · mention spam".
 * Entries of an unknown kind are skipped (null) rather than shown half-understood.
 */
export function toAuditLine(entry: AuditEntry): AuditLine | null {
  const action = ACTIONS[entry.action];

  if (!action) {
    return null;
  }

  const { metadata } = entry;
  const parts: string[] = [];
  let head = action.verb;

  if (action.hasTarget && entry.targetId) {
    head += ` ${shortId(entry.targetId)}`;
  }

  if (entry.action === "moderation.timeout" && typeof metadata.durationMinutes === "number") {
    head += ` for ${metadata.durationMinutes} min`;
  }

  parts.push(head);

  if (typeof metadata.reason === "string" && metadata.reason.trim() && entry.action !== "moderation.purge") {
    parts.push(metadata.reason.trim());
  }

  // The bot logs refused and failed attempts too: never show them as if they had succeeded.
  if (typeof metadata.result === "string" && metadata.result !== "ok") {
    parts.push(metadata.result.startsWith("refused") ? "refused" : "failed");
  }

  return { id: entry.id, tag: action.tag, text: parts.join(" · "), occurredAt: entry.occurredAt };
}

export function toAuditLines(entries: ReadonlyArray<AuditEntry>): ReadonlyArray<AuditLine> {
  return entries.flatMap((entry) => {
    const line = toAuditLine(entry);
    return line ? [line] : [];
  });
}
