import { describe, expect, it } from "vitest";
import { buildProactiveCandidates, isWithinQuietHours } from "./proactivity";

describe("Shadow proactivity", () => {
  it("respeta ventanas nocturnas que cruzan medianoche", () => {
    const timezone = "America/Mexico_City";
    expect(isWithinQuietHours(new Date("2026-08-21T05:30:00.000Z"), timezone, "23:00", "08:00")).toBe(true);
    expect(isWithinQuietHours(new Date("2026-08-20T18:00:00.000Z"), timezone, "23:00", "08:00")).toBe(false);
  });

  it("prioriza una entrega próxima y una desviación de gasto", () => {
    const now = new Date("2026-08-20T18:00:00.000Z");
    const candidates = buildProactiveCandidates({
      now,
      timezone: "America/Mexico_City",
      todayCalories: 1_500,
      todayWater: 2,
      todayExpense: 1_200,
      latestWorkoutAt: new Date("2026-08-19T18:00:00.000Z"),
      latestSleep: 7,
      assignments: [{ id: "a1", title: "Ensayo", course: "Historia", dueDate: new Date("2026-08-21T00:00:00.000Z"), status: "pending" }],
      patterns: [{
        id: "p1", signature: "finance:daily-spending-baseline", kind: "spending_baseline",
        subject: "gasto", title: "Gasto", description: "Base", evidence: { dailyAverage: 300 }, confidence: 0.9, sampleSize: 10,
      }],
    });

    expect(candidates.some((candidate) => candidate.type === "university.deadline")).toBe(true);
    expect(candidates.some((candidate) => candidate.type === "finance.spend_anomaly")).toBe(true);
    expect(candidates[0].urgency).toBeGreaterThanOrEqual(candidates[1].urgency);
  });
});
