import type { NextConfig } from "next";

/**
 * In local dev, the admin app often uses same-origin `/api` (no NEXT_PUBLIC_API_URL).
 * Without a rewrite, Next.js has no handler for `/api/*` and returns "Cannot POST /api/...".
 * Point at the Nest process (default PORT 3004); override with ADMIN_DEV_API_ORIGIN if needed.
 */
const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    const origin = (process.env.ADMIN_DEV_API_ORIGIN || "http://127.0.0.1:3004").replace(/\/+$/, "");
    return [{ source: "/api/:path*", destination: `${origin}/api/:path*` }];
  },
};

export default nextConfig;

