import { readFile } from "node:fs/promises";

/** Lit un fichier `.env` (KEY=valeur, # commentaires, guillemets optionnels). `null` s'il n'existe pas. */
export async function readDotenv(file: string): Promise<Record<string, string> | null> {
  const text = await readFile(file, "utf8").catch(() => null);
  if (text === null) return null;

  const values: Record<string, string> = {};

  for (const line of text.split("\n")) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match || line.trim().startsWith("#")) continue;
    values[match[1]!] = match[2]!.replace(/^(["'])(.*)\1$/, "$2");
  }

  return values;
}

/** Masque un secret pour l'affichage : « abcd…wxyz (59 caractères) ». */
export function mask(secret: string): string {
  return secret.length <= 8 ? "••••" : `${secret.slice(0, 4)}…${secret.slice(-4)} (${secret.length} caractères)`;
}

/** Masque le mot de passe d'une URL de connexion. */
export function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = "****";
    return parsed.toString();
  } catch {
    return "(URL invalide)";
  }
}
