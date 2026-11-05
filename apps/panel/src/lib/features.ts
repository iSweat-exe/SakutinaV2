/**
 * What the panel can really do today.
 *
 * The whole design is built; a section whose data or action does not exist
 * yet is wrapped in <Locked feature="…"> and shows its (sample) layout behind
 * a padlock. Wiring a feature = give its component real data (a `panel_*`
 * database function, see lib/panel-db), then set `wired: true` here: the lock
 * disappears and the section becomes live.
 *
 * `needs` is shown to the admin under the padlock.
 */
export const FEATURES = {
  guilds: { wired: false, needs: "Needs the Discord “guilds” permission at sign-in" },
  settings: { wired: false, needs: "Needs a settings table the bot reads" },
  antiRaid: { wired: false, needs: "Anti-Raid is not built yet" },
  moderation: { wired: false, needs: "Needs moderation functions in the database" },
  phaethon: { wired: false, needs: "Needs Phaethon scores and member names in the database" },
  economy: { wired: false, needs: "Needs economy functions in the database" },
  casino: { wired: false, needs: "The casino is not built yet" },
  profiling: { wired: false, needs: "Needs member names and stats functions in the database" },
  giveaways: { wired: false, needs: "Giveaways are not built yet" },
} as const satisfies Record<string, { wired: boolean; needs: string }>;

export type FeatureKey = keyof typeof FEATURES;
