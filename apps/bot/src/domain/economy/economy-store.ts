import type { Account, LedgerEntry } from "@/domain/economy/economy-types.ts";

/**
 * Ce qu'un changement fait au trésor du serveur, dans la même transaction que le compte :
 * `in` y verse `amount` ; `out` en retire `upTo` au plus, dans la limite de ce qu'il contient (le reste du gain
 * vient de nulle part : le trésor ne passe jamais sous zéro).
 */
export type TreasuryMove = Readonly<
  { kind: "in"; amount: number; reason: string } | { kind: "out"; upTo: number; reason: string }
>;

export type Mutation = Readonly<{
  /** Nouvel état du compte. */
  account: Account;
  /** Entrée de grand livre correspondant à ce changement. */
  entry: LedgerEntry;
  /** Mouvement du trésor lié à ce changement, le cas échéant. */
  treasury?: TreasuryMove;
}>;

export type TransactionResult = Readonly<{
  account: Account;
  entry: LedgerEntry;
  /** `true` si la clé d'idempotence était déjà connue : rien n'a été réécrit. */
  replayed: boolean;
}>;

/** Résultat d'un virement : les deux côtés, rejoués ensemble si la clé était déjà connue. */
export type TransferResult = Readonly<{ from: TransactionResult; to: TransactionResult }>;

/** Persistance de l'économie. Toute écriture passe par `transact` ou `transfer`. */
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

  /**
   * Virement atomique entre deux comptes : les deux sont verrouillés (dans un ordre fixe, sans interblocage),
   * puis les deux changements et leurs deux entrées de grand livre s'écrivent ensemble ou pas du tout.
   * `fromKey` identifie l'opération : déjà connue, rien n'est réécrit (`replayed`). `fromKey` et `toKey` sont
   * les clés d'idempotence des deux entrées, celles que renvoient `mutateFrom` et `mutateTo`.
   */
  transfer(
    guildId: string,
    fromId: string,
    toId: string,
    fromKey: string,
    toKey: string,
    mutateFrom: (account: Account) => Mutation,
    mutateTo: (account: Account) => Mutation,
  ): Promise<TransferResult>;

  /** Pièces que le serveur garde (taxe, mises des jeux) : le trésor. */
  treasury(guildId: string): Promise<number>;

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
