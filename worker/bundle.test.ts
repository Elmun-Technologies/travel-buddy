// Runs the *production* worker bundle (dist/index.mjs) against a fake Telegram Bot API.
// Guards against bundling bugs like esbuild renaming AbortSignal → node-fetch rejecting the signal.
import { execFileSync, spawn } from "node:child_process";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { authAccounts, notifications, trips, users } from "@/db/schema";
import { getDb } from "@/lib/db";

it.runIf(!!process.env.DATABASE_URL)(
  "bundled bot can call the Telegram API and starts polling",
  async () => {
    execFileSync("pnpm", ["-s", "worker:build"], { stdio: "ignore" });

    // A queued notification for a Telegram user: the worker must deliver it via sendMessage.
    const db = getDb();
    const chatId = String(4_200_000_000 + Math.floor(Math.random() * 1e6));
    const [u] = await db.insert(users).values({ locale: "uz" }).returning({ id: users.id });
    await db.insert(authAccounts).values({ userId: u.id, provider: "telegram", providerUserId: chatId });
    const [trip] = await db
      .insert(trips)
      .values({
        kind: "independent",
        ownerUserId: u.id,
        title: "TEST notify",
        destinationCountry: "GE",
        startDate: "2099-01-01",
        endDate: "2099-01-05",
        status: "open",
        isTest: true,
      })
      .returning({ id: trips.id });
    const [n] = await db
      .insert(notifications)
      .values({ userId: u.id, type: "join_approved", payload: { tripId: trip.id }, channel: "telegram" })
      .returning({ id: notifications.id });

    const calls: string[] = [];
    const sent: string[] = [];
    const api = http.createServer((req, res) => {
      const method = req.url!.split("/").pop()!;
      calls.push(method);
      if (method === "sendMessage") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => sent.push(body));
      }
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
        APP_ENV: "test",
        TELEGRAM_BOT_TOKEN: "1:test",
        TELEGRAM_API_ROOT: `http://127.0.0.1:${port}`,
        APP_URL: "https://example.com", // https → bot also sets the Mini App menu button
      },
    });
    let out = "";
    worker.stdout.on("data", (d) => (out += d));
    worker.stderr.on("data", (d) => (out += d));

    try {
      const deadline = Date.now() + 25_000;
      while (
        !(calls.includes("getUpdates") && sent.length) &&
        !out.includes("bot failed") &&
        Date.now() < deadline
      )
        await new Promise((r) => setTimeout(r, 100));
      expect(out).not.toContain("bot failed");
      expect(out).toContain("bot @stub_bot polling");
      expect(calls).toEqual(
        expect.arrayContaining(["setChatMenuButton", "getMe", "getUpdates", "sendMessage"]),
      );
      expect(sent.join()).toContain(chatId);
      expect(sent.join()).toContain("TEST notify");
      const [row] = await db
        .select({ sentAt: notifications.sentAt })
        .from(notifications)
        .where(eq(notifications.id, n.id));
      expect(row.sentAt).not.toBeNull();
    } finally {
      const exited = new Promise<number | null>((r) => worker.on("exit", r));
      worker.kill("SIGTERM");
      expect(await exited).toBe(0); // graceful shutdown
      api.close();
      await db.execute(sql`delete from trips where id = ${trip.id}`);
      await db.delete(users).where(eq(users.id, u.id));
    }
  },
  60_000,
);
