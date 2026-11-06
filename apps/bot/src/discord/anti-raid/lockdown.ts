import { ChannelType, OverwriteType, PermissionFlagsBits, Routes, type Guild, type GuildBasedChannel } from "discord.js";

import { HIGHEST_VERIFICATION_LEVEL } from "@/domain/anti-raid/anti-raid-rules.ts";
import type { AntiRaidService } from "@/domain/anti-raid/anti-raid-service.ts";
import { alreadyLocked, lockedOverwrite, restoredOverwrite, type ChannelSnapshot, type Overwrite } from "@/domain/anti-raid/overwrites.ts";
import { messages } from "@/discord/messages.ts";
import { logger } from "@/shared/logger.ts";

/** Salons où l'on écrit (texte, annonces, forums, médias, discussion des salons vocaux) ; ni catégories ni fils. */
const LOCKABLE = new Set<ChannelType>([
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildForum,
  ChannelType.GuildMedia,
  ChannelType.GuildVoice,
  ChannelType.GuildStageVoice,
]);

type OverwritableChannel = Extract<GuildBasedChannel, { permissionOverwrites: unknown }>;

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** La permission de @everyone sur ce salon, en champs de bits. */
export function everyoneOverwrite(channel: OverwritableChannel, guildId: string): Overwrite {
  const overwrite = channel.permissionOverwrites.cache.get(guildId);

  return overwrite ? { allow: overwrite.allow.bitfield.toString(), deny: overwrite.deny.bitfield.toString() } : null;
}

/** Salons que le bot peut verrouiller : il les voit et peut y gérer les permissions. */
export function lockableChannels(guild: Guild): OverwritableChannel[] {
  const me = guild.members.me;

  if (!me) {
    return [];
  }

  return [...guild.channels.cache.values()].filter((channel): channel is OverwritableChannel => {
    if (!LOCKABLE.has(channel.type) || !("permissionOverwrites" in channel)) {
      return false;
    }

    const permissions = channel.permissionsFor(me);

    return permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageRoles]) ?? false;
  });
}

const canManageGuild = (guild: Guild) => guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuild) ?? false;

/** Pose exactement ces bits pour @everyone (l'API remplace la surcharge entière : rien n'est fusionné à l'aveugle). */
async function putEveryone(guild: Guild, channelId: string, value: { allow: string; deny: string }, reason: string): Promise<void> {
  await guild.client.rest.put(Routes.channelPermission(channelId, guild.id), {
    body: { type: OverwriteType.Role, allow: value.allow, deny: value.deny },
    reason,
  });
}

export type LockResult = Readonly<{ locked: number; failed: number; verificationRaised: boolean }>;

/**
 * Verrouille le serveur pour ce raid. L'état d'avant de chaque salon (et la vérification) est d'abord enregistré en
 * base d'un seul tenant ; ce n'est qu'ensuite que les salons sont modifiés. Un redémarrage au milieu ne perd donc rien.
 */
export async function lockGuild(
  guild: Guild,
  raidId: string,
  antiRaid: AntiRaidService,
  options: Readonly<{ channels: boolean; verification: boolean }>,
): Promise<LockResult> {
  const snapshots: ChannelSnapshot[] = options.channels
    ? lockableChannels(guild).flatMap((channel) => {
        const overwrite = everyoneOverwrite(channel, guild.id);
        return alreadyLocked(overwrite) ? [] : [{ channelId: channel.id, overwrite }];
      })
    : [];
  const verificationBefore =
    options.verification && canManageGuild(guild) && guild.verificationLevel < HIGHEST_VERIFICATION_LEVEL ? guild.verificationLevel : null;

  await antiRaid.saveLockdown(raidId, guild.id, snapshots, verificationBefore);

  const reason = messages.antiRaid.reasons.lockdown;
  let locked = 0;
  let failed = 0;

  for (const snapshot of snapshots) {
    try {
      await putEveryone(guild, snapshot.channelId, lockedOverwrite(snapshot.overwrite), reason);
      locked += 1;
    } catch (error) {
      failed += 1;
      logger.warn("Anti-raid could not lock a channel", { guildId: guild.id, channelId: snapshot.channelId, error: errorText(error) });
    }
  }

  let verificationRaised = false;

  if (verificationBefore !== null) {
    try {
      await guild.setVerificationLevel(HIGHEST_VERIFICATION_LEVEL, reason);
      verificationRaised = true;
    } catch (error) {
      logger.warn("Anti-raid could not raise the verification level", { guildId: guild.id, error: errorText(error) });
    }
  }

  await antiRaid.count(raidId, { lockedChannels: locked });

  return { locked, failed, verificationRaised };
}

export type RestoreResult = Readonly<{ restored: number; failed: number; verificationRestored: boolean }>;

/**
 * Rétablit ce que le raid a changé : sur chaque salon, les bits du verrouillage reprennent exactement leur état d'avant
 * (les autres changements faits entre-temps restent) ; la vérification revient à son niveau d'avant si personne ne l'a
 * changée depuis. Chaque salon rétabli est retiré de la base : une reprise ne refait que ce qui reste.
 */
export async function restoreGuild(guild: Guild, raidId: string, antiRaid: AntiRaidService): Promise<RestoreResult> {
  const { channels, verificationBefore } = await antiRaid.lockdown(raidId);
  const reason = messages.antiRaid.reasons.restore;
  let restored = 0;
  let failed = 0;

  for (const snapshot of channels) {
    const channel = guild.channels.cache.get(snapshot.channelId);

    // Salon supprimé pendant le raid : plus rien à rétablir.
    if (!channel || !("permissionOverwrites" in channel)) {
      await antiRaid.forgetChannel(raidId, snapshot.channelId);
      continue;
    }

    try {
      const target = restoredOverwrite(snapshot.overwrite, everyoneOverwrite(channel, guild.id));

      if (target === null) {
        await guild.client.rest.delete(Routes.channelPermission(channel.id, guild.id), { reason });
      } else {
        await putEveryone(guild, channel.id, target, reason);
      }

      await antiRaid.forgetChannel(raidId, snapshot.channelId);
      restored += 1;
    } catch (error) {
      failed += 1;
      logger.warn("Anti-raid could not restore a channel", { guildId: guild.id, channelId: channel.id, error: errorText(error) });
    }
  }

  let verificationRestored = false;

  if (verificationBefore !== null && guild.verificationLevel === HIGHEST_VERIFICATION_LEVEL) {
    try {
      await guild.setVerificationLevel(verificationBefore, reason);
      verificationRestored = true;
    } catch (error) {
      logger.warn("Anti-raid could not restore the verification level", { guildId: guild.id, error: errorText(error) });
    }
  }

  return { restored, failed, verificationRestored };
}
