import { ROOT } from "./paths.ts";

async function git(...args: string[]): Promise<string> {
  const process = Bun.spawn(["git", ...args], { cwd: ROOT, stdout: "pipe", stderr: "pipe" });
  const [out] = await Promise.all([new Response(process.stdout).text(), process.exited]);
  return out.trim();
}

/**
 * Fichiers modifiés par rapport à `main` : commits de la branche, modifications non
 * commitées et fichiers non suivis. Chemins relatifs à la racine.
 */
export async function changedFiles(): Promise<readonly string[]> {
  let base = "";

  for (const ref of ["origin/main", "main"]) {
    base = await git("merge-base", "HEAD", ref);
    if (base) break;
  }

  const committed = base ? await git("diff", "--name-only", `${base}...HEAD`) : "";
  const working = await git("status", "--porcelain", "--untracked-files=all");
  const fromStatus = working
    .split("\n")
    .filter(Boolean)
    // « XY chemin » ou « XY ancien -> nouveau »
    .map((line) => line.slice(3).split(" -> ").pop()!);

  return [...new Set([...committed.split("\n").filter(Boolean), ...fromStatus])];
}
