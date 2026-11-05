/** Montants en entiers de la plus petite unité ; jamais de décimales. */

/** Plafond de solde du portefeuille comme de la banque (aussi imposé par la base). */
export const MAX_BALANCE = 1_000_000_000_000;

/** Délai entre deux `/work` d'un même membre. */
export const WORK_COOLDOWN_MS = 60 * 60_000;
export const WORK_MIN_REWARD = 50;
export const WORK_MAX_REWARD = 150;

/** Délai minimal entre deux récompenses quotidiennes. */
export const DAILY_COOLDOWN_MS = 20 * 3_600_000;
/** Au-delà de ce délai depuis la dernière récompense, la série repart de 1. */
export const DAILY_STREAK_WINDOW_MS = 48 * 3_600_000;
export const DAILY_BASE_REWARD = 200;
/** Bonus par jour de série au-delà du premier. */
export const DAILY_STREAK_BONUS = 25;
/** Le bonus cesse de croître à cette longueur de série. */
export const DAILY_STREAK_CAP = 10;
