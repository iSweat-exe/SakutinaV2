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

/** Mise maximale par défaut de chaque jeu : le jeu le moins favorable au joueur (machine à sous) est aussi le plus bridé. */
export const MAX_BET: Readonly<Record<Game, number>> = {
  slots: 500,
  blackjack: 2_000,
  roulette: 1_000,
  coinflip: 250,
};

/**
 * Pire gain net d'une partie, en multiple de la mise : c'est ce que le compte du casino doit pouvoir couvrir.
 * Machine à sous : trois 7 paient 120 fois la mise (le jackpot vient de sa cagnotte, pas du casino) ; blackjack :
 * une main doublée gagnée rapporte deux mises ; roulette : un numéro plein paie 35 fois ; pile ou face : une fois.
 */
export const WORST_NET: Readonly<Record<Game, number>> = { slots: 119, blackjack: 2, roulette: 35, coinflip: 1 };

/** Plafond absolu qu'un serveur peut choisir pour la mise maximale d'un jeu (le panneau et la base le vérifient aussi). */
export const BET_CEILING = 100_000;

/** Réglages d'un jeu pour un serveur : ouvert ou fermé, et mise maximale (au moins `MIN_BET`, au plus `BET_CEILING`). */
export type GameSettings = Readonly<{ enabled: boolean; maxBet: number }>;
export type CasinoSettings = Readonly<Record<Game, GameSettings>>;

/** Tout ouvert, plafonds historiques : ce que voit un serveur qui n'a rien réglé. */
export function defaultCasinoSettings(): CasinoSettings {
  return {
    slots: { enabled: true, maxBet: MAX_BET.slots },
    blackjack: { enabled: true, maxBet: MAX_BET.blackjack },
    roulette: { enabled: true, maxBet: MAX_BET.roulette },
    coinflip: { enabled: true, maxBet: MAX_BET.coinflip },
  };
}

/** Un jeu fini : combien le joueur récupère (mise comprise) pour une mise donnée. */
export type Settlement = Readonly<{ bet: number; payout: number }>;

/** Gain net : positif si le joueur a gagné, négatif s'il a perdu, nul à égalité. */
export const netOf = ({ bet, payout }: Settlement): number => payout - bet;
