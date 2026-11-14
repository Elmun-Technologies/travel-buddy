import { expect, it } from "vitest";
import { formatBudget } from "./format";

it("formats budgets like the design", () => {
  expect(formatBudget(55000, 65000, "USD")).toBe("$550–650");
  expect(formatBudget(30000, null, "USD")).toBe("$300+");
  expect(formatBudget(null, 60000, "USD")).toBe("≤ $600");
  expect(formatBudget(null, null, "USD")).toBeNull();
});
