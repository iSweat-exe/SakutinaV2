import type { User } from "discord.js";

import { encodeId } from "@/discord/components/custom-id.ts";
import { formatCoins, formatShort } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { button, buttonRow } from "@/discord/ui/controls.ts";
import { createPanel, type Panel } from "@/discord/ui/panels.ts";
import type { Account } from "@/domain/economy/economy-types.ts";

type BalanceData = Readonly<{
  user: Pick<User, "displayName">;
  account: Account;
  /** Si présent, le solde est celui de son propriétaire : les boutons d'action s'affichent sous le panneau. */
  ownerId?: string;
  /** Ligne « Dernière opération » après un dépôt ou un retrait. */
  notice?: string;
  /** Nom de la monnaie du serveur. */
  currency: string;
}>;

/**
 * Solde : le total en grand, où est l'argent dessous. Pour son propriétaire, trois boutons sous le panneau
 * (tout déposer, tout retirer, un montant précis).
 */
export function buildBalancePanel({ user, account, ownerId, notice, currency }: BalanceData): Panel {
  const total = account.wallet + account.bank;
  const description = [
    `**${formatCoins(total, currency)}**`,
    messages.economy.balance.split(formatShort(account.wallet), formatShort(account.bank)),
    notice ? `-# ${notice}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return createPanel({
    category: "economy",
    title: messages.economy.balance.title,
    // Le propriétaire sait déjà que le solde est le sien : pas de nom en en-tête.
    ...(ownerId ? {} : { author: { name: user.displayName } }),
    description,
    ...(ownerId
      ? {
          rows: [
            buttonRow(
              button({ id: encodeId("ba", "deposit-all", ownerId), label: messages.controls.depositAll, intent: "primary", disabled: account.wallet <= 0 }),
              button({ id: encodeId("ba", "withdraw-all", ownerId), label: messages.controls.withdrawAll, intent: "neutral", disabled: account.bank <= 0 }),
              button({ id: encodeId("ba", "modal", ownerId), label: messages.controls.custom }),
            ),
          ],
        }
      : {}),
  });
}
