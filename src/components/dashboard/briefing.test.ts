import { describe, expect, it } from "vitest";
import { buildBriefing, greetingFor } from "./briefing";
import type { DashboardInitialData } from "./types";

const base: DashboardInitialData = {
  finance: { transactions: [], balance: 0, spentThisWeek: 0, incomeThisWeek: 0 },
  biometrics: {
    latest: { weight: null, sleep: null, hrv: null, steps: null },
    averages: { weight: null, sleep: null, hrv: null, steps: null },
    readiness: 60,
  },
  nutrition: { totals: { calories: 0, protein: 0, carbs: 0, fat: 0, water: 0 }, logs: [] },
  assignments: [],
  gym: { totalWorkouts: 0, lifetimeVolume: 0, currentWeight: 0, sessionHistory: [] },
  notes: [],
};

const morning = new Date(2026, 9, 7, 9, 0);

describe("dashboard briefing", () => {
  it("saluda según la hora", () => {
    expect(greetingFor(8)).toBe("Buenos días");
    expect(greetingFor(15)).toBe("Buenas tardes");
    expect(greetingFor(23)).toBe("Buenas noches");
    expect(greetingFor(3)).toBe("Buenas noches");
  });

  it("no inventa urgencia sin datos", () => {
    expect(buildBriefing(base, morning)).toEqual([]);
  });

  it("prioriza entregas próximas e ignora las terminadas o lejanas", () => {
    const data: DashboardInitialData = {
      ...base,
      assignments: [
        { id: "a", title: "Ensayo", dueDate: new Date(2026, 9, 7, 20).toISOString(), status: "pending", course: { id: "c", name: "Ética" } },
        { id: "b", title: "Hecha", dueDate: new Date(2026, 9, 7, 12).toISOString(), status: "done", course: { id: "c", name: "Ética" } },
        { id: "c", title: "Lejana", dueDate: new Date(2026, 9, 20).toISOString(), status: "pending", course: { id: "c", name: "Ética" } },
      ],
    };
    const items = buildBriefing(data, morning);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ tone: "focus", label: "Ensayo · en 11 h", href: "/uni" });
  });

  it("solo opina de recuperación con biometría real", () => {
    expect(buildBriefing({ ...base, biometrics: { ...base.biometrics, readiness: 30 } }, morning)).toEqual([]);
    const withData = { ...base, biometrics: { ...base.biometrics, readiness: 30, latest: { ...base.biometrics.latest, hrv: 40 } } };
    expect(buildBriefing(withData, morning)[0]?.id).toBe("readiness:low");
  });

  it("avisa de comida atrasada por la tarde y nunca da más de tres puntos", () => {
    const evening = new Date(2026, 9, 7, 18, 0);
    const data: DashboardInitialData = {
      ...base,
      finance: { ...base.finance, spentThisWeek: 900 },
      gym: { ...base.gym, sessionHistory: [{ id: "s", date: new Date(2026, 9, 1).toISOString(), routineName: "Push", duration: "1h", totalVolume: 1 }] },
      biometrics: { ...base.biometrics, readiness: 85, latest: { ...base.biometrics.latest, sleep: 8 } },
      assignments: [{ id: "a", title: "Tarea", dueDate: new Date(2026, 9, 8, 9).toISOString(), status: "pending", course: { id: "c", name: "X" } }],
    };
    const items = buildBriefing(data, evening);
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.id)).toEqual(["assignment:a", "readiness:high", "nutrition:behind"]);
  });
});
