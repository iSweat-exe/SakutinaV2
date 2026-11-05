import "server-only";
import { parseAutomod, parseModeration, parseRevoke, type Automod, type Moderation, type SanctionKind } from "./moderation-schema";
import { callGuildFunction } from "./rpc";

/** One server's moderation, with the signed-in user's session. Throws PanelForbiddenError / PanelDataError. */
export function getModeration(guildId: string): Promise<Moderation> {
  return callGuildFunction("panel_moderation", guildId, {}, parseModeration);
}

/** Changes the auto-moderation. Only the given fields change; the database refuses out-of-range values. */
export function setAutomod(guildId: string, patch: Partial<Automod>): Promise<Automod> {
  const words = patch.bannedWords;

  return callGuildFunction(
    "panel_set_automod",
    guildId,
    {
      ...(patch.spam !== undefined ? { p_spam: patch.spam } : {}),
      ...(patch.links !== undefined ? { p_links: patch.links } : {}),
      ...(patch.words !== undefined ? { p_words: patch.words } : {}),
      ...(patch.mentions !== undefined ? { p_mentions: patch.mentions } : {}),
      ...(words !== undefined ? { p_banned_words: [...words] } : {}),
      ...(patch.muteMinutes !== undefined ? { p_mute_minutes: patch.muteMinutes } : {}),
    },
    parseAutomod,
  );
}

/** Lifts a sanction: a warning at once, a mute or ban by asking the bot. */
export function revokeSanction(guildId: string, kind: SanctionKind, id: number): Promise<"done" | "pending"> {
  return callGuildFunction("panel_revoke_sanction", guildId, { p_kind: kind, p_id: id }, parseRevoke);
}
