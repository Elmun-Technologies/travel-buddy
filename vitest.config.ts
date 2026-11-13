import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Services import "server-only"; it's a no-op guard outside React Server bundles.
      "server-only": fileURLToPath(new URL("./test/empty.ts", import.meta.url)),
    },
  },
  test: { include: ["src/**/*.test.ts", "worker/**/*.test.ts"], fileParallelism: false },
});
