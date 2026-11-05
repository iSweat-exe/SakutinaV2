"use server";

import { guildIdOrNotFound } from "@/lib/guild-id";
import { PanelDataError, PanelForbiddenError } from "@/lib/panel-db/errors";
import { setEconomyRules } from "@/lib/panel-db/economy";
import { RULE_LIMITS, type EconomyRules } from "@/lib/panel-db/economy-schema";
import { findMembers, payOutTreasury } from "@/lib/panel-db/treasury";
import { PAYOUT_LIMITS, type MemberHit } from "@/lib/panel-db/treasury-schema";

export type SaveRulesResult =
  | Readonly<{ ok: true; rules: EconomyRules }>
  | Readonly<{ ok: false; error: "forbidden" | "invalid" | "unavailable" }>;

const isCount = (value: unknown, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max;

/**
 * Saves the economy rules of one server. The server action runs with the signed-in user's session:
 * the database decides whether they manage this server; this only refuses malformed input early.
 */
export async function saveEconomyRules(guildId: string, rules: EconomyRules): Promise<SaveRulesResult> {
  const id = guildIdOrNotFound(guildId);
  const name = typeof rules.currencyName === "string" ? rules.currencyName.trim() : "";

  if (
    !name ||
    name.length > RULE_LIMITS.currencyName.max ||
    !isCount(rules.dailyReward, RULE_LIMITS.dailyReward.max) ||
    !isCount(rules.startingBalance, RULE_LIMITS.startingBalance.max) ||
    !isCount(rules.transferTaxPercent, RULE_LIMITS.transferTaxPercent.max)
  ) {
    return { ok: false, error: "invalid" };
  }

  try {
    return { ok: true, rules: await setEconomyRules(id, { ...rules, currencyName: name }) };
  } catch (error) {
    if (error instanceof PanelForbiddenError) {
      return { ok: false, error: "forbidden" };
    }

    return { ok: false, error: error instanceof PanelDataError && /invalid/.test(error.message) ? "invalid" : "unavailable" };
  }
}

export type PayOutResult =
  | Readonly<{ ok: true; balance: number }>
  | Readonly<{ ok: false; error: "forbidden" | "invalid" | "insufficient" | "limit" | "unavailable" }>;

/** Pays a sum from the treasury to a member. The database decides who may; this refuses malformed input early. */
export async function payOutFromTreasury(guildId: string, memberId: string, amount: number, note: string): Promise<PayOutResult> {
  const id = guildIdOrNotFound(guildId);
  const reason = typeof note === "string" ? note.trim() : "";

  if (
    typeof memberId !== "string" ||
    !/^\d{5,25}$/.test(memberId) ||
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    amount > PAYOUT_LIMITS.amountMax ||
    reason.length > PAYOUT_LIMITS.noteMax
  ) {
    return { ok: false, error: "invalid" };
  }

  try {
    return { ok: true, balance: (await payOutTreasury(id, memberId, amount, reason)).balance };
  } catch (error) {
    if (error instanceof PanelForbiddenError) {
      return { ok: false, error: "forbidden" };
    }

    if (error instanceof PanelDataError) {
      if (/insufficient treasury/.test(error.message)) {
        return { ok: false, error: "insufficient" };
      }
      if (/balance limit/.test(error.message)) {
        return { ok: false, error: "limit" };
      }
      if (/invalid/.test(error.message)) {
        return { ok: false, error: "invalid" };
      }
    }

    return { ok: false, error: "unavailable" };
  }
}

/** Members matching what the administrator typed. Never throws: no result is the same as a failed search. */
export async function searchMembers(guildId: string, query: string): Promise<MemberHit[]> {
  const id = guildIdOrNotFound(guildId);
  const text = typeof query === "string" ? query.trim().slice(0, 40) : "";

  if (text.length < 2) {
    return [];
  }

  return findMembers(id, text).catch(() => []);
}
