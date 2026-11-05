/**
 * Compteurs d'activité suivis par membre et par jour. Seuls des nombres sont
 * conservés : jamais le contenu des messages, des pièces jointes ni des liens.
 */
export const COUNTER_NAMES = [
  "messages",
  "characters",
  "replies",
  "attachments",
  "mentions",
  "reactionsGiven",
  "reactionsReceived",
  "voiceSeconds",
  "joins",
  "leaves",
  "attributedInvites",
] as const;

export type CounterName = (typeof COUNTER_NAMES)[number];

export type Counters = Readonly<Record<CounterName, number>>;

export const EMPTY_COUNTERS: Counters = Object.freeze(
  Object.fromEntries(COUNTER_NAMES.map((name) => [name, 0])),
) as Counters;

/** Compteurs à zéro, avec les valeurs données. */
export function countersWith(values: Partial<Counters>): Counters {
  return { ...EMPTY_COUNTERS, ...values };
}

export function addCounters(left: Counters, right: Counters): Counters {
  return Object.fromEntries(
    COUNTER_NAMES.map((name) => [name, left[name] + right[name]]),
  ) as Counters;
}

export function sumCounters(list: readonly Counters[]): Counters {
  return list.reduce(addCounters, EMPTY_COUNTERS);
}

export function isCounterName(value: string): value is CounterName {
  return (COUNTER_NAMES as readonly string[]).includes(value);
}
