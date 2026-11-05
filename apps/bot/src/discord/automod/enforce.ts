import { PermissionFlagsBits, type Message } from "discord.js";

import { notifyMember } from "@/discord/commands/moderation/shared.ts";
import type { HandlerContext } from "@/discord/handler-context.ts";
import { messages } from "@/discord/messages.ts";
import { roleOfMember } from "@/discord/permissions.ts";
import { recordAudit } from "@/discord/audit.ts";
import { evaluateAutomod } from "@/domain/moderation/automod.ts";
import { AUTOMOD_ACTOR } from "@/domain/moderation/sanction-store.ts";
import { logger } from "@/shared/logger.ts";

const DAY_MS = 86_400_000;
const text = messages.automod;

/**
 * Applique l'auto-modération du serveur à un message : suppression, puis mute si la règle le prévoit.
 * Les modérateurs, les administrateurs et ceux qui gèrent les messages ne sont jamais touchés.
 * Le texte du message sert à décider, puis disparaît : seule la règle enfreinte est journalisée.
 */
export async function enforceAutomod(context: HandlerContext, message: Message<true>): Promise<void> {
  const { guildService, spamWindow, sanctionService } = context;
  const settings = await guildService.settings(message.guildId);
  const { automod } = settings;

  if (!automod.spam && !automod.links && !automod.words && !automod.mentions) {
    return;
  }

  const member = message.member;

  if (!member || roleOfMember(member, settings) !== "member" || member.permissions.has(PermissionFlagsBits.ManageMessages)) {
    return;
  }

  const violation = evaluateAutomod(
    {
      guildId: message.guildId,
      memberId: message.author.id,
      text: message.content,
      mentionedUsers: message.mentions.users.filter((user) => !user.bot && user.id !== message.author.id).size,
      memberAgeDays: member.joinedTimestamp === null ? null : (Date.now() - member.joinedTimestamp) / DAY_MS,
      at: message.createdTimestamp,
    },
    automod,
    spamWindow,
  );

  if (!violation) {
    return;
  }

  const rule = violation.rule;
  const deleted = await message.delete().then(
    () => true,
    (error: unknown) => {
      logger.warn("Automod could not delete a message", { guildId: message.guildId, rule, error: error instanceof Error ? error.message : String(error) });
      return false;
    },
  );

  await recordAudit(context, message.guildId, "automod.delete", null, message.author.id, { rule, result: deleted ? "ok" : "failed" });

  if (!violation.punish || !member.moderatable) {
    return;
  }

  const durationMs = automod.muteMinutes * 60_000;
  const reason = text.reasons[rule];

  try {
    await member.timeout(durationMs, `Sakutina : ${reason}`);
  } catch (error) {
    logger.warn("Automod could not mute a member", { guildId: message.guildId, rule, error: error instanceof Error ? error.message : String(error) });
    await recordAudit(context, message.guildId, "automod.timeout", null, message.author.id, { rule, result: "failed" });
    return;
  }

  // Le membre repart de zéro : le prochain message ne déclenche pas un second mute.
  spamWindow.forget(message.guildId, message.author.id);
  await sanctionService.recordMute(message.guildId, message.author.id, AUTOMOD_ACTOR, reason, durationMs).catch((error: unknown) => {
    logger.error("Failed to record the automod mute", { error: error instanceof Error ? error.message : String(error) });
  });
  await recordAudit(context, message.guildId, "automod.timeout", null, message.author.id, {
    rule,
    durationMinutes: automod.muteMinutes,
    result: "ok",
  });
  await notifyMember(message.author, text.dmTitle, message.guild.name, reason, text.dmExtra(automod.muteMinutes));
}
