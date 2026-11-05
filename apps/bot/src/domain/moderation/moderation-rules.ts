import { ROLES, type Role } from "@/domain/permissions/permissions.ts";
import type { Refusal } from "./moderation-types.ts";

/** Les avertissements sont conservés un an (ou jusqu'à ce qu'un administrateur les retire). */
export const WARNING_RETENTION_DAYS = 365;

/** Longueur maximale d'un motif. */
export const MAX_REASON_LENGTH = 300;

const MINUTE_MS = 60_000;
/** Limites de Discord pour un timeout : de 1 minute à 28 jours. */
export const MIN_TIMEOUT_MS = MINUTE_MS;
export const MAX_TIMEOUT_MS = 28 * 24 * 60 * MINUTE_MS;

const units: Readonly<Record<string, number>> = {
  m: MINUTE_MS,
  min: MINUTE_MS,
  h: 60 * MINUTE_MS,
  d: 24 * 60 * MINUTE_MS,
  j: 24 * 60 * MINUTE_MS,
};

/**
 * Durée saisie par un modérateur : « 30m », « 2h », « 7d » (ou « 7j »). Sans unité,
 * ce sont des minutes. Renvoie `null` si le texte est illisible ou hors des bornes de Discord.
 */
export function parseDuration(input: string): number | null {
  const match = /^\s*(\d{1,6})\s*([a-zA-Z]*)\s*$/.exec(input);

  if (!match) {
    return null;
  }

  const unit = (match[2] ?? "").toLowerCase() || "m";
  const factor = units[unit];

  if (factor === undefined) {
    return null;
  }

  const duration = Number(match[1]) * factor;

  return duration >= MIN_TIMEOUT_MS && duration <= MAX_TIMEOUT_MS ? duration : null;
}

export type Party = Readonly<{
  id: string;
  /** Rôle du bot (member < moderator < admin < owner). */
  role: Role;
  isGuildOwner: boolean;
  /** Position du plus haut rôle Discord. */
  position: number;
}>;

export type SanctionContext = Readonly<{
  actor: Party;
  targetId: string;
  /** `null` : la cible n'est pas (ou plus) sur le serveur, seul un bannissement par identifiant est possible. */
  target: Party | null;
  botId: string;
  /** Discord autorise le bot à agir sur la cible (`kickable`, `bannable`, `moderatable`). */
  botCanAct: boolean;
}>;

/**
 * Garde-fous communs à toutes les sanctions. On ne se sanctionne pas soi-même, ni le bot,
 * ni le propriétaire ; on ne sanctionne que plus bas que soi, au sens du rôle du bot comme
 * de la hiérarchie des rôles Discord ; et le bot lui-même doit pouvoir agir.
 */
export function evaluateSanction({ actor, targetId, target, botId, botCanAct }: SanctionContext): Refusal | null {
  if (targetId === actor.id) return "self";
  if (targetId === botId) return "bot";

  if (!target) {
    return null;
  }

  if (target.isGuildOwner) return "owner";
  if (ROLES.indexOf(target.role) >= ROLES.indexOf(actor.role)) return "role";
  if (!actor.isGuildOwner && actor.position <= target.position) return "position";
  if (!botCanAct) return "bot-position";

  return null;
}
