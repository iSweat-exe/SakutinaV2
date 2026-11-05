/** Shape returned by `panel_casino` and `panel_set_casino_game`, and its validation (no I/O). */
export const GAMES = ["slots", "blackjack", "roulette", "coinflip"] as const;
export type GameName = (typeof GAMES)[number];

/** One casino game as the bot applies it on this server. */
export type CasinoGame = Readonly<{
  game: GameName;
  /** Closed games refuse every bet; hands already in progress finish. */
  enabled: boolean;
  /** Largest bet accepted on this server. */
  maxBet: number;
  /** What the game allows until an administrator changes it. */
  defaultMaxBet: number;
  /** Rounds played in the last 24 h. */
  rounds24h: number;
  /** What the treasury gained (positive) or paid out (negative) on this game in the last 24 h. */
  houseNet24h: number;
}>;

export type Casino = Readonly<{
  generatedAt: string;
  currencyName: string;
  /** Smallest bet, the same for every game. */
  minBet: number;
  /** Largest value an administrator can set as a game's maximum bet. */
  betCeiling: number;
  /** Always the four games, in display order. */
  games: readonly CasinoGame[];
}>;

/** Limits enforced by the database; the form uses the same ones. */
export const BET_LIMITS = { min: 10, ceiling: 100_000 } as const;

const isCount = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const isInteger = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value);

function parseGame(value: unknown): CasinoGame | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const v = value as Record<string, unknown>;

  if (
    !GAMES.includes(v.game as GameName) ||
    typeof v.enabled !== "boolean" ||
    !isCount(v.max_bet) ||
    v.max_bet < BET_LIMITS.min ||
    v.max_bet > BET_LIMITS.ceiling ||
    !isCount(v.default_max_bet) ||
    !isCount(v.rounds_24h) ||
    !isInteger(v.house_net_24h)
  ) {
    return null;
  }

  return {
    game: v.game as GameName,
    enabled: v.enabled,
    maxBet: v.max_bet,
    defaultMaxBet: v.default_max_bet,
    rounds24h: v.rounds_24h,
    houseNet24h: v.house_net_24h,
  };
}

/** Validates the JSON of the casino functions; `null` for anything that does not have the expected shape. */
export function parseCasino(value: unknown): Casino | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const v = value as Record<string, unknown>;

  if (
    typeof v.generated_at !== "string" ||
    typeof v.currency_name !== "string" ||
    !v.currency_name.trim() ||
    !isCount(v.min_bet) ||
    !isCount(v.bet_ceiling) ||
    !Array.isArray(v.games) ||
    v.games.length !== GAMES.length
  ) {
    return null;
  }

  const games: CasinoGame[] = [];

  for (const item of v.games as unknown[]) {
    const game = parseGame(item);

    // Each game exactly once, in the order of GAMES: the view relies on it.
    if (!game || game.game !== GAMES[games.length]) {
      return null;
    }

    games.push(game);
  }

  return {
    generatedAt: v.generated_at,
    currencyName: v.currency_name,
    minBet: v.min_bet,
    betCeiling: v.bet_ceiling,
    games,
  };
}
