import { Events } from "discord.js";

import { defineEvent } from "@/discord/events/types.ts";

export const voiceStateUpdate = defineEvent({
  name: Events.VoiceStateUpdate,
  execute({ config, voiceSessionTracker, voiceCoPresence }, oldState, newState) {
    const member = newState.member ?? oldState.member;

    if (newState.guild.id !== config.primaryGuildId || !member || member.user.bot) {
      return;
    }

    const at = new Date();
    const guildId = newState.guild.id;

    if (newState.channelId && !oldState.channelId) {
      voiceSessionTracker.join(guildId, member.id, newState.channelId, at);
      voiceCoPresence.join(guildId, member.id, newState.channelId, at);
    } else if (newState.channelId && oldState.channelId !== newState.channelId) {
      voiceSessionTracker.move(guildId, member.id, newState.channelId, at);
      voiceCoPresence.move(guildId, member.id, newState.channelId, at);
    } else if (!newState.channelId && oldState.channelId) {
      voiceSessionTracker.leave(guildId, member.id, at);
      voiceCoPresence.leave(guildId, member.id, at);
    }
  },
});
