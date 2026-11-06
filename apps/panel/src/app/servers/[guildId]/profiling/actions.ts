"use server";

import { guildIdOrNotFound } from "@/lib/guild-id";
import { PanelForbiddenError } from "@/lib/panel-db/errors";
import { getProfiling } from "@/lib/panel-db/profiling";
import { PROFILING_QUERY_MAX, type MemberProfile } from "@/lib/panel-db/profiling-schema";

export type SearchResult =
  | Readonly<{ ok: true; query: string; members: ReadonlyArray<MemberProfile> }>
  | Readonly<{ ok: false; error: "forbidden" | "invalid" | "unavailable" }>;

/**
 * Finds members of one server by name, username or id, beyond the most active ones loaded with the page. Runs with
 * the signed-in user's session: the database decides whether they manage this server.
 */
export async function searchMembers(guildId: string, query: string): Promise<SearchResult> {
  const id = guildIdOrNotFound(guildId);
  const trimmed = typeof query === "string" ? query.trim() : "";

  if (trimmed.length < 2 || trimmed.length > PROFILING_QUERY_MAX) {
    return { ok: false, error: "invalid" };
  }

  try {
    const result = await getProfiling(id, trimmed);
    return { ok: true, query: trimmed, members: result.members };
  } catch (error) {
    return { ok: false, error: error instanceof PanelForbiddenError ? "forbidden" : "unavailable" };
  }
}
