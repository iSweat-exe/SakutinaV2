/** Rôles du bot, du moins au plus privilégié. */
export const ROLES = ["member", "moderator", "admin", "owner"] as const;

export type Role = (typeof ROLES)[number];

export type RoleEvidence = Readonly<{
  isGuildOwner: boolean;
  /** Permission Discord `Administrator` du membre (jamais requise pour le bot). */
  hasAdministrator: boolean;
  /** Permission Discord `ModerateMembers` du membre. */
  canModerate: boolean;
  memberRoleIds: readonly string[];
}>;

export type RoleMapping = Readonly<{
  adminRoleIds: readonly string[];
  moderatorRoleIds: readonly string[];
}>;

/** Déduit le rôle du bot d'un membre à partir de faits Discord. */
export function resolveRole(
  evidence: RoleEvidence,
  mapping: RoleMapping,
): Role {
  if (evidence.isGuildOwner) {
    return "owner";
  }

  const has = (ids: readonly string[]) =>
    ids.some((id) => evidence.memberRoleIds.includes(id));

  if (evidence.hasAdministrator || has(mapping.adminRoleIds)) {
    return "admin";
  }

  if (evidence.canModerate || has(mapping.moderatorRoleIds)) {
    return "moderator";
  }

  return "member";
}

export function hasRole(actual: Role, required: Role): boolean {
  return ROLES.indexOf(actual) >= ROLES.indexOf(required);
}
