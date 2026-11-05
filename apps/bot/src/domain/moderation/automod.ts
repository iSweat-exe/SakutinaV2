import type { AutomodSettings } from "@/domain/guilds/guild-types.ts";

export type AutomodRule = "spam" | "links" | "words" | "mentions";

export type Violation = Readonly<{
  rule: AutomodRule;
  /** Le message est supprimé dans tous les cas ; `punish` ajoute un mute de la durée du serveur. */
  punish: boolean;
}>;

/** Ce que l'auto-modération regarde d'un message. Le texte n'est jamais conservé : il sert à décider, puis disparaît. */
export type MessageFacts = Readonly<{
  guildId: string;
  memberId: string;
  text: string;
  /** Personnes distinctes mentionnées (utilisateurs, hors réponse automatique). */
  mentionedUsers: number;
  /** Jours depuis l'arrivée du membre sur le serveur ; `null` si inconnu. */
  memberAgeDays: number | null;
  at: number;
}>;

/** Plus de 5 personnes mentionnées d'un coup : mute. */
export const MENTION_LIMIT = 5;
/** « Nouveau » membre pour le filtre de liens : arrivé depuis moins de 7 jours. */
export const NEWCOMER_DAYS = 7;
/** Spam : au moins 5 messages en 8 secondes… */
export const BURST_MESSAGES = 5;
export const BURST_WINDOW_MS = 8_000;
/** …ou le même message au moins 3 fois en 30 secondes. */
export const REPEAT_MESSAGES = 3;
export const REPEAT_WINDOW_MS = 30_000;

const LINK = /discord(?:app)?\.(?:gg|com\/invite)\/\S+|https?:\/\/\S+|www\.\S+/i;

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();
const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Mémoire à court terme du filtre de spam : pour chaque membre, l'heure et l'empreinte des messages des
 * 30 dernières secondes. Rien n'est écrit en base, et le texte lui-même n'est pas gardé.
 */
export class SpamWindow {
  private readonly recent = new Map<string, { at: number; text: string }[]>();

  /** Enregistre un message et dit s'il fait déborder la rafale ou la répétition. */
  observe(guildId: string, memberId: string, content: string, at: number): boolean {
    const key = `${guildId}:${memberId}`;
    const text = normalize(content);
    const window = (this.recent.get(key) ?? []).filter((entry) => at - entry.at <= REPEAT_WINDOW_MS);

    window.push({ at, text });
    this.recent.set(key, window);

    const burst = window.filter((entry) => at - entry.at <= BURST_WINDOW_MS).length >= BURST_MESSAGES;
    const repeated = text.length > 0 && window.filter((entry) => entry.text === text).length >= REPEAT_MESSAGES;

    return burst || repeated;
  }

  /** Oublie les membres silencieux depuis plus de 30 secondes. */
  sweep(now: number): void {
    for (const [key, window] of this.recent) {
      if (window.every((entry) => now - entry.at > REPEAT_WINDOW_MS)) {
        this.recent.delete(key);
      }
    }
  }

  /** Remet à zéro la mémoire d'un membre (après une sanction, il repart de zéro). */
  forget(guildId: string, memberId: string): void {
    this.recent.delete(`${guildId}:${memberId}`);
  }

  get size(): number {
    return this.recent.size;
  }
}

/** Mots interdits en mots entiers, sans tenir compte de la casse ni des accents composés. */
export function matchesBannedWord(content: string, words: readonly string[]): boolean {
  const list = words.map((word) => word.trim()).filter(Boolean);

  if (list.length === 0) {
    return false;
  }

  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${list.map(escape).join("|")})(?![\\p{L}\\p{N}])`, "iu");

  return pattern.test(content.normalize("NFC"));
}

/** La première règle activée que le message enfreint, ou `null`. Mentions, puis spam, liens, mots. */
export function evaluateAutomod(facts: MessageFacts, settings: AutomodSettings, spam: SpamWindow): Violation | null {
  // Le spam voit tous les messages, même quand une autre règle les attrape : la rafale se mesure en entier.
  const burst = settings.spam ? spam.observe(facts.guildId, facts.memberId, facts.text, facts.at) : false;

  if (settings.mentions && facts.mentionedUsers > MENTION_LIMIT) {
    return { rule: "mentions", punish: true };
  }

  if (burst) {
    return { rule: "spam", punish: true };
  }

  if (settings.links && facts.memberAgeDays !== null && facts.memberAgeDays < NEWCOMER_DAYS && LINK.test(facts.text)) {
    return { rule: "links", punish: false };
  }

  if (settings.words && matchesBannedWord(facts.text, settings.bannedWords)) {
    return { rule: "words", punish: false };
  }

  return null;
}
