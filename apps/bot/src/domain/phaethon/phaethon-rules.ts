/** Seuils de Phaéthon. Ce sont des indications explicables, jamais des jugements. */

/** Fenêtre d'observation des dossiers, en jours (la rétention du détail). */
export const DOSSIER_WINDOW_DAYS = 30;

/** « Nuit » : heures UTC de 22 h à 4 h 59 (soit environ 23 h – 6 h en France). */
export const NIGHT_HOURS_UTC: readonly number[] = [22, 23, 0, 1, 2, 3, 4];
/** « Oiseau de nuit » : au moins cette part des messages la nuit… */
export const NIGHT_OWL_SHARE = 0.4;
/** …sur au moins ce nombre de messages (en dessous, la part ne dit rien). */
export const NIGHT_OWL_MIN_MESSAGES = 20;

/** Un temps vocal de ce nombre de secondes compte pour une interaction dans le poids d'un contact. */
export const VOICE_SECONDS_PER_INTERACTION = 600;

/** Les salons vocaux plus peuplés que ceci ne produisent pas de paires (conférences, scènes). */
export const MAX_COPRESENCE_CHANNEL_SIZE = 25;

/** Texte conservé au plus (pseudos, noms de jeux). */
export const MAX_TEXT_LENGTH = 100;

/** Alerte : un compte Discord créé il y a moins de ce nombre de jours rejoint le serveur. */
export const SUSPICIOUS_ACCOUNT_DAYS = 7;
/** Alerte : au moins ce nombre de changements de nom ou d'avatar en 24 h. */
export const IDENTITY_CHURN_CHANGES = 4;
/** Alerte : un membre régulier sans aucune activité depuis ce nombre de jours. */
export const GONE_QUIET_DAYS = 5;
/** « Régulier » : au moins ce nombre de messages sur la fenêtre… */
export const GONE_QUIET_BASELINE_MESSAGES = 150;
/** …ou ce temps vocal. */
export const GONE_QUIET_BASELINE_VOICE_SECONDS = 5 * 3_600;
/** Alerte : messages du jour au moins égaux à ce minimum… */
export const SPIKE_MIN_MESSAGES = 100;
/** …et à ce multiple de la moyenne quotidienne du membre. */
export const SPIKE_FACTOR = 5;
