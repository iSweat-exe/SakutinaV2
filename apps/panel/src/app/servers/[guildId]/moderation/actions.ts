"use server";

import { guildIdOrNotFound } from "@/lib/guild-id";
import { PanelDataError, PanelForbiddenError } from "@/lib/panel-db/errors";
import { revokeSanction, setAutomod } from "@/lib/panel-db/moderation";
import { AUTOMOD_LIMITS, type Automod, type SanctionKind } from "@/lib/panel-db/moderation-schema";

export type ActionError = "forbidden" | "invalid" | "unavailable";
export type SaveAutomodResult = Readonly<{ ok: true; automod: Automod }> | Readonly<{ ok: false; error: ActionError }>;
export type RevokeResult = Readonly<{ ok: true; status: "done" | "pending" }> | Readonly<{ ok: false; error: ActionError }>;

function failure(error: unknown): { ok: false; error: ActionError } {
  if (error instanceof PanelForbiddenError) {
    return { ok: false, error: "forbidden" };
  }

  return { ok: false, error: error instanceof PanelDataError && /invalid/.test(error.message) ? "invalid" : "unavailable" };
}

/**
 * Saves part of the auto-moderation of one server. Runs with the signed-in user's session: the database decides
 * whether they manage this server; this only refuses malformed input early.
 */
export async function saveAutomod(guildId: string, patch: Partial<Automod>): Promise<SaveAutomodResult> {
  const id = guildIdOrNotFound(guildId);
  const flags = [patch.spam, patch.links, patch.words, patch.mentions];
  const words = patch.bannedWords;

  if (
    flags.some((flag) => flag !== undefined && typeof flag !== "boolean") ||
    (patch.muteMinutes !== undefined &&
      !(Number.isInteger(patch.muteMinutes) && patch.muteMinutes >= AUTOMOD_LIMITS.muteMinutes.min && patch.muteMinutes <= AUTOMOD_LIMITS.muteMinutes.max)) ||
    (words !== undefined &&
      (!Array.isArray(words) ||
        words.length > AUTOMOD_LIMITS.bannedWords.count ||
        words.some((word) => typeof word !== "string" || word.length > AUTOMOD_LIMITS.bannedWords.length)))
  ) {
    return { ok: false, error: "invalid" };
  }

  try {
    return { ok: true, automod: await setAutomod(id, patch) };
  } catch (error) {
    return failure(error);
  }
}

/** Lifts a sanction of one server: a warning at once, a mute or ban by asking the bot. */
export async function revoke(guildId: string, kind: SanctionKind, sanctionId: number): Promise<RevokeResult> {
  const id = guildIdOrNotFound(guildId);

  if ((kind !== "mute" && kind !== "ban" && kind !== "warn") || !Number.isInteger(sanctionId) || sanctionId < 1) {
    return { ok: false, error: "invalid" };
  }

  try {
    return { ok: true, status: await revokeSanction(id, kind, sanctionId) };
  } catch (error) {
    return failure(error);
  }
}
