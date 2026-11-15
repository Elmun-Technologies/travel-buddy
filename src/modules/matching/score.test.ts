import { describe, expect, it } from "vitest";
import { matchTrip, type Traveler, type TripForMatch } from "./score";

const u: Traveler = {
  age: 26,
  gender: "female",
  countries: ["GE"],
  windows: [{ start: "2026-11-20", end: "2026-11-27" }],
  budgetMax: 65000,
  styles: ["mountains", "food"],
  interests: ["hiking", "wine"],
  languages: ["uz", "ru"],
};
const t: TripForMatch = {
  country: "GE",
  startDate: "2026-11-20",
  endDate: "2026-11-27",
  flexDays: 0,
  budgetMin: 55000,
  budgetMax: 65000,
  styles: ["mountains"],
  ageMin: null,
  ageMax: null,
  womenOnly: false,
  organizer: { age: 28, interests: ["hiking"], languages: ["uz"] },
};

describe("matchTrip", () => {
  it("scores a near-perfect match high, with reasons in weight order", () => {
    const m = matchTrip(u, t)!;
    expect(m.percent).toBeGreaterThanOrEqual(90);
    expect(m.reasons.slice(0, 3)).toEqual(["destination", "dates", "budget"]);
  });

  it("hard filters: women-only and the trip's age range", () => {
    expect(matchTrip({ ...u, gender: "male" }, { ...t, womenOnly: true })).toBeNull();
    expect(matchTrip(u, { ...t, ageMin: 30 })).toBeNull();
    expect(matchTrip(u, { ...t, ageMax: 25 })).toBeNull();
  });

  it("a different country and no shared dates pull the score down", () => {
    const m = matchTrip(u, { ...t, country: "TR", startDate: "2027-03-01", endDate: "2027-03-05" })!;
    expect(m.percent).toBeLessThan(60);
    expect(m.reasons).not.toContain("destination");
    expect(m.reasons).not.toContain("dates");
  });

  it("flex days count toward the date overlap", () => {
    const later = { ...t, startDate: "2026-11-28", endDate: "2026-11-30" }; // 1 day after the window
    expect(matchTrip(u, later)!.reasons).not.toContain("dates");
    expect(matchTrip(u, { ...later, flexDays: 3 })!.reasons).toContain("dates");
  });

  it("does not invent a number when it knows too little", () => {
    const blank: Traveler = {
      ...u,
      countries: [],
      windows: [],
      budgetMax: null,
      styles: [],
      interests: [],
      languages: [],
    };
    expect(matchTrip(blank, { ...t, organizer: null })).toEqual({ percent: null, reasons: [] });
  });
});
