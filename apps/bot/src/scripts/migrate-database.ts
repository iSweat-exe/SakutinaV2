import { connectPostgres } from "@/database/postgres/connection.ts";
import { migrate } from "@/database/postgres/migrate.ts";
import { logger } from "@/shared/logger.ts";

/** Applique les migrations sans démarrer le bot (`bun run db:migrate`), par exemple en CI. */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is required to run the migrations.");
  }

  const connection = connectPostgres(url);

  try {
    const applied = await migrate(connection.db);

    logger.info("Migrations applied", { count: applied.length, files: applied });
  } finally {
    await connection.close();
  }
}

try {
  await main();
} catch (error) {
  logger.error("Database migration failed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
}
