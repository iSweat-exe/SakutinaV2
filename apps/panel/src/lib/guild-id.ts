import { notFound } from "next/navigation";

/** A Discord server id from the URL. Anything else is a 404 (never sent to the database). */
export function guildIdOrNotFound(value: string): string {
  if (!/^\d{5,25}$/.test(value)) {
    notFound();
  }

  return value;
}
