import { INTEREST_BASE_CAP, INTEREST_TREASURY_SHARE_PERCENT, MAX_BALANCE } from "@/domain/economy/economy-rules.ts";
import type { Account, LedgerEntry } from "@/domain/economy/economy-types.ts";

/**
 * Un compte qui a de l'argent en banque : `bank` aujourd'hui et `bankBefore`, ce qu'il y avait il y a 24 h
 * (0 sans écriture avant). Seul ce qui est resté en banque toute la journée rapporte.
 */
export type InterestCandidate = Readonly<{ memberId: string; bank: number; bankBefore: number }>;

export type InterestPlan = Readonly<{
  payouts: ReadonlyArray<Readonly<{ memberId: string; amount: number }>>;
  /** Total au taux plein. */
  wanted: number;
  /** Total versé : `wanted`, ou moins si le trésor ne suffit pas. */
  paid: number;
}>;

/**
 * Calcule les intérêts du jour. Chacun reçoit `permille` ‰ de `min(banque aujourd'hui, banque il y a 24 h,
 * plafond)`, arrondi à l'inférieur. Ils sont **payés par le trésor** : la distribution ne dépasse jamais
 * `INTEREST_TREASURY_SHARE_PERCENT` % de son solde, et si le total dépasse cette limite, chaque part est réduite dans
 * la même proportion. Aucune pièce n'est créée : un trésor vide ne verse rien.
 */
export function planInterest(candidates: readonly InterestCandidate[], permille: number, treasury: number): InterestPlan {
  const wantedBy = candidates
    .map((candidate) => ({
      memberId: candidate.memberId,
      wanted: Math.floor((Math.min(candidate.bank, candidate.bankBefore, INTEREST_BASE_CAP) * permille) / 1000),
    }))
    .filter((entry) => entry.wanted > 0)
    .sort((a, b) => a.memberId.localeCompare(b.memberId));
  const wanted = wantedBy.reduce((sum, entry) => sum + entry.wanted, 0);
  const budget = Math.floor((Math.max(treasury, 0) * INTEREST_TREASURY_SHARE_PERCENT) / 100);
  // Une part vaut au plus INTEREST_BASE_CAP × 5 % = 5 000, le budget au plus 2,5 × 10¹¹ : le produit reste un entier sûr.
  const payouts = wantedBy
    .map((entry) => ({ memberId: entry.memberId, amount: wanted <= budget ? entry.wanted : Math.floor((entry.wanted * budget) / wanted) }))
    .filter((payout) => payout.amount > 0);

  return { payouts, wanted, paid: payouts.reduce((sum, payout) => sum + payout.amount, 0) };
}

/** Le compte après versement des intérêts (au portefeuille) et l'écriture du grand livre ; `null` si le plafond de solde serait dépassé. */
export function creditInterest(
  account: Account,
  amount: number,
  day: string,
  now: Date,
): Readonly<{ account: Account; entry: LedgerEntry }> | null {
  if (account.wallet + amount > MAX_BALANCE) {
    return null;
  }

  const next: Account = { ...account, wallet: account.wallet + amount };

  return {
    account: next,
    entry: {
      id: crypto.randomUUID(),
      guildId: account.guildId,
      memberId: account.memberId,
      kind: "earn",
      amount,
      walletAfter: next.wallet,
      bankAfter: next.bank,
      reason: "interest",
      idempotencyKey: `interest:${day}:${account.memberId}`,
      createdAt: now,
    },
  };
}
