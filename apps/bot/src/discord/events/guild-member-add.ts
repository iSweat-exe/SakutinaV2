import { Events } from "discord.js";

import { logger } from "@/shared/logger.ts";
import type { AuditEvent, AuditLog } from "@/domain/audit/audit-event.ts";
import { defineEvent } from "@/discord/events/types.ts";

async function appendAuditEvent(
  auditLog: AuditLog,
  event: AuditEvent,
): Promise<void> {
  try {
    await auditLog.append(event);
  } catch (error) {
    logger.error("Failed to append audit event", {
      action: event.action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const guildMemberAdd = defineEvent({
  name: Events.GuildMemberAdd,
  async execute({ config, activityTracker, auditLog, inviteTracker, memberService }, member) {
    if (member.guild.id !== config.primaryGuildId || member.user.bot) {
      return;
    }

    const occurredAt = new Date();
    activityTracker.recordJoin(member.guild.id, member.id, occurredAt);
    await memberService.markJoined(member.guild.id, member.id, occurredAt).catch((error: unknown) => {
      logger.error("Failed to record member arrival", {
        memberId: member.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
    await appendAuditEvent(auditLog, {
      id: crypto.randomUUID(),
      action: "member.joined",
      guildId: member.guild.id,
      occurredAt,
      actorId: null,
      targetId: member.id,
      metadata: {},
    });

    try {
      const attribution = await inviteTracker.attributeJoin(member.guild);

      if (!attribution) {
        return;
      }

      activityTracker.recordInviteAttribution(
        member.guild.id,
        member.id,
        occurredAt,
      );
      await appendAuditEvent(auditLog, {
        id: crypto.randomUUID(),
        action: "invite.attributed",
        guildId: member.guild.id,
        occurredAt,
        actorId: attribution.inviterId,
        targetId: member.id,
        metadata: { inviteCode: attribution.code },
      });
    } catch (error) {
      logger.warn("Failed to attribute member invite", {
        guildId: member.guild.id,
        memberId: member.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
