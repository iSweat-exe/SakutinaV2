import { ApplicationIntegrationType, InteractionContextType, REST, Routes } from "discord.js";

import { readAppConfig } from "@sakutina/config";

import { applicationCommands } from "@/discord/commands/index.ts";
import { logger } from "@/shared/logger.ts";

/**
 * Publie les slash commands pour tous les serveurs (`bun run commands:register`). Elles ne sont
 * proposées que sur un serveur (jamais en message privé) et pour une installation sur serveur.
 * Les anciennes commandes du serveur historique (époque mono-serveur) sont retirées : sans cela,
 * elles apparaîtraient en double sur ce serveur.
 */
async function main(): Promise<void> {
  const config = readAppConfig();

  if (!config.discordApplicationId) {
    throw new Error(
      "DISCORD_APPLICATION_ID is required to register Discord commands.",
    );
  }

  const rest = new REST({ version: "10" }).setToken(config.discordToken);
  const body = applicationCommands().map((command) => ({
    ...command,
    contexts: [InteractionContextType.Guild],
    integration_types: [ApplicationIntegrationType.GuildInstall],
  }));

  await rest.put(Routes.applicationCommands(config.discordApplicationId), { body });

  logger.info("Global commands registered", {
    commands: body.map((command) => command.name),
  });

  if (config.legacyGuildId) {
    await rest.put(Routes.applicationGuildCommands(config.discordApplicationId, config.legacyGuildId), { body: [] });
    logger.info("Legacy guild commands removed", { guildId: config.legacyGuildId });
  }
}

try {
  await main();
} catch (error) {
  logger.error("Command registration failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
}
