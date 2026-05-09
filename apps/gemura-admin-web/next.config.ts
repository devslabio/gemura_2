import type { NextConfig } from "next";

/**
 * When `NEXT_PUBLIC_API_URL` is unset (or relative `/api`), the browser calls same-origin `/api/*`.
 * Next.js has no route there — without a rewrite you get 404 on every API call (including `next start`).
 * If `NEXT_PUBLIC_API_URL` is an absolute http(s) URL, the client talks to Nest directly — skip proxy.
 *
 * Nest default: `http://127.0.0.1:3004` — override with `ADMIN_DEV_API_ORIGIN`.
 */
const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    const publicApi = process.env.NEXT_PUBLIC_API_URL?.trim() ?? "";
    if (/^https?:\/\//i.test(publicApi)) {
      return [];
    }
    const origin = (process.env.ADMIN_DEV_API_ORIGIN || "http://127.0.0.1:3004").replace(/\/+$/, "");
    return [{ source: "/api/:path*", destination: `${origin}/api/:path*` }];
  },
};

export default nextConfig;

