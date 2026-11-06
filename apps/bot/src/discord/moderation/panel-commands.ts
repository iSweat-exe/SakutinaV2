import type { Client } from "discord.js";

import type { AuditAction, AuditLog } from "@/domain/audit/audit-event.ts";
import type { SanctionService } from "@/domain/moderation/sanction-service.ts";
import type { SanctionCommand } from "@/domain/moderation/sanction-store.ts";
import { logger } from "@/shared/logger.ts";

/** Discord : « Unknown Ban » (10026) et « Unknown Member » (10007) veulent dire que la sanction n'existe déjà plus. */
const ALREADY_GONE = new Set([10_026, 10_007]);

type Dependencies = Readonly<{ client: Client; sanctionService: SanctionService; auditLog: AuditLog }>;

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Exécute les demandes écrites par le panneau (« lever cette sanction », « bannir ce compte ») : le panneau n'a aucun accès à Discord,
 * c'est le bot qui lève le mute ou le bannissement, journalise l'action au nom de l'administrateur qui l'a
 * demandée, puis clôt la demande. Un échec (permission manquante…) est consigné sur la demande, et la sanction
 * reste active : le panneau l'affiche.
 */
export function createPanelCommandRunner({ client, sanctionService, auditLog }: Dependencies): () => Promise<void> {
  const audit = (action: AuditAction, guildId: string, actorId: string, targetId: string, result: string, reason = "panel") =>
    auditLog
      .append({
        id: crypto.randomUUID(),
        action,
        guildId,
        occurredAt: new Date(),
        actorId,
        targetId,
        metadata: { reason, result, source: "panel" },
      })
      .catch((error: unknown) => logger.error("Failed to append audit event", { action, error: errorText(error) }));

  async function revoke(command: Extract<SanctionCommand, { action: "revoke" }>): Promise<void> {
    const sanction = await sanctionService.find(command.sanctionId);

    // Déjà levée ou échue entre la demande et maintenant : rien à faire.
    if (!sanction || sanction.guildId !== command.guildId || sanction.revokedAt !== null) {
      await sanctionService.finishCommand(command.id, "done");
      return;
    }

    const guild = client.guilds.cache.get(command.guildId);
    const action: AuditAction = sanction.kind === "ban" ? "moderation.unban" : "moderation.untimeout";

    if (!guild) {
      await sanctionService.finishCommand(command.id, "failed", "Le bot n'est plus sur ce serveur.");
      return;
    }

    try {
      const reason = `Panneau : levé par ${command.requestedBy}`;

      if (sanction.kind === "ban") {
        await guild.bans.remove(sanction.memberId, reason);
      } else {
        const member = await guild.members.fetch(sanction.memberId).catch(() => null);
        await member?.timeout(null, reason);
      }
    } catch (error) {
      const code = (error as { code?: number }).code;

      if (code === undefined || !ALREADY_GONE.has(code)) {
        await audit(action, guild.id, command.requestedBy, sanction.memberId, "failed");
        await sanctionService.finishCommand(command.id, "failed", errorText(error));
        return;
      }
    }

    await sanctionService.clear(sanction.kind, guild.id, sanction.memberId, command.requestedBy);
    await audit(action, guild.id, command.requestedBy, sanction.memberId, "ok");
    await sanctionService.finishCommand(command.id, "done");
  }

  /**
   * Bannissement demandé depuis Phaéthon. Discord applique la hiérarchie des rôles : un membre plus haut que le bot
   * fait échouer la demande (consignée, visible dans le panneau) au lieu d'être contourné.
   */
  async function ban(command: Extract<SanctionCommand, { action: "ban" }>): Promise<void> {
    const guild = client.guilds.cache.get(command.guildId);

    if (!guild) {
      await sanctionService.finishCommand(command.id, "failed", "Le bot n'est plus sur ce serveur.");
      return;
    }

    try {
      await guild.members.ban(command.memberId, { reason: `Panneau (Phaéthon) : ${command.reason}`.slice(0, 512) });
    } catch (error) {
      await audit("moderation.ban", guild.id, command.requestedBy, command.memberId, "failed", command.reason);
      await sanctionService.finishCommand(command.id, "failed", errorText(error));
      return;
    }

    await sanctionService.recordBan(guild.id, command.memberId, command.requestedBy, command.reason);
    await audit("moderation.ban", guild.id, command.requestedBy, command.memberId, "ok", command.reason);
    await sanctionService.finishCommand(command.id, "done");
  }

  const run = (command: SanctionCommand) => (command.action === "ban" ? ban(command) : revoke(command));

  return async () => {
    for (const command of await sanctionService.pendingCommands(10)) {
      try {
        await run(command);
      } catch (error) {
        logger.error("Panel moderation command crashed", { commandId: command.id, error: errorText(error) });
        await sanctionService.finishCommand(command.id, "failed", errorText(error)).catch(() => undefined);
      }
    }
  };
}
