import { expect, test } from "bun:test";

import { ROLES } from "@/domain/permissions/permissions.ts";
import type { Command, CommandGroup } from "@/discord/commands/command.ts";
import {
  MAX_SUBCOMMANDS,
  applicationCommands,
  buildApplicationCommands,
  chunkName,
  commandPath,
  commands,
  findCommand,
  groups,
} from "@/discord/commands/index.ts";

const ApplicationCommandOptionSubcommand = 1;

test("les commandes sont rangées par section : 5 commandes de premier niveau au lieu de 22", () => {
  expect(groups.map((group) => [group.name, group.commands.map((command) => command.definition.name)])).toEqual([
    ["economy", ["balance", "work", "daily", "deposit", "withdraw", "history"]],
    ["me", ["stats", "card", "forget"]],
    ["info", ["user", "avatar", "ping"]],
    ["server", ["info", "leaderboard", "channels", "stats", "inactive", "health"]],
    ["phaethon", ["profile", "search", "compare", "activity"]],
  ]);
  expect(applicationCommands().map((command) => command.name)).toEqual([
    "economy",
    "me",
    "info",
    "server",
    "phaethon",
  ]);
  expect(commands).toHaveLength(22);
});

test("chaque commande publiée est un groupe de sous-commandes dans les limites de Discord", () => {
  for (const published of applicationCommands()) {
    expect(published.name).toMatch(/^[a-z0-9_-]{1,32}$/);
    expect(published.description.length).toBeGreaterThan(0);
    expect(published.description.length).toBeLessThanOrEqual(100);
    expect(published.options?.length).toBeGreaterThan(0);
    expect(published.options!.length).toBeLessThanOrEqual(MAX_SUBCOMMANDS);

    const names = published.options!.map((option) => option.name);

    expect(new Set(names).size).toBe(names.length);

    for (const option of published.options!) {
      expect(option.type).toBe(ApplicationCommandOptionSubcommand);
    }
  }
});

test("les sections et leurs sous-commandes sont résolues par le registre", () => {
  for (const group of groups) {
    for (const command of group.commands) {
      expect(findCommand(group.name, command.definition.name)).toBe(command);
    }
  }

  expect(findCommand("economy", "inconnue")).toBeUndefined();
  expect(findCommand("inconnue", "balance")).toBeUndefined();
  expect(findCommand("economy", null)).toBeUndefined();
  expect(commandPath("economy", "balance")).toBe("economy balance");
  expect(commandPath("economy", null)).toBe("economy");
});

test("chaque commande a un rôle valide et une description Discord valide", () => {
  for (const command of commands) {
    expect(ROLES).toContain(command.requiredRole);
    expect(command.definition.description.length).toBeGreaterThan(0);
    expect(command.definition.description.length).toBeLessThanOrEqual(100);
  }
});

const role = (section: string, name: string) => findCommand(section, name)!.requiredRole;

test("le rôle se règle par sous-commande : une même section mêle membres et administrateurs", () => {
  expect(role("server", "info")).toBe("member");
  expect(role("server", "leaderboard")).toBe("member");

  for (const [section, name] of [
    ["server", "health"],
    ["server", "inactive"],
    ["server", "channels"],
    ["server", "stats"],
    ["phaethon", "profile"],
    ["phaethon", "search"],
    ["phaethon", "compare"],
    ["phaethon", "activity"],
  ] as const) {
    expect(["admin", "owner"]).toContain(role(section, name));
  }
});

test("les commandes personnelles sont ouvertes à tous les membres", () => {
  for (const [section, name] of [
    ["me", "stats"],
    ["me", "forget"],
    ["me", "card"],
    ["economy", "daily"],
    ["economy", "work"],
    ["info", "user"],
    ["info", "avatar"],
    ["info", "ping"],
  ] as const) {
    expect(role(section, name)).toBe("member");
  }
});

test("les options de période sont bornées à la durée de conservation", () => {
  for (const [section, name] of [
    ["me", "stats"],
    ["server", "leaderboard"],
    ["server", "channels"],
    ["server", "stats"],
  ] as const) {
    const days = (findCommand(section, name)!.definition.options ?? []).find(
      (option) => option.name === "days",
    ) as { min_value?: number; max_value?: number } | undefined;

    expect(days?.min_value).toBe(1);
    expect(days?.max_value).toBe(30);
  }
});

test("un groupe de plus de 25 sous-commandes est scindé en /casino, /casino2…", () => {
  const sub = (name: string): Command => ({
    definition: { type: 1, name, description: name },
    requiredRole: "member",
    execute: async () => undefined,
  });
  const casino: CommandGroup = {
    name: "casino",
    description: "Jeux d'argent",
    commands: Array.from({ length: 27 }, (_, index) => sub(`jeu${index}`)),
  };

  const published = buildApplicationCommands([casino]);

  expect(published.map((command) => command.name)).toEqual(["casino", "casino2"]);
  expect(published.map((command) => command.options?.length)).toEqual([25, 2]);
  expect(published[1]?.options?.[0]).toMatchObject({ name: "jeu25" });
  expect(published[1]?.description).toBe("Jeux d'argent");
  expect(chunkName("casino", 0)).toBe("casino");
  expect(chunkName("casino", 2)).toBe("casino3");
});

test("le poids d'une commande publiée reste sous la limite de 8000 caractères de Discord", () => {
  for (const published of applicationCommands()) {
    expect(JSON.stringify(published).length).toBeLessThan(8_000);
  }
});
