import { describe, expect, it } from "vitest";
import { profileSchema } from "../profiles/schema";
import { tripSchema } from "./schema";
import { todayISO } from "@/lib/catalog";

const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

const trip = {
  title: "Tbilisi weekend",
  destinationCountry: "GE",
  destinationCity: "",
  startDate: plusDays(10),
  endDate: plusDays(14),
  groupSizeMax: "4",
  budgetMin: "500",
  budgetMax: "650",
  travelStyles: ["trekking"],
  description: "",
};

const issues = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) =>
  r.error?.issues.map((i) => `${i.path.join(".")}:${i.message}`) ?? [];

describe("tripSchema", () => {
  it("parses and converts budget to minor units", () => {
    const v = tripSchema.parse(trip);
    expect(v).toMatchObject({ budgetMin: 50000, budgetMax: 65000, groupSizeMax: 4, destinationCity: null });
  });

  it("rejects past start, end before start, too long, budget and age inversions", () => {
    expect(issues(tripSchema.safeParse({ ...trip, startDate: plusDays(-2) }))).toContain("startDate:past");
    expect(issues(tripSchema.safeParse({ ...trip, endDate: plusDays(5) }))).toContain("endDate:before_start");
    expect(issues(tripSchema.safeParse({ ...trip, endDate: plusDays(200) }))).toContain("endDate:too_long");
    expect(issues(tripSchema.safeParse({ ...trip, budgetMin: "900" }))).toContain("budgetMax:min_gt_max");
    expect(issues(tripSchema.safeParse({ ...trip, ageMin: "40", ageMax: "30" }))).toContain(
      "ageMax:min_gt_max",
    );
  });

  it("rejects unknown country and too large groups", () => {
    expect(tripSchema.safeParse({ ...trip, destinationCountry: "XX" }).success).toBe(false);
    expect(tripSchema.safeParse({ ...trip, groupSizeMax: "100" }).success).toBe(false);
  });
});

describe("profileSchema 18+", () => {
  const base = { displayName: "Ali", languages: ["uz"], bio: "", city: "" };
  const yearsAgo = (y: number) => {
    const [Y, M, D] = todayISO().split("-");
    return `${Number(Y) - y}-${M}-${D}`;
  };

  it("accepts exactly 18 today, rejects one day younger", () => {
    expect(profileSchema.safeParse({ ...base, birthDate: yearsAgo(18) }).success).toBe(true);
    const [Y, M, D] = yearsAgo(18).split("-").map(Number);
    const dayLater = new Date(Date.UTC(Y, M - 1, D + 1)).toISOString().slice(0, 10);
    expect(issues(profileSchema.safeParse({ ...base, birthDate: dayLater }))).toContain("birthDate:under_18");
  });

  it("requires at least one language", () => {
    expect(profileSchema.safeParse({ ...base, birthDate: yearsAgo(25), languages: [] }).success).toBe(false);
  });
});
