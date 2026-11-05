export type EconomyErrorCode =
  | "invalid_amount"
  | "insufficient_funds"
  | "cooldown"
  | "balance_limit"
  | "self_transfer"
  | "bet_limits";

/** Refus métier attendu (pas un bug) : rien n'est écrit quand elle est levée. */
export class EconomyError extends Error {
  constructor(
    readonly code: EconomyErrorCode,
    readonly details: Readonly<{ remainingMs?: number; available?: number; min?: number; max?: number }> = {},
  ) {
    super(code);
    this.name = "EconomyError";
  }
}
