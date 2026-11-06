import { cacheLife } from "next/cache";

/**
 * Made-up Discord members for the landing page, from randomuser.me: a username
 * and a portrait. Nobody here is a real member of any server. The seed is fixed,
 * so the same people come back on every build; the result is cached for a day.
 */
export type SampleProfile = { username: string; avatar: string };

const API = "https://randomuser.me/api/1.4/";
const SEED = "sakutina";
const PORTRAIT_PREFIX = "https://randomuser.me/api/portraits/";
const USERNAME = /^[a-z0-9._]{2,32}$/;

/** Keeps only entries with a plausible username and a portrait served by randomuser.me. */
export function parseProfiles(body: unknown): SampleProfile[] {
  const results = (body as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) {
    return [];
  }

  const profiles: SampleProfile[] = [];
  for (const entry of results) {
    const username = (entry as { login?: { username?: unknown } })?.login?.username;
    const avatar = (entry as { picture?: { large?: unknown } })?.picture?.large;
    if (
      typeof username === "string" &&
      USERNAME.test(username) &&
      typeof avatar === "string" &&
      avatar.startsWith(PORTRAIT_PREFIX) &&
      !avatar.includes("..")
    ) {
      profiles.push({ username, avatar });
    }
  }
  return profiles;
}

/** `count` sample members, or an empty list when the API cannot be reached (the page then draws its own avatars). */
export async function getSampleProfiles(count: number): Promise<SampleProfile[]> {
  "use cache";
  cacheLife("days");

  const query = new URLSearchParams({
    seed: SEED,
    results: String(count),
    inc: "login,picture",
    nat: "fr,us,gb,ca,de,es,nl",
    noinfo: "",
  });

  try {
    const response = await fetch(`${API}?${query}`, { signal: AbortSignal.timeout(5000) });
    return response.ok ? parseProfiles(await response.json()).slice(0, count) : [];
  } catch {
    return [];
  }
}
