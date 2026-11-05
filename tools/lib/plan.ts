import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { ROOT } from "./paths.ts";
import { fail, ok, term } from "./term.ts";

type Op =
  | Readonly<{ kind: "create"; path: string; content: string }>
  | Readonly<{ kind: "edit"; path: string; label: string; apply: (source: string) => string }>;

const rel = (path: string) => relative(ROOT, path);

/**
 * Ce qu'un générateur va faire. On calcule TOUT en mémoire d'abord : si une modification
 * ne s'applique pas (motif introuvable), rien n'est écrit et le message dit pourquoi.
 */
export class Plan {
  private readonly ops: Op[] = [];

  create(path: string, content: string): this {
    this.ops.push({ kind: "create", path, content });
    return this;
  }

  edit(path: string, label: string, apply: (source: string) => string): this {
    this.ops.push({ kind: "edit", path, label, apply });
    return this;
  }

  /** Retourne la liste des fichiers touchés, ou lève une erreur sans rien avoir écrit. */
  async apply(options: { dryRun: boolean }): Promise<readonly string[]> {
    const pending = new Map<string, string>();
    const created = new Set<string>();

    for (const op of this.ops) {
      if (op.kind === "create") {
        if (existsSync(op.path) || pending.has(op.path)) {
          throw new Error(`${rel(op.path)} existe déjà : rien n'est écrasé.`);
        }
        pending.set(op.path, op.content);
        created.add(op.path);
      } else {
        const current = pending.get(op.path) ?? (await readFile(op.path, "utf8"));
        pending.set(op.path, op.apply(current));
      }
    }

    for (const [path, content] of pending) {
      console.log(`${options.dryRun ? term.dim("(simulation) ") : ""}${created.has(path) ? ok("créé    ") : ok("modifié ")}${rel(path)}`);

      if (!options.dryRun) {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, content);
      }
    }

    return [...pending.keys()].map(rel);
  }
}

/** Lance une commande de vérification et affiche sa fin en cas d'échec. Retourne vrai si elle réussit. */
export async function runCheck(label: string, command: readonly string[], cwd: string): Promise<boolean> {
  const process = Bun.spawn([...command], { cwd, stdout: "pipe", stderr: "pipe", env: { ...Bun.env, NO_COLOR: "1" } });
  const [out, err, code] = await Promise.all([new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited]);

  console.log(code === 0 ? ok(label) : fail(label));

  if (code !== 0) {
    console.log(`${out}${err}`.trim().split("\n").slice(-40).join("\n"));
  }

  return code === 0;
}
