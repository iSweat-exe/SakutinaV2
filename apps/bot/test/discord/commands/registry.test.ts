import { expect, test } from "bun:test";

import { ROLES } from "@/domain/permissions/permissions.ts";
import {
  commands,
  findCommand,
} from "@/discord/commands/index.ts";

test("les noms de commandes sont uniques et résolus par le registre", () => {
  const names = commands.map((command) => command.definition.name);

  expect(new Set(names).size).toBe(names.length);
  expect(names).toEqual([
    "health",
    "activity",
    "ping",
    "userinfo",
    "serverinfo",
    "avatar",
    "balance",
    "work",
    "daily",
    "deposit",
    "withdraw",
    "history",
    "stats",
    "leaderboard",
    "inactive",
    "channels",
    "serverstats",
    "forgetme",
    "card",
    "profile",
    "search",
    "compare",
  ]);

  for (const name of names) {
    expect(findCommand(name)?.definition.name).toBe(name);
  }

  expect(findCommand("inconnue")).toBeUndefined();
});

test("chaque commande a un rôle valide et une description Discord valide", () => {
  for (const command of commands) {
    expect(ROLES).toContain(command.requiredRole);
    expect(command.definition.description.length).toBeGreaterThan(0);
    expect(command.definition.description.length).toBeLessThanOrEqual(100);
  }
});

test("les commandes actuelles exigent au moins le rôle admin", () => {
  for (const name of ["health", "activity"]) {
    expect(["admin", "owner"]).toContain(findCommand(name)!.requiredRole);
  }
});

test("les commandes qui exposent l'activité des autres exigent le rôle admin", () => {
  for (const name of ["inactive", "channels", "serverstats", "health", "activity", "profile", "search", "compare"]) {
    expect(["admin", "owner"]).toContain(findCommand(name)!.requiredRole);
  }
});

test("les commandes de suivi personnelles sont ouvertes à tous les membres", () => {
  for (const name of ["stats", "forgetme", "daily", "card", "leaderboard"]) {
    expect(findCommand(name)!.requiredRole).toBe("member");
  }
});

test("les options de période sont bornées à la durée de conservation", () => {
  for (const name of ["stats", "leaderboard", "channels", "serverstats"]) {
    const days = (findCommand(name)!.definition.options ?? []).find(
      (option) => option.name === "days",
    ) as { min_value?: number; max_value?: number } | undefined;

    expect(days?.min_value).toBe(1);
    expect(days?.max_value).toBe(30);
  }
});
