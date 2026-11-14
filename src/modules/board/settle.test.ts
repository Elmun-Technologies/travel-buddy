import { describe, expect, it } from "vitest";
import { balances, settle } from "./settle";

describe("settle", () => {
  it("splits one expense equally", () => {
    expect(settle([{ paidBy: "a", amount: 300, splitAmong: ["a", "b", "c"] }], [])).toEqual([
      { from: "b", to: "a", amount: 100 },
      { from: "c", to: "a", amount: 100 },
    ]);
  });

  it("keeps cents exact when the amount does not divide", () => {
    const b = balances([{ paidBy: "a", amount: 100, splitAmong: ["a", "b", "c"] }], []);
    expect([...b.values()].reduce((x, y) => x + y, 0)).toBe(0);
    expect(b.get("b")! + b.get("c")!).toBe(-66);
  });

  it("nets out mutual debts and repayments", () => {
    const ex = [
      { paidBy: "a", amount: 200, splitAmong: ["a", "b"] },
      { paidBy: "b", amount: 100, splitAmong: ["a", "b"] },
    ];
    expect(settle(ex, [])).toEqual([{ from: "b", to: "a", amount: 50 }]);
    expect(settle(ex, [{ from: "b", to: "a", amount: 50 }])).toEqual([]);
  });

  it("ignores an expense split among nobody", () => {
    expect(settle([{ paidBy: "a", amount: 100, splitAmong: [] }], [])).toEqual([]);
  });
});
