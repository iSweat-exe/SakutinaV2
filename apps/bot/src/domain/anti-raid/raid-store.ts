import type { RaidAction } from "./anti-raid-rules.ts";
import type { ChannelSnapshot } from "./overwrites.ts";

/** « burst » : déclaré par la rafale d'arrivées ; « manual » : verrouillage demandé par un administrateur. */
export type RaidTrigger = "burst" | "manual";

/** Un raid et son bilan. Aucun identifiant de membre visé : les actions sont dans le journal d'audit. */
export type Raid = Readonly<{
  id: string;
  guildId: string;
  startedAt: Date;
  endedAt: Date | null;
  trigger: RaidTrigger;
  /** Administrateur qui l'a déclaré (verrouillage manuel) ; `null` pour une rafale. */
  startedBy: string | null;
  /** Administrateur qui l'a levé ; `null` : fin automatique. */
  endedBy: string | null;
  /** Arrivées comptées dans le raid. */
  joins: number;
  windowSeconds: number;
  /** Réponse en vigueur quand il a commencé. */
  action: RaidAction;
  /** Comptes mis en quarantaine, expulsés ou bannis ; échecs (hiérarchie, permission manquante). */
  actioned: number;
  failed: number;
  lockedChannels: number;
  /** Niveau de vérification d'avant, s'il a été relevé ; rétabli à la fin. */
  verificationBefore: number | null;
}>;

export type NewRaid = Pick<Raid, "id" | "guildId" | "startedAt" | "trigger" | "startedBy" | "joins" | "windowSeconds" | "action">;

export type RaidCounts = Readonly<{ joins?: number; actioned?: number; failed?: number; lockedChannels?: number }>;

/** Une demande du panneau à exécuter sur Discord : verrouiller le serveur, ou lever le raid en cours. */
export type RaidCommand = Readonly<{ id: string; guildId: string; action: "start" | "end"; requestedBy: string }>;

/** Persistance des raids, de l'état d'avant le verrouillage, et de la file de demandes du panneau. */
export interface RaidStore {
  /** Enregistre un raid ; `null` si le serveur en a déjà un en cours (un seul à la fois). */
  start(raid: NewRaid): Promise<Raid | null>;

  /** Raids en cours, tous serveurs (reprise après un redémarrage). */
  active(): Promise<readonly Raid[]>;

  find(raidId: string): Promise<Raid | null>;

  /** Ajoute aux compteurs du raid. */
  addCounts(raidId: string, counts: RaidCounts): Promise<void>;

  /**
   * Enregistre, d'un seul tenant et **avant** toute modification, la permission de @everyone de chaque salon à
   * verrouiller et le niveau de vérification d'avant (`null` s'il n'est pas relevé).
   */
  saveLockdown(raidId: string, guildId: string, channels: readonly ChannelSnapshot[], verificationBefore: number | null): Promise<void>;

  /** Ce qui reste à rétablir pour ce raid. */
  lockdown(raidId: string): Promise<Readonly<{ channels: readonly ChannelSnapshot[]; verificationBefore: number | null }>>;

  /** Ce salon est rétabli (ou n'existe plus) : sa copie est supprimée. */
  forgetChannel(raidId: string, channelId: string): Promise<void>;

  /** Clôt le raid ; `false` s'il l'était déjà. */
  end(raidId: string, at: Date, by: string | null): Promise<boolean>;

  /** Demandes en attente, plus anciennes d'abord. */
  pendingCommands(limit: number): Promise<readonly RaidCommand[]>;

  /** Demande du panneau (il l'écrit en SQL avec `panel_request_raid` ; ici pour les tests et le mode mémoire). */
  enqueueCommand(guildId: string, action: "start" | "end", requestedBy: string): Promise<void>;

  finishCommand(id: string, status: "done" | "failed", at: Date, error?: string): Promise<void>;

  /** Supprime les raids clos avant `raidsBefore` et les demandes traitées avant `commandsBefore`. */
  purge(raidsBefore: Date, commandsBefore: Date): Promise<number>;
}
