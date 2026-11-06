import { Events } from "discord.js";

import { logger } from "@/shared/logger.ts";
import type { AuditEvent, AuditLog } from "@/domain/audit/audit-event.ts";
import { defineEvent } from "@/discord/events/types.ts";
import { identityOf } from "@/discord/members/identity.ts";

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
  async execute(
    { activityTracker, auditLog, inviteTracker, memberService, phaethonService, alerts, economyService, guildService },
    member,
  ) {
    if (member.user.bot) {
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
    await memberService.setIdentity(member.guild.id, member.id, identityOf(member)).catch(() => undefined);

    // Dotation d'arrivée versée à la réserve, puis solde de départ payé par elle : une seule fois par membre.
    try {
      const { startingBalance } = await guildService.settings(member.guild.id);
      await economyService.welcome(member.guild.id, member.id, startingBalance);
    } catch (error) {
      logger.warn("Failed to grant the starting balance", {
        memberId: member.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await appendAuditEvent(auditLog, {
      id: crypto.randomUUID(),
      action: "member.joined",
      guildId: member.guild.id,
      occurredAt,
      actorId: null,
      targetId: member.id,
      metadata: {},
    });

    // Phaéthon : un compte très récent qui arrive mérite un coup d'œil.
    try {
      const alert = await phaethonService.checkNewcomer(member.guild.id, member.id, member.user.createdAt);

      if (alert) {
        await alerts(member.guild.id, [alert]);
      }
    } catch (error) {
      logger.warn("Failed to evaluate newcomer alert", {
        memberId: member.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }

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
