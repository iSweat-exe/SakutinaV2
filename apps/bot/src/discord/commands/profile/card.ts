import { guildIdOf } from "@/discord/guild.ts";
import { AttachmentBuilder, SlashCommandSubcommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { buildProfileCardInput } from "@/discord/commands/profile/profile-card-content.ts";
import { messages } from "@/discord/messages.ts";
import { createPanel, warningPanel } from "@/discord/ui/panels.ts";
import { respond, respondPrivately } from "@/discord/ui/replies.ts";
import { fetchBytes } from "@/shared/fetch-bytes.ts";

const AVATAR_TIMEOUT_MS = 3_000;
const AVATAR_MAX_BYTES = 1024 * 1024;
const CARD_FILE = "card.png";

/**
 * Carte de profil PNG dessinée par l'addon Rust. Seul le demandeur voit sa
 * propre carte : l'activité d'un membre reste réservée aux administrateurs
 * (`/phaethon activity`).
 */
export const cardCommand: Command = {
  definition: new SlashCommandSubcommandBuilder()
    .setName("card")
    .setDescription(messages.card.description)
    .toJSON(),
  requiredRole: "member",
  async execute(
    interaction,
    { config, activityService, economyService, cardRenderer },
  ) {
    if (!cardRenderer) {
      await respondPrivately(
        interaction,
        warningPanel({
          category: "profile",
          title: messages.card.unavailableTitle,
          description: messages.card.unavailable,
        }),
      );
      return;
    }

    // Avatar + rendu peuvent dépasser les 3 s de réponse initiale de Discord.
    await interaction.deferReply();

    const user = interaction.user;
    const displayName = interaction.inCachedGuild()
      ? interaction.member.displayName
      : user.displayName;
    const [totals, account, avatar] = await Promise.all([
      activityService.totalsForMember(guildIdOf(interaction), user.id),
      economyService.getAccount(guildIdOf(interaction), user.id),
      fetchBytes(user.displayAvatarURL({ extension: "png", size: 128, forceStatic: true }), {
        timeoutMs: AVATAR_TIMEOUT_MS,
        maxBytes: AVATAR_MAX_BYTES,
      }),
    ]);

    const png = await cardRenderer.render(
      buildProfileCardInput({
        displayName,
        guildName: interaction.guild?.name ?? "",
        totals,
        account,
        avatar,
      }),
    );

    await respond(
      interaction,
      createPanel({
        category: "profile",
        title: messages.card.title,
        images: [{ url: `attachment://${CARD_FILE}`, description: messages.card.title }],
        timestamp: true,
      }),
      { files: [new AttachmentBuilder(Buffer.from(png), { name: CARD_FILE })] },
    );
  },
};
