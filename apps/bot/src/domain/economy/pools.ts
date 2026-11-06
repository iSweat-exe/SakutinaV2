/**
 * Circuit fermé (SB-CLE) : par serveur, l'argent vit dans les comptes des membres et dans trois caisses du serveur.
 *
 * - `reserve` : la réserve (le trésor). Elle paie les salaires, les intérêts et les versements du panneau, et reçoit
 *   les taxes, l'impôt sur la fortune et l'argent des actions vendues par le serveur.
 * - `casino` : le compte du casino. Il reçoit les pertes des joueurs et paie leurs gains, jamais au-delà de son solde.
 *   Le cours de l'action Casino est ce solde divisé par le nombre d'actions.
 * - `jackpot` : la cagnotte de la machine à sous, alimentée par une part des pertes au casino.
 *
 * Aucune pièce n'est créée en dehors de deux dotations journalisées dans le trésor : la dotation de lancement d'un
 * serveur (`genesis`) et la dotation d'arrivée d'un nouveau membre (`arrival`). Tout le reste est un déplacement : la
 * somme des comptes et des caisses ne bouge pas.
 */

export const POOLS = ["reserve", "casino", "jackpot"] as const;
export type Pool = (typeof POOLS)[number];

/** Budget des salaires d'un jour (UTC), partagé entre les membres actifs. */
export type SalaryDay = Readonly<{
  /** Jour `AAAA-MM-JJ`. */
  day: string;
  /** Budget du jour ; `null` tant qu'il n'a pas été fixé (première réclamation du jour). */
  budget: number | null;
  /** Déjà versé ce jour. */
  paid: number;
  /** Membres actifs (travail ou récompense dans les 7 derniers jours) au début du jour, au moins 1. */
  active: number;
}>;

/** État des caisses d'un serveur, lu (et verrouillé) dans la transaction qui le modifie. */
export type Pools = Readonly<{
  reserve: number;
  casino: number;
  jackpot: number;
  /** Nombre total d'actions Casino. */
  shares: number;
  /** Actions encore détenues par le serveur (à vendre). */
  float: number;
  salary: SalaryDay;
  /** Solde du casino au début du jour (UTC) et ce qu'il a gagné (positif) ou perdu (négatif) depuis. */
  casinoDayStart: number;
  casinoDayNet: number;
}>;

/** Un déplacement signé d'une caisse : positif = la caisse reçoit. */
export type PoolMove = Readonly<{ pool: Pool; amount: number; reason: string }>;

/** Ce qu'une opération fait aux caisses, dans la même transaction que le compte du membre. */
export type PoolChange = Readonly<{
  moves: readonly PoolMove[];
  /** Nouvel état du budget des salaires, si l'opération en a consommé. */
  salary?: SalaryDay;
  /** Actions que le serveur vend (négatif) ou rachète (positif). */
  floatDelta?: number;
  /** Actions échangées (volume du graphique). */
  volume?: number;
}>;

/** Ce qu'une caisse devient après des déplacements ; `null` si l'une passerait sous zéro. */
export function applyMoves(pools: Pools, moves: readonly PoolMove[]): Readonly<Record<Pool, number>> | null {
  const next: Record<Pool, number> = { reserve: pools.reserve, casino: pools.casino, jackpot: pools.jackpot };

  for (const move of moves) {
    next[move.pool] += move.amount;
  }

  return POOLS.every((pool) => next[pool] >= 0) ? next : null;
}

/**
 * Les déplacements du casino qui comptent dans son résultat (journée, semaine, dividendes) : ceux des parties
 * (`casino:<jeu>:…`), pas l'apport de départ ni les dividendes et l'impôt qu'il verse.
 */
export const isCasinoResult = (move: PoolMove): boolean => move.pool === "casino" && move.reason.startsWith("casino:");

/** Cours de l'action Casino en centièmes de pièce : solde du casino par action, arrondi vers le bas. */
export function sharePriceCents(casino: number, shares: number): number {
  return shares > 0 ? Math.floor((casino * 100) / shares) : 0;
}

/** Jour UTC `AAAA-MM-JJ`. */
export const utcDay = (at: Date): string => at.toISOString().slice(0, 10);

/**
 * Mise maximale que le casino accepte pour une partie dont le pire gain net vaut `maxNet` fois la mise : au plus 1 %
 * de son compte, et le pire gain ne dépasse jamais 20 % du compte. Un casino vide n'accepte rien.
 */
export function casinoBetLimit(casino: number, maxNet: number, maxBetPercent: number, worstCasePercent: number): number {
  const byShare = Math.floor((Math.max(casino, 0) * maxBetPercent) / 100);
  const byWorstCase = Math.floor((Math.max(casino, 0) * worstCasePercent) / 100 / Math.max(maxNet, 1));

  return Math.min(byShare, byWorstCase);
}

/** `true` si le casino a déjà perdu sa perte maximale du jour (`lossPercent` % de son solde du matin). */
export function casinoClosedToday(pools: Pools, lossPercent: number): boolean {
  return pools.casinoDayNet < 0 && -pools.casinoDayNet >= Math.floor((pools.casinoDayStart * lossPercent) / 100);
}

/** Ce que la base garde des caisses d'un serveur : `Pools`, plus le jour du casino et son résultat de la semaine. */
export type PoolState = Pools &
  Readonly<{
    /** Jour (UTC) de `casinoDayStart` / `casinoDayNet`. */
    casinoDay: string;
    /** Résultat des parties depuis le dernier passage hebdomadaire. */
    casinoWeekNet: number;
    /** Perte reportée des semaines passées. */
    carriedLoss: number;
  }>;

/** Un nouveau jour (UTC) remet à zéro la perte du jour du casino, à partir de son solde du moment. */
export function rollCasinoDay(state: PoolState, today: string): PoolState {
  return state.casinoDay === today ? state : { ...state, casinoDay: today, casinoDayStart: state.casino, casinoDayNet: 0 };
}

/**
 * Applique un changement aux caisses : déplacements, actions du serveur, budget des salaires, résultat du casino.
 * `null` si une caisse passerait sous zéro ou si le serveur n'a plus ces actions : l'opération est refusée.
 */
export function commitPoolChange(state: PoolState, change: PoolChange): PoolState | null {
  const balances = applyMoves(state, change.moves);
  const float = state.float + (change.floatDelta ?? 0);

  if (!balances || float < 0 || float > state.shares) {
    return null;
  }

  const result = change.moves.filter(isCasinoResult).reduce((sum, move) => sum + move.amount, 0);

  return {
    ...state,
    ...balances,
    float,
    salary: change.salary ?? state.salary,
    casinoDayNet: state.casinoDayNet + result,
    casinoWeekNet: state.casinoWeekNet + result,
  };
}

/** Début de la période de 15 min (UTC) et du jour qui contiennent `at` : les deux bougies du graphique. */
export function candleBuckets(at: Date): Readonly<{ quarter: Date; day: Date }> {
  const quarter = new Date(Math.floor(at.getTime() / 900_000) * 900_000);
  const day = new Date(`${utcDay(at)}T00:00:00.000Z`);

  return { quarter, day };
}
