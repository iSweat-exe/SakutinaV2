/** "kick-user" | "kick_user" | "Kick User" | "kickUser" → ["kick", "user"]. */
const words = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => word.toLowerCase());

export const camel = (value: string): string =>
  words(value)
    .map((word, i) => (i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join("");

export const kebab = (value: string): string => words(value).join("-");
export const snake = (value: string): string => words(value).join("_");

/** Nom de sous-commande Discord : minuscules, chiffres, `-` et `_`, 1 à 32 caractères. */
export const isDiscordName = (value: string): boolean => /^[a-z0-9_-]{1,32}$/.test(value);
