import type {
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";

import { activityCommand } from "@/discord/commands/administration/activity.ts";
import { healthCommand } from "@/discord/commands/administration/health.ts";
import type { Command, CommandGroup } from "@/discord/commands/command.ts";
import { balanceCommand } from "@/discord/commands/economy/balance.ts";
import { dailyCommand } from "@/discord/commands/economy/daily.ts";
import { depositCommand } from "@/discord/commands/economy/deposit.ts";
import { historyCommand } from "@/discord/commands/economy/history.ts";
import { payCommand } from "@/discord/commands/economy/pay.ts";
import { withdrawCommand } from "@/discord/commands/economy/withdraw.ts";
import { workCommand } from "@/discord/commands/economy/work.ts";
import { blackjackCommand } from "@/discord/commands/casino/blackjack.ts";
import { coinflipCommand } from "@/discord/commands/casino/coinflip.ts";
import { rouletteCommand } from "@/discord/commands/casino/roulette.ts";
import { slotsCommand } from "@/discord/commands/casino/slots.ts";
import { alertsCommand } from "@/discord/commands/administration/alerts.ts";
import { avatarCommand } from "@/discord/commands/general/avatar.ts";
import { lockdownCommand } from "@/discord/commands/anti-raid/lockdown.ts";
import { pingCommand } from "@/discord/commands/general/ping.ts";
import { serverInfoCommand } from "@/discord/commands/general/serverinfo.ts";
import { treasuryCommand } from "@/discord/commands/general/treasury.ts";
import { unlockCommand } from "@/discord/commands/anti-raid/unlock.ts";
import { userInfoCommand } from "@/discord/commands/general/userinfo.ts";
import { buyCommand } from "@/discord/commands/market/buy.ts";
import { sellCommand } from "@/discord/commands/market/sell.ts";
import { viewCommand } from "@/discord/commands/market/view.ts";
import { banCommand } from "@/discord/commands/moderation/ban.ts";
import { kickCommand } from "@/discord/commands/moderation/kick.ts";
import { purgeCommand } from "@/discord/commands/moderation/purge.ts";
import { timeoutCommand } from "@/discord/commands/moderation/timeout.ts";
import { unbanCommand } from "@/discord/commands/moderation/unban.ts";
import { untimeoutCommand } from "@/discord/commands/moderation/untimeout.ts";
import { unwarnCommand } from "@/discord/commands/moderation/unwarn.ts";
import { warnCommand } from "@/discord/commands/moderation/warn.ts";
import { warningsCommand } from "@/discord/commands/moderation/warnings.ts";
import { compareCommand } from "@/discord/commands/phaethon/compare.ts";
import { profileCommand } from "@/discord/commands/phaethon/profile.ts";
import { searchCommand } from "@/discord/commands/phaethon/search.ts";
import { cardCommand } from "@/discord/commands/profile/card.ts";
import { channelsCommand } from "@/discord/commands/tracking/channels.ts";
import { forgetMeCommand } from "@/discord/commands/tracking/forgetme.ts";
import { inactiveCommand } from "@/discord/commands/tracking/inactive.ts";
import { leaderboardCommand } from "@/discord/commands/tracking/leaderboard.ts";
import { serverStatsCommand } from "@/discord/commands/tracking/serverstats.ts";
import { statsCommand } from "@/discord/commands/tracking/stats.ts";
import { messages } from "@/discord/messages.ts";

/** Limite de Discord : sous-commandes par commande. */
export const MAX_SUBCOMMANDS = 25;

/**
 * Seule liste de commandes, rangée par section. Ajouter une commande = un fichier + une
 * ligne dans son groupe ; ajouter une section (`/casino`) = un groupe de plus.
 */
export const groups: readonly CommandGroup[] = [
  {
    name: "economy",
    description: messages.groups.economy,
    commands: [balanceCommand, workCommand, dailyCommand, depositCommand, withdrawCommand, historyCommand, payCommand],
  },
  {
    name: "casino",
    description: messages.groups.casino,
    commands: [slotsCommand, blackjackCommand, rouletteCommand, coinflipCommand],
  },
  {
    name: "market",
    description: messages.groups.market,
    commands: [viewCommand, buyCommand, sellCommand],
  },
  {
    name: "me",
    description: messages.groups.me,
    commands: [statsCommand, cardCommand, forgetMeCommand],
  },
  {
    name: "info",
    description: messages.groups.info,
    commands: [userInfoCommand, avatarCommand, pingCommand],
  },
  {
    name: "server",
    description: messages.groups.server,
    commands: [
      serverInfoCommand,
      leaderboardCommand,
      channelsCommand,
      serverStatsCommand,
      inactiveCommand,
      healthCommand,
      treasuryCommand,
      lockdownCommand,
      unlockCommand,
      alertsCommand,
    ],
  },
  {
    name: "mod",
    description: messages.groups.mod,
    commands: [
      warnCommand,
      warningsCommand,
      unwarnCommand,
      timeoutCommand,
      untimeoutCommand,
      kickCommand,
      banCommand,
      unbanCommand,
      purgeCommand,
    ],
  },
  {
    name: "phaethon",
    description: messages.groups.phaethon,
    commands: [profileCommand, searchCommand, compareCommand, activityCommand],
  },
];

/** `casino`, `casino2`, `casino3`… : le nom de la n-ième part (0 pour la première) d'un groupe trop grand. */
export function chunkName(name: string, index: number): string {
  return index === 0 ? name : `${name}${index + 1}`;
}

type Part = Readonly<{ name: string; description: string; commands: readonly Command[] }>;

/** Découpe chaque groupe en commandes Discord de 25 sous-commandes au plus. */
function parts(list: readonly CommandGroup[]): Part[] {
  return list.flatMap((group) => {
    const result: Part[] = [];

    for (let start = 0; start < group.commands.length; start += MAX_SUBCOMMANDS) {
      result.push({
        name: chunkName(group.name, start / MAX_SUBCOMMANDS),
        description: group.description,
        commands: group.commands.slice(start, start + MAX_SUBCOMMANDS),
      });
    }

    return result;
  });
}

const allParts = parts(groups);

/** Les commandes de premier niveau d'une liste de groupes, scindées à 25 sous-commandes. */
export function buildApplicationCommands(
  list: readonly CommandGroup[],
): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return parts(list).map((part) => ({
    name: part.name,
    description: part.description,
    options: part.commands.map((command) => command.definition),
  }));
}

/** Les commandes de premier niveau à publier sur Discord. */
export function applicationCommands(): RESTPostAPIChatInputApplicationCommandsJSONBody[] {
  return buildApplicationCommands(groups);
}

/** Toutes les commandes, à plat (tests, contrôles). */
export const commands: readonly Command[] = groups.flatMap((group) => group.commands);

/** Retrouve la commande de `/section sous-commande`. */
export function findCommand(section: string, subcommand: string | null): Command | undefined {
  return allParts
    .find((part) => part.name === section)
    ?.commands.find((command) => command.definition.name === subcommand);
}

/** Le chemin lisible d'une commande (« economy balance »), pour les journaux. */
export function commandPath(section: string, subcommand: string | null): string {
  return subcommand ? `${section} ${subcommand}` : section;
}
