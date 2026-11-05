import type { PresenceDelta } from "@/domain/activity/activity-types.ts";
import type { MemberProfile } from "./member-profile.ts";

export type SeedMember = Readonly<{ memberId: string; joinedAt: Date | null }>;

/** Persistance des fiches de membres. */
export interface MemberStore {
  /** Enregistre les dernières activités ; ne recule jamais une date déjà connue. */
  touch(presences: readonly PresenceDelta[]): Promise<void>;

  /** Crée les fiches manquantes (membres déjà présents au démarrage) sans écraser l'existant. */
  seed(guildId: string, members: readonly SeedMember[], now: Date): Promise<void>;

  markJoined(guildId: string, memberId: string, at: Date): Promise<void>;
  markLeft(guildId: string, memberId: string, at: Date): Promise<void>;

  find(guildId: string, memberId: string): Promise<MemberProfile | null>;

  /**
   * Membres présents dont la dernière activité (ou, à défaut, la première
   * observation) est antérieure à `before`, du plus inactif au moins inactif.
   */
  listInactive(
    guildId: string,
    before: Date,
    limit: number,
  ): Promise<readonly MemberProfile[]>;

  delete(guildId: string, memberId: string): Promise<void>;

  /** Supprime les fiches des membres partis avant `before` ; renvoie leur nombre. */
  purgeLeftBefore(before: Date): Promise<number>;
}
