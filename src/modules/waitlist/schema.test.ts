import { describe, expect, it } from "vitest";
import { contactSchema, waitlistSchema } from "./schema";

describe("contactSchema", () => {
  it.each([
    ["Ali@Mail.UZ ", { type: "email", value: "ali@mail.uz" }],
    ["@Travel_Bro", { type: "telegram", value: "@travel_bro" }],
    ["travel_bro", { type: "telegram", value: "@travel_bro" }],
    ["https://t.me/travel_bro", { type: "telegram", value: "@travel_bro" }],
  ])("accepts %s", (input, expected) => {
    expect(contactSchema.parse(input)).toEqual(expected);
  });

  it.each(["", "abc", "@ab", "not an email@", "a@b", "@1abcde", "x".repeat(300)])("rejects %j", (input) => {
    expect(contactSchema.safeParse(input).success).toBe(false);
  });
});

describe("waitlistSchema", () => {
  const ok = { contact: "a@b.uz", locale: "uz" };

  it("defaults destinations to []", () => {
    expect(waitlistSchema.parse(ok).destinations).toEqual([]);
  });

  it("rejects unknown destination and locale", () => {
    expect(waitlistSchema.safeParse({ ...ok, destinations: ["XX"] }).success).toBe(false);
    expect(waitlistSchema.safeParse({ ...ok, locale: "de" }).success).toBe(false);
  });

  it("rejects filled honeypot", () => {
    expect(waitlistSchema.safeParse({ ...ok, website: "spam" }).success).toBe(false);
  });
});
