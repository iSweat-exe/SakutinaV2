"use client";

import { useParams } from "next/navigation";

/** Link to a page of the server being viewed: `href("phaethon")` → `/servers/<id>/phaethon`. */
export function useGuildHref(): (page: string) => string {
  const { guildId } = useParams<{ guildId?: string }>();

  return (page) => (guildId ? `/servers/${guildId}/${page.replace(/^\//, "")}` : "/servers");
}
