export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
};

export type FoodAnalysisItem = {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type FoodAnalysisDraft = {
  description: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack" | "drink";
  confidence: number;
  assumptions: string[];
  clarificationQuestion: string | null;
  water: number;
  items: FoodAnalysisItem[];
  totals: MacroTotals;
};

export type FoodLogView = MacroTotals & {
  id: string;
  date: string;
  description: string;
  breakdown: FoodAnalysisItem[];
};

export type ShadowNutritionInsight = {
  message: string;
  nutrition: {
    remainingCalories: number;
    remainingProtein: number;
    remainingCarbs: number;
    remainingFat: number;
  };
  training: {
    state: "completed" | "planned" | "rest";
    label: string;
    detail: string;
  };
  recovery: {
    readiness: number;
    label: string;
    detail: string;
  };
};

export const NUTRITION_GOALS: Readonly<MacroTotals> = Object.freeze({
  calories: 2_850,
  protein: 135,
  carbs: 365,
  fat: 95,
  water: 3,
});

function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function sumNutritionItems(items: FoodAnalysisItem[], water = 0): MacroTotals {
  const totals = items.reduce(
    (result, item) => ({
      calories: result.calories + item.calories,
      protein: result.protein + item.protein,
      carbs: result.carbs + item.carbs,
      fat: result.fat + item.fat,
      water: result.water,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, water },
  );

  return {
    calories: Math.round(totals.calories),
    protein: round(totals.protein),
    carbs: round(totals.carbs),
    fat: round(totals.fat),
    water: round(water, 2),
  };
}

export function normalizeStoredBreakdown(value: unknown): FoodAnalysisItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Record<string, unknown>;
    if (typeof item.name !== "string") return [];

    const numeric = (key: string, fallback = 0) => {
      const number = Number(item[key]);
      return Number.isFinite(number) && number >= 0 ? number : fallback;
    };

    return [{
      name: item.name,
      quantity: numeric("quantity", 1),
      unit: typeof item.unit === "string" && item.unit.trim() ? item.unit : "porción",
      calories: numeric("calories"),
      protein: numeric("protein"),
      carbs: numeric("carbs"),
      fat: numeric("fat"),
    }];
  });
}

export function withDraftItems(draft: FoodAnalysisDraft, items: FoodAnalysisItem[]): FoodAnalysisDraft {
  return { ...draft, items, totals: sumNutritionItems(items, draft.water) };
}
