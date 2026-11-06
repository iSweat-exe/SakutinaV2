import type { Account, LedgerEntry } from "@/domain/economy/economy-types.ts";
import type { InterestCandidate, InterestPlan } from "@/domain/economy/interest.ts";
import type { PoolChange, Pools } from "@/domain/economy/pools.ts";
import type { WeeklyInput, WeeklyPlan } from "@/domain/economy/weekly.ts";

export type Mutation = Readonly<{
  /** Nouvel état du compte. */
  account: Account;
  /** Entrée de grand livre correspondant à ce changement. */
  entry: LedgerEntry;
  /**
   * Ce que le changement fait aux caisses du serveur, dans la même transaction. La base refuse tout ce qui ferait
   * passer une caisse sous zéro : aucune pièce n'est créée.
   */
  pools?: PoolChange;
}>;

export type TransactionResult = Readonly<{
  account: Account;
  entry: LedgerEntry;
  /** `true` si la clé d'idempotence était déjà connue : rien n'a été réécrit. */
  replayed: boolean;
}>;

/** Résultat d'un virement : les deux côtés, rejoués ensemble si la clé était déjà connue. */
export type TransferResult = Readonly<{ from: TransactionResult; to: TransactionResult }>;

export type TransactOptions = Readonly<{
  /** Instant de l'opération (l'horloge du service) : il fixe le jour du casino. Sans lui, maintenant. */
  at?: Date;
  /**
   * Jour (UTC) des salaires : si le budget enregistré date d'un autre jour, la base fournit un budget neuf (`budget`
   * à `null`, rien de versé) et compte les membres actifs des 7 derniers jours.
   */
  salaryDay?: string;
}>;

/** Persistance de l'économie. Toute écriture passe par ces méthodes, chacune atomique. */
export interface EconomyStore {
  find(guildId: string, memberId: string): Promise<Account | null>;

  /**
   * Opération atomique et sérialisée par compte : verrouille le compte puis les caisses du serveur, rejoue le
   * résultat si `idempotencyKey` est déjà enregistrée, sinon appelle `mutate` avec l'état des caisses puis écrit le
   * compte, l'entrée de grand livre et les caisses ensemble. Si `mutate` lève une erreur, rien n'est écrit.
   */
  transact(
    guildId: string,
    memberId: string,
    idempotencyKey: string,
    mutate: (account: Account, pools: Pools) => Mutation,
    options?: TransactOptions,
  ): Promise<TransactionResult>;

  /**
   * Virement atomique entre deux comptes : les deux sont verrouillés (dans un ordre fixe, sans interblocage), puis les
   * caisses, puis les deux changements et leurs deux entrées de grand livre s'écrivent ensemble ou pas du tout.
   * `fromKey` identifie l'opération : déjà connue, rien n'est réécrit (`replayed`).
   */
  transfer(
    guildId: string,
    fromId: string,
    toId: string,
    fromKey: string,
    toKey: string,
    mutateFrom: (account: Account, pools: Pools) => Mutation,
    mutateTo: (account: Account, pools: Pools) => Mutation,
  ): Promise<TransferResult>;

  /**
   * Verse les intérêts d'un jour (`day`, `AAAA-MM-JJ`) en une seule transaction : si ce jour est déjà réglé pour le
   * serveur, ne fait rien et renvoie `null`. Sinon fournit à `plan` chaque compte avec sa banque d'aujourd'hui et celle
   * de `since`, et le solde de la réserve, puis écrit les versements et la sortie de la réserve.
   */
  accrueInterest(
    guildId: string,
    day: string,
    since: Date,
    now: Date,
    plan: (candidates: readonly InterestCandidate[], reserve: number) => InterestPlan,
  ): Promise<InterestRun | null>;

  /**
   * Passage hebdomadaire (`week`, le dimanche `AAAA-MM-JJ`) : une seule fois par serveur et par semaine (`null`
   * ensuite). Fournit les comptes, le résultat du casino et ses actions à `plan`, puis écrit l'impôt, les dividendes,
   * l'impôt du casino et remet à zéro le résultat de la semaine, d'un seul tenant.
   */
  weekly(guildId: string, week: string, now: Date, plan: (input: WeeklyInput) => WeeklyPlan): Promise<WeeklyPlan | null>;

  /**
   * Dotation d'arrivée : verse `amount` à la réserve pour un membre qui arrive pour la première fois (journalisée
   * `arrival`). `false` si ce membre l'a déjà apportée.
   */
  mintArrival(guildId: string, memberId: string, amount: number, at: Date): Promise<boolean>;

  /**
   * `/me forget` pour l'économie : le solde du membre retourne à la réserve, ses actions au serveur, puis son compte
   * et son grand livre sont effacés et son identifiant retiré des journaux des caisses.
   */
  forget(guildId: string, memberId: string, at: Date): Promise<Readonly<{ returned: number; shares: number }>>;

  /** État des caisses du serveur à l'instant `at` (créées à la première lecture, avec leurs dotations). */
  pools(guildId: string, at?: Date): Promise<Pools>;

  /** Cours de l'action Casino (centièmes) à la fin de la dernière période de 15 min avant `at`, ou `null`. */
  priceBefore(guildId: string, at: Date): Promise<number | null>;

  /** Efface les bougies de 15 min antérieures à `before` (celles du jour restent) ; renvoie leur nombre. */
  purgeCandles(before: Date): Promise<number>;

  /** Comptes classés par richesse totale (portefeuille + banque), les plus riches d'abord. */
  leaderboard(guildId: string, limit: number): Promise<readonly Account[]>;

  /** Entrées du membre, plus récentes d'abord ; `offset` saute les `offset` plus récentes. */
  history(guildId: string, memberId: string, limit: number, offset?: number): Promise<readonly LedgerEntry[]>;
}

/** Ce qu'une distribution d'intérêts a fait. */
export type InterestRun = Readonly<{ members: number; wanted: number; paid: number }>;
