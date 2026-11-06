import type {
  EconomyStore,
  InterestRun,
  Mutation,
  TransactOptions,
  TransactionResult,
  TransferResult,
} from "@/domain/economy/economy-store.ts";
import { EconomyError } from "@/domain/economy/economy-error.ts";
import {
  ARRIVAL_ENDOWMENT,
  CASINO_DAILY_LOSS_PERCENT,
  CASINO_MAX_BET_PERCENT,
  CASINO_WORST_CASE_PERCENT,
  DAILY_COOLDOWN_MS,
  DAILY_STREAK_WINDOW_MS,
  IDLE_TAX_MAX_PERMILLE,
  INTEREST_MAX_PERMILLE,
  JACKPOT_SHARE_PERCENT,
  MARKET_FEE_PERCENT,
  MAX_BALANCE,
  SALARY_BUDGET_MAX_PERMILLE,
  WEALTH_TAX_MAX_PERMILLE,
  WORK_COOLDOWN_MS,
} from "@/domain/economy/economy-rules.ts";
import { planInterest } from "@/domain/economy/interest.ts";
import {
  applyMoves,
  casinoBetLimit,
  casinoClosedToday,
  sharePriceCents,
  utcDay,
  type PoolChange,
  type PoolMove,
  type Pools,
} from "@/domain/economy/pools.ts";
import { dailyShare, paySalary, salaryBudget, workShare } from "@/domain/economy/salary.ts";
import { planWeekly, weeklyRunDay, type WeeklyPlan } from "@/domain/economy/weekly.ts";
import { emptyAccount, type Account, type LedgerEntry, type LedgerKind } from "@/domain/economy/economy-types.ts";

type Clock = () => Date;
type Random = () => number;

/** Une partie de casino réglée : le compte après, l'écriture (aucune à égalité) et le jackpot gagné. */
export type CasinoSettled = Readonly<{ account: Account; entry: LedgerEntry | null; replayed: boolean; jackpot: number }>;

/** Ce que coûte ou rapporte un ordre d'actions. */
export type ShareTrade = TransactionResult & Readonly<{ shares: number; value: number; fee: number; priceCents: number }>;

/** Cours de l'action Casino et ce qui le porte. */
export type Market = Readonly<{ priceCents: number; dayAgoCents: number | null; pools: Pools }>;

/**
 * Règles de l'économie en circuit fermé. Aucune dépendance à Discord : une opération économique ne peut pas
 * déclencher d'action de modération. Aucune pièce n'est créée ici : tout gain sort d'une caisse du serveur (réserve,
 * casino, jackpot) ou d'un autre compte, dans la limite de ce qu'elle contient.
 */
export class EconomyService {
  constructor(
    private readonly store: EconomyStore,
    private readonly clock: Clock = () => new Date(),
    private readonly random: Random = Math.random,
  ) {}

  async getAccount(guildId: string, memberId: string): Promise<Account> {
    return (await this.store.find(guildId, memberId)) ?? emptyAccount(guildId, memberId);
  }

  history(guildId: string, memberId: string, limit = 10, offset = 0): Promise<readonly LedgerEntry[]> {
    return this.store.history(guildId, memberId, limit, offset);
  }

  /**
   * Travail, une fois par heure : une part du budget des salaires du jour (`budgetPermille` ‰ de la réserve),
   * partagée entre les membres actifs, entre 50 et 150 % de la part moyenne. Payé par la réserve ; budget épuisé =
   * `salary_exhausted`, et le délai ne démarre pas.
   */
  async work(guildId: string, memberId: string, idempotencyKey: string, budgetPermille: number): Promise<TransactionResult> {
    const now = this.clock();
    const permille = clampPermille(budgetPermille, SALARY_BUDGET_MAX_PERMILLE);

    return this.transact(
      guildId,
      memberId,
      idempotencyKey,
      (account, pools) => {
        if (account.lastWorkAt) {
          const remainingMs = account.lastWorkAt.getTime() + WORK_COOLDOWN_MS - now.getTime();

          if (remainingMs > 0) {
            throw new EconomyError("cooldown", { remainingMs });
          }
        }

        const budget = salaryBudget(pools.salary, pools.reserve, permille);
        const paid = paySalary(pools.salary, pools.reserve, permille, workShare(budget, pools.salary.active, this.random));

        if (paid.amount <= 0) {
          throw new EconomyError("salary_exhausted");
        }

        return this.mutation(account, "earn", paid.amount, "work", idempotencyKey, now, {
          wallet: account.wallet + paid.amount,
          lastWorkAt: now,
        }, { moves: [{ pool: "reserve", amount: -paid.amount, reason: "salary:work" }], salary: paid.salary });
      },
      { salaryDay: utcDay(now) },
    );
  }

