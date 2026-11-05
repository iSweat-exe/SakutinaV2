import type { NewWarning, Warning } from "./moderation-types.ts";

/** Persistance des avertissements. */
export interface WarningStore {
  add(warning: NewWarning): Promise<Warning>;

  /** Avertissements d'un membre, du plus récent au plus ancien. */
  listForMember(guildId: string, memberId: string, limit: number): Promise<readonly Warning[]>;

  count(guildId: string, memberId: string): Promise<number>;

  /** Retire un avertissement ; `false` s'il n'existe pas. */
  remove(guildId: string, id: number): Promise<boolean>;

  /** Supprime les avertissements créés avant `before` ; renvoie leur nombre. */
  purgeBefore(before: Date): Promise<number>;
}
