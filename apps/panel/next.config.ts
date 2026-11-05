import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Discord avatars of the signed-in user and the pictures of their servers.
    remotePatterns: [
      { protocol: "https", hostname: "cdn.discordapp.com", pathname: "/avatars/**" },
      { protocol: "https", hostname: "cdn.discordapp.com", pathname: "/icons/**" },
    ],
  },
  async redirects() {
    return [{ source: "/", destination: "/servers", permanent: false }];
  },
};

export default nextConfig;
