import { expect, test } from "bun:test";
import { EditError, appendToArray, insertImport, insertInBlock, matchingClose, replaceOnce } from "../lib/edit.ts";

test("replaceOnce exige exactement une occurrence", () => {
  expect(replaceOnce("a b c", "b", "X", "t")).toBe("a X c");
  expect(() => replaceOnce("a b b", "b", "X", "t")).toThrow(/2 occurrences/);
  expect(() => replaceOnce("a", "z", "X", "t")).toThrow(/introuvable/);
});

test("matchingClose ignore les délimiteurs dans les chaînes", () => {
  const source = 'f({ a: "}", b: [1, 2] }) + 1';
  expect(source[matchingClose(source, 2)]).toBe("}");
});

const groups = `export const groups = [
  {
    name: "economy",
    description: messages.groups.economy,
    commands: [balanceCommand, workCommand],
  },
  {
    name: "server",
    description: messages.groups.server,
    commands: [
      serverInfoCommand,
      healthCommand,
    ],
  },
];`;

test("appendToArray complète un tableau sur une ligne", () => {
  const out = appendToArray(groups, /name: "economy",[\s\S]*?commands:\s*/, "fooCommand", "t");
  expect(out).toContain("commands: [balanceCommand, workCommand, fooCommand],");
  // l'autre groupe n'est pas touché
  expect(out).toContain("      serverInfoCommand,\n      healthCommand,\n    ],");
});

test("appendToArray respecte un tableau multiligne, avec ou sans virgule finale", () => {
  const out = appendToArray(groups, /name: "server",[\s\S]*?commands:\s*/, "fooCommand", "t");
  expect(out).toContain("      serverInfoCommand,\n      healthCommand,\n      fooCommand,\n    ],");

  const noTrailing = "x = [\n  a,\n  b\n];";
  expect(appendToArray(noTrailing, /x = /, "c", "t")).toBe("x = [\n  a,\n  b,\n  c,\n];");
});

test("appendToArray échoue clairement si l'ancre manque", () => {
  expect(() => appendToArray(groups, /name: "nope",/, "x", "registre")).toThrow(EditError);
});

test("insertImport range l'import dans l'ordre alphabétique des modules", () => {
  const source = [
    'import { a } from "@/discord/commands/administration/a.ts";',
    'import type { Command } from "@/discord/commands/command.ts";',
    'import { b } from "@/discord/commands/economy/b.ts";',
    'import { m } from "@/discord/messages.ts";',
  ].join("\n");

  const middle = insertImport(source, 'import { c } from "@/discord/commands/economy/c.ts";', "@/discord/commands/", "t");
  expect(middle.split("\n").map((line) => /"([^"]+)"/.exec(line)![1])).toEqual([
    "@/discord/commands/administration/a.ts",
    "@/discord/commands/command.ts",
    "@/discord/commands/economy/b.ts",
    "@/discord/commands/economy/c.ts",
    "@/discord/messages.ts",
  ]);

  const last = insertImport(source, 'import { z } from "@/discord/commands/zzz/z.ts";', "@/discord/commands/", "t");
  expect(last.split("\n")[3]).toContain("zzz/z.ts");
  expect(() => insertImport(source, source.split("\n")[0]!, "@/discord/commands/", "t")).toThrow(/déjà présent/);
});

test("insertInBlock ajoute en fin de bloc", () => {
  const source = "export const messages = {\n  general: {\n    ping: { a: 1 },\n  },\n  economy: {\n    x: 1,\n  },\n} as const;";
  const out = insertInBlock(source, /\n  general: \{/, "    foo: { b: 2 },", "t");
  expect(out).toContain("    ping: { a: 1 },\n    foo: { b: 2 },\n  },\n  economy");
});
