import { describe, expect, it } from "vitest";
import { flightSearchUrl } from "./aviasales";

const trip = {
  destinationCountry: "GE",
  destinationCity: null,
  startDate: "2026-11-20",
  endDate: "2026-11-27",
};

describe("flightSearchUrl", () => {
  it("fills route and dates", () => {
    expect(flightSearchUrl(trip, "")).toBe("https://www.aviasales.uz/search/TAS2011TBS27111");
  });
  it("adds the marker when set and prefers the city airport", () => {
    expect(flightSearchUrl({ ...trip, destinationCity: "Batumi" }, "123")).toBe(
      "https://www.aviasales.uz/search/TAS2011BUS27111?marker=123",
    );
  });
  it("has no link for an unknown destination", () => {
    expect(flightSearchUrl({ ...trip, destinationCountry: "XX" }, "")).toBeNull();
  });
});
