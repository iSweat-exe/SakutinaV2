import { cacheLife } from "next/cache";

/** Shape returned by the bot's GET /api/v1/health (apps/bot/src/domain/health). */
type HealthPayload = Readonly<{
  status: "ok" | "degraded";
  environment: string;
  uptimeSeconds: number;
  memoryMb: number;
  discord: Readonly<{ connected: boolean; websocketPingMs: number | null }>;
}>;

export type BotHealth =
  | Readonly<{ state: "operational" | "degraded"; uptimeSeconds: number; memoryMb: number; pingMs: number | null; discordConnected: boolean }>
  | Readonly<{ state: "unreachable" }>;

const DEFAULT_BOT_URL = "https://sakutina.isweat.pro";

function isPayload(value: unknown): value is HealthPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const v = value as Record<string, unknown>;
  const discord = v.discord as Record<string, unknown> | undefined;

  return (
    (v.status === "ok" || v.status === "degraded") &&
    typeof v.uptimeSeconds === "number" &&
    typeof v.memoryMb === "number" &&
    typeof discord === "object" &&
    discord !== null &&
    typeof discord.connected === "boolean"
  );
}

/**
 * Live state of the bot, read server-side from its health endpoint
 * (BOT_API_URL, default https://sakutina.isweat.pro). Cached for 30 s so
 * every visitor shares one request. Never throws: an unreachable bot is a state.
 */
export async function getBotHealth(): Promise<BotHealth> {
  "use cache";
  cacheLife({ stale: 15, revalidate: 30, expire: 300 });

  const base = (process.env.BOT_API_URL?.trim() || DEFAULT_BOT_URL).replace(/\/+$/, "");

  try {
    const response = await fetch(`${base}/api/v1/health`, {
      signal: AbortSignal.timeout(4_000),
      headers: { accept: "application/json" },
    });
    const body: unknown = await response.json();

    if (!isPayload(body)) {
      return { state: "unreachable" };
    }

    return {
      state: body.status === "ok" ? "operational" : "degraded",
      uptimeSeconds: body.uptimeSeconds,
      memoryMb: body.memoryMb,
      pingMs: body.discord.websocketPingMs,
      discordConnected: body.discord.connected,
    };
  } catch {
    return { state: "unreachable" };
  }
}