  /**
   * Récompense quotidienne avec série : 20 h de délai, la série continue si la précédente date de moins de 48 h.
   * Elle vaut 40 % du budget des salaires du jour partagés entre les actifs, +5 % par jour de série (jusqu'à 10).
   */
  async daily(guildId: string, memberId: string, idempotencyKey: string, budgetPermille: number): Promise<TransactionResult> {
    const now = this.clock();
    const permille = clampPermille(budgetPermille, SALARY_BUDGET_MAX_PERMILLE);

    return this.transact(
      guildId,
      memberId,
      idempotencyKey,
      (account, pools) => {
        let streak = 1;

        if (account.lastDailyAt) {
          const elapsed = now.getTime() - account.lastDailyAt.getTime();

          if (elapsed < DAILY_COOLDOWN_MS) {
            throw new EconomyError("cooldown", { remainingMs: DAILY_COOLDOWN_MS - elapsed });
          }

          if (elapsed <= DAILY_STREAK_WINDOW_MS) {
            streak = account.dailyStreak + 1;
          }
        }

        const budget = salaryBudget(pools.salary, pools.reserve, permille);
        const paid = paySalary(pools.salary, pools.reserve, permille, dailyShare(budget, pools.salary.active, streak));

        if (paid.amount <= 0) {
          throw new EconomyError("salary_exhausted");
        }

        return this.mutation(account, "earn", paid.amount, "daily", idempotencyKey, now, {
          wallet: account.wallet + paid.amount,
          lastDailyAt: now,
          dailyStreak: streak,
        }, { moves: [{ pool: "reserve", amount: -paid.amount, reason: "salary:daily" }], salary: paid.salary });
      },
      { salaryDay: utcDay(now) },
    );
  }

  /**
   * Arrivée d'un membre : la réserve reçoit la dotation d'arrivée (une fois par membre, la seule création d'argent
   * avec la dotation de lancement), puis le membre reçoit le solde de départ (`grantStartingBalance`).
   */
  async welcome(guildId: string, memberId: string, startingBalance: number): Promise<TransactionResult | null> {
    await this.store.mintArrival(guildId, memberId, ARRIVAL_ENDOWMENT, this.clock());

    return this.grantStartingBalance(guildId, memberId, startingBalance);
  }

  /**
   * Solde de départ d'un nouveau membre, payé par la réserve dans la limite de ce qu'elle contient. La clé
   * d'idempotence est propre au membre : un membre qui quitte puis revient ne le reçoit pas une seconde fois. `null`
   * quand rien n'est versé.
   */
  async grantStartingBalance(guildId: string, memberId: string, amount: number): Promise<TransactionResult | null> {
    if (amount <= 0) {
      return null;
    }

    assertAmount(amount);
    const now = this.clock();
    const key = `starting:${guildId}:${memberId}`;

    try {
      return await this.transact(guildId, memberId, key, (account, pools) => {
        const paid = Math.min(amount, pools.reserve);

        if (paid <= 0) {
          throw new EconomyError("salary_exhausted");
        }

        return this.mutation(account, "earn", paid, "starting", key, now, { wallet: account.wallet + paid }, {
          moves: [{ pool: "reserve", amount: -paid, reason: "starting" }],
        });
      });
    } catch (error) {
      if (error instanceof EconomyError && error.code === "salary_exhausted") {
        return null;
      }

      throw error;
    }
  }

