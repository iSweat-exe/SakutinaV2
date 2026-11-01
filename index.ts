import { Client, GatewayIntentBits } from "discord.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const port = process.env.PORT || 3000;

Bun.serve({
  port,
  fetch(req) {
    const url = new URL(req.url);

    // Cron-job.org read this every 5 minutes
    if (url.pathname === "/health") {
      return Response.json(
        {
          status: "ok",
          uptime: process.uptime(),
          wsPing: client.ws.ping,
          memoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
        { status: 200 }
      );
    }

    return new Response("SakutinaV2 is running!", { status: 200 });
  },
});

console.log(`Healthcheck server listening on port ${port}`);

client.login(process.env.DISCORD_TOKEN);