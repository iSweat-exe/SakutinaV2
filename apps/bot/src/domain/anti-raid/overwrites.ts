/**
 * Verrouillage réversible d'un salon : ce que le bot retire à @everyone et comment il le rend. Les permissions sont
 * des champs de bits Discord (texte décimal, comme l'API). Pur : aucun appel à Discord.
 */

/** Écrire, écrire dans les fils, créer des fils, réagir. */
export const LOCK_BITS =
  (1n << 11n) | // SEND_MESSAGES
  (1n << 38n) | // SEND_MESSAGES_IN_THREADS
  (1n << 35n) | // CREATE_PUBLIC_THREADS
  (1n << 36n) | // CREATE_PRIVATE_THREADS
  (1n << 6n); // ADD_REACTIONS

const SEND_MESSAGES = 1n << 11n;

/** La permission de @everyone sur un salon telle qu'elle était, ou est : `null` = aucune surcharge. */
export type Overwrite = Readonly<{ allow: string; deny: string }> | null;

/** Ce qui est enregistré avant de verrouiller un salon. */
export type ChannelSnapshot = Readonly<{ channelId: string; overwrite: Overwrite }>;

const bits = (value: string) => BigInt(value);

/** Un salon où @everyone n'a déjà plus le droit d'écrire n'est pas touché (rien à rendre ensuite). */
export function alreadyLocked(current: Overwrite): boolean {
  return current !== null && (bits(current.deny) & SEND_MESSAGES) !== 0n;
}

/** La surcharge à poser : les autres bits restent tels quels, ceux du verrouillage passent en « refusé ». */
export function lockedOverwrite(current: Overwrite): { allow: string; deny: string } {
  const allow = current ? bits(current.allow) : 0n;
  const deny = current ? bits(current.deny) : 0n;

  return { allow: String(allow & ~LOCK_BITS), deny: String(deny | LOCK_BITS) };
}

/**
 * La surcharge à rétablir : les bits du verrouillage reprennent exactement leur état d'avant ; les autres gardent leur
 * état actuel (un changement fait pendant le raid n'est pas effacé). `null` : supprimer la surcharge (il n'y en avait
 * pas et il ne reste rien).
 */
export function restoredOverwrite(before: Overwrite, current: Overwrite): { allow: string; deny: string } | null {
  const nowAllow = current ? bits(current.allow) : 0n;
  const nowDeny = current ? bits(current.deny) : 0n;
  const wasAllow = before ? bits(before.allow) : 0n;
  const wasDeny = before ? bits(before.deny) : 0n;

  const allow = (nowAllow & ~LOCK_BITS) | (wasAllow & LOCK_BITS);
  const deny = (nowDeny & ~LOCK_BITS) | (wasDeny & LOCK_BITS);

  if (before === null && allow === 0n && deny === 0n) {
    return null;
  }

  return { allow: String(allow), deny: String(deny) };
}
