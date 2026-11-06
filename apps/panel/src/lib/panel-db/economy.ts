import "server-only";
import { parseEconomy, parseRules, type Economy, type EconomyRules } from "./economy-schema";
import { callGuildFunction } from "./rpc";

/** One server's economy, with the signed-in user's session. Throws PanelForbiddenError / PanelDataError. */
export function getEconomy(guildId: string): Promise<Economy> {
  return callGuildFunction("panel_economy", guildId, {}, parseEconomy);
}

/**
 * Changes the server's economy rules. The database checks the caller manages the server and refuses
 * out-of-range values (PanelDataError with "invalid …"). Only the given fields change.
 */
export function setEconomyRules(guildId: string, rules: Partial<EconomyRules>): Promise<EconomyRules> {
  return callGuildFunction(
    "panel_set_economy_rules",
    guildId,
    {
      ...(rules.currencyName !== undefined ? { p_currency_name: rules.currencyName } : {}),
      ...(rules.salaryBudgetPermille !== undefined ? { p_salary_budget_permille: rules.salaryBudgetPermille } : {}),
      ...(rules.startingBalance !== undefined ? { p_starting_balance: rules.startingBalance } : {}),
      ...(rules.transferTaxPercent !== undefined ? { p_transfer_tax_percent: rules.transferTaxPercent } : {}),
      ...(rules.bankInterestPermille !== undefined ? { p_bank_interest_permille: rules.bankInterestPermille } : {}),
      ...(rules.wealthTaxPermille !== undefined ? { p_wealth_tax_permille: rules.wealthTaxPermille } : {}),
      ...(rules.idleTaxPermille !== undefined ? { p_idle_tax_permille: rules.idleTaxPermille } : {}),
    },
    parseRules,
  );
}
