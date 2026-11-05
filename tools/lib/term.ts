/** Couleurs ANSI, désactivées quand la sortie n'est pas un terminal (CI, redirections, LLM). */
const enabled = process.stdout.isTTY === true && process.env.NO_COLOR === undefined;
const wrap = (code: number) => (text: string) => (enabled ? `\u001b[${code}m${text}\u001b[0m` : text);

export const term = {
  green: wrap(32),
  red: wrap(31),
  yellow: wrap(33),
  dim: wrap(2),
  bold: wrap(1),
};

export const ok = (text: string) => `${term.green("✓")} ${text}`;
export const fail = (text: string) => `${term.red("✗")} ${text}`;
export const warn = (text: string) => `${term.yellow("!")} ${text}`;
