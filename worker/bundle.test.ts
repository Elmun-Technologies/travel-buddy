// Runs the *production* worker bundle (dist/index.mjs) against a fake Telegram Bot API.
// Guards against bundling bugs like esbuild renaming AbortSignal → node-fetch rejecting the signal.
import { execFileSync, spawn } from "node:child_process";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { expect, it } from "vitest";

it.runIf(!!process.env.DATABASE_URL)(
  "bundled bot can call the Telegram API and starts polling",
  async () => {
    execFileSync("pnpm", ["-s", "worker:build"], { stdio: "ignore" });

    const calls: string[] = [];
    const api = http.createServer((req, res) => {
      const method = req.url!.split("/").pop()!;
      calls.push(method);
      const result =
        method === "getMe"
          ? { id: 1, is_bot: true, first_name: "t", username: "stub_bot" }
          : method === "getUpdates"
            ? []
            : true;
      res.setHeader("content-type", "application/json");
      setTimeout(() => res.end(JSON.stringify({ ok: true, result })), method === "getUpdates" ? 200 : 0);
    });
    await new Promise<void>((r) => api.listen(0, "127.0.0.1", r));
    const { port } = api.address() as AddressInfo;

    const worker = spawn(process.execPath, ["dist/index.mjs"], {
      env: {
        ...process.env,
        TELEGRAM_BOT_TOKEN: "1:test",
        TELEGRAM_API_ROOT: `http://127.0.0.1:${port}`,
        APP_URL: "https://example.com", // https → bot also sets the Mini App menu button
      },
    });
    let out = "";
    worker.stdout.on("data", (d) => (out += d));
    worker.stderr.on("data", (d) => (out += d));

    try {
      const deadline = Date.now() + 20_000;
      while (!calls.includes("getUpdates") && !out.includes("bot failed") && Date.now() < deadline)
        await new Promise((r) => setTimeout(r, 100));
      expect(out).not.toContain("bot failed");
      expect(out).toContain("bot @stub_bot polling");
      expect(calls).toEqual(expect.arrayContaining(["setChatMenuButton", "getMe", "getUpdates"]));
    } finally {
      const exited = new Promise<number | null>((r) => worker.on("exit", r));
      worker.kill("SIGTERM");
      expect(await exited).toBe(0); // graceful shutdown
      api.close();
    }
  },
  60_000,
);
