import { describe, expect, it } from "vitest";
import { detectBehaviorPatterns } from "./patterns";

const timezone = "America/Mexico_City";

describe("detectBehaviorPatterns", () => {
  it("detecta horarios, cadencia, gasto y sueño con evidencia suficiente", () => {
    const result = detectBehaviorPatterns({
      timezone,
      food: [12, 13, 13, 14].map((hour, index) => ({
        date: new Date(`2026-08-${String(index + 1).padStart(2, "0")}T${hour + 6}:00:00.000Z`),
        calories: 500,
        water: 0,
      })),
      workouts: [1, 3, 5, 8].map((day) => ({ date: new Date(`2026-08-${String(day).padStart(2, "0")}T18:00:00.000Z`) })),
      transactions: [1, 2, 3, 4, 5].map((day, index) => ({
        date: new Date(`2026-08-${String(day).padStart(2, "0")}T18:00:00.000Z`),
        amount: -(100 + index * 20),
      })),
      biometrics: [7, 7.5, 6.5, 8, 7].map((sleep, index) => ({
        date: new Date(`2026-08-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`),
        sleep,
      })),
    });

    expect(result.map((pattern) => pattern.kind)).toEqual([
      "meal_timing",
      "workout_cadence",
      "spending_baseline",
      "sleep_baseline",
    ]);
    expect(result.every((pattern) => pattern.confidence >= 0.5)).toBe(true);
  });

  it("no inventa patrones con muestras insuficientes", () => {
    expect(detectBehaviorPatterns({ timezone, food: [], workouts: [], transactions: [], biometrics: [] })).toEqual([]);
  });
});
