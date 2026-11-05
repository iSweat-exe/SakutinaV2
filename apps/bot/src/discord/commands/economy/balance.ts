import { SlashCommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { buildBalancePanel } from "@/discord/commands/economy/balance-panel.ts";
import { messages } from "@/discord/messages.ts";
import { respond } from "@/discord/ui/replies.ts";

/** Solde interactif pour soi-même ; consultation simple pour un autre membre. */
export const balanceCommand: Command = {
  definition: new SlashCommandBuilder()
    .setName("balance")
    .setDescription(messages.economy.balance.description)
    .addUserOption((option) =>
      option
        .setName("member")
        .setDescription(messages.economy.memberOption)
        .setRequired(false),
    )
    .toJSON(),
  requiredRole: "member",
  async execute(interaction, { config, economyService }) {
    const user = interaction.options.getUser("member") ?? interaction.user;
    const account = await economyService.getAccount(config.primaryGuildId, user.id);
    const own = user.id === interaction.user.id;

    await respond(
      interaction,
      buildBalancePanel({ user, account, ...(own ? { ownerId: user.id } : {}) }),
      // Les boutons d'un solde sont privés : personne d'autre ne les voit ni ne peut les actionner.
      { ephemeral: own },
    );
  },
};
