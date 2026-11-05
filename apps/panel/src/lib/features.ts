/**
 * What the panel can really do today.
 *
 * The whole design is built; a section whose data or action does not exist
 * yet is wrapped in <Locked feature="…"> and shows its (sample) layout behind
 * a padlock. Wiring a feature = fill in its data/handlers in the page, then
 * set `wired: true` here: the lock disappears and the section becomes live.
 *
 * `needs` is shown to the admin under the padlock.
 */
export const FEATURES = {
  stats: { wired: false, needs: "Needs a stats API on the bot" },
  guilds: { wired: false, needs: "Needs the Discord “guilds” permission at sign-in" },
  settings: { wired: false, needs: "Needs per-server settings stored by the bot" },
  antiRaid: { wired: false, needs: "Anti-Raid is not built yet" },
  moderation: { wired: false, needs: "Needs a moderation API on the bot" },
  phaethon: { wired: false, needs: "Needs a Phaethon API on the bot" },
  economy: { wired: false, needs: "Needs an economy API on the bot" },
  casino: { wired: false, needs: "The casino is not built yet" },
  profiling: { wired: false, needs: "Needs a member stats API on the bot" },
  giveaways: { wired: false, needs: "Giveaways are not built yet" },
} as const satisfies Record<string, { wired: boolean; needs: string }>;

export type FeatureKey = keyof typeof FEATURES;
