"use server";

import { guildIdOrNotFound } from "@/lib/guild-id";
import { PanelDataError, PanelForbiddenError } from "@/lib/panel-db/errors";
import { setEconomyRules } from "@/lib/panel-db/economy";
import { RULE_LIMITS, type EconomyRules } from "@/lib/panel-db/economy-schema";

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
