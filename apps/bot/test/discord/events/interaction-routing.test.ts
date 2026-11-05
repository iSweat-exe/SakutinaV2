import { expect, test } from "bun:test";

import { interactionCreate } from "@/discord/events/interaction-create.ts";
import { messages } from "@/discord/messages.ts";
import type { HandlerContext } from "@/discord/handler-context.ts";
import { GUILD, ME, createContext, isEphemeral, type Sent } from "../../support/fakes.ts";
import { textOf } from "../../support/panel-text.ts";

/** Le contexte de test n'a pas la configuration des rôles Discord : on la lui ajoute. */
function routed(): HandlerContext {
  const { context } = createContext();

  return {
    ...context,
    config: { ...context.config, adminRoleIds: [], moderatorRoleIds: [] },
  } as HandlerContext;
}

function slash(section: string, subcommand: string | null, options: { admin?: boolean } = {}) {
  const replies: Sent[] = [];
  const interaction = {
    isChatInputCommand: () => true,
    commandName: section,
    guildId: GUILD,
    guild: { ownerId: "propriétaire" },
    user: { id: ME, displayName: "Moi", displayAvatarURL: () => "https://cdn.test/me.png" },
    memberPermissions: { has: () => options.admin === true },
    member: { roles: [] },
    deferred: false,
    replied: false,
    options: {
      getSubcommand: () => subcommand,
      getUser: () => null,
      getInteger: () => null,
      getString: (name: string) => (name === "category" ? "economy" : null),
      getBoolean: () => null,
    },
    reply: async (payload: Sent) => {
      replies.push(payload);
    },
  };

  return { interaction: interaction as never, replies };
}

test("une sous-commande de membre s'exécute dans sa section", async () => {
  const context = routed();
  const { interaction, replies } = slash("economy", "balance");

  await interactionCreate.execute(context, interaction);

  expect(textOf(replies[0])).toContain(messages.economy.balance.title);
});

test("le rôle est vérifié par sous-commande : un membre ne peut pas lancer /server health ni /phaethon profile", async () => {
  const context = routed();

  for (const [section, subcommand] of [
    ["server", "health"],
    ["server", "inactive"],
    ["phaethon", "profile"],
    ["phaethon", "search"],
    ["mod", "warn"],
    ["mod", "kick"],
    ["mod", "ban"],
    ["mod", "purge"],
  ] as const) {
    const { interaction, replies } = slash(section, subcommand);

    await interactionCreate.execute(context, interaction);

    expect(isEphemeral(replies[0])).toBe(true);
    expect(textOf(replies[0])).toContain(messages.errors.unauthorized);
  }
});

test("la même section reste ouverte aux membres pour ses sous-commandes publiques", async () => {
  const context = routed();
  const { interaction, replies } = slash("server", "leaderboard");

  await interactionCreate.execute(context, interaction);

  expect(replies).toHaveLength(1);
  expect(textOf(replies[0])).not.toContain(messages.errors.unauthorized);
});

test("une section ou une sous-commande inconnue, ou une section seule, ne répond rien", async () => {
  const context = routed();

  for (const [section, subcommand] of [
    ["inconnue", "balance"],
    ["economy", "inconnue"],
    ["economy", null],
  ] as const) {
    const { interaction, replies } = slash(section, subcommand);

    await interactionCreate.execute(context, interaction);

    expect(replies).toEqual([]);
  }
});
