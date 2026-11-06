import type { GuildMember } from "discord.js";

import { MAX_ROLE_NAMES, type MemberIdentity } from "@/domain/members/member-profile.ts";

/**
 * Ce que le panneau affiche d'un membre : le nom qu'on lui voit sur le serveur (pseudo, sinon nom d'affichage,
 * sinon nom d'utilisateur), le hash de sa photo de profil, son nom d'utilisateur et le nom de ses rôles (du plus
 * haut au plus bas, sans @everyone). Aucune donnée de contenu.
 */
export function identityOf(member: Pick<GuildMember, "displayName" | "user" | "roles" | "guild">): MemberIdentity {
  const roleNames = [...member.roles.cache.values()]
    .filter((role) => role.id !== member.guild.id)
    .sort((a, b) => b.position - a.position)
    .slice(0, MAX_ROLE_NAMES)
    .map((role) => role.name);

  return { displayName: member.displayName, avatar: member.user.avatar, username: member.user.username, roleNames };
}
