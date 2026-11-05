import "server-only";
import { callGuildFunction } from "./rpc";
import { parseMemberHits, parsePayout, parseTreasury, type MemberHit, type Treasury } from "./treasury-schema";

/** One server's treasury, with the signed-in user's session. Throws PanelForbiddenError / PanelDataError. */
export function getTreasury(guildId: string): Promise<Treasury> {
  return callGuildFunction("panel_treasury", guildId, {}, parseTreasury);
}

/** Members the bot knows, by name (two letters at least) or exact Discord id: who can receive a pay out. */
export function findMembers(guildId: string, query: string): Promise<MemberHit[]> {
  return callGuildFunction("panel_find_members", guildId, { p_query: query }, parseMemberHits);
}

/**
 * Pays `amount` from the treasury to a member's wallet. The database refuses (PanelDataError with
 * "invalid …", "insufficient treasury" or "balance limit") instead of clamping; the action is audited with its author.
 */
export function payOutTreasury(guildId: string, memberId: string, amount: number, note: string) {
  return callGuildFunction(
    "panel_treasury_pay_out",
    guildId,
    { p_member_id: memberId, p_amount: amount, ...(note ? { p_note: note } : {}) },
    parsePayout,
  );
}
