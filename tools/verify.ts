#!/usr/bin/env bun
/**
 * `bun run verify` : lance les vérifications de la CI en local, en parallèle, et résume.
 *
 *   bun run verify               types + tests + lint de tout (sans build)
 *   bun run verify --changed     seulement ce que vos changements touchent
 *   bun run verify --full        ajoute le build de production du panneau
 *   bun run verify --only bot,panel:lint   étapes ou familles précises
 *   bun run verify --list        liste les étapes
 *   bun run verify --json        résumé lisible par une machine
 *   bun run verify --verbose     affiche aussi la sortie des étapes réussies
 */
import { parseArgs, flag, stringOption } from "./lib/args.ts";
import { changedFiles } from "./lib/git.ts";
import { STEPS, selectSteps, type Step } from "./lib/steps.ts";
import { fail, ok, term } from "./lib/term.ts";

type Result = Readonly<{ step: Step; passed: boolean; seconds: number; output: string }>;

// eslint-disable-next-line no-control-regex
const stripAnsi = (text: string) => text.replace(/\u001b\[[0-9;]*m/g, "");

async function run(step: Step): Promise<Result> {
  const started = performance.now();
  const process = Bun.spawn([...step.command], {
    cwd: step.cwd,
    env: { ...Bun.env, ...step.env, FORCE_COLOR: "0", NO_COLOR: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const timeout = setTimeout(() => process.kill(), 10 * 60_000);
  const [stdout, stderr, code] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);
  clearTimeout(timeout);

  return {
    step,
    passed: code === 0,
    seconds: (performance.now() - started) / 1000,
    output: stripAnsi(`${stdout}${stderr}`).trim(),
  };
}

/** File d'attente simple : au plus `jobs` étapes en même temps. */
async function runAll(steps: readonly Step[], jobs: number, onDone: (result: Result) => void): Promise<Result[]> {
  const results: Result[] = [];
  const queue = [...steps];

  await Promise.all(
    Array.from({ length: Math.min(jobs, steps.length) }, async () => {
      for (let step = queue.shift(); step; step = queue.shift()) {
        const result = await run(step);
        results.push(result);
        onDone(result);
      }
    }),
  );

  return steps.map((step) => results.find((result) => result.step === step)!);
}

const tail = (text: string, lines: number) => text.split("\n").slice(-lines).join("\n");

async function main() {
  const args = parseArgs(Bun.argv.slice(2));

  if (flag(args, "list")) {
    for (const step of STEPS) {
      console.log(`${step.id.padEnd(16)} ${step.full ? "(--full) " : ""}${step.description}`);
    }
    return;
  }

  const only = stringOption(args, "only")?.split(",").map((id) => id.trim());
  const changed = flag(args, "changed") ? await changedFiles() : undefined;
  const steps = selectSteps({ changed, full: flag(args, "full"), only });
  const json = flag(args, "json");

  if (steps.length === 0) {
    console.log(changed ? "Aucun changement qui demande une vérification." : "Aucune étape sélectionnée.");
    return;
  }

  if (!json) {
    console.log(term.dim(`${steps.length} étape(s) : ${steps.map((step) => step.id).join(", ")}`));
  }

  const jobs = flag(args, "serial") ? 1 : Number(stringOption(args, "jobs") ?? 3);
  const results = await runAll(steps, jobs, (result) => {
    if (!json) {
      const line = `${result.step.id.padEnd(16)} ${term.dim(`${result.seconds.toFixed(1)} s`)}`;
      console.log(result.passed ? ok(line) : fail(line));
    }
  });

  const failed = results.filter((result) => !result.passed);

  if (json) {
    console.log(
      JSON.stringify({
        passed: failed.length === 0,
        steps: results.map(({ step, passed, seconds, output }) => ({
          id: step.id,
          passed,
          seconds: Number(seconds.toFixed(1)),
          output: passed ? undefined : tail(output, 80),
        })),
      }),
    );
  } else {
    for (const result of results) {
      if (!result.passed || flag(args, "verbose")) {
        console.log(`\n${term.bold(`── ${result.step.id}`)} ${term.dim(`(${result.step.command.join(" ")})`)}\n${tail(result.output, result.passed ? 200 : 80)}`);
      }
    }
    console.log(
      failed.length === 0
        ? `\n${ok(`${results.length} étape(s) réussie(s)`)}`
        : `\n${fail(`${failed.length} étape(s) en échec : ${failed.map((result) => result.step.id).join(", ")}`)}`,
    );
  }

  process.exitCode = failed.length === 0 ? 0 : 1;
}

await main();
