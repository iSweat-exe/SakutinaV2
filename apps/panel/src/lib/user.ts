import "server-only";
import { createClient } from "@/lib/supabase/server";

export type PanelUser = Readonly<{
  /** Discord id (the identity provider's user id). */
  discordId: string | null;
  /** Display name, e.g. "Mika". */
  name: string;
  /** Discord username with a leading @, e.g. "@mika". */
  handle: string;
  avatarUrl: string | null;
}>;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Maps the Supabase (Discord OAuth) user metadata to what the panel displays. */
export function toPanelUser(metadata: Record<string, unknown> | undefined): PanelUser {
  const meta = metadata ?? {};
  const claims =
    typeof meta.custom_claims === "object" && meta.custom_claims !== null
      ? (meta.custom_claims as Record<string, unknown>)
      : {};

  const username = text(meta.user_name) ?? text(meta.preferred_username) ?? text(meta.name) ?? text(meta.full_name);
  const name = text(claims.global_name) ?? text(meta.global_name) ?? text(meta.full_name) ?? username ?? "User";
  const avatar = text(meta.avatar_url);

  return {
    discordId: text(meta.provider_id) ?? text(meta.sub),
    name,
    handle: username ? `@${username.replace(/^@/, "")}` : "",
    // Only Discord's CDN is allowed by next.config.ts.
    avatarUrl: avatar?.startsWith("https://cdn.discordapp.com/avatars/") ? avatar : null,
  };
}

/** The signed-in user, or null. Reads cookies: call it behind <Suspense>. */
export async function getPanelUser(): Promise<PanelUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data) {
    return null;
  }

  return toPanelUser(data.claims.user_metadata as Record<string, unknown> | undefined);
}
