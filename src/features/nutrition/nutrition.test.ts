import { describe, expect, it } from "vitest";
import { normalizeStoredBreakdown, sumNutritionItems, withDraftItems, type FoodAnalysisDraft } from "./nutrition";

describe("nutrition calculations", () => {
  it("recalculates canonical totals from editable ingredients", () => {
    expect(sumNutritionItems([
      { name: "Huevos", quantity: 3, unit: "piezas", calories: 210, protein: 18, carbs: 1.5, fat: 15 },
      { name: "Tortillas", quantity: 2, unit: "piezas", calories: 120, protein: 3, carbs: 24, fat: 2 },
    ], 0.5)).toEqual({ calories: 330, protein: 21, carbs: 25.5, fat: 17, water: 0.5 });
  });

  it("normalizes legacy breakdowns without quantity or unit", () => {
    expect(normalizeStoredBreakdown([{ name: "Arroz", calories: 200, protein: 4, carbs: 45, fat: 1 }])).toEqual([
      { name: "Arroz", quantity: 1, unit: "porción", calories: 200, protein: 4, carbs: 45, fat: 1 },
    ]);
  });

  it("keeps draft totals in sync after an edit", () => {
    const draft: FoodAnalysisDraft = {
      description: "Yogur",
      mealType: "snack",
      confidence: 0.9,
      assumptions: [],
      clarificationQuestion: null,
      water: 0,
      items: [{ name: "Yogur", quantity: 1, unit: "vaso", calories: 120, protein: 10, carbs: 12, fat: 3 }],
      totals: { calories: 120, protein: 10, carbs: 12, fat: 3, water: 0 },
    };
    const updated = withDraftItems(draft, [{ ...draft.items[0], calories: 150, protein: 15 }]);
    expect(updated.totals).toEqual({ calories: 150, protein: 15, carbs: 12, fat: 3, water: 0 });
  });
});
