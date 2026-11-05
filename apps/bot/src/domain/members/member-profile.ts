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
  /** Nom affiché (pseudo du serveur, sinon nom d'affichage, sinon nom d'utilisateur) ; `null` si inconnu. */
  displayName?: string | null;
  /** Hash de la photo de profil Discord ; `null` sans photo ou si inconnu. */
  avatar?: string | null;
}>;

/** Ce que le panneau affiche d'un membre : son nom et sa photo. Aucune donnée de contenu. */
export type MemberIdentity = Readonly<{ displayName: string; avatar: string | null }>;

/** Date de référence pour mesurer l'inactivité. */
export function inactivityReference(profile: MemberProfile): Date {
  return profile.lastActiveAt ?? profile.firstSeenAt;
}
