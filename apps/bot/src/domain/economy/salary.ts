import {
  DAILY_SHARE_PERCENT,
  DAILY_STREAK_BONUS_PERCENT,
  DAILY_STREAK_CAP,
  WORK_EXPECTED_PER_DAY,
  WORK_SPREAD_MAX_PERCENT,
  WORK_SPREAD_MIN_PERCENT,
} from "@/domain/economy/economy-rules.ts";
import type { SalaryDay } from "@/domain/economy/pools.ts";

/**
 * Salaires en circuit fermé : chaque jour, la réserve consacre `budgetPermille` ‰ de son solde aux salaires. Ce
 * budget est partagé entre les membres actifs (ceux qui ont travaillé ou réclamé leur récompense dans les 7 derniers
 * jours) : le débit de la réserve ne dépend pas du nombre de joueurs, et l'ordre des réclamations ne change pas la
 * part de chacun. Quand le budget du jour est épuisé, plus rien n'est versé jusqu'au lendemain.
 */

/** Le budget du jour, fixé à la première réclamation : `budgetPermille` ‰ de la réserve, arrondi vers le bas. */
export function salaryBudget(salary: SalaryDay, reserve: number, budgetPermille: number): number {
  return salary.budget ?? Math.floor((Math.max(reserve, 0) * budgetPermille) / 1000);
}

/** Part d'une récompense quotidienne : 40 % du budget partagé entre les actifs, avec le bonus de série. */
export function dailyShare(budget: number, active: number, streak: number): number {
  const base = Math.floor((budget * DAILY_SHARE_PERCENT) / 100 / Math.max(active, 1));
  const bonus = 100 + DAILY_STREAK_BONUS_PERCENT * (Math.min(streak, DAILY_STREAK_CAP) - 1);

  return Math.floor((base * bonus) / 100);
}

/** Part d'un travail : le reste du budget, partagé entre les actifs et les travaux attendus, entre 50 et 150 %. */
export function workShare(budget: number, active: number, random: () => number): number {
  const mean = Math.floor((budget * (100 - DAILY_SHARE_PERCENT)) / 100 / (Math.max(active, 1) * WORK_EXPECTED_PER_DAY));
  const spread = WORK_SPREAD_MIN_PERCENT + Math.floor(random() * (WORK_SPREAD_MAX_PERCENT - WORK_SPREAD_MIN_PERCENT + 1));

  return Math.floor((mean * spread) / 100);
}

/**
 * Ce qu'un salaire verse vraiment : la part voulue, sans dépasser ce qui reste du budget du jour ni la réserve.
 * Renvoie le montant et le nouvel état du budget.
 */
export function paySalary(
  salary: SalaryDay,
  reserve: number,
  budgetPermille: number,
  wanted: number,
): Readonly<{ amount: number; salary: SalaryDay }> {
  const budget = salaryBudget(salary, reserve, budgetPermille);
  const amount = Math.max(0, Math.min(wanted, budget - salary.paid, reserve));

  return { amount, salary: { ...salary, budget, paid: salary.paid + amount } };
}
