export type Account = Readonly<{
  guildId: string;
  memberId: string;
  wallet: number;
  bank: number;
  lastWorkAt: Date | null;
  /** Dernière récompense quotidienne réclamée. */
  lastDailyAt: Date | null;
  /** Jours consécutifs de récompense quotidienne. */
  dailyStreak: number;
}>;

export type LedgerKind = "earn" | "spend" | "deposit" | "withdraw";

/** Entrée immuable du grand livre ; `amount` est toujours positif. */
export type LedgerEntry = Readonly<{
  id: string;
  guildId: string;
  memberId: string;
  kind: LedgerKind;
  amount: number;
  walletAfter: number;
  bankAfter: number;
  reason: string;
  idempotencyKey: string;
  createdAt: Date;
}>;

export function emptyAccount(guildId: string, memberId: string): Account {
  return { guildId, memberId, wallet: 0, bank: 0, lastWorkAt: null, lastDailyAt: null, dailyStreak: 0 };
}
