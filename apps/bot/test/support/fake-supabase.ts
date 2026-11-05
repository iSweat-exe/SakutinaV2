import type { PGlite } from "@electric-sql/pglite";

/**
 * Imite ce que Supabase fournit à la base : le schéma `auth` (`auth.uid()`,
 * `auth.identities`). PGlite n'a pas Supabase, mais les fonctions `panel_*` en dépendent.
 * `as(userId)` se fait ensuite passer pour cet utilisateur (ou pour personne : `null`).
 */
export async function installFakeSupabaseAuth(client: PGlite): Promise<void> {
  await client.exec(`
    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE TABLE IF NOT EXISTS auth.identities (user_id uuid NOT NULL, provider text NOT NULL, provider_id text NOT NULL);
    CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid', true), '')::uuid $$;
  `);
}

export const actAs = (client: PGlite, userId: string | null) =>
  client.query("SELECT set_config('test.uid', $1, false)", [userId ?? ""]);

/** Vrai si l'appel échoue avec le refus `forbidden` des fonctions `panel_*`. */
export async function isForbidden(client: PGlite, query: string, params: unknown[] = []): Promise<boolean> {
  try {
    await client.query(query, params);
    return false;
  } catch (error) {
    return (error as { message?: string }).message?.includes("forbidden") === true;
  }
}
