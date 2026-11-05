import { DEFAULT_CURRENCY } from "@/domain/guilds/guild-types.ts";

const numberFormat = new Intl.NumberFormat("fr-FR");
const compactFormat = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });

/** Au-delà de ce seuil, un nombre est abrégé : en dessous, on le lit en entier (une mise de 1 250 reste 1 250). */
export const SHORT_FROM = 10_000;

/**
 * Nombre lisible d'un coup d'œil : exact jusqu'à 9 999, puis abrégé avec une décimale au plus
 * (« 12,3 k », « 500,2 k », « 1 M »). Des espaces ordinaires : la police des cartes n'a pas l'espace fine.
 */
export function formatShort(value: number): string {
  const text = Math.abs(value) < SHORT_FROM ? numberFormat.format(value) : compactFormat.format(value);

  return text.replace(/[\s  ]/g, " ");
}

/**
 * Un montant avec le nom de la monnaie du serveur. Le nom par défaut s'accorde (« 1 pièce », « 2 pièces ») ;
 * un nom choisi par les administrateurs est affiché tel quel.
 */
export function formatCoins(amount: number, currency: string = DEFAULT_CURRENCY): string {
  const unit = currency === DEFAULT_CURRENCY ? (Math.abs(amount) >= 2 ? "pièces" : "pièce") : currency;

  return `${formatShort(amount)} ${unit}`;
}

/** Durée lisible : « 1 h 05 min », « 4 min 03 s », « 12 s ». */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(1, Math.ceil(ms / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  if (hours > 0) {
    return `${hours} h ${pad(minutes)} min`;
  }

  if (minutes > 0) {
    return `${minutes} min ${pad(seconds)} s`;
  }

  return `${seconds} s`;
}

/** Un nombre pour l'affichage : exact jusqu'à 9 999, abrégé ensuite (voir {@link formatShort}). */
export function formatNumber(value: number): string {
  return formatShort(value);
}

/** Temps vocal : « 0 min », « 42 min », « 3 h 05 min ». */
export function formatVoiceTime(seconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, seconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours > 0
    ? `${hours} h ${String(minutes).padStart(2, "0")} min`
    : `${minutes} min`;
}

/** Horodatage Discord affiché dans le fuseau de chaque lecteur : `<t:…:D>` (date) ou `<t:…:R>` (relatif). */
export function discordTime(date: Date, style: "D" | "R" | "f" = "D"): string {
  return `<t:${Math.floor(date.getTime() / 1_000)}:${style}>`;
}

/** Barre de progression en blocs : `value / max` sur `width` caractères. */
export function formatBar(value: number, max: number, width = 12): string {
  if (max <= 0 || value <= 0) {
    return "";
  }

  return "█".repeat(Math.max(1, Math.round((value / max) * width)));
}

/** Texte venu d'un membre (pseudo, nom de jeu), rendu inerte : ni mise en forme Markdown, ni mention. */
export function plain(text: string, max = 60): string {
  const clipped = text.length > max ? `${text.slice(0, max - 1)}…` : text;

  return clipped.replace(/[\\*_`~|>#<@\[\]()]/g, "\\$&");
}

/** Heure UTC lisible : « 21 h ». */
export function formatHour(hour: number): string {
  return `${hour} h`;
}
