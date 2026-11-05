/**
 * Identifiant d'un composant interactif : `espace:action:propriétaire:arguments…`.
 * Le propriétaire est celui qui a lancé la commande : seul lui peut utiliser
 * les contrôles du message. L'état de la vue (page, période…) voyage dans les
 * arguments, donc rien n'est gardé en mémoire côté bot.
 */
export type ComponentId = Readonly<{
  namespace: string;
  action: string;
  ownerId: string;
  args: readonly string[];
}>;

const SEPARATOR = ":";
const MAX_LENGTH = 100;

export function encodeId(
  namespace: string,
  action: string,
  ownerId: string,
  ...args: readonly (string | number)[]
): string {
  const parts = [namespace, action, ownerId, ...args].map(String);

  if (parts.some((part) => part.includes(SEPARATOR))) {
    throw new Error("Component id parts cannot contain ':'");
  }

  const id = parts.join(SEPARATOR);

  if (id.length > MAX_LENGTH) {
    throw new Error(`Component id exceeds ${MAX_LENGTH} characters`);
  }

  return id;
}

/** `null` si l'identifiant n'a pas été produit par `encodeId` (donc pas par ce bot). */
export function parseId(raw: string): ComponentId | null {
  const [namespace, action, ownerId, ...args] = raw.split(SEPARATOR);

  if (!namespace || !action || !ownerId) {
    return null;
  }

  return { namespace, action, ownerId, args };
}
