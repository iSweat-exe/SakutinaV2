const DEFAULT_PORT = 3000;

export type AppConfig = Readonly<{
  discordToken: string;
  discordApplicationId: string | null;
  /** Le bot est mono-serveur Discord : seul ce serveur est traité. */
  primaryGuildId: string;
  /** Rôles Discord additionnels reconnus comme administrateurs du bot. */
  adminRoleIds: readonly string[];
  /** Rôles Discord reconnus comme modérateurs du bot. */
  moderatorRoleIds: readonly string[];
  /** Salon où Phaéthon publie ses alertes ; sans lui, les alertes ne sont pas émises. */
  alertChannelId: string | null;
  /**
   * Suit la présence (statut, jeux). Exige l'intention privilégiée « Presence »
   * dans le portail développeur Discord : sans elle, la connexion est refusée.
   */
  trackPresence: boolean;
  /** Chaîne PostgreSQL ; absente seulement hors production (stockage mémoire). */
  databaseUrl: string | null;
  port: number;
  environment: string;
}>;

function requiredValue(environment: NodeJS.ProcessEnv, name: string): string {
  const value = environment[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readPort(environment: NodeJS.ProcessEnv): number {
  const value = environment.PORT;

  if (!value) {
    return DEFAULT_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return port;
}

function optionalValue(
  environment: NodeJS.ProcessEnv,
  name: string,
): string | null {
  return environment[name]?.trim() || null;
}

function readIdList(
  environment: NodeJS.ProcessEnv,
  name: string,
): readonly string[] {
  const ids = (environment[name] ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);

  for (const id of ids) {
    if (!/^\d{17,20}$/.test(id)) {
      throw new Error(`${name} must contain comma-separated Discord IDs.`);
    }
  }

  return ids;
}

function readOptionalId(environment: NodeJS.ProcessEnv, name: string): string | null {
  const value = optionalValue(environment, name);

  if (value !== null && !/^\d{17,20}$/.test(value)) {
    throw new Error(`${name} must be a Discord ID.`);
  }

  return value;
}

function readFlag(environment: NodeJS.ProcessEnv, name: string): boolean {
  return ["1", "true", "yes", "on"].includes(environment[name]?.trim().toLowerCase() ?? "");
}

export function readAppConfig(
  environment: NodeJS.ProcessEnv = process.env,
): AppConfig {
  const nodeEnvironment = environment.NODE_ENV?.trim() || "development";
  const databaseUrl = optionalValue(environment, "DATABASE_URL");

  if (nodeEnvironment === "production" && !databaseUrl) {
    throw new Error(
      "DATABASE_URL is required in production: the in-memory store loses all data on restart.",
    );
  }

  return {
    discordToken: requiredValue(environment, "DISCORD_TOKEN"),
    discordApplicationId: optionalValue(environment, "DISCORD_APPLICATION_ID"),
    primaryGuildId: requiredValue(environment, "DISCORD_PRIMARY_GUILD_ID"),
    adminRoleIds: readIdList(environment, "ADMIN_ROLE_IDS"),
    moderatorRoleIds: readIdList(environment, "MODERATOR_ROLE_IDS"),
    alertChannelId: readOptionalId(environment, "ALERT_CHANNEL_ID"),
    trackPresence: readFlag(environment, "TRACK_PRESENCE"),
    databaseUrl,
    port: readPort(environment),
    environment: nodeEnvironment,
  };
}
