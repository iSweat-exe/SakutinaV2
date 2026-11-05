import { formatNumber, formatVoiceTime } from "@/discord/formatting.ts";
import { messages } from "@/discord/messages.ts";
import type { Counters } from "@/domain/activity/counters.ts";
import type { Account } from "@/domain/economy/economy-types.ts";
import type { ProfileCardInput } from "@/domain/cards/card-renderer.ts";

export type ProfileCardData = Readonly<{
  displayName: string;
  guildName: string;
  totals: Counters;
  account: Account;
  avatar: Uint8Array | null;
}>;

/** Décide du contenu de la carte ; le dessin est fait par le moteur de rendu. */
export function buildProfileCardInput(data: ProfileCardData): ProfileCardInput {
  const { labels } = messages.card;

  return {
    title: data.displayName,
    ...(data.guildName ? { subtitle: data.guildName } : {}),
    ...(data.avatar ? { avatar: data.avatar } : {}),
    stats: [
      { label: labels.messages, value: formatNumber(data.totals.messages) },
      { label: labels.voice, value: formatVoiceTime(data.totals.voiceSeconds) },
      { label: labels.wallet, value: formatNumber(data.account.wallet) },
      { label: labels.bank, value: formatNumber(data.account.bank) },
    ],
  };
}
