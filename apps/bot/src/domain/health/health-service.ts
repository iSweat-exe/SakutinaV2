export type HealthSnapshot = Readonly<{
  status: "ok" | "degraded";
  environment: string;
  uptimeSeconds: number;
  memoryMb: number;
  discord: Readonly<{
    connected: boolean;
    websocketPingMs: number | null;
  }>;
}>;

export type HealthDependencies = Readonly<{
  environment: string;
  isDiscordReady: () => boolean;
  discordPing: () => number;
}>;

export class HealthService {
  private readonly startedAt = Date.now();

  constructor(private readonly dependencies: HealthDependencies) {}

  snapshot(now = Date.now()): HealthSnapshot {
    const connected = this.dependencies.isDiscordReady();
    const ping = this.dependencies.discordPing();

    return {
      status: connected ? "ok" : "degraded",
      environment: this.dependencies.environment,
      uptimeSeconds: Math.floor((now - this.startedAt) / 1_000),
      memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
      discord: {
        connected,
        websocketPingMs: Number.isFinite(ping) && ping >= 0 ? ping : null,
      },
    };
  }
}
