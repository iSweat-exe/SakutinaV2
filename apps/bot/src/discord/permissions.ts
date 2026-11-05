import { PermissionFlagsBits, type GuildMember } from "discord.js";

import type { AppConfig } from "@sakutina/config";

import { resolveRole, type Role } from "@/domain/permissions/permissions.ts";

/** Rôle du bot d'un membre du serveur (propriétaire, administrateur, modérateur ou membre). */
export function roleOfMember(member: GuildMember, config: AppConfig): Role {
  return resolveRole(
    {
      isGuildOwner: member.guild.ownerId === member.id,
      hasAdministrator: member.permissions.has(PermissionFlagsBits.Administrator),
      canModerate: member.permissions.has(PermissionFlagsBits.ModerateMembers),
      memberRoleIds: [...member.roles.cache.keys()],
    },
    config,
  );
}
