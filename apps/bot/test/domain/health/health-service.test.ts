import { expect, test } from "bun:test";

import { HealthService } from "@/domain/health/health-service.ts";

function service(ready: boolean, ping: number) {
  return new HealthService({
    environment: "test",
    isDiscordReady: () => ready,
    discordPing: () => ping,
  });
}

test("signale degraded tant que Discord est déconnecté", () => {
  const snapshot = service(false, -1).snapshot();

  expect(snapshot.status).toBe("degraded");
  expect(snapshot.discord.websocketPingMs).toBeNull();
});

test("signale ok avec le ping quand Discord est prêt", () => {
  const snapshot = service(true, 42).snapshot();

  expect(snapshot.status).toBe("ok");
  expect(snapshot.discord.websocketPingMs).toBe(42);
});
