import type { AppConfig } from "@sakutina/config";
import { logger } from "@/shared/logger.ts";
import type { HealthService } from "@/domain/health/health-service.ts";

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function startHealthServer(
  config: AppConfig,
  healthService: HealthService,
): ReturnType<typeof Bun.serve> {
  const server = Bun.serve({
    port: config.port,
    fetch(request) {
      const { pathname } = new URL(request.url);

      if (pathname === "/") {
        return json({ service: "sakutina", status: "running" });
      }

      const snapshot = healthService.snapshot();

      if (pathname === "/api/v1/health") {
        return json(snapshot);
      }

      if (pathname === "/api/v1/ready") {
        return json(snapshot, snapshot.status === "ok" ? 200 : 503);
      }

      return json({ error: "Not found" }, 404);
    },
    error(error) {
      logger.error("Unhandled HTTP request error", {
        error: error instanceof Error ? error.message : String(error),
      });
      return json({ error: "Internal server error" }, 500);
    },
  });

  logger.info("Health server started", {
    port: config.port,
    healthEndpoint: "/api/v1/health",
    readinessEndpoint: "/api/v1/ready",
  });

  return server;
}
