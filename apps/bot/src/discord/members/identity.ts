import type { GuildMember } from "discord.js";

import type { MemberIdentity } from "@/domain/members/member-profile.ts";

/**
 * Ce que le panneau affiche d'un membre : le nom qu'on lui voit sur le serveur (pseudo, sinon nom d'affichage,
 * sinon nom d'utilisateur) et le hash de sa photo de profil. Aucune donnée de contenu.
 */
export function identityOf(member: Pick<GuildMember, "displayName" | "user">): MemberIdentity {
  return { displayName: member.displayName, avatar: member.user.avatar };
}
