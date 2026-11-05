import "server-only";
import { PanelDataError, PanelForbiddenError } from "./errors";
import { callPanelFunction } from "./rpc";

export type PanelAccess =
  | Readonly<{ state: "granted"; role: "admin" | "owner" }>
  | Readonly<{ state: "denied" }>
  | Readonly<{ state: "unavailable" }>;

/**
 * What the signed-in user may do on the managed server, from the database's
 * `panel_role` function (table `panel_admin`). Never throws.
 */
export async function getPanelAccess(): Promise<PanelAccess> {
  try {
    // panel_role returns NULL (not an error) for someone who is not an administrator.
    const role = await callPanelFunction<"admin" | "owner" | "none">("panel_role", {}, (value) =>
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
