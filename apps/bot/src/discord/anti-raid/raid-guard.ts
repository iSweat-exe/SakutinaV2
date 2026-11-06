import { PermissionFlagsBits, type Client, type Guild, type GuildMember } from "discord.js";

import type { ChannelPoster } from "@/discord/alerts/alert-poster.ts";
import { formatDuration } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { createPanel, warningPanel, type PanelField } from "@/discord/ui/panels.ts";
import { post as sendPanel } from "@/discord/ui/replies.ts";
import { BAN_DELETE_MESSAGE_SECONDS, QUARANTINE_MS, type AntiRaidSettings, type RaidAction } from "@/domain/anti-raid/anti-raid-rules.ts";
import type { AntiRaidService } from "@/domain/anti-raid/anti-raid-service.ts";
import type { Raid } from "@/domain/anti-raid/raid-store.ts";
import type { AuditAction, AuditLog } from "@/domain/audit/audit-event.ts";
import { AUTOMOD_ACTOR, type SanctionService } from "@/domain/moderation/sanction-service.ts";
import { logger } from "@/shared/logger.ts";
import { lockGuild, restoreGuild, type LockResult, type RestoreResult } from "./lockdown.ts";

type Dependencies = Readonly<{
  client: Client;
  antiRaid: AntiRaidService;
  sanctionService: SanctionService;
  auditLog: AuditLog;
  /** Publie dans le salon d'alertes du serveur. */
  post: ChannelPoster;
}>;

/** L'anti-raid côté Discord : il exécute ce que `AntiRaidService` décide. */
export type RaidGuard = Readonly<{
  /** Un membre arrive. `true` s'il a été expulsé ou banni (le reste de l'accueil est alors inutile). */
  onJoin: (member: GuildMember) => Promise<boolean>;
  /** Verrouillage demandé par un administrateur ; `null` si un raid est déjà en cours. */
  lockdown: (guild: Guild, by: string) => Promise<Readonly<{ raid: Raid; lock: LockResult }> | null>;
  /** Lève le raid en cours et rétablit tout ; `null` s'il n'y en avait pas. */
  unlock: (guild: Guild, by: string) => Promise<Readonly<{ raid: Raid; restore: RestoreResult }> | null>;
  /** Clôt les raids calmes depuis 2 minutes. */
  sweep: () => Promise<void>;
  /** Exécute les demandes du panneau (verrouiller, lever). */
  runPanelCommands: () => Promise<void>;
  /** Au démarrage : reprend les raids restés ouverts. */
  resume: () => Promise<void>;
}>;

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Personne qui gère le serveur : jamais visée, même arrivée pendant un raid. */
function isProtected(member: GuildMember): boolean {
  return (
    member.user.bot ||
    member.id === member.guild.ownerId ||
    member.permissions.has(PermissionFlagsBits.Administrator) ||
    member.permissions.has(PermissionFlagsBits.ManageGuild)
  );
}

const AUDIT_OF: Record<Exclude<RaidAction, "watch">, AuditAction> = {
  quarantine: "antiraid.quarantine",
  kick: "antiraid.kick",
  ban: "antiraid.ban",
};

