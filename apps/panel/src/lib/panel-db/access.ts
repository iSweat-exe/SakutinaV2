import "server-only";
import { PanelDataError, PanelForbiddenError } from "./errors";
import { callGuildFunction } from "./rpc";

export type PanelAccess =
  | Readonly<{ state: "granted"; role: "admin" | "owner" }>
  | Readonly<{ state: "denied" }>
  | Readonly<{ state: "unavailable" }>;

/**
 * What the signed-in user may do on a server, from the database's
 * `panel_role` function (owner, synced manager or `panel_admin`). Never throws.
 */
export async function getPanelAccess(guildId: string): Promise<PanelAccess> {
  try {
    // panel_role returns NULL (not an error) for someone who is not an administrator.
    const role = await callGuildFunction<"admin" | "owner" | "none">("panel_role", guildId, {}, (value) =>
      value === null ? "none" : value === "admin" || value === "owner" ? value : null,
    );

    return role === "none" ? { state: "denied" } : { state: "granted", role };
  } catch (error) {
    if (error instanceof PanelForbiddenError) {
      return { state: "denied" };
    }
    if (error instanceof PanelDataError) {
      return { state: "unavailable" };
    }
    return { state: "unavailable" };
  }
}
