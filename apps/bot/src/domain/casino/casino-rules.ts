/** Source d'aléa : un réel dans [0, 1). En production, `secureRandom` ; dans les tests, une suite choisie. */
export type Random = () => number;

/** Aléa non prévisible (`crypto`), jamais `Math.random` : de l'argent virtuel dépend du tirage. */
export const secureRandom: Random = () => {
  const [value] = crypto.getRandomValues(new Uint32Array(1));

  return (value ?? 0) / 2 ** 32;
};

/** Entier uniforme dans [0, bound). */
export function randomInt(random: Random, bound: number): number {
  return Math.min(bound - 1, Math.floor(random() * bound));
}

export const GAMES = ["slots", "blackjack", "roulette", "coinflip"] as const;
export type Game = (typeof GAMES)[number];

/** Mise minimale commune à tous les jeux. */
export const MIN_BET = 10;

/** Mise maximale par jeu : le jeu le moins favorable au joueur (machine à sous) est aussi le plus bridé. */
export const MAX_BET: Readonly<Record<Game, number>> = {
  slots: 500,
  blackjack: 2_000,
  roulette: 1_000,
  coinflip: 250,
};

/** Un jeu fini : combien le joueur récupère (mise comprise) pour une mise donnée. */
export type Settlement = Readonly<{ bet: number; payout: number }>;

/** Gain net : positif si le joueur a gagné, négatif s'il a perdu, nul à égalité. */
export const netOf = ({ bet, payout }: Settlement): number => payout - bet;
