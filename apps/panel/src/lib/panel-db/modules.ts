import "server-only";
import { parseModules, type ModuleId, type Modules } from "./modules-schema";
import { callGuildFunction } from "./rpc";

/** Which modules are on for one server, and whether it is under a raid. Throws PanelForbiddenError / PanelDataError. */
export function getModules(guildId: string): Promise<Modules> {
  return callGuildFunction("panel_modules", guildId, {}, parseModules);
}

/** Switches one module on or off; the database logs it under the caller's name. */
export function setModule(guildId: string, module: ModuleId, enabled: boolean): Promise<Modules> {
  return callGuildFunction("panel_set_module", guildId, { p_module: module, p_enabled: enabled }, parseModules);
}
