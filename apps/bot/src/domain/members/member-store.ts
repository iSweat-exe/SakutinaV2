import type { PresenceDelta } from "@/domain/activity/activity-types.ts";
import type { MemberIdentity, MemberProfile } from "./member-profile.ts";

export type SeedMember = Readonly<{ memberId: string; joinedAt: Date | null; identity?: MemberIdentity }>;

/** Persistance des fiches de membres. */
export interface MemberStore {
  /** Enregistre les dernières activités ; ne recule jamais une date déjà connue. */
  touch(presences: readonly PresenceDelta[]): Promise<void>;

  /** Crée les fiches manquantes (membres déjà présents au démarrage) sans écraser l'existant. */
  seed(guildId: string, members: readonly SeedMember[], now: Date): Promise<void>;

  /** Met à jour le nom et la photo d'un membre ; ne crée pas de fiche s'il n'en a pas. */
  setIdentity(guildId: string, memberId: string, identity: MemberIdentity): Promise<void>;

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

  /** Fiches des membres actuellement présents sur le serveur. */
  listPresent(guildId: string): Promise<readonly MemberProfile[]>;

  /** Membres partis avant `before` : leurs fiches vont être purgées. */
  listLeftBefore(before: Date): Promise<readonly { guildId: string; memberId: string }[]>;

  delete(guildId: string, memberId: string): Promise<void>;

  /** Supprime les fiches des membres partis avant `before` ; renvoie leur nombre. */
  purgeLeftBefore(before: Date): Promise<number>;
}
