import type { NextConfig } from "next";
import { SITE_BANNER_URL } from "./lib/site-assets";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/banner.jpg",
        destination: SITE_BANNER_URL,
        permanent: false,
      },
      {
        // Keep service endpoints and framework assets on their requested host.
        source: "/:path((?!api(?:/|$)|_next(?:/|$)).*)",
        has: [{ type: "host", value: "dinhthong-gallery\\.vercel\\.app" }],
        destination: "https://dinhthongphotos.io.vn/:path",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "drive.google.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
