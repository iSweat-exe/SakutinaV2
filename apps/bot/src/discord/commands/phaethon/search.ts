import { SlashCommandBuilder } from "discord.js";

import type { Command } from "@/discord/commands/command.ts";
import { buildSearchPanel, describeCriteria } from "@/discord/commands/phaethon/search-panel.ts";
import { recordConsultation } from "@/discord/commands/phaethon/shared.ts";
import { messages } from "@/discord/messages.ts";
import { respondPrivately } from "@/discord/ui/replies.ts";
import type { MemberTagId } from "@/domain/insights/member-tags.ts";
import type { SearchCriteria, SearchSort } from "@/domain/phaethon/phaethon-types.ts";

const LIMIT = 15;

const TAGS: readonly MemberTagId[] = [
  "new",
  "active",
  "inactive",
  "chatty",
  "voice-regular",
  "social",
  "media-sharer",
];
const SORTS: readonly SearchSort[] = ["messages", "voice", "social", "recent"];

const text = messages.phaethon.search;

/** Recherche de membres par critères combinés : « actifs la nuit, qui jouent à X, arrivés ce mois-ci »… */
export const searchCommand: Command = {
  definition: new SlashCommandBuilder()
    .setName("search")
    .setDescription(text.description)
    .addIntegerOption((option) =>
      option.setName("min_messages").setDescription(text.options.minMessages).setMinValue(1),
    )
    .addIntegerOption((option) =>
      option.setName("min_voice_hours").setDescription(text.options.minVoiceHours).setMinValue(1),
    )
    .addBooleanOption((option) => option.setName("night_owl").setDescription(text.options.nightOwl))
    .addIntegerOption((option) =>
      option.setName("joined_within").setDescription(text.options.joinedWithin).setMinValue(1).setMaxValue(365),
    )
    .addIntegerOption((option) =>
      option.setName("inactive_days").setDescription(text.options.inactiveDays).setMinValue(1).setMaxValue(365),
    )
    .addStringOption((option) =>
      option.setName("game").setDescription(text.options.game).setMaxLength(50),
    )
    .addStringOption((option) =>
      option
        .setName("tag")
        .setDescription(text.options.tag)
        .addChoices(...TAGS.map((tag) => ({ name: text.tagNames[tag], value: tag }))),
    )
    .addUserOption((option) => option.setName("talks_to").setDescription(text.options.talksTo))
    .addStringOption((option) =>
      option
        .setName("sort")
        .setDescription(text.options.sort)
        .addChoices(...SORTS.map((sort) => ({ name: text.sorts[sort], value: sort }))),
    )
    .toJSON(),
  requiredRole: "admin",
  async execute(interaction, context) {
    const { options } = interaction;
    const sort = options.getString("sort");
    const tag = options.getString("tag");
    const talksTo = options.getUser("talks_to");
    const game = options.getString("game")?.trim();
    const minMessages = options.getInteger("min_messages");
    const minVoiceHours = options.getInteger("min_voice_hours");
    const joinedWithinDays = options.getInteger("joined_within");
    const inactiveDays = options.getInteger("inactive_days");

    const criteria: SearchCriteria = {
      sort: SORTS.find((candidate) => candidate === sort) ?? "messages",
      ...(minMessages !== null ? { minMessages } : {}),
      ...(minVoiceHours !== null ? { minVoiceHours } : {}),
      ...(options.getBoolean("night_owl") === true ? { nightOwl: true } : {}),
      ...(joinedWithinDays !== null ? { joinedWithinDays } : {}),
      ...(inactiveDays !== null ? { inactiveDays } : {}),
      ...(game ? { game } : {}),
      ...(TAGS.find((candidate) => candidate === tag) ? { tag: tag as MemberTagId } : {}),
      ...(talksTo ? { talksTo: talksTo.id } : {}),
    };

    const hits = await context.phaethonService.search(context.config.primaryGuildId, criteria, LIMIT);

    await recordConsultation(context, "profile.searched", interaction.user.id, null, {
      criteria: describeCriteria(criteria),
      results: hits.length,
    });
    await respondPrivately(interaction, buildSearchPanel(hits, criteria));
  },
};
