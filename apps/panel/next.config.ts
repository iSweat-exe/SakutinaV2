import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Discord avatars of the signed-in user.
    remotePatterns: [{ protocol: "https", hostname: "cdn.discordapp.com", pathname: "/avatars/**" }],
  },
  async redirects() {
    return [{ source: "/", destination: "/servers", permanent: false }];
  },
};

export default nextConfig;
