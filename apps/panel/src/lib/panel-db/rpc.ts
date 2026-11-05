import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PanelDataError, PanelForbiddenError } from "./errors";

/**
 * The server the panel manages (the bot is single-server). Same variable as the bot's,
 * defaulting to the pilot server documented in Tasks.md. Server-side only.
 */
export const PANEL_GUILD_ID = process.env.DISCORD_PRIMARY_GUILD_ID?.trim() || "1317931106993180763";

/**
 * Calls one of the database's `panel_*` functions with the signed-in user's session.
 *
 * The panel never reads tables and holds no database secret: the function itself checks
 * that the caller is an administrator (apps/bot/.../0007_panel_access.sql), so a bug in
 * the panel cannot widen access. Reads cookies: call it behind <Suspense>.
 */
export async function callPanelFunction<T>(
  name: string,
  args: Record<string, string | number>,
  parse: (value: unknown) => T | null,
): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(name, { p_guild_id: PANEL_GUILD_ID, ...args });

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
