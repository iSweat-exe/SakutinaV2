import { PermissionFlagsBits, type GuildMember } from "discord.js";

import { resolveRole, type Role, type RoleMapping } from "@/domain/permissions/permissions.ts";

/** Rôle du bot d'un membre du serveur (propriétaire, administrateur, modérateur ou membre), selon les rôles déclarés par ce serveur. */
export function roleOfMember(member: GuildMember, mapping: RoleMapping): Role {
  return resolveRole(
    {
      isGuildOwner: member.guild.ownerId === member.id,
      hasAdministrator: member.permissions.has(PermissionFlagsBits.Administrator),
      canModerate: member.permissions.has(PermissionFlagsBits.ModerateMembers),
      memberRoleIds: [...member.roles.cache.keys()],
    },
    mapping,
  );
}