export function createRaidGuard({ client, antiRaid, sanctionService, auditLog, post }: Dependencies): RaidGuard {
  const text = messages.antiRaid;

  const audit = (action: AuditAction, guildId: string, actorId: string | null, targetId: string | null, metadata: Record<string, string | number | boolean | null>) =>
    auditLog
      .append({ id: crypto.randomUUID(), action, guildId, occurredAt: new Date(), actorId, targetId, metadata })
      .catch((error: unknown) => logger.error("Failed to append audit event", { action, error: errorText(error) }));

  const alert = async (guildId: string, settings: AntiRaidSettings, panel: Parameters<ChannelPoster>[1]) => {
    if (settings.alertAdmins) {
      await post(guildId, panel).catch(() => false);
    }
  };

  /**
   * Explique au compte ce qui lui arrive : un vrai membre peut être pris dans la rafale. Au mieux : des messages privés
   * fermés ne bloquent rien. Pas de message pour un bannissement.
   */
  async function tell(member: GuildMember, action: "quarantine" | "kick"): Promise<void> {
    try {
      const dm = text.dm[action];
      await sendPanel(await member.user.createDM(), warningPanel({ category: "admin", title: dm.title, description: dm.text(member.guild.name) }));
    } catch {
      // Messages privés fermés : rien à faire.
    }
  }

  /** Met en quarantaine, expulse ou bannit un compte arrivé pendant le raid. `true` s'il a quitté le serveur. */
  async function respond(member: GuildMember, raidId: string, action: RaidAction): Promise<boolean> {
    if (action === "watch" || isProtected(member)) {
      return false;
    }

    const guild = member.guild;
    const reason = text.reasons[action];

    try {
      if (action === "quarantine") {
        await member.timeout(QUARANTINE_MS, reason);
        await sanctionService.recordMute(guild.id, member.id, AUTOMOD_ACTOR, reason, QUARANTINE_MS).catch(() => undefined);
        await tell(member, "quarantine");
      } else if (action === "kick") {
        // Avant l'expulsion : ensuite, plus aucun serveur commun ne permet de lui écrire.
        await tell(member, "kick");
        await member.kick(reason);
      } else {
        await guild.members.ban(member.id, { reason, deleteMessageSeconds: BAN_DELETE_MESSAGE_SECONDS });
        await sanctionService.recordBan(guild.id, member.id, AUTOMOD_ACTOR, reason).catch(() => undefined);
      }
    } catch (error) {
      logger.warn("Anti-raid could not act on a member", { guildId: guild.id, action, error: errorText(error) });
      await antiRaid.count(raidId, { failed: 1 });
      await audit(AUDIT_OF[action], guild.id, null, member.id, { raid: raidId, result: "failed" });
      return false;
    }

    await antiRaid.count(raidId, { actioned: 1 });
    await audit(AUDIT_OF[action], guild.id, null, member.id, { raid: raidId, result: "ok" });

    return action !== "quarantine";
  }

  function startedPanel(raid: Raid, settings: AntiRaidSettings, lock: LockResult | null, by: string | null) {
    const fields: PanelField[] = [
      { name: text.fields.response, value: text.actions[settings.action] },
      { name: text.fields.channels, value: text.lockedChannels(lock?.locked ?? 0) },
      { name: text.fields.verification, value: lock?.verificationRaised ? text.verificationRaised : text.verificationUnchanged },
    ];

    return createPanel({
      category: "admin",
      tone: "danger",
      title: by ? text.manual.title : text.started.title,
      description: by ? text.manual.text(`<@${by}>`) : text.started.text(raid.joins, raid.windowSeconds),
      fields: by ? fields : [{ name: text.fields.joins, value: String(raid.joins) }, ...fields],
      footer: text.posted,
      timestamp: true,
    });
  }

  function endedPanel(raid: Raid, restore: RestoreResult) {
    const end = raid.endedAt ?? new Date();
    const fields: PanelField[] = [
      { name: text.fields.duration, value: formatDuration(end.getTime() - raid.startedAt.getTime()) },
      { name: text.fields.joins, value: String(raid.joins) },
      { name: text.fields.actioned, value: String(raid.actioned) },
      { name: text.fields.channels, value: text.restoredChannels(restore.restored) },
      { name: text.fields.endedBy, value: raid.endedBy ? `<@${raid.endedBy}>` : text.automatic },
    ];

    if (raid.failed > 0) {
      fields.splice(3, 0, { name: text.fields.failed, value: String(raid.failed) });
    }

    if (raid.verificationBefore !== null) {
      fields.push({ name: text.fields.verification, value: restore.verificationRestored ? text.verificationRestored : text.verificationUnchanged });
    }

    return createPanel({
      category: "admin",
      tone: restore.failed > 0 ? "warning" : "success",
      title: text.ended.title,
      description: restore.failed > 0 ? `${text.ended.text}\n${text.notRestored(restore.failed)}` : text.ended.text,
      fields,
      footer: text.posted,
      timestamp: true,
    });
  }

  /** Verrouille selon les réglages (toujours les salons pour un verrouillage manuel), journalise et alerte. */
  async function protect(guild: Guild, raid: Raid, settings: AntiRaidSettings, by: string | null): Promise<LockResult> {
    const channels = by !== null || (settings.action !== "watch" && settings.lockChannels);
    const verification = settings.raiseVerification && (by !== null || settings.action !== "watch");
    const lock = channels || verification ? await lockGuild(guild, raid.id, antiRaid, { channels, verification }) : { locked: 0, failed: 0, verificationRaised: false };

    await audit("antiraid.started", guild.id, by, null, {
      raid: raid.id,
      trigger: raid.trigger,
      joins: raid.joins,
      windowSeconds: raid.windowSeconds,
      action: settings.action,
      lockedChannels: lock.locked,
      verificationRaised: lock.verificationRaised,
    });
    await alert(guild.id, settings, startedPanel(raid, settings, lock, by));

    return lock;
  }

  /** Rétablit, journalise et alerte pour un raid déjà clos en base. */
  async function finish(guild: Guild, raid: Raid): Promise<RestoreResult> {
    const restore = await restoreGuild(guild, raid.id, antiRaid);
    const settings = await antiRaid.settings(guild.id);

    await audit("antiraid.ended", guild.id, raid.endedBy, null, {
      raid: raid.id,
      joins: raid.joins,
      actioned: raid.actioned,
      failed: raid.failed,
      restoredChannels: restore.restored,
      restoreFailures: restore.failed,
      durationSeconds: Math.round(((raid.endedAt ?? new Date()).getTime() - raid.startedAt.getTime()) / 1_000),
    });
    await alert(guild.id, settings, endedPanel(raid, restore));

    return restore;
  }

  async function onJoin(member: GuildMember): Promise<boolean> {
    if (member.user.bot) {
      return false;
    }

    try {
      const outcome = await antiRaid.onJoin(member.guild.id, member.id);

      if (outcome.kind === "calm") {
        return false;
      }

      if (outcome.kind === "raider") {
        return await respond(member, outcome.raidId, outcome.settings.action);
      }

      await protect(member.guild, outcome.raid, outcome.settings, null);

      // Les comptes arrivés dans la fenêtre font partie du raid, celui-ci compris.
      let removed = false;

      for (const memberId of outcome.memberIds) {
        const target = memberId === member.id ? member : await member.guild.members.fetch(memberId).catch(() => null);

        if (target) {
          const left = await respond(target, outcome.raid.id, outcome.settings.action);
          removed ||= memberId === member.id && left;
        }
      }

      return removed;
    } catch (error) {
      logger.error("Anti-raid failed on a join", { guildId: member.guild.id, error: errorText(error) });
      return false;
    }
  }

  async function lockdown(guild: Guild, by: string) {
    const started = await antiRaid.startManual(guild.id, by);

    if (!started) {
      return null;
    }

    return { raid: started.raid, lock: await protect(guild, started.raid, started.settings, by) };
  }

  async function unlock(guild: Guild, by: string) {
    const raid = await antiRaid.end(guild.id, by);

    return raid ? { raid, restore: await finish(guild, raid) } : null;
  }

  async function sweep(): Promise<void> {
    for (const raid of await antiRaid.endCalmed()) {
      const guild = client.guilds.cache.get(raid.guildId);

      if (guild) {
        await finish(guild, raid).catch((error: unknown) => logger.error("Anti-raid could not finish a raid", { guildId: raid.guildId, error: errorText(error) }));
      }
    }
  }

  async function runPanelCommands(): Promise<void> {
    for (const command of await antiRaid.pendingCommands(10)) {
      const guild = client.guilds.cache.get(command.guildId);

      try {
        if (!guild) {
          await antiRaid.finishCommand(command.id, "failed", "Le bot n'est plus sur ce serveur.");
        } else if (command.action === "start") {
          const result = await lockdown(guild, command.requestedBy);
          await antiRaid.finishCommand(command.id, result ? "done" : "failed", result ? undefined : "Un raid est déjà en cours.");
        } else {
          // Déjà levé (fin automatique, /server unlock) : la demande est sans objet, pas en échec.
          await unlock(guild, command.requestedBy);
          await antiRaid.finishCommand(command.id, "done");
        }
      } catch (error) {
        logger.error("Anti-raid panel command crashed", { commandId: command.id, error: errorText(error) });
        await antiRaid.finishCommand(command.id, "failed", errorText(error)).catch(() => undefined);
      }
    }
  }

  async function resume(): Promise<void> {
    const raids = await antiRaid.resume();

    if (raids.length > 0) {
      logger.info("Anti-raid resumed open raids", { raids: raids.map((raid) => raid.guildId) });
    }
  }

  return { onJoin, lockdown, unlock, sweep, runPanelCommands, resume };
}
