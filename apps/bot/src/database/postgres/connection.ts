import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/** Base commune à postgres-js (production) et PGlite (tests). */
export type Database = PgDatabase<PgQueryResultHKT>;

export type PostgresConnection = Readonly<{
  db: Database;
  close: () => Promise<void>;
}>;

/** Ouvre un petit pool : un seul processus bot, charge faible. */
export function connectPostgres(url: string): PostgresConnection {
  // `prepare: false` : compatible avec le pooler Supabase en mode transaction.
  const client = postgres(url, { max: 5, idle_timeout: 30, prepare: false });

  return {
    db: drizzle(client),
    close: () => client.end({ timeout: 5 }),
  };
}
