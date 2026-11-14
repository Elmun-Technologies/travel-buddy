import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  // deploymentId comes from NEXT_DEPLOYMENT_ID (git SHA, set in the Docker build).
  // HTML must never be cached: Telegram's WebView would keep a page from an old build.
  async headers() {
    return [{ source: "/:locale(uz|ru|en)/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default createNextIntlPlugin("./src/i18n/request.ts")(nextConfig);
