"use server";

import { guildIdOrNotFound } from "@/lib/guild-id";
import { requestRaid, setAlertChannel, setAntiRaid } from "@/lib/panel-db/anti-raid";
import { validPatch, type AntiRaid, type SettingsPatch } from "@/lib/panel-db/anti-raid-schema";
import { PanelDataError, PanelForbiddenError } from "@/lib/panel-db/errors";

export type ActionError = "forbidden" | "invalid" | "unavailable";
export type SaveResult = Readonly<{ ok: true; antiRaid: AntiRaid }> | Readonly<{ ok: false; error: ActionError }>;
export type RequestResult = Readonly<{ ok: true }> | Readonly<{ ok: false; error: ActionError }>;

function failure(error: unknown): { ok: false; error: ActionError } {
  if (error instanceof PanelForbiddenError) {
    return { ok: false, error: "forbidden" };
  }

  return { ok: false, error: error instanceof PanelDataError && /invalid/.test(error.message) ? "invalid" : "unavailable" };
}

/**
 * Changes some Anti-Raid settings of one server. Runs with the signed-in user's session: the database decides whether
 * they manage this server, validates every value and logs the change; this only refuses malformed input early.
 */
export async function saveAntiRaid(guildId: string, patch: SettingsPatch): Promise<SaveResult> {
  const id = guildIdOrNotFound(guildId);

  if (!validPatch(patch)) {
    return { ok: false, error: "invalid" };
  }

  try {
    return { ok: true, antiRaid: await setAntiRaid(id, patch) };
  } catch (error) {
    return failure(error);
  }
}

/** Asks the bot to lock the server down now, or to end the raid in progress. It does so within seconds. */
export async function askRaid(guildId: string, action: "start" | "end"): Promise<RequestResult> {
  const id = guildIdOrNotFound(guildId);

  if (action !== "start" && action !== "end") {
    return { ok: false, error: "invalid" };
  }

  try {
    await requestRaid(id, action);
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Chooses the alert channel of one server (null: none). The database only accepts a channel the bot can write in. */
export async function chooseAlertChannel(guildId: string, channelId: string | null): Promise<SaveResult> {
  const id = guildIdOrNotFound(guildId);

  if (channelId !== null && (typeof channelId !== "string" || !/^\d{5,25}$/.test(channelId))) {
    return { ok: false, error: "invalid" };
  }

  try {
    return { ok: true, antiRaid: await setAlertChannel(id, channelId) };
  } catch (error) {
    return failure(error);
  }
}
