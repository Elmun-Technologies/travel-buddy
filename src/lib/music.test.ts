import { expect, it } from "vitest";
import { motif } from "./music";

it("each country has its own, stable tune that resolves to the tonic", () => {
  const ge = motif("GE");
  expect(motif("GE")).toEqual(ge); // same country, same tune
  expect(motif("TR").notes.map((n) => n.midi)).not.toEqual(ge.notes.map((n) => n.midi));
  expect(ge.notes).toHaveLength(10);
  expect((ge.notes.at(-1)!.midi - ge.tonic) % 12).toBe(0); // ends on the tonic
  // Georgian dorian: every note belongs to the mode
  const dorian = [0, 2, 3, 5, 7, 9, 10];
  for (const n of ge.notes) expect(dorian).toContain((((n.midi - ge.tonic) % 12) + 12) % 12);
  expect(ge.length).toBeGreaterThan(2);
  expect(ge.length).toBeLessThan(7);
  expect(motif("XX").tonic).toBe(motif("UZ").tonic); // unknown country: Central Asian default
});
