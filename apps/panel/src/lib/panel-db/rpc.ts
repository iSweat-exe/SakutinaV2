import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PanelDataError, PanelForbiddenError } from "./errors";

/**
 * Calls one of the database's `panel_*` functions with the signed-in user's session.
 *
 * The panel never reads tables and holds no database secret: the function itself checks
 * who the caller is (apps/bot/.../migrations), so a bug in the panel cannot widen access.
 * Reads cookies: call it behind <Suspense>.
 */
/** Arguments a `panel_*` function takes: text, numbers, booleans and lists of text. */
export type RpcArgs = Record<string, string | number | boolean | readonly string[]>;

export async function callPanelFunction<T>(
  name: string,
  args: RpcArgs,
  parse: (value: unknown) => T | null,
): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(name, args as Record<string, unknown>);

  if (error) {
    if (error.code === "42501") {
      throw new PanelForbiddenError();
    }
    throw new PanelDataError(`${name}: ${error.message}`);
  }

  const parsed = parse(data);

  if (parsed === null) {
    throw new PanelDataError(`${name}: unexpected response shape`);
  }

  return parsed;
}

/** A `panel_*` function of one server: the database checks the caller manages `guildId`. */
export function callGuildFunction<T>(
  name: string,
  guildId: string,
  args: RpcArgs,
  parse: (value: unknown) => T | null,
): Promise<T> {
  return callPanelFunction(name, { p_guild_id: guildId, ...args }, parse);
}
