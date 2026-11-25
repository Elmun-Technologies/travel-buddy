import { afterEach, expect, it, vi } from "vitest";
import { personId, sendEvent } from "./analytics";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

it("does nothing without a key", async () => {
  const f = vi.fn();
  vi.stubGlobal("fetch", f);
  await sendEvent("signup", "u_1");
  expect(f).not.toHaveBeenCalled();
});

it("sends a pseudonymous event to the EU host and never throws", async () => {
  vi.stubEnv("POSTHOG_KEY", "phc_test");
  vi.stubEnv("APP_ENV", "staging");
  const f = vi.fn().mockResolvedValue(new Response("{}"));
  vi.stubGlobal("fetch", f);
  await sendEvent("trip_created", personId("user-123"), { country: "GE" });
  const [url, init] = f.mock.calls[0];
  expect(url).toBe("https://eu.i.posthog.com/capture/");
  const body = JSON.parse(init.body);
  expect(body).toMatchObject({
    api_key: "phc_test",
    event: "trip_created",
    properties: { country: "GE", env: "staging" },
  });
  expect(body.distinct_id).toMatch(/^u_[a-f0-9]{20}$/);
  expect(JSON.stringify(body)).not.toContain("user-123"); // the raw id never leaves

  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
  await expect(sendEvent("signup", "u_1")).resolves.toBeUndefined();
});
