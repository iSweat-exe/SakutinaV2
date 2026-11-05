/** Seuils des étiquettes. Ce sont des indications explicables, jamais des jugements. */

/** Fenêtre d'observation des étiquettes, en jours. */
export const TAG_WINDOW_DAYS = 30;

/** Un membre est « nouveau » s'il est arrivé il y a moins de ce nombre de jours. */
export const NEW_WITHIN_DAYS = 7;
/** « Actif » : dernière activité il y a moins de ce nombre de jours. */
export const ACTIVE_WITHIN_DAYS = 3;
/** « Inactif » : dernière activité il y a au moins ce nombre de jours (ou jamais observée). */
export const INACTIVE_AFTER_DAYS = 14;
/** « Bavard » : au moins ce nombre de messages par jour en moyenne sur la fenêtre. */
export const CHATTY_MESSAGES_PER_DAY = 20;
/** « Pilier vocal » : au moins ce temps vocal sur la fenêtre. */
export const VOICE_REGULAR_SECONDS = 10 * 3_600;
/** « Sociable » : réactions données + réponses + mentions sur la fenêtre. */
export const SOCIAL_INTERACTIONS = 100;
/** « Partageur de médias » : pièces jointes sur la fenêtre. */
export const MEDIA_SHARER_ATTACHMENTS = 20;
