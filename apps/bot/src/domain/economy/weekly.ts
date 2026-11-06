import {
  CASINO_TAX_PERCENT,
  DIVIDEND_PERCENT,
  IDLE_AFTER_MS,
  WEALTH_TAX_FLOOR,
  WEALTH_TAX_MEDIAN_MULTIPLE,
} from "@/domain/economy/economy-rules.ts";

/**
 * Le passage hebdomadaire (dimanche, UTC) d'un serveur : impôt sur la fortune, puis partage du bénéfice du casino.
 * Fonctions pures : la base fournit les comptes et les caisses, et écrit ce que le plan décide, d'un seul tenant.
 */

/** Un compte au moment du passage : ses soldes, ses actions et sa dernière opération (hors versements automatiques). */
export type WeeklyAccount = Readonly<{ memberId: string; wallet: number; bank: number; shares: number; lastActiveAt: Date | null }>;

export type WeeklyInput = Readonly<{
  accounts: readonly WeeklyAccount[];
  /** Ce que le casino a gagné (positif) ou perdu depuis le dernier passage, et la perte reportée des semaines passées. */
  casinoWeekNet: number;
  carriedLoss: number;
  casino: number;
  shares: number;
  /** Actions détenues par le serveur : leurs dividendes vont à la réserve. */
  float: number;
}>;

export type WeeklyPlan = Readonly<{
  /** Impôt prélevé sur chaque compte : d'abord sur le portefeuille, puis sur la banque. */
  taxes: ReadonlyArray<Readonly<{ memberId: string; fromWallet: number; fromBank: number }>>;
  /** Dividendes versés au portefeuille des actionnaires. */
  dividends: ReadonlyArray<Readonly<{ memberId: string; amount: number }>>;
  /** Seuil de l'impôt cette semaine. */
  threshold: number;
  wealthTax: number;
  /** Bénéfice de la semaine après report des pertes (0 si négatif). */
  profit: number;
  /** Total des dividendes (membres + part du serveur) ; le reste de l'arrondi reste au casino. */
  dividendsTotal: number;
  /** Part des dividendes qui revient au serveur pour ses actions, versée à la réserve. */
  serverDividend: number;
  /** Impôt du casino, versé à la réserve. */
  casinoTax: number;
  /** Perte à reporter sur la semaine suivante. */
  carriedLoss: number;
}>;

/** Médiane des fortunes non nulles (portefeuille + banque) ; 0 sans compte. */
export function medianWealth(accounts: readonly WeeklyAccount[]): number {
  const totals = accounts
    .map((account) => account.wallet + account.bank)
    .filter((total) => total > 0)
    .sort((a, b) => a - b);

  if (totals.length === 0) {
    return 0;
  }

  const middle = Math.floor(totals.length / 2);

  return totals.length % 2 === 1 ? totals[middle]! : Math.floor((totals[middle - 1]! + totals[middle]!) / 2);
}

export function planWeekly(input: WeeklyInput, wealthPermille: number, idlePermille: number, now: Date): WeeklyPlan {
  const threshold = Math.max(WEALTH_TAX_FLOOR, WEALTH_TAX_MEDIAN_MULTIPLE * medianWealth(input.accounts));
  const taxes = input.accounts
    .map((account) => {
      const idle = account.lastActiveAt === null || now.getTime() - account.lastActiveAt.getTime() >= IDLE_AFTER_MS;
      const permille = idle ? idlePermille : wealthPermille;
      const amount = Math.floor((Math.max(account.wallet + account.bank - threshold, 0) * permille) / 1000);
      const fromWallet = Math.min(amount, account.wallet);

      return { memberId: account.memberId, fromWallet, fromBank: amount - fromWallet };
    })
    .filter((tax) => tax.fromWallet + tax.fromBank > 0)
    .sort((a, b) => a.memberId.localeCompare(b.memberId));

  const result = input.casinoWeekNet - input.carriedLoss;
  // Le partage (dividendes + impôt) ne dépasse jamais ce que le casino contient.
  const profit = Math.min(Math.max(result, 0), Math.max(input.casino, 0));
  const pool = Math.floor((profit * DIVIDEND_PERCENT) / 100);
  const dividends =
    input.shares > 0
      ? input.accounts
          .filter((account) => account.shares > 0)
          .map((account) => ({ memberId: account.memberId, amount: Math.floor((pool * account.shares) / input.shares) }))
          .filter((dividend) => dividend.amount > 0)
          .sort((a, b) => a.memberId.localeCompare(b.memberId))
      : [];
  const serverDividend = input.shares > 0 ? Math.floor((pool * input.float) / input.shares) : 0;
  const memberDividends = dividends.reduce((sum, dividend) => sum + dividend.amount, 0);

  return {
    taxes,
    dividends,
    threshold,
    wealthTax: taxes.reduce((sum, tax) => sum + tax.fromWallet + tax.fromBank, 0),
    profit,
    dividendsTotal: memberDividends + serverDividend,
    serverDividend,
    casinoTax: Math.floor((profit * CASINO_TAX_PERCENT) / 100),
    carriedLoss: result < 0 ? -result : 0,
  };
}

/** Le dimanche (UTC) de la semaine de `at`, ou `null` si `at` n'est pas un dimanche : le passage n'a lieu que ce jour. */
export function weeklyRunDay(at: Date): string | null {
  return at.getUTCDay() === 0 ? at.toISOString().slice(0, 10) : null;
}
