"use server";

import { guildIdOrNotFound } from "@/lib/guild-id";
import { PanelForbiddenError } from "@/lib/panel-db/errors";
import { setModule } from "@/lib/panel-db/modules";
import { isModuleId, type ModuleId, type Modules } from "@/lib/panel-db/modules-schema";

export type ToggleResult = Readonly<{ ok: true; modules: Modules }> | Readonly<{ ok: false; error: "forbidden" | "invalid" | "unavailable" }>;

/**
 * Switches a module of one server on or off (dashboard, Modules page, "module off" screens). Runs with the signed-in
 * user's session: the database decides whether they manage this server and logs the change.
 */
export async function toggleModule(guildId: string, module: ModuleId, enabled: boolean): Promise<ToggleResult> {
  const id = guildIdOrNotFound(guildId);

  if (!isModuleId(module) || typeof enabled !== "boolean") {
    return { ok: false, error: "invalid" };
  }

  try {
    return { ok: true, modules: await setModule(id, module, enabled) };
  } catch (error) {
    return { ok: false, error: error instanceof PanelForbiddenError ? "forbidden" : "unavailable" };
  }
}
