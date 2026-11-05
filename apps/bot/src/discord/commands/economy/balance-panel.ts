import type { User } from "discord.js";

import { encodeId } from "@/discord/components/custom-id.ts";
import { formatCoins } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import { label } from "@/discord/ui/blocks.ts";
import { button, buttonRow } from "@/discord/ui/controls.ts";
import { createPanel, type Panel } from "@/discord/ui/panels.ts";
import type { Account } from "@/domain/economy/economy-types.ts";

type BalanceData = Readonly<{
  user: Pick<User, "displayName">;
  account: Account;
  /** Si présent, le solde est celui de son propriétaire : boutons d'action et modale. */
  ownerId?: string;
  /** Ligne « Dernière opération » après un dépôt ou un retrait. */
  notice?: string;
  /** Nom de la monnaie du serveur. */
  currency: string;
}>;

/**
 * Solde. Pour son propriétaire, chaque ligne porte son bouton (composant « Section »
 * avec accessoire) et un bouton ouvre une modale pour un montant précis.
 */
export function buildBalancePanel({ user, account, ownerId, notice, currency }: BalanceData): Panel {
  const coins = (amount: number) => formatCoins(amount, currency);
  const { fields } = messages.economy;
  const total = account.wallet + account.bank;
  // Le propriétaire sait déjà que le solde est le sien : pas de nom en en-tête.
  const author = ownerId ? undefined : { name: user.displayName };

  if (!ownerId) {
    return createPanel({
      category: "economy",
      title: messages.economy.balance.title,
      author,
      fields: [
        { name: fields.wallet, value: `**${coins(account.wallet)}**` },
        { name: fields.bank, value: `**${coins(account.bank)}**` },
        { name: fields.total, value: `**${coins(total)}**` },
      ],
      timestamp: true,
    });
  }

  return createPanel({
    category: "economy",
    title: messages.economy.balance.title,
    author,
    blocks: [
      {
        kind: "action",
        text: `${label(fields.wallet)}\n**${coins(account.wallet)}**`,
        button: button({
          id: encodeId("ba", "deposit-all", ownerId),
          label: messages.controls.depositAll,
          intent: "primary",
          disabled: account.wallet <= 0,
        }),
      },
      {
        kind: "action",
        text: `${label(fields.bank)}\n**${coins(account.bank)}**`,
        button: button({
          id: encodeId("ba", "withdraw-all", ownerId),
          label: messages.controls.withdrawAll,
          intent: "neutral",
          disabled: account.bank <= 0,
        }),
      },
      { kind: "separator" },
      { kind: "text", text: `${label(fields.total)}\n**${coins(total)}**` },
      ...(notice ? [{ kind: "text" as const, text: `-# ${messages.balanceActions.noticeLabel}\n${notice}` }] : []),
    ],
    rows: [
      buttonRow(
        button({
          id: encodeId("ba", "modal", ownerId),
          label: messages.controls.custom,
        }),
      ),
    ],
    timestamp: true,
  });
}
