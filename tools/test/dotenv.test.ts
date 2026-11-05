import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { mask, maskUrl, readDotenv } from "../lib/dotenv.ts";

test("readDotenv lit les variables, ignore les commentaires et retire les guillemets", async () => {
  const dir = mkdtempSync(join(tmpdir(), "dotenv-"));
  writeFileSync(join(dir, ".env"), '# commentaire\nA=1\nexport B="deux mots"\nC=\n  D = \'x\'  \nmauvais ligne\n');

  expect(await readDotenv(join(dir, ".env"))).toEqual({ A: "1", B: "deux mots", C: "", D: "x" });
  expect(await readDotenv(join(dir, "absent"))).toBeNull();
  rmSync(dir, { recursive: true });
});

test("les secrets ne sont jamais affichés en clair", () => {
  expect(mask("abcdefghijklmnopqrstuvwxyz")).toBe("abcd…wxyz (26 caractères)");
  expect(mask("court")).toBe("••••");
  expect(maskUrl("postgres://user:pa55w0rd@db.example.com:5432/postgres")).not.toContain("pa55w0rd");
  expect(maskUrl("pas une url")).toBe("(URL invalide)");
});
