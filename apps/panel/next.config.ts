import type { NextConfig } from "next";

/** Pages of a server before the panel went multi-server (`/dashboard`…): now under `/servers/<id>/`. */
const LEGACY_PAGES = ["dashboard", "anti-raid", "moderation", "phaethon", "balance", "casino", "profiling", "modules"];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Discord avatars of the signed-in user, and the pictures and banners of their servers.
    remotePatterns: [
      { protocol: "https", hostname: "cdn.discordapp.com", pathname: "/avatars/**" },
      { protocol: "https", hostname: "cdn.discordapp.com", pathname: "/icons/**" },
      { protocol: "https", hostname: "cdn.discordapp.com", pathname: "/banners/**" },
      // Made-up members of the landing page (src/lib/sample-profiles.ts).
      { protocol: "https", hostname: "randomuser.me", pathname: "/api/portraits/**" },
    ],
  },
  async redirects() {
    return [
      { source: "/servers/:guildId(\\d{5,25})", destination: "/servers/:guildId/dashboard", permanent: false },
      ...LEGACY_PAGES.map((page) => ({ source: `/${page}`, destination: "/servers", permanent: false })),
    ];
  },
};

export default nextConfig;
