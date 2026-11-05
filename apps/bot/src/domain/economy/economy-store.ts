import type { Account, LedgerEntry } from "@/domain/economy/economy-types.ts";

export type Mutation = Readonly<{
  /** Nouvel état du compte. */
  account: Account;
  /** Entrée de grand livre correspondant à ce changement. */
  entry: LedgerEntry;
}>;

export type TransactionResult = Readonly<{
  account: Account;
  entry: LedgerEntry;
  /** `true` si la clé d'idempotence était déjà connue : rien n'a été réécrit. */
  replayed: boolean;
}>;

/** Persistance de l'économie. Toute écriture passe par `transact`. */
export interface EconomyStore {
  find(guildId: string, memberId: string): Promise<Account | null>;

  /**
   * Opération atomique et sérialisée par compte : verrouille le compte, rejoue
   * le résultat si `idempotencyKey` est déjà enregistrée, sinon appelle `mutate`
   * puis écrit le compte et l'entrée de grand livre ensemble. Si `mutate`
   * lève une erreur, rien n'est écrit.
   */
  transact(
    guildId: string,
    memberId: string,
    idempotencyKey: string,
    mutate: (account: Account) => Mutation,
  ): Promise<TransactionResult>;

  /** Comptes classés par richesse totale (portefeuille + banque), les plus riches d'abord. */
  leaderboard(guildId: string, limit: number): Promise<readonly Account[]>;

  /** Entrées du membre, plus récentes d'abord ; `offset` saute les `offset` plus récentes. */
  history(
    guildId: string,
    memberId: string,
    limit: number,
    offset?: number,
  ): Promise<readonly LedgerEntry[]>;
}