  /**
   * Paiement d'un membre à un autre, portefeuille à portefeuille. Le serveur prélève `taxPercent` % (arrondi à
   * l'inférieur), versés à la réserve : l'expéditeur dépense `amount`, le destinataire reçoit le reste.
   */
  async pay(
    guildId: string,
    fromId: string,
    toId: string,
    amount: number,
    taxPercent: number,
    idempotencyKey: string,
  ): Promise<TransferResult & { tax: number; received: number }> {
    assertAmount(amount);

    if (fromId === toId) {
      throw new EconomyError("self_transfer");
    }

    const now = this.clock();
    const tax = Math.floor((amount * Math.min(Math.max(taxPercent, 0), 100)) / 100);
    const received = amount - tax;
    const outKey = idempotencyKey;
    const inKey = `${idempotencyKey}:in`;

    const result = await this.store.transfer(
      guildId,
      fromId,
      toId,
      outKey,
      inKey,
      (account) => {
        if (amount > account.wallet) {
          throw new EconomyError("insufficient_funds", { available: account.wallet });
        }

        return this.mutation(
          account,
          "spend",
          amount,
          `pay:to:${toId}`,
          outKey,
          now,
          { wallet: account.wallet - amount },
          tax > 0 ? { moves: [{ pool: "reserve", amount: tax, reason: "tax" }] } : undefined,
        );
      },
      (account) =>
        this.mutation(account, "earn", received, `pay:from:${fromId}`, inKey, now, { wallet: account.wallet + received }),
    );

    return { ...result, tax, received };
  }

  /**
   * Verse les intérêts de la banque du jour (UTC) à `permille` ‰ par jour, payés par la réserve. Une seule fois par
   * jour et par serveur : un second appel le même jour renvoie `null` sans rien changer.
   */
  accrueInterest(guildId: string, permille: number): Promise<InterestRun | null> {
    if (!Number.isInteger(permille) || permille < 1 || permille > INTEREST_MAX_PERMILLE) {
      return Promise.resolve(null);
    }

    const now = this.clock();

    return this.store.accrueInterest(guildId, utcDay(now), new Date(now.getTime() - 24 * 3_600_000), now, (candidates, reserve) =>
      planInterest(candidates, permille, reserve),
    );
  }

  /**
   * Passage du dimanche (UTC) : impôt sur la fortune (`wealthPermille` ‰ pour les actifs, `idlePermille` ‰ pour les
   * comptes inactifs depuis 14 jours, au-delà du seuil), puis dividendes et impôt du casino. Une fois par semaine ;
   * `null` un autre jour ou si la semaine est déjà réglée.
   */
  weekly(guildId: string, wealthPermille: number, idlePermille: number): Promise<WeeklyPlan | null> {
    const now = this.clock();
    const week = weeklyRunDay(now);

    if (!week) {
      return Promise.resolve(null);
    }

    const wealth = clampPermille(wealthPermille, WEALTH_TAX_MAX_PERMILLE);
    const idle = clampPermille(idlePermille, IDLE_TAX_MAX_PERMILLE);

    return this.store.weekly(guildId, week, now, (input) => planWeekly(input, wealth, idle, now));
  }

  /** Caisses du serveur : réserve, casino, jackpot, actions. */
  pools(guildId: string): Promise<Pools> {
    return this.store.pools(guildId, this.clock());
  }

  /** Cours de l'action Casino, celui d'il y a 24 h (s'il existe) et les caisses. */
  async market(guildId: string): Promise<Market> {
    const pools = await this.store.pools(guildId, this.clock());
    const dayAgoCents = await this.store.priceBefore(guildId, new Date(this.clock().getTime() - 24 * 3_600_000));

    return { priceCents: sharePriceCents(pools.casino, pools.shares), dayAgoCents, pools };
  }

  /**
   * Achète `count` actions Casino au serveur, au cours (solde du casino par action, arrondi au profit du serveur),
   * plus 1 % de frais. L'argent va à la réserve ; le compte du casino, donc le cours, ne bouge pas.
   */
  async buyShares(guildId: string, memberId: string, count: number, idempotencyKey: string): Promise<ShareTrade> {
    assertShares(count);
    const now = this.clock();
    let trade = { value: 0, fee: 0, priceCents: 0 };

    const result = await this.transact(guildId, memberId, idempotencyKey, (account, pools) => {
      if (count > pools.float) {
        throw new EconomyError("shares_unavailable", { shares: pools.float });
      }

      const value = Math.ceil((count * pools.casino) / pools.shares);
      const fee = Math.ceil((value * MARKET_FEE_PERCENT) / 100);
      const cost = value + fee;

      if (value <= 0) {
        throw new EconomyError("casino_limit");
      }

      if (cost > account.wallet) {
        throw new EconomyError("insufficient_funds", { available: account.wallet });
      }

      trade = { value, fee, priceCents: sharePriceCents(pools.casino, pools.shares) };

      return this.mutation(account, "spend", cost, `market:buy:${count}`, idempotencyKey, now, {
        wallet: account.wallet - cost,
        shares: account.shares + count,
      }, { moves: [{ pool: "reserve", amount: cost, reason: "market:buy" }], floatDelta: -count, volume: count });
    });

    return { ...result, shares: count, ...trade };
  }

