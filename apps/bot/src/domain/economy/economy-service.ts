import type { EconomyStore, TransactionResult, TransferResult, TreasuryMove } from "@/domain/economy/economy-store.ts";
import { EconomyError } from "@/domain/economy/economy-error.ts";
import {
  DAILY_BASE_REWARD,
  DAILY_COOLDOWN_MS,
  DAILY_STREAK_BONUS,
  DAILY_STREAK_CAP,
  DAILY_STREAK_WINDOW_MS,
  MAX_BALANCE,
  WORK_COOLDOWN_MS,
  WORK_MAX_REWARD,
  WORK_MIN_REWARD,
} from "@/domain/economy/economy-rules.ts";
import { emptyAccount, type Account, type LedgerEntry, type LedgerKind } from "@/domain/economy/economy-types.ts";

type Clock = () => Date;
type Random = () => number;

/**
 * Règles de l'économie de base. Aucune dépendance à Discord : une opération
 * économique ne peut pas déclencher d'action de modération.
 */
export class EconomyService {
  constructor(
    private readonly store: EconomyStore,
    private readonly clock: Clock = () => new Date(),
    private readonly random: Random = Math.random,
  ) {}

  async getAccount(guildId: string, memberId: string): Promise<Account> {
    return (
      (await this.store.find(guildId, memberId)) ??
      emptyAccount(guildId, memberId)
    );
  }

  history(
    guildId: string,
    memberId: string,
    limit = 10,
    offset = 0,
  ): Promise<readonly LedgerEntry[]> {
    return this.store.history(guildId, memberId, limit, offset);
  }

  /** Gain périodique : un tirage entre `WORK_MIN_REWARD` et `WORK_MAX_REWARD`, avec délai. */
  async work(
    guildId: string,
    memberId: string,
    idempotencyKey: string,
  ): Promise<TransactionResult> {
    const now = this.clock();

    return this.store.transact(guildId, memberId, idempotencyKey, (account) => {
      if (account.lastWorkAt) {
        const remainingMs =
          account.lastWorkAt.getTime() + WORK_COOLDOWN_MS - now.getTime();

        if (remainingMs > 0) {
          throw new EconomyError("cooldown", { remainingMs });
        }
      }

      const reward =
        WORK_MIN_REWARD +
        Math.floor(this.random() * (WORK_MAX_REWARD - WORK_MIN_REWARD + 1));

      return this.mutation(account, "earn", reward, "work", idempotencyKey, now, {
        wallet: account.wallet + reward,
        lastWorkAt: now,
      });
    });
  }

  /**
   * Récompense quotidienne avec série : 20 h de délai, la série continue si la
   * précédente date de moins de 48 h, le bonus croît jusqu'à `DAILY_STREAK_CAP`.
   */
  async daily(
    guildId: string,
    memberId: string,
    idempotencyKey: string,
    baseReward: number = DAILY_BASE_REWARD,
  ): Promise<TransactionResult> {
    const now = this.clock();

    return this.store.transact(guildId, memberId, idempotencyKey, (account) => {
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

      const reward =
        baseReward + DAILY_STREAK_BONUS * (Math.min(streak, DAILY_STREAK_CAP) - 1);

      return this.mutation(account, "earn", reward, "daily", idempotencyKey, now, {
        wallet: account.wallet + reward,
        lastDailyAt: now,
        dailyStreak: streak,
      });
    });
  }

  /**
   * Solde de départ d'un nouveau membre. La clé d'idempotence est propre au membre : un membre qui quitte
   * puis revient ne le reçoit pas une seconde fois. `null` quand le montant est nul.
   */
  async grantStartingBalance(
    guildId: string,
    memberId: string,
    amount: number,
  ): Promise<TransactionResult | null> {
    if (amount <= 0) {
      return null;
    }

    assertAmount(amount);
    const now = this.clock();
    const key = `starting:${guildId}:${memberId}`;

    return this.store.transact(guildId, memberId, key, (account) =>
      this.mutation(account, "earn", amount, "starting", key, now, { wallet: account.wallet + amount }),
    );
  }

  /**
   * Paiement d'un membre à un autre, portefeuille à portefeuille. Le serveur prélève `taxPercent` % (arrondi
   * à l'inférieur) : l'expéditeur dépense `amount`, le destinataire reçoit `amount` moins la taxe, et la taxe
   * va au trésor du serveur. Les deux écritures et le trésor sont atomiques.
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
          tax > 0 ? { kind: "in", amount: tax, reason: "tax" } : undefined,
        );
      },
      (account) =>
        this.mutation(account, "earn", received, `pay:from:${fromId}`, inKey, now, { wallet: account.wallet + received }),
    );

    return { ...result, tax, received };
  }

  /**
   * Gain d'argent hors travail et récompense (gain d'un jeu…). Le montant est positif ; la raison est celle du grand
   * livre. Avec `fromTreasury`, le trésor du serveur paie ce qu'il peut, le reste est créé.
   */
  async credit(
    guildId: string,
    memberId: string,
    amount: number,
    reason: string,
    idempotencyKey: string,
    fromTreasury = false,
  ): Promise<TransactionResult> {
    assertAmount(amount);
    const now = this.clock();

    return this.store.transact(guildId, memberId, idempotencyKey, (account) =>
      this.mutation(
        account,
        "earn",
        amount,
        reason,
        idempotencyKey,
        now,
        { wallet: account.wallet + amount },
        fromTreasury ? { kind: "out", upTo: amount, reason } : undefined,
      ),
    );
  }

