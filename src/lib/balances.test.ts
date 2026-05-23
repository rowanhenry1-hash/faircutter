import { describe, expect, it } from "vitest";
import { computePairwiseDebts } from "./pairwise-debts";

describe("computePairwiseDebts", () => {
  it("simplifies three-way equal split into two debts", () => {
    const balances = new Map([
      ["a", 6000],
      ["b", -3000],
      ["c", -3000],
    ]);

    const debts = computePairwiseDebts(balances);
    expect(debts).toHaveLength(2);
    expect(debts).toContainEqual({ from: "b", to: "a", amount: 3000 });
    expect(debts).toContainEqual({ from: "c", to: "a", amount: 3000 });
  });

  it("returns empty when everyone is settled", () => {
    const balances = new Map([
      ["a", 0],
      ["b", 0],
    ]);
    expect(computePairwiseDebts(balances)).toEqual([]);
  });
});
