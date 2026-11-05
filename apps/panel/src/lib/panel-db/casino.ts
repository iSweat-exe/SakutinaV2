import "server-only";
import { parseCasino, type Casino, type GameName } from "./casino-schema";
import { callGuildFunction } from "./rpc";

/** One server's casino, with the signed-in user's session. Throws PanelForbiddenError / PanelDataError. */
export function getCasino(guildId: string): Promise<Casino> {
  return callGuildFunction("panel_casino", guildId, {}, parseCasino);
}

/**
 * Opens or closes a game and/or changes its maximum bet; only the given fields change. The database checks the caller
 * manages the server, refuses out-of-range values (PanelDataError with "invalid …") and logs the change with its
 * author. Returns the casino as it is now.
 */
export function setCasinoGame(guildId: string, game: GameName, change: Readonly<{ enabled?: boolean; maxBet?: number }>): Promise<Casino> {
  return callGuildFunction(
    "panel_set_casino_game",
    guildId,
    {
      p_game: game,
      ...(change.enabled !== undefined ? { p_enabled: change.enabled } : {}),
      ...(change.maxBet !== undefined ? { p_max_bet: change.maxBet } : {}),
    },
    parseCasino,
  );
}
