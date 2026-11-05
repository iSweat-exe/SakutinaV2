/** Fiche minimale d'un membre : quatre dates, aucune donnée de contenu. */
export type MemberProfile = Readonly<{
  guildId: string;
  memberId: string;
  /** Première fois que le bot a vu le membre. */
  firstSeenAt: Date;
  /** Date d'arrivée sur le serveur, si connue. */
  joinedAt: Date | null;
  /** Date de départ ; `null` tant que le membre est présent. */
  leftAt: Date | null;
  /** Dernier message, réaction ou passage en vocal ; `null` si jamais observé. */
  lastActiveAt: Date | null;
}>;

/** Date de référence pour mesurer l'inactivité. */
export function inactivityReference(profile: MemberProfile): Date {
  return profile.lastActiveAt ?? profile.firstSeenAt;
}
