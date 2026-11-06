export type SanctionKind = "mute" | "ban";

/** `moderatorId` des sanctions de l'auto-modération (ce n'est pas un identifiant Discord). */
export const AUTOMOD_ACTOR = "sakutina";

/** Un mute ou un bannissement et son état. Actif tant qu'il n'est ni levé ni échu. */
export type Sanction = Readonly<{
  id: number;
  guildId: string;
  memberId: string;
  kind: SanctionKind;
  /** `null` : posée dans Discord (auteur inconnu) ; {@link AUTOMOD_ACTOR} : auto-modération. */
  moderatorId: string | null;
  reason: string;
  createdAt: Date;
  /** Fin d'un mute ; `null` pour un bannissement (permanent). */
  endsAt: Date | null;
  revokedAt: Date | null;
  revokedBy: string | null;
}>;

export type NewSanction = Omit<Sanction, "id" | "revokedAt" | "revokedBy">;

type CommandBase = Readonly<{
  id: string;
  guildId: string;
  /** Identifiant Discord de l'administrateur qui l'a demandé. */
  requestedBy: string;
}>;

/**
 * Une action demandée depuis le panneau et à exécuter sur Discord : lever une sanction (page Moderation), ou
 * bannir un compte (page Phaethon).
 */
export type SanctionCommand =
  | (CommandBase & Readonly<{ action: "revoke"; sanctionId: number }>)
  | (CommandBase & Readonly<{ action: "ban"; memberId: string; reason: string }>);

/** Persistance des sanctions actives et de la file de demandes du panneau. */
export interface SanctionStore {
  /** Ajoute une sanction ; une sanction active du même type sur ce membre est d'abord close. */
  add(sanction: NewSanction): Promise<Sanction>;

  /** Clôt les sanctions actives de ce type sur ce membre ; renvoie leur nombre. */
  close(guildId: string, memberId: string, kind: SanctionKind, at: Date, by: string | null): Promise<number>;

  find(id: number): Promise<Sanction | null>;

  hasActive(guildId: string, memberId: string, kind: SanctionKind, now: Date): Promise<boolean>;

  /** Supprime les sanctions closées ou échues avant `before` ; renvoie leur nombre. */
  purgeClosedBefore(before: Date): Promise<number>;

  /** Demande de levée (le panneau l'écrit en SQL ; ici pour les tests et le mode mémoire). */
  enqueueCommand(guildId: string, sanctionId: number, requestedBy: string): Promise<void>;

  /** Demande de bannissement (le panneau l'écrit en SQL avec `panel_request_ban` ; ici pour les tests). */
  enqueueBan(guildId: string, memberId: string, reason: string, requestedBy: string): Promise<void>;

  /** Demandes en attente, plus anciennes d'abord. */
  pendingCommands(limit: number): Promise<readonly SanctionCommand[]>;

  finishCommand(id: string, status: "done" | "failed", at: Date, error?: string): Promise<void>;
}
