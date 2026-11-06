export type AuditAction =
  | "member.joined"
  | "invite.attributed"
  | "moderation.warn"
  | "moderation.unwarn"
  | "moderation.timeout"
  | "moderation.untimeout"
  | "moderation.kick"
  | "moderation.ban"
  | "moderation.unban"
  | "moderation.purge"
  | "automod.delete"
  | "automod.timeout"
  | "profile.viewed"
  | "profile.compared"
  | "profile.searched"
  | "antiraid.started"
  | "antiraid.ended"
  | "antiraid.quarantine"
  | "antiraid.kick"
  | "antiraid.ban";

export type AuditEvent = Readonly<{
  id: string;
  action: AuditAction;
  guildId: string;
  occurredAt: Date;
  actorId: string | null;
  targetId: string | null;
  metadata: Readonly<Record<string, string | number | boolean | null>>;
}>;

/** Persistance des événements de sécurité et d'administration. */
export interface AuditLog {
  append(event: AuditEvent): Promise<void>;
  listForGuild(guildId: string, limit: number): Promise<readonly AuditEvent[]>;
  /** Supprime les événements strictement antérieurs à `before`. */
  purgeBefore(before: Date): Promise<number>;
}
