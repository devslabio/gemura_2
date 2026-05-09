import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    // Allow the frontend to call the Nest backend via same-origin `/api/*` during local dev.
    // Nest uses global prefix `api` so the target should include `/api`.
    // Set NEXT_PUBLIC_API_URL in prod/other environments to bypass this.
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3004/api/:path*",
      },
    ];
  },
};

export default nextConfig;
