import { activityCommand } from "@/discord/commands/administration/activity.ts";
import { healthCommand } from "@/discord/commands/administration/health.ts";
import type { Command } from "@/discord/commands/command.ts";
import { balanceCommand } from "@/discord/commands/economy/balance.ts";
import { dailyCommand } from "@/discord/commands/economy/daily.ts";
import { depositCommand } from "@/discord/commands/economy/deposit.ts";
import { historyCommand } from "@/discord/commands/economy/history.ts";
import { withdrawCommand } from "@/discord/commands/economy/withdraw.ts";
import { workCommand } from "@/discord/commands/economy/work.ts";
import { avatarCommand } from "@/discord/commands/general/avatar.ts";
import { pingCommand } from "@/discord/commands/general/ping.ts";
import { serverInfoCommand } from "@/discord/commands/general/serverinfo.ts";
import { userInfoCommand } from "@/discord/commands/general/userinfo.ts";
import { cardCommand } from "@/discord/commands/profile/card.ts";
import { channelsCommand } from "@/discord/commands/tracking/channels.ts";
import { forgetMeCommand } from "@/discord/commands/tracking/forgetme.ts";
import { inactiveCommand } from "@/discord/commands/tracking/inactive.ts";
import { leaderboardCommand } from "@/discord/commands/tracking/leaderboard.ts";
import { serverStatsCommand } from "@/discord/commands/tracking/serverstats.ts";
import { statsCommand } from "@/discord/commands/tracking/stats.ts";

/** Seule liste de commandes : enregistrement, routage et tests la lisent. */
export const commands: readonly Command[] = [
  // Administration
  healthCommand,
  activityCommand,
  // Général
  pingCommand,
  userInfoCommand,
  serverInfoCommand,
  avatarCommand,
  // Économie
  balanceCommand,
  workCommand,
  dailyCommand,
  depositCommand,
  withdrawCommand,
  historyCommand,
  // Suivi des membres
  statsCommand,
  leaderboardCommand,
  inactiveCommand,
  channelsCommand,
  serverStatsCommand,
  forgetMeCommand,
  // Profil
  cardCommand,
];

export function findCommand(name: string): Command | undefined {
  return commands.find((command) => command.definition.name === name);
}
