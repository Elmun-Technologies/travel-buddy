import { describe, expect, it } from "vitest";
import { joinDenied, type Joiner, type JoinTrip } from "./rules";

const TODAY = "2026-11-14";
const trip: JoinTrip = {
  ownerUserId: "owner",
  status: "open",
  startDate: "2026-12-01",
  groupSizeMax: 4,
  approvedCount: 2,
  ageMin: 20,
  ageMax: 30,
  womenOnly: false,
};
const user: Joiner = {
  id: "u1",
  birthDate: "2000-05-10", // 26
  gender: "male",
  phoneVerified: false,
  memberStatus: null,
  blocked: false,
};

describe("joinDenied", () => {
  it("allows an eligible user", () => expect(joinDenied(trip, user, TODAY)).toBeNull());

  it.each<[string, Partial<JoinTrip>, Partial<Joiner>, string]>([
    ["own trip", {}, { id: "owner" }, "own_trip"],
    ["blocked", {}, { blocked: true }, "blocked"],
    ["pending request", {}, { memberStatus: "requested" }, "already"],
    ["approved member", {}, { memberStatus: "approved" }, "already"],
    ["closed", { status: "closed" }, {}, "not_open"],
    ["full status", { status: "full" }, {}, "full"],
    ["full by count", { approvedCount: 4 }, {}, "full"],
    ["started", { startDate: TODAY }, {}, "started"],
    ["too young", {}, { birthDate: "2007-01-01" }, "age"],
    ["too old", {}, { birthDate: "1980-01-01" }, "age"],
    ["women-only, male", { womenOnly: true }, {}, "women_only"],
    ["women-only, unverified", { womenOnly: true }, { gender: "female" }, "phone_required"],
  ])("denies: %s", (_, t, u, reason) => {
    expect(joinDenied({ ...trip, ...t }, { ...user, ...u }, TODAY)).toBe(reason);
  });

  it("lets a verified woman join a women-only trip", () => {
    expect(
      joinDenied({ ...trip, womenOnly: true }, { ...user, gender: "female", phoneVerified: true }, TODAY),
    ).toBeNull();
  });

  it("rejected users may request again", () => {
    expect(joinDenied(trip, { ...user, memberStatus: "rejected" }, TODAY)).toBeNull();
  });
});
