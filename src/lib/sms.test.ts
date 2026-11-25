import { describe, expect, it, vi } from "vitest";
import { createEskiz, eskizNumber } from "./sms";

describe("Eskiz SMS adapter", () => {
  it("accepts only Uzbek numbers, digits only", () => {
    expect(eskizNumber("+998 90 123-45-67")).toBe("998901234567");
    expect(eskizNumber("+7 912 345 67 89")).toBeNull();
    expect(eskizNumber("90123")).toBeNull();
  });

  it("logs in once, sends, and logs in again when the token expired", async () => {
    const calls: string[] = [];
    let logins = 0;
    const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = String(url);
      calls.push(u.replace("https://notify.eskiz.uz/api", ""));
      if (u.endsWith("/auth/login")) return Response.json({ data: { token: `t${++logins}` } });
      const auth = (init?.headers as Record<string, string>).authorization;
      // the first token is rejected once (expired), the second works
      return auth === "Bearer t1" && logins === 1 && calls.filter((c) => c.includes("sms/send")).length === 1
        ? new Response("{}", { status: 401 })
        : Response.json({ status: "waiting" });
    }) as unknown as typeof fetch;
    const sms = createEskiz({ ESKIZ_EMAIL: "a@b.uz", ESKIZ_PASSWORD: "x", ESKIZ_FROM: "4546" }, fetchFn);
    expect(await sms.send("+998901234567", "Salom")).toBe(true);
    expect(calls).toEqual(["/auth/login", "/message/sms/send", "/auth/login", "/message/sms/send"]);
    expect(await sms.send("+79123456789", "x")).toBe(false); // not an Uzbek number: nothing is sent
    expect(calls).toHaveLength(4);
  });

  it("returns false when the login fails", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { status: 500 })) as unknown as typeof fetch;
    expect(
      await createEskiz({ ESKIZ_EMAIL: "a", ESKIZ_PASSWORD: "b" }, fetchFn).send("+998901234567", "x"),
    ).toBe(false);
  });
});
