export type ParsedArgs = Readonly<{
  /** Arguments positionnels, dans l'ordre. */
  positional: readonly string[];
  /** `--clé valeur` ou `--clé=valeur` ; `--drapeau` seul vaut `true`. */
  options: Readonly<Record<string, string | true>>;
}>;

/** Analyse minimale de la ligne de commande : pas de dépendance pour 20 lignes. */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const positional: string[] = [];
  const options: Record<string, string | true> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    const [key, inline] = arg.slice(2).split(/=(.*)/s, 2) as [string, string | undefined];

    if (inline !== undefined) {
      options[key] = inline;
    } else if (argv[i + 1] !== undefined && !argv[i + 1]!.startsWith("--")) {
      options[key] = argv[++i]!;
    } else {
      options[key] = true;
    }
  }

  return { positional, options };
}

export function stringOption(args: ParsedArgs, key: string): string | undefined {
  const value = args.options[key];
  return typeof value === "string" ? value : undefined;
}

export const flag = (args: ParsedArgs, key: string): boolean => args.options[key] !== undefined && args.options[key] !== "false";
