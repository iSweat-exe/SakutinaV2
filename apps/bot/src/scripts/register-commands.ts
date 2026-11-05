import { REST, Routes } from "discord.js";

import { readAppConfig } from "@sakutina/config";

import { applicationCommands } from "@/discord/commands/index.ts";
import { logger } from "@/shared/logger.ts";

/** Publie les slash commands sur le serveur configuré (`bun run commands:register`). */
async function main(): Promise<void> {
  const config = readAppConfig();

  if (!config.discordApplicationId) {
    throw new Error(
      "DISCORD_APPLICATION_ID is required to register Discord commands.",
    );
  }

  const rest = new REST({ version: "10" }).setToken(config.discordToken);

  await rest.put(
    Routes.applicationGuildCommands(
      config.discordApplicationId,
      config.primaryGuildId,
    ),
    { body: applicationCommands() },
  );

  logger.info("Guild commands registered", {
    guildId: config.primaryGuildId,
    commands: applicationCommands().map((command) => command.name),
  });
}

try {
  await main();
} catch (error) {
  logger.error("Guild command registration failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
}
