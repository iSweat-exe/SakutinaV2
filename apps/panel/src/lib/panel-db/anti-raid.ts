import "server-only";
import { parseAntiRaid, parseRequest, type AntiRaid, type SettingsPatch } from "./anti-raid-schema";
import { callGuildFunction, type RpcArgs } from "./rpc";

/** One server's Anti-Raid settings, live state and history. Throws PanelForbiddenError / PanelDataError. */
export function getAntiRaid(guildId: string): Promise<AntiRaid> {
  return callGuildFunction("panel_antiraid", guildId, {}, parseAntiRaid);
}

const ARGUMENT: Record<keyof SettingsPatch, string> = {
  enabled: "p_enabled",
  joinThreshold: "p_join_threshold",
  windowSeconds: "p_window_seconds",
  minAccountAgeDays: "p_min_account_age_days",
  action: "p_action",
  lockChannels: "p_lock_channels",
  alertAdmins: "p_alert_admins",
  raiseVerification: "p_raise_verification",
};

/** Changes only the given settings; the database validates and logs the change under the caller's name. */
export function setAntiRaid(guildId: string, patch: SettingsPatch): Promise<AntiRaid> {
  const args: RpcArgs = {};

  for (const [key, value] of Object.entries(patch) as [keyof SettingsPatch, SettingsPatch[keyof SettingsPatch]][]) {
    if (value !== undefined) {
      args[ARGUMENT[key]] = value;
    }
  }

  return callGuildFunction("panel_set_antiraid", guildId, args, parseAntiRaid);
}

/** Asks the bot to lock the server down ("start") or to end the raid in progress ("end"). */
export function requestRaid(guildId: string, action: "start" | "end"): Promise<"pending"> {
  return callGuildFunction("panel_request_raid", guildId, { p_action: action }, parseRequest);
}

/** Picks the channel alerts are posted in (one the bot can write in), or none. Logged under the caller's name. */
export function setAlertChannel(guildId: string, channelId: string | null): Promise<AntiRaid> {
  return callGuildFunction("panel_set_alert_channel", guildId, channelId ? { p_channel_id: channelId } : {}, parseAntiRaid);
}
