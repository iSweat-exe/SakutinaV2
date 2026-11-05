/**
 * Compile le crate puis copie la bibliothèque dynamique en
 * `dist/sakutina_native.node`, le nom que charge `index.ts`.
 *
 * Usage : `bun run build` (release) ou `bun run build:debug`.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");
const debug = process.argv.includes("--debug");
const profile = debug ? "debug" : "release";

const libraries: Partial<Record<NodeJS.Platform, string>> = {
  win32: "sakutina_native.dll",
  darwin: "libsakutina_native.dylib",
  linux: "libsakutina_native.so",
};
const library = libraries[process.platform];

if (!library) {
  console.error(`Plateforme non supportée : ${process.platform}`);
  process.exit(1);
}

const cargo = Bun.spawnSync(
  ["cargo", "build", ...(debug ? [] : ["--release"])],
  { cwd: root, stdout: "inherit", stderr: "inherit" },
);

if (cargo.exitCode !== 0) {
  process.exit(cargo.exitCode ?? 1);
}

mkdirSync(join(root, "dist"), { recursive: true });

try {
  copyFileSync(
    join(root, "target", profile, library),
    join(root, "dist", "sakutina_native.node"),
  );
} catch (error) {
  // Windows verrouille une bibliothèque chargée : un bot lancé (`bun run dev`) empêche de la remplacer.
  if ((error as NodeJS.ErrnoException).code === "EBUSY") {
    console.error(
      "dist/sakutina_native.node est utilisé par un processus (bot en cours ?). Arrête-le puis relance le build.",
    );
    process.exit(1);
  }

  throw error;
}

console.log(`Addon compilé (${profile}) : dist/sakutina_native.node`);
