export type EconomyErrorCode =
  | "invalid_amount"
  | "insufficient_funds"
  | "cooldown"
  | "balance_limit"
  | "self_transfer"
  | "bet_limits"
  | "game_closed"
  /** Le budget des salaires du jour est épuisé (ou la réserve est vide). */
  | "salary_exhausted"
  /** La réserve ne contient pas assez pour racheter ces actions. */
  | "reserve_short"
  /** Le casino ne peut pas couvrir la partie (compte trop bas, ou perte maximale du jour atteinte). */
  | "casino_limit"
  /** Pas assez d'actions à acheter (serveur) ou à vendre (membre). */
  | "shares_unavailable";

/** Refus métier attendu (pas un bug) : rien n'est écrit quand elle est levée. */
export class EconomyError extends Error {
  constructor(
    readonly code: EconomyErrorCode,
    readonly details: Readonly<{ remainingMs?: number; available?: number; min?: number; max?: number; game?: string; shares?: number }> = {},
  ) {
    super(code);
    this.name = "EconomyError";
  }
}
