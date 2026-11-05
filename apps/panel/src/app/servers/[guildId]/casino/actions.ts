"use server";

import { guildIdOrNotFound } from "@/lib/guild-id";
import { setCasinoGame } from "@/lib/panel-db/casino";
import { BET_LIMITS, GAMES, type Casino, type GameName } from "@/lib/panel-db/casino-schema";
import { PanelDataError, PanelForbiddenError } from "@/lib/panel-db/errors";

export type SaveGameResult =
  | Readonly<{ ok: true; casino: Casino }>
  | Readonly<{ ok: false; error: "forbidden" | "invalid" | "unavailable" }>;

/**
 * Opens or closes one game and/or changes its maximum bet. The server action runs with the signed-in user's session:
 * the database decides whether they manage this server; this only refuses malformed input early.
 */
export async function saveCasinoGame(
  guildId: string,
  game: GameName,
  change: Readonly<{ enabled?: boolean; maxBet?: number }>,
): Promise<SaveGameResult> {
  const id = guildIdOrNotFound(guildId);
  const { enabled, maxBet } = change ?? {};

  if (
    !GAMES.includes(game) ||
    (enabled === undefined && maxBet === undefined) ||
    (enabled !== undefined && typeof enabled !== "boolean") ||
    (maxBet !== undefined && (!Number.isSafeInteger(maxBet) || maxBet < BET_LIMITS.min || maxBet > BET_LIMITS.ceiling))
  ) {
    return { ok: false, error: "invalid" };
  }

  try {
    return { ok: true, casino: await setCasinoGame(id, game, { enabled, maxBet }) };
  } catch (error) {
    if (error instanceof PanelForbiddenError) {
      return { ok: false, error: "forbidden" };
    }

    return { ok: false, error: error instanceof PanelDataError && /invalid/.test(error.message) ? "invalid" : "unavailable" };
  }
}
