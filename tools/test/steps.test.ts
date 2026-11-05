import { expect, test } from "bun:test";
import { areasOf, selectSteps, STEPS } from "../lib/steps.ts";

test("les fichiers sont rattachés au bon dossier", () => {
  expect([...areasOf(["apps/bot/src/main.ts"])]).toEqual(["bot"]);
  expect([...areasOf(["packages/config/src/index.ts"])]).toEqual(["bot"]);
  expect([...areasOf(["apps/panel/src/app/layout.tsx"])]).toEqual(["panel"]);
  expect([...areasOf(["tools/verify.ts"])]).toEqual(["tools"]);
  expect([...areasOf(["README.md", "docs/architecture.md"])]).toEqual([]);
});

test("une dépendance ou la CI concerne tout le monde", () => {
  for (const file of ["bun.lock", "package.json", "tsconfig.base.json", ".github/workflows/ci.yml"]) {
    expect([...areasOf([file])].sort()).toEqual(["bot", "panel", "tools"]);
  }
});

test("--changed ne lance que les étapes concernées, sans le build", () => {
  const ids = (changed: string[]) => selectSteps({ changed, full: false }).map((step) => step.id);

  expect(ids(["apps/panel/src/lib/x.ts"])).toEqual(["panel:lint", "panel:types", "panel:test", "inventory:check"]);
  expect(ids(["README.md"])).toEqual([]);
  expect(ids(["apps/bot/src/main.ts"])).toContain("bot:test");
  expect(ids(["apps/bot/src/main.ts"])).not.toContain("panel:lint");
});

test("--full ajoute le build ; --only accepte une étape ou une famille", () => {
  expect(selectSteps({ full: false }).map((step) => step.id)).not.toContain("panel:build");
  expect(selectSteps({ full: true }).map((step) => step.id)).toContain("panel:build");
  expect(selectSteps({ full: false, only: ["panel"] }).map((step) => step.id)).toEqual(["panel:lint", "panel:types", "panel:test"]);
  expect(selectSteps({ full: false, only: ["bot:types"] }).map((step) => step.id)).toEqual(["bot:types"]);
});

test("chaque étape a un identifiant unique de la forme famille:nom", () => {
  const ids = STEPS.map((step) => step.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const id of ids) expect(id).toMatch(/^[a-z]+:[a-z]+$/);
});