  /**
   * Vend `count` actions Casino au serveur, au cours (arrondi au profit du serveur), moins 1 % de frais. La réserve
   * paie ; si elle ne contient pas assez, `reserve_short` et rien ne change.
   */
  async sellShares(guildId: string, memberId: string, count: number, idempotencyKey: string): Promise<ShareTrade> {
    assertShares(count);
    const now = this.clock();
    let trade = { value: 0, fee: 0, priceCents: 0 };

    const result = await this.transact(guildId, memberId, idempotencyKey, (account, pools) => {
      if (count > account.shares) {
        throw new EconomyError("shares_unavailable", { shares: account.shares });
      }

      const value = Math.floor((count * pools.casino) / pools.shares);
      const fee = Math.floor((value * MARKET_FEE_PERCENT) / 100);
      const proceeds = value - fee;

      if (proceeds <= 0) {
        throw new EconomyError("casino_limit");
      }

      if (proceeds > pools.reserve) {
        throw new EconomyError("reserve_short", { available: pools.reserve });
      }

      trade = { value, fee, priceCents: sharePriceCents(pools.casino, pools.shares) };

      return this.mutation(account, "earn", proceeds, `market:sell:${count}`, idempotencyKey, now, {
        wallet: account.wallet + proceeds,
        shares: account.shares - count,
      }, { moves: [{ pool: "reserve", amount: -proceeds, reason: "market:sell" }], floatDelta: count, volume: count });
    });

    return { ...result, shares: count, ...trade };
  }

  /** Mise maximale que le casino accepte maintenant pour un jeu dont le pire gain net vaut `maxNet` fois la mise. */
  async casinoBetCeiling(guildId: string, maxNet: number): Promise<Readonly<{ max: number; closedToday: boolean }>> {
    const pools = await this.store.pools(guildId, this.clock());

    return { max: betLimitOf(pools, maxNet), closedToday: casinoClosedToday(pools, CASINO_DAILY_LOSS_PERCENT) };
  }

  /**
   * Règle d'un coup un jeu à issue immédiate : le joueur met `bet`, récupère `payout` (mise comprise), et la
   * cagnotte entière s'il a touché le jackpot. Une seule écriture, atomique. Le casino paie le gain net ; une perte va
   * au casino, sauf 5 % pour la cagnotte. Avant tout, la mise est confrontée au casino (pire gain `maxNet`, perte
   * maximale du jour) : ce contrôle ne dépend pas du tirage. Raison suffixée `:win`, `:loss` ou `:jackpot`.
   */
  async settle(
    guildId: string,
    memberId: string,
    bet: number,
    payout: number,
    reason: string,
    idempotencyKey: string,
    options: Readonly<{ maxNet: number; jackpot?: boolean }>,
  ): Promise<CasinoSettled> {
    assertAmount(bet);

    if (!Number.isSafeInteger(payout) || payout < 0) {
      throw new EconomyError("invalid_amount");
    }

    const now = this.clock();
    let jackpot = 0;

    if (payout === bet && !options.jackpot) {
      // Égalité sans jackpot : rien ne bouge, rien n'est écrit (mais la mise devait être couverte).
      const [account, pools] = await Promise.all([this.getAccount(guildId, memberId), this.store.pools(guildId, this.clock())]);

      if (bet > account.wallet) {
        throw new EconomyError("insufficient_funds", { available: account.wallet });
      }

      assertCasinoCovers(pools, bet, options.maxNet);

      return { account, entry: null, replayed: false, jackpot: 0 };
    }

    const result = await this.transact(guildId, memberId, idempotencyKey, (account, pools) => {
      if (bet > account.wallet) {
        throw new EconomyError("insufficient_funds", { available: account.wallet });
      }

      assertCasinoCovers(pools, bet, options.maxNet);
      jackpot = options.jackpot ? pools.jackpot : 0;
      const net = payout - bet;
      const gain = net + jackpot;
      const why = `${reason}:${jackpot > 0 ? "jackpot" : gain > 0 ? "win" : "loss"}`;
      const moves: PoolMove[] = [];

      if (net > 0) {
        moves.push({ pool: "casino", amount: -net, reason: why });
      } else if (net < 0) {
        const toJackpot = Math.floor((-net * JACKPOT_SHARE_PERCENT) / 100);
        moves.push({ pool: "casino", amount: -net - toJackpot, reason: why });

        if (toJackpot > 0) {
          moves.push({ pool: "jackpot", amount: toJackpot, reason: why });
        }
      }

      if (jackpot > 0) {
        moves.push({ pool: "jackpot", amount: -jackpot, reason: why });
      }

      return this.mutation(account, gain > 0 ? "earn" : "spend", Math.abs(gain), why, idempotencyKey, now, {
        wallet: account.wallet + gain,
      }, { moves });
    });

    return { account: result.account, entry: result.entry, replayed: result.replayed, jackpot };
  }

