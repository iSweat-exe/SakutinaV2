/** Une modification de texte impossible à appliquer : le message dit quoi chercher et où. */
export class EditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EditError";
  }
}

/** Remplace `pattern` en exigeant exactement une occurrence : jamais de modification silencieuse ou double. */
export function replaceOnce(source: string, pattern: RegExp | string, replacement: string | ((match: string, ...groups: string[]) => string), label: string): string {
  const regex = typeof pattern === "string" ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) : new RegExp(pattern.source, pattern.flags.replace("g", ""));
  const matches = [...source.matchAll(new RegExp(regex.source, `${regex.flags}g`))];

  if (matches.length !== 1) {
    throw new EditError(`${label} : ${matches.length === 0 ? "motif introuvable" : `${matches.length} occurrences (une seule attendue)`} (${regex.source.slice(0, 80)})`);
  }

  return source.replace(regex, replacement as string);
}

/** Position de la parenthèse/accolade/crochet fermant qui correspond à celui ouvert en `openIndex`. */
export function matchingClose(source: string, openIndex: number): number {
  const pairs: Record<string, string> = { "[": "]", "{": "}", "(": ")" };
  const open = source[openIndex]!;
  const close = pairs[open];

  if (!close) throw new EditError(`pas de délimiteur ouvrant en position ${openIndex}`);

  let depth = 0;
  let quote: string | null = null;

  for (let i = openIndex; i < source.length; i++) {
    const char = source[i]!;

    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (char === open) {
      depth++;
    } else if (char === close && --depth === 0) {
      return i;
    }
  }

  throw new EditError(`délimiteur fermant introuvable pour « ${open} » en position ${openIndex}`);
}

/**
 * Ajoute `item` à la fin du tableau `[...]` qui suit `anchor`. Respecte la mise en forme :
 * un élément par ligne si le tableau est multiligne, sinon à la suite sur la même ligne.
 */
export function appendToArray(source: string, anchor: RegExp, item: string, label: string): string {
  const found = anchor.exec(source);
  if (!found) throw new EditError(`${label} : ancre introuvable (${anchor.source.slice(0, 80)})`);

  const open = source.indexOf("[", found.index + found[0].length);
  if (open === -1) throw new EditError(`${label} : tableau introuvable après l'ancre`);

  const close = matchingClose(source, open);
  const inner = source.slice(open + 1, close);

  if (inner.includes("\n")) {
    const itemIndent = /\n([ \t]+)\S/.exec(inner)?.[1] ?? "  ";
    const body = inner.replace(/\s+$/, "");
    const withComma = body.endsWith(",") ? body : `${body},`;

    return `${source.slice(0, open + 1)}${withComma}\n${itemIndent}${item},\n${closingIndent(source, close)}${source.slice(close)}`;
  }

  const trimmed = inner.trim();
  return `${source.slice(0, open + 1)}${trimmed ? `${trimmed}, ` : ""}${item}${source.slice(close)}`;
}

/** Indentation de la ligne qui contient `index` (celle du crochet fermant). */
function closingIndent(source: string, index: number): string {
  const lineStart = source.lastIndexOf("\n", index - 1) + 1;
  return /^\s*/.exec(source.slice(lineStart, index))![0];
}

/**
 * Insère une ligne d'import triée parmi les imports dont le module commence par `modulePrefix`
 * (ou après le dernier d'entre eux si l'ordre existant n'est pas alphabétique).
 */
export function insertImport(source: string, line: string, modulePrefix: string, label: string): string {
  const lines = source.split("\n");
  const moduleOf = (text: string) => /from\s+"([^"]+)"/.exec(text)?.[1] ?? "";
  const target = moduleOf(line);

  if (lines.includes(line)) throw new EditError(`${label} : import déjà présent`);

  let last = -1;
  let insertAt = -1;

  lines.forEach((current, index) => {
    const module = moduleOf(current);
    if (!current.startsWith("import ") || !module.startsWith(modulePrefix)) return;
    last = index;
    if (insertAt === -1 && module > target) insertAt = index;
  });

  if (last === -1) throw new EditError(`${label} : aucun import « ${modulePrefix}… » où se placer`);

  lines.splice(insertAt === -1 ? last + 1 : insertAt, 0, line);
  return lines.join("\n");
}

/** Insère `text` juste avant la ligne de fermeture `closing` du bloc qui s'ouvre par `opening`. */
export function insertInBlock(source: string, opening: RegExp, text: string, label: string): string {
  const found = opening.exec(source);
  if (!found) throw new EditError(`${label} : bloc introuvable (${opening.source.slice(0, 80)})`);

  const open = source.indexOf("{", found.index + found[0].length - 1);
  const close = matchingClose(source, open);
  const lineStart = source.lastIndexOf("\n", close) + 1;

  return `${source.slice(0, lineStart)}${text.replace(/\n?$/, "\n")}${source.slice(lineStart)}`;
}
