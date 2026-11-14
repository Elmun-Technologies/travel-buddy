import { expect, it } from "vitest";
import { profileSchema } from "./schema";

const base = { displayName: "Nodira", birthDate: "1998-03-21", languages: ["uz"], city: "", bio: "" };

it("women-only group preference needs gender female", () => {
  expect(profileSchema.safeParse({ ...base, gender: "female", groupPref: "women_only" }).success).toBe(true);
  const r = profileSchema.safeParse({ ...base, gender: "male", groupPref: "women_only" });
  expect(r.success).toBe(false);
  expect(r.error?.issues[0]).toMatchObject({ path: ["groupPref"], message: "women_only_pref" });
});

it("new preference fields stay optional (profile edit doesn't send them)", () => {
  const r = profileSchema.safeParse({ ...base, gender: null });
  expect(r.success && r.data.groupPref === undefined && r.data.dreamDestinations === undefined).toBe(true);
});
