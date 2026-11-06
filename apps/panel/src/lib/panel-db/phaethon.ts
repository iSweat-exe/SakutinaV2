import "server-only";
import { parseBanRequest, parsePhaethon, parsePhaethonTop, parseReview, type Phaethon, type PhaethonTop, type Review } from "./phaethon-schema";
import { callGuildFunction } from "./rpc";

/** One server's Phaethon watchlist, with the signed-in user's session. Throws PanelForbiddenError / PanelDataError. */
export function getPhaethon(guildId: string): Promise<Phaethon> {
  return callGuildFunction("panel_phaethon", guildId, {}, parsePhaethon);
}

/** Records an administrator's decision on an account ("clear" removes it). */
export function setReview(guildId: string, memberId: string, status: Review | "clear"): Promise<Review | "clear"> {
  return callGuildFunction("panel_set_phaethon_review", guildId, { p_member_id: memberId, p_status: status }, parseReview);
}

/** Asks the bot to ban an account. The database refuses the owner, the server's administrators and the caller. */
export function requestBan(guildId: string, memberId: string, reason: string): Promise<"pending"> {
  return callGuildFunction("panel_request_ban", guildId, { p_member_id: memberId, p_reason: reason }, parseBanRequest);
}

/** The dashboard's Phaethon card: the `limit` highest scores and how many accounts are flagged. */
export function getPhaethonTop(guildId: string, limit = 3): Promise<PhaethonTop> {
  return callGuildFunction("panel_phaethon_top", guildId, { p_limit: limit }, parsePhaethonTop);
}
