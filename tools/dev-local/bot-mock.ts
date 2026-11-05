export type BotState = "ok" | "degraded";

/** Imite `GET /api/v1/health` du bot (apps/bot/src/http). `?state=degraded` simule Discord déconnecté. */
export function startBotMock(port: number) {
  let state: BotState = "ok";
  const startedAt = Date.now() - (14 * 86_400 + 6 * 3_600) * 1000;

  const server = Bun.serve({
    port,
    fetch(request) {
      const url = new URL(request.url);
      const next = url.searchParams.get("state");
      if (next === "ok" || next === "degraded") state = next;

      if (url.pathname === "/api/v1/health" || url.pathname === "/api/v1/ready") {
        const body = {
          status: state,
          environment: "development",
          uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
          memoryMb: 180,
          discord: { connected: state === "ok", websocketPingMs: state === "ok" ? 42 : null },
        };
        return Response.json(body, { status: url.pathname.endsWith("ready") && state !== "ok" ? 503 : 200 });
      }

      return Response.json({ service: "sakutina", status: "running (mock)" });
    },
  });

  return { port: server.port ?? port, close: () => server.stop(true) };
}
