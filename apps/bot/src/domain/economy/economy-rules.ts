/** Montants en entiers de la plus petite unité ; jamais de décimales. */

/** Plafond de solde du portefeuille comme de la banque (aussi imposé par la base). */
export const MAX_BALANCE = 1_000_000_000_000;

/** Délai entre deux `/economy work` d'un même membre. */
export const WORK_COOLDOWN_MS = 60 * 60_000;

/** Délai minimal entre deux récompenses quotidiennes. */
export const DAILY_COOLDOWN_MS = 20 * 3_600_000;
/** Au-delà de ce délai depuis la dernière récompense, la série repart de 1. */
export const DAILY_STREAK_WINDOW_MS = 48 * 3_600_000;
/** Le bonus de série cesse de croître à cette longueur de série. */
export const DAILY_STREAK_CAP = 10;

/** Taux d'intérêt quotidien maximal de la banque, en pour mille (50 = 5 %) ; aussi imposé par la base. */
export const INTEREST_MAX_PERMILLE = 50;
/** Seule cette part de la banque d'un membre rapporte : l'intérêt ne s'emballe pas pour les gros soldes. */
export const INTEREST_BASE_CAP = 100_000;
/** Part du trésor qu'une distribution quotidienne peut utiliser, en pourcentage : il ne se vide jamais d'un coup. */
export const INTEREST_TREASURY_SHARE_PERCENT = 25;

/* ---- Circuit fermé (SB-CLE) ---- */

/** Dotation de lancement de la réserve d'un serveur : la seule masse monétaire de départ. */
export const GENESIS_RESERVE = 1_000_000;
/** Dotation versée à la réserve à l'arrivée d'un nouveau membre : la masse suit la taille du serveur. */
export const ARRIVAL_ENDOWMENT = 5_000;

/** Budget quotidien des salaires par défaut, en pour mille de la réserve (10 = 1 % par jour). */
export const SALARY_BUDGET_DEFAULT_PERMILLE = 10;
/** Budget quotidien maximal qu'un serveur peut choisir (aussi imposé par la base). */
export const SALARY_BUDGET_MAX_PERMILLE = 100;
/** Part du budget du jour réservée à `/economy daily`, en pourcentage ; le reste va à `/economy work`. */
export const DAILY_SHARE_PERCENT = 40;
/** Nombre de `/economy work` par jour sur lequel la part du travail est calculée. */
export const WORK_EXPECTED_PER_DAY = 6;
/** Le gain d'un travail varie entre ces deux pourcentages de la part moyenne. */
export const WORK_SPREAD_MIN_PERCENT = 50;
export const WORK_SPREAD_MAX_PERCENT = 150;
/** Bonus de série de la récompense quotidienne, en pourcentage par jour de série au-delà du premier. */
export const DAILY_STREAK_BONUS_PERCENT = 5;
/** Fenêtre d'activité qui fait compter un membre dans le partage des salaires. */
export const ACTIVE_WINDOW_MS = 7 * 24 * 3_600_000;

/** Impôt sur la fortune hebdomadaire par défaut : membres actifs, et comptes inactifs (pour mille). */
export const WEALTH_TAX_DEFAULT_PERMILLE = 5;
export const IDLE_TAX_DEFAULT_PERMILLE = 20;
export const WEALTH_TAX_MAX_PERMILLE = 50;
export const IDLE_TAX_MAX_PERMILLE = 100;
/** Seuil de l'impôt : seule la fortune au-delà de ce multiple de la fortune médiane est imposée… */
export const WEALTH_TAX_MEDIAN_MULTIPLE = 3;
/** … et jamais en dessous de ce plancher. */
export const WEALTH_TAX_FLOOR = 10_000;
/** Sans opération depuis ce délai, un compte est imposé au taux des inactifs. */
export const IDLE_AFTER_MS = 14 * 24 * 3_600_000;

/** Nombre d'actions Casino et apport de départ du casino, pris dans la réserve (le cours part de 100). */
export const CASINO_SHARES = 1_000;
export const CASINO_SEED = 100_000;
/** Part des pertes au casino versée à la cagnotte du jackpot, en pourcentage. */
export const JACKPOT_SHARE_PERCENT = 5;
/** Mise maximale : au plus ce pourcentage du compte du casino… */
export const CASINO_MAX_BET_PERCENT = 1;
/** … et le pire gain possible d'une partie ne dépasse jamais ce pourcentage du compte. */
export const CASINO_WORST_CASE_PERCENT = 20;
/** Le casino ferme pour la journée quand il a perdu ce pourcentage de son solde du matin. */
export const CASINO_DAILY_LOSS_PERCENT = 10;
/** Partage du bénéfice net hebdomadaire du casino : dividendes et impôt versé à la réserve (pourcentages). */
export const DIVIDEND_PERCENT = 20;
export const CASINO_TAX_PERCENT = 30;
/** Frais d'achat et de vente d'actions, versés à la réserve, en pourcentage. */
export const MARKET_FEE_PERCENT = 1;
