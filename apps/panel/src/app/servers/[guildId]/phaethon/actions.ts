"use server";

import { guildIdOrNotFound } from "@/lib/guild-id";
import { PanelDataError, PanelForbiddenError } from "@/lib/panel-db/errors";
import { requestBan, setReview } from "@/lib/panel-db/phaethon";
import { BAN_REASON_MAX, type Review } from "@/lib/panel-db/phaethon-schema";

export type ActionError = "forbidden" | "invalid" | "unavailable";
export type ReviewResult = Readonly<{ ok: true; status: Review | "clear" }> | Readonly<{ ok: false; error: ActionError }>;
export type BanResult = Readonly<{ ok: true }> | Readonly<{ ok: false; error: ActionError }>;

const MEMBER_ID = /^\d{5,25}$/;

function failure(error: unknown): { ok: false; error: ActionError } {
  if (error instanceof PanelForbiddenError) {
    return { ok: false, error: "forbidden" };
  }

  return { ok: false, error: error instanceof PanelDataError && /invalid/.test(error.message) ? "invalid" : "unavailable" };
}

/**
 * Watch, dismiss or clear an account on one server's watchlist. Runs with the signed-in user's session: the
 * database decides whether they manage this server and logs the decision under their name.
 */
export async function review(guildId: string, memberId: string, status: Review | "clear"): Promise<ReviewResult> {
  const id = guildIdOrNotFound(guildId);

  if (!MEMBER_ID.test(memberId) || (status !== "watch" && status !== "dismissed" && status !== "clear")) {
    return { ok: false, error: "invalid" };
  }

  try {
    return { ok: true, status: await setReview(id, memberId, status) };
  } catch (error) {
    return failure(error);
  }
}

/** Asks the bot to ban an account of one server. The bot does it within seconds and logs it under the caller's name. */
export async function ban(guildId: string, memberId: string, reason: string): Promise<BanResult> {
  const id = guildIdOrNotFound(guildId);
  const trimmed = typeof reason === "string" ? reason.trim() : "";

  if (!MEMBER_ID.test(memberId) || trimmed.length === 0 || trimmed.length > BAN_REASON_MAX) {
    return { ok: false, error: "invalid" };
  }

  try {
    await requestBan(id, memberId, trimmed);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
