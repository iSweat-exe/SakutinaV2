import { startApplication } from "@/app/start-application.ts";
import { readAppConfig } from "@sakutina/config";
import { logger } from "@/shared/logger.ts";

try {
  await startApplication(readAppConfig());
} catch (error) {
  logger.error("Sakutina failed to start", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
}
