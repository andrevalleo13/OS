import { describe, expect, it } from "vitest";
import { createDraft, formatClock, isDraft, isSetPr, parseLoad, summarizeDraft, type SessionDraft } from "./session";
import type { Ghost, RoutineDay } from "./types";

const day: RoutineDay = {
  weekday: 1,
  day: "Lunes",
  name: "Upper",
  focus: "Énfasis Pecho",
  kind: "fuerza",
  exercises: [
    { name: "Press inclinado con mancuernas", muscleId: "chest", sets: null, reps: null },
    { name: "Saltos", muscleId: null, sets: 3, reps: "10" },
  ],
  notes: [],
};

const ghosts: Record<string, Ghost> = {
  "press inclinado con mancuernas": { kg: 27.2, value: 60, unit: "lb", reps: "", key: "2026-08-27", best: 27.2 },
};

describe("session drafts", () => {
  it("creates a draft from the routine using the protocol sets and ghost units", () => {
    const draft = createDraft(day, ghosts, 2, 1_000, "al fallo");
    expect(draft).toMatchObject({ title: "Upper (Énfasis Pecho)", subtitle: "Lunes", weekday: 1, startedAt: 1_000 });
    expect(draft.exercises.map((item) => [item.name, item.sets.length, item.sets[0].unit, item.target])).toEqual([
      ["Press inclinado con mancuernas", 2, "lb", "al fallo"],
      ["Saltos", 3, "kg", "10"],
    ]);
    expect(isDraft(draft)).toBe(true);
    expect(isDraft({ v: 2 })).toBe(false);
    expect(createDraft(null, {}, 2, 0, null)).toMatchObject({ title: "Sesión libre", exercises: [] });
  });

  it("parses loads in kg or lb", () => {
    expect(parseLoad({ weight: "65", reps: "8", unit: "lb" })).toEqual({ kg: 29.5, reps: 8 });
    expect(parseLoad({ weight: "", reps: "12", unit: "kg" })).toEqual({ kg: null, reps: 12 });
    expect(parseLoad({ weight: "abc", reps: "0", unit: "kg" })).toEqual({ kg: null, reps: null });
  });

  it("summarizes volume, PRs and the save payload", () => {
    const draft: SessionDraft = createDraft(day, ghosts, 2, 0, null);
    draft.exercises[0].sets = [
      { id: "a", weight: "65", reps: "8", unit: "lb", done: true },
      { id: "b", weight: "60", reps: "9", unit: "lb", done: false },
    ];
    draft.exercises[1].sets = [
      { id: "c", weight: "", reps: "10", unit: "kg", done: true },
      { id: "d", weight: "", reps: "", unit: "kg", done: false },
      { id: "e", weight: "", reps: "", unit: "kg", done: false },
    ];
    const summary = summarizeDraft(draft, ghosts);
    expect(summary).toMatchObject({ doneSets: 2, totalSets: 5, loggedSets: 3 });
    expect(summary.volume).toBe(Math.round(29.5 * 8 + 27.2 * 9));
    expect(summary.prs).toEqual([{ name: "Press inclinado con mancuernas", kg: 29.5, previous: 27.2 }]);
    expect(summary.payload).toEqual([
      { name: "Press inclinado con mancuernas", sets: 2, reps: "8, 9", weight: 29.5, muscleId: "chest" },
      { name: "Saltos", sets: 1, reps: "10", weight: null, muscleId: "other" },
    ]);
    expect(isSetPr(draft.exercises[0].sets[0], ghosts["press inclinado con mancuernas"])).toBe(true);
    expect(isSetPr(draft.exercises[0].sets[1], ghosts["press inclinado con mancuernas"])).toBe(false);
  });

  it("formats clocks", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(125)).toBe("2:05");
    expect(formatClock(3725)).toBe("1:02:05");
  });
});
