import { describe, expect, it } from "vitest";
import { calculateFinanceSummary } from "./finance.service";

describe("calculateFinanceSummary", () => {
  it("resta gastos aunque estén almacenados como negativos", () => {
    expect(calculateFinanceSummary([{ amount: -500, type: "EXPENSE" }], 4_200)).toEqual({
      spentThisWeek: 500,
      incomeThisWeek: 0,
      balance: 3_700,
    });
  });

  it("suma ingresos y no mezcla tipos", () => {
    expect(calculateFinanceSummary([
      { amount: 1_000, type: "INCOME" },
      { amount: -250, type: "EXPENSE" },
      { amount: 999, type: "UNKNOWN" },
    ], 4_200).balance).toBe(4_950);
  });
});