  /** Pièces que le serveur garde : la taxe des paiements et la mise des jeux, moins ce qu'il a versé. */
  treasury(guildId: string): Promise<number> {
    return this.store.treasury(guildId);
  }

  /**
   * Règle d'un coup un jeu à issue immédiate : le joueur met `bet`, récupère `payout` (mise comprise). Une seule
   * écriture, atomique : gain net en `earn` (payé par le trésor dans la limite de son solde), perte nette en `spend`
   * (versée au trésor), raison suffixée `:win` ou `:loss` ; une égalité n'écrit rien. Il faut avoir la mise en portefeuille, sinon `insufficient_funds` et rien n'est écrit.
   */
  async settle(
    guildId: string,
    memberId: string,
    bet: number,
    payout: number,
    reason: string,
    idempotencyKey: string,
  ): Promise<{ account: Account; entry: LedgerEntry | null; replayed: boolean }> {
    assertAmount(bet);

    if (!Number.isSafeInteger(payout) || payout < 0) {
      throw new EconomyError("invalid_amount");
    }

    const net = payout - bet;
    const now = this.clock();

    if (net === 0) {
      const account = await this.getAccount(guildId, memberId);

      if (bet > account.wallet) {
        throw new EconomyError("insufficient_funds", { available: account.wallet });
      }

      return { account, entry: null, replayed: false };
    }

    return this.store.transact(guildId, memberId, idempotencyKey, (account) => {
      if (bet > account.wallet) {
        throw new EconomyError("insufficient_funds", { available: account.wallet });
      }

      const why = `${reason}:${net > 0 ? "win" : "loss"}`;
      const move: TreasuryMove = net > 0 ? { kind: "out", upTo: net, reason: why } : { kind: "in", amount: -net, reason: why };

      return this.mutation(account, net > 0 ? "earn" : "spend", Math.abs(net), why, idempotencyKey, now, { wallet: account.wallet + net }, move);
    });
  }

  /** Comptes les plus riches du serveur. */
  leaderboard(guildId: string, limit = 10): Promise<readonly Account[]> {
    return this.store.leaderboard(guildId, limit);
  }

  /** Portefeuille → banque. `"all"` déplace tout le portefeuille. */
  async deposit(
    guildId: string,
    memberId: string,
    amount: number | "all",
    idempotencyKey: string,
  ): Promise<TransactionResult> {
    return this.move(guildId, memberId, amount, idempotencyKey, "deposit");
  }

  /** Banque → portefeuille. `"all"` déplace toute la banque. */
  async withdraw(
    guildId: string,
    memberId: string,
    amount: number | "all",
    idempotencyKey: string,
  ): Promise<TransactionResult> {
    return this.move(guildId, memberId, amount, idempotencyKey, "withdraw");
  }

  /** Dépense depuis le portefeuille. Avec `toTreasury`, la somme va au trésor du serveur au lieu de disparaître. */
  async spend(
    guildId: string,
    memberId: string,
    amount: number,
    reason: string,
    idempotencyKey: string,
    toTreasury = false,
  ): Promise<TransactionResult> {
    assertAmount(amount);
    const now = this.clock();

    return this.store.transact(guildId, memberId, idempotencyKey, (account) => {
      if (amount > account.wallet) {
        throw new EconomyError("insufficient_funds", { available: account.wallet });
      }

      return this.mutation(
        account,
        "spend",
        amount,
        reason,
        idempotencyKey,
        now,
        { wallet: account.wallet - amount },
        toTreasury ? { kind: "in", amount, reason } : undefined,
      );
    });
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

    return this.store.transact(guildId, memberId, idempotencyKey, (account) => {
      const source = kind === "deposit" ? account.wallet : account.bank;
      const target = kind === "deposit" ? account.bank : account.wallet;
      const amount = requested === "all" ? source : requested;

      if (amount <= 0 || amount > source) {
        throw new EconomyError("insufficient_funds", { available: source });
      }

      if (target + amount > MAX_BALANCE) {
        throw new EconomyError("balance_limit");
      }

      const wallet =
        kind === "deposit" ? account.wallet - amount : account.wallet + amount;
      const bank =
        kind === "deposit" ? account.bank + amount : account.bank - amount;

      return this.mutation(account, kind, amount, kind, idempotencyKey, now, {
        wallet,
        bank,
      });
    });
  }

  private mutation(
    account: Account,
    kind: LedgerKind,
    amount: number,
    reason: string,
    idempotencyKey: string,
    now: Date,
    changes: Partial<Pick<Account, "wallet" | "bank" | "lastWorkAt" | "lastDailyAt" | "dailyStreak">>,
    treasury?: TreasuryMove,
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
      ...(treasury ? { treasury } : {}),
    };
  }
}

function assertAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_BALANCE) {
    throw new EconomyError("invalid_amount");
  }
}
