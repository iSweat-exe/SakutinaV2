import { guildIdOf } from "@/discord/guild.ts";
import type { ChatInputCommandInteraction, GuildMember, User } from "discord.js";

import { recordAudit } from "@/discord/audit.ts";
import type { Invoker } from "@/discord/commands/command.ts";
import type { HandlerContext } from "@/discord/handler-context.ts";
import { plain } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { roleOfMember } from "@/discord/permissions.ts";
import { errorPanel, successPanel, warningPanel, type Panel } from "@/discord/ui/panels.ts";
import { post, respondPrivately } from "@/discord/ui/replies.ts";
import type { AuditAction } from "@/domain/audit/audit-event.ts";
import { MAX_REASON_LENGTH, evaluateSanction, type Party } from "@/domain/moderation/moderation-rules.ts";
import { logger } from "@/shared/logger.ts";

const text = messages.moderation;

/** Motif saisi par le modérateur, borné et nettoyé. */
export function readReason(interaction: ChatInputCommandInteraction): string {
  return (interaction.options.getString("reason", true) ?? "").trim().slice(0, MAX_REASON_LENGTH);
}

/** Motif transmis au journal d'audit de Discord : qui a agi, et pourquoi. */
export const auditReason = (interaction: ChatInputCommandInteraction, reason: string) =>
  `${interaction.user.username} : ${reason}`.slice(0, 500);

export const refusalPanel = (description: string) =>
  errorPanel({ category: "admin", title: text.refusals.title, description });

/** Informe un membre de la sanction. Au mieux : des messages privés fermés ne bloquent jamais la modération. */
export async function notifyMember(
  user: User,
  title: string,
  guildName: string,
  reason: string,
  extra?: string,
): Promise<void> {
  try {
    await post(
      await user.createDM(),
      warningPanel({
        category: "admin",
        title,
        description: [text.serverLine(plain(guildName)), extra, `${text.reasonLabel} : ${plain(reason, MAX_REASON_LENGTH)}`]
          .filter(Boolean)
          .join("\n"),
      }),
    );
  } catch {
    // Messages privés fermés : rien à faire.
  }
}

export type SanctionSpec = Readonly<{
  action: AuditAction;
  user: User;
  reason: string;
  /** La cible doit être sur le serveur (tout sauf un bannissement par identifiant). */
  requireMember: boolean;
  /** Discord autorise-t-il le bot à agir sur ce membre ? (`kickable`, `bannable`, `moderatable`) */
  botCan: (member: GuildMember) => boolean;
  /** L'action Discord elle-même. */
  perform: (member: GuildMember | null) => Promise<void>;
  /** Panneau de succès, construit une fois l'action réussie. */
  success: () => Promise<Panel> | Panel;
  /** Titre du message privé envoyé à la cible (absent : pas de message). */
  notify?: Readonly<{ title: string; extra?: string; beforeAction?: boolean }>;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
}>;

/**
 * Le déroulé commun de toute sanction : garde-fous de hiérarchie, action, journal d'audit
 * (réussite, refus ou échec), message à la cible, réponse privée au modérateur.
 * Une sanction n'est jamais tentée sans que son résultat soit journalisé.
 */
export async function sanction(
  interaction: ChatInputCommandInteraction,
  context: HandlerContext,
  invoker: Invoker,
  spec: SanctionSpec,
): Promise<void> {
  const { guild } = interaction;
  const audit = (result: string) =>
    recordAudit(context, guildIdOf(interaction), spec.action, interaction.user.id, spec.user.id, {
      ...spec.metadata,
      reason: spec.reason,
      result,
    });

  if (!guild) {
    return;
  }

  const roles = await context.guildService.settings(guild.id);
  const [actorMember, member] = await Promise.all([
    guild.members.fetch(interaction.user.id).catch(() => null),
    guild.members.fetch(spec.user.id).catch(() => null),
  ]);

  if (spec.requireMember && !member) {
    await audit("refused:not-member");
    await respondPrivately(interaction, refusalPanel(text.refusals.notMember));
    return;
  }

  const party = (candidate: GuildMember, role: Party["role"]): Party => ({
    id: candidate.id,
    role,
    isGuildOwner: guild.ownerId === candidate.id,
    position: candidate.roles.highest.position,
  });
  const refusal = evaluateSanction({
    actor: actorMember
      ? party(actorMember, invoker.role)
      : { id: interaction.user.id, role: invoker.role, isGuildOwner: guild.ownerId === interaction.user.id, position: 0 },
    targetId: spec.user.id,
    target: member ? party(member, roleOfMember(member, roles)) : null,
    botId: interaction.client.user.id,
    botCanAct: member ? spec.botCan(member) : true,
  });

  if (refusal) {
    await audit(`refused:${refusal}`);
    await respondPrivately(interaction, refusalPanel(text.refusals[refusal]));
    return;
  }

  const notify = () =>
    spec.notify
      ? notifyMember(spec.user, spec.notify.title, guild.name, spec.reason, spec.notify.extra)
      : Promise.resolve();

  try {
    // Un membre expulsé ou banni ne partage plus de serveur avec le bot : on le prévient avant.
    if (spec.notify?.beforeAction) await notify();
    await spec.perform(member);
  } catch (error) {
    logger.warn("Moderation action failed", {
      action: spec.action,
      error: error instanceof Error ? error.message : String(error),
    });
    await audit("failed");
    await respondPrivately(interaction, errorPanel({ category: "admin", title: text.failedTitle, description: text.failed }));
    return;
  }

  await audit("ok");
  await trackSanction(context, guildIdOf(interaction), interaction.user.id, spec);

  if (!spec.notify?.beforeAction) await notify();

  await respondPrivately(interaction, await spec.success());
}

/** Tient à jour les sanctions actives (ce que le panneau affiche) après une sanction réussie. */
async function trackSanction(context: HandlerContext, guildId: string, moderatorId: string, spec: SanctionSpec): Promise<void> {
  const { sanctionService } = context;

  try {
    switch (spec.action) {
      case "moderation.timeout":
        await sanctionService.recordMute(guildId, spec.user.id, moderatorId, spec.reason, Number(spec.metadata?.durationMinutes ?? 0) * 60_000);
        break;
      case "moderation.ban":
        await sanctionService.recordBan(guildId, spec.user.id, moderatorId, spec.reason);
        break;
      case "moderation.untimeout":
        await sanctionService.clear("mute", guildId, spec.user.id, moderatorId);
        break;
      default:
    }
  } catch (error) {
    logger.error("Failed to track the sanction", { action: spec.action, error: error instanceof Error ? error.message : String(error) });
  }
}

export const done = (title: string, description: string): Panel =>
  successPanel({ category: "admin", title, description });