  /**
   * Met une mise en jeu (blackjack : la mise, puis le « double ») : elle quitte le portefeuille pour le compte du
   * casino. Contrôlée contre le casino comme `settle` (pire gain `maxNet` fois la mise) ; `null` = déjà couverte.
   */
  async casinoStake(
    guildId: string,
    memberId: string,
    amount: number,
    reason: string,
    idempotencyKey: string,
    maxNet: number | null,
  ): Promise<TransactionResult> {
    assertAmount(amount);
    const now = this.clock();

    return this.transact(guildId, memberId, idempotencyKey, (account, pools) => {
      if (amount > account.wallet) {
        throw new EconomyError("insufficient_funds", { available: account.wallet });
      }

      if (maxNet !== null) {
        assertCasinoCovers(pools, amount, maxNet);
      }

      return this.mutation(account, "spend", amount, reason, idempotencyKey, now, { wallet: account.wallet - amount }, {
        moves: [{ pool: "casino", amount, reason }],
      });
    });
  }

  /**
   * Fin d'une main en plusieurs temps (blackjack) : `payout` (mise comprise) revient au joueur depuis le casino, puis
   * la réserve s'il le fallait, jamais au-delà de ce qu'elles contiennent. Une main perdue n'écrit rien : la mise est
   * déjà au casino.
   */
  async casinoReturn(guildId: string, memberId: string, payout: number, reason: string, idempotencyKey: string): Promise<TransactionResult> {
    assertAmount(payout);
    const now = this.clock();

    return this.transact(guildId, memberId, idempotencyKey, (account, pools) => {
      const fromCasino = Math.min(payout, pools.casino);
      const fromReserve = Math.min(payout - fromCasino, pools.reserve);
      const paid = fromCasino + fromReserve;
      const moves: PoolMove[] = [{ pool: "casino", amount: -fromCasino, reason }];

      if (fromReserve > 0) {
        moves.push({ pool: "reserve", amount: -fromReserve, reason });
      }

      if (paid <= 0) {
        throw new EconomyError("casino_limit");
      }

      return this.mutation(account, "earn", paid, reason, idempotencyKey, now, { wallet: account.wallet + paid }, { moves });
    });
  }

  /** Efface les bougies de 15 min de plus de 30 jours (le graphique d'une heure en montre 80, soit 3 jours et demi). */
  purgeCandles(now: Date = this.clock()): Promise<number> {
    return this.store.purgeCandles(new Date(now.getTime() - 30 * 24 * 3_600_000));
  }

  /** `/me forget` : le solde retourne à la réserve, les actions au serveur, puis compte et grand livre sont effacés. */
  forget(guildId: string, memberId: string): Promise<Readonly<{ returned: number; shares: number }>> {
    return this.store.forget(guildId, memberId, this.clock());
  }

  /** Comptes les plus riches du serveur. */
  leaderboard(guildId: string, limit = 10): Promise<readonly Account[]> {
    return this.store.leaderboard(guildId, limit);
  }

  /** Portefeuille → banque. `"all"` déplace tout le portefeuille. */
  async deposit(guildId: string, memberId: string, amount: number | "all", idempotencyKey: string): Promise<TransactionResult> {
    return this.move(guildId, memberId, amount, idempotencyKey, "deposit");
  }

  /** Banque → portefeuille. `"all"` déplace toute la banque. */
  async withdraw(guildId: string, memberId: string, amount: number | "all", idempotencyKey: string): Promise<TransactionResult> {
    return this.move(guildId, memberId, amount, idempotencyKey, "withdraw");
  }

  /** `store.transact` à l'heure de l'horloge du service. */
  private transact(
    guildId: string,
    memberId: string,
    idempotencyKey: string,
    mutate: (account: Account, pools: Pools) => Mutation,
    options: TransactOptions = {},
  ): Promise<TransactionResult> {
    return this.store.transact(guildId, memberId, idempotencyKey, mutate, { at: this.clock(), ...options });
  }

  private move(
    guildId: string,
    memberId: string,
    requested: number | "all",
    idempotencyKey: string,
    kind: "deposit" | "withdraw",
  ): Promise<TransactionResult> {
    if (requested !== "all") {
      assertAmount(requested);
    }

    const now = this.clock();

    return this.transact(guildId, memberId, idempotencyKey, (account) => {
      const source = kind === "deposit" ? account.wallet : account.bank;
      const target = kind === "deposit" ? account.bank : account.wallet;
      const amount = requested === "all" ? source : requested;

      if (amount <= 0 || amount > source) {
        throw new EconomyError("insufficient_funds", { available: source });
      }

      if (target + amount > MAX_BALANCE) {
        throw new EconomyError("balance_limit");
      }

      const wallet = kind === "deposit" ? account.wallet - amount : account.wallet + amount;
      const bank = kind === "deposit" ? account.bank + amount : account.bank - amount;

      return this.mutation(account, kind, amount, kind, idempotencyKey, now, { wallet, bank });
    });
  }

  private mutation(
    account: Account,
    kind: LedgerKind,
    amount: number,
    reason: string,
    idempotencyKey: string,
    now: Date,
    changes: Partial<Pick<Account, "wallet" | "bank" | "lastWorkAt" | "lastDailyAt" | "dailyStreak" | "shares">>,
    pools?: PoolChange,
  ) {
    const next: Account = { ...account, ...changes };

    if (next.wallet > MAX_BALANCE || next.bank > MAX_BALANCE) {
      throw new EconomyError("balance_limit");
    }

    return {
      account: next,
      entry: {
        id: crypto.randomUUID(),
        guildId: account.guildId,
        memberId: account.memberId,
        kind,
        amount,
        walletAfter: next.wallet,
        bankAfter: next.bank,
        reason,
        idempotencyKey,
        createdAt: now,
      },
      ...(pools ? { pools } : {}),
    };
  }
}

/** Mise maximale que le casino couvre pour un jeu dont le pire gain net vaut `maxNet` fois la mise. */
export function betLimitOf(pools: Pools, maxNet: number): number {
  return casinoBetLimit(pools.casino, maxNet, CASINO_MAX_BET_PERCENT, CASINO_WORST_CASE_PERCENT);
}

function assertCasinoCovers(pools: Pools, bet: number, maxNet: number): void {
  if (casinoClosedToday(pools, CASINO_DAILY_LOSS_PERCENT) || bet > betLimitOf(pools, maxNet)) {
    throw new EconomyError("casino_limit", { max: betLimitOf(pools, maxNet) });
  }
}

function assertAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_BALANCE) {
    throw new EconomyError("invalid_amount");
  }
}

function assertShares(count: number): void {
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new EconomyError("invalid_amount");
  }
}

function clampPermille(value: number, max: number): number {
  return Number.isInteger(value) ? Math.min(Math.max(value, 0), max) : 0;
}

/** Contrôle de cohérence réutilisé par les stockages : les caisses après ces déplacements, ou une erreur. */
export function poolsAfter(pools: Pools, moves: readonly PoolMove[]): Readonly<Record<"reserve" | "casino" | "jackpot", number>> {
  const next = applyMoves(pools, moves);

  if (!next) {
    throw new EconomyError("casino_limit");
  }

  return next;
}
