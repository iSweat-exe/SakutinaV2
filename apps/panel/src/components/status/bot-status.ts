import type { BotHealth } from "@/lib/bot-health";
import { formatUptime } from "@/lib/format";

export type StatusTone = "success" | "warning" | "danger";

export const TONE_STYLE: Record<StatusTone, { color: string; ring: string }> = {
  success: { color: "#4ade80", ring: "rgba(74,222,128,0.18)" },
  warning: { color: "#fbbf24", ring: "rgba(251,191,36,0.18)" },
  danger: { color: "#ff8a80", ring: "rgba(255,138,128,0.18)" },
};

/** Words and tone for a bot health reading. */
export function describeHealth(health: BotHealth): { tone: StatusTone; label: string; detail: string } {
  switch (health.state) {
    case "operational":
      return {
        tone: "success",
        label: "All Systems Operational",
        detail: `Up for ${formatUptime(health.uptimeSeconds)}. The bot is connected to Discord${
          health.pingMs === null ? "" : ` (${health.pingMs} ms)`
        }.`,
      };
    case "degraded":
      return {
        tone: "warning",
        label: "Discord Connection Lost",
        detail: `The bot is running (up for ${formatUptime(health.uptimeSeconds)}) but is not connected to Discord.`,
      };
    case "unreachable":
      return {
        tone: "danger",
        label: "Bot Unreachable",
        detail: "The panel cannot reach the bot right now. Check its hosting.",
      };
  }
}
