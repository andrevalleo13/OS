import { describe, expect, it } from "vitest";
import { addDays, daysBetween, mondayOf, weekdayOf } from "./dates";
import { buildGymView, isValidSession, routineFromTemplate } from "./derive";
import type { DailyEntry, GymHistory, GymVaultSnapshot, HistorySession, RoutineDay } from "./types";

const strength = (weekday: number, name: string, exercises: [string, string | null][]): RoutineDay => ({
  weekday,
  day: "",
  name,
  focus: null,
  kind: "fuerza",
  exercises: exercises.map(([exercise, muscleId]) => ({ name: exercise, muscleId, sets: null, reps: null })),
  notes: [],
});

const ROUTINE: RoutineDay[] = [
  strength(1, "Upper", [["Press inclinado", "chest"], ["Remo", "lats"]]),
  strength(2, "Lower", [["Sentadilla", "quads"]]),
  strength(4, "Upper", [["Remo", "lats"], ["Press inclinado", "chest"]]),
  strength(5, "Lower", [["Peso muerto rumano", "hamstrings"]]),
  { weekday: 0, day: "Domingo", name: "Gameday", focus: null, kind: "partido", exercises: [], notes: [] },
];

const daily = (key: string, patch: Partial<DailyEntry> = {}): DailyEntry => ({
  key,
  path: `Diario/${key}.md`,
  gym: null,
  gymDetail: null,
  other: null,
  weight: null,
  sleep: null,
  energy: null,
  mood: null,
  body: [],
  ...patch,
});

const session = (key: string, patch: Partial<HistorySession> = {}): HistorySession => ({
  id: key,
  date: `${key}T12:00:00.000Z`,
  key,
  title: "Upper",
  duration: 55,
  volume: 1200,
  exercises: [{ name: "Press inclinado", muscleId: "chest", sets: 2, reps: "8, 7", weight: 30 }],
  ...patch,
});

function vault(patch: Partial<GymVaultSnapshot> = {}): GymVaultSnapshot {
  return {
    routine: { source: { path: "Salud.md", title: "Salud" }, days: ROUTINE },
    protocol: [],
    defaultSets: 2,
    weeklyTarget: null,
    measurements: { height: 1.75, refWeight: 63, refWeightKey: "2026-08-29", startWeight: 62, goalWeight: 70, goalNote: null, sources: [] },
    traits: [],
    daily: [],
    lifts: [],
    memory: [],
    partners: [],
    schedule: { time: null, place: null, source: null },
    ...patch,
  };
}

const EMPTY: GymHistory = { sessions: [], weights: [] };
// Miércoles.
const TODAY = "2026-10-14";

describe("day keys", () => {
  it("does calendar arithmetic without timezone drift", () => {
    expect(weekdayOf(TODAY)).toBe(3);
    expect(mondayOf(TODAY)).toBe("2026-10-12");
    expect(mondayOf("2026-10-18")).toBe("2026-10-12");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(daysBetween("2026-10-10", TODAY)).toBe(4);
  });
});

describe("buildGymView", () => {
  it("renders a coherent empty state without vault or data", () => {
    const view = buildGymView({ todayKey: TODAY, history: EMPTY, vault: null, fallbackRoutine: [] });
    expect(view.vaultAvailable).toBe(false);
    expect(view.routine.days).toHaveLength(7);
    expect(view.week.target).toBeNull();
    expect(view.streak).toEqual({ current: 0, best: 0, lastKey: null });
    expect(view.weight.current).toBeNull();
    expect(view.calendar.days).toHaveLength(26 * 7);
    expect(view.lifts).toEqual([]);
  });

  it("uses the template routine when the vault is missing", () => {
    const fallback = routineFromTemplate({ 1: { day: "Lunes", name: "Push", exercises: [{ id: "a", name: "Bench", sets: 3, reps: "8", muscleId: "chest" }] } });
    const view = buildGymView({ todayKey: "2026-10-12", history: EMPTY, vault: null, fallbackRoutine: fallback });
    expect(view.routine.days[1]).toMatchObject({ name: "Push", kind: "fuerza" });
    expect(view.muscles).toEqual([{ id: "chest", name: "Pectorales", done: 0, planned: 3, exercises: ["Bench"] }]);
  });

  it("merges DB sessions and daily notes into the week and streak", () => {
    const view = buildGymView({
      todayKey: TODAY,
      history: { sessions: [session("2026-10-12"), session("2026-10-01", { exercises: [], volume: 0 })], weights: [] },
      vault: vault({ daily: [daily("2026-10-09", { gym: "si" }), daily("2026-10-11", { gym: "no", other: "Fútbol" }), daily("2026-10-13", { gym: "si" })] }),
      fallbackRoutine: [],
    });
    expect(view.week.days.map((day) => day.status)).toEqual(["hecho", "hecho", "descanso", "proximo", "proximo", "descanso", "descanso"]);
    expect(view.week.done).toBe(2);
    expect(view.week.target).toBe(4);
    // Viernes 9 + lunes 12 + martes 13; el sábado (descanso) y el partido no la rompen.
    expect(view.streak).toEqual({ current: 3, best: 3, lastKey: "2026-10-13" });
    expect(view.next).toEqual({ key: "2026-10-15", weekday: 4, inDays: 1 });
    expect(view.calendar.trained90).toBe(3);
    expect(view.calendar.other90).toBe(1);
    expect(view.totals.sessions).toBe(1);
  });

  it("breaks the streak on a missed strength day", () => {
    const view = buildGymView({
      todayKey: TODAY,
      history: EMPTY,
      vault: vault({ daily: [daily("2026-10-08", { gym: "si" }), daily("2026-10-09", { gym: "si" })] }),
      fallbackRoutine: [],
    });
    expect(view.streak.current).toBe(0);
    expect(view.streak.best).toBe(2);
  });

  it("filters abandoned sessions", () => {
    expect(isValidSession(session(TODAY, { exercises: [], volume: 0 }))).toBe(false);
    expect(isValidSession(session(TODAY))).toBe(true);
  });

  it("builds weight trend from DB and diary, with goal context", () => {
    const view = buildGymView({
      todayKey: TODAY,
      history: { sessions: [], weights: [{ date: "2026-10-12T15:00:00.000Z", key: "2026-10-12", weight: 66.4 }] },
      vault: vault({ daily: [daily("2026-10-01", { weight: 65 }), daily("2026-10-12", { weight: 67 })] }),
      fallbackRoutine: [],
    });
    expect(view.weight.series).toEqual([
      { key: "2026-10-01", value: 65, source: "diario" },
      { key: "2026-10-12", value: 66.4, source: "db" },
    ]);
    expect(view.weight).toMatchObject({ current: 66.4, source: "db", start: 62, goal: 70, bmi: 21.7, change30: 1.4 });
  });

  it("falls back to the ficha weight", () => {
    const view = buildGymView({ todayKey: TODAY, history: EMPTY, vault: vault(), fallbackRoutine: [] });
    expect(view.weight).toMatchObject({ current: 63, source: "ficha", currentKey: "2026-08-29" });
  });

  it("derives lifts, ghosts and weekly muscle volume", () => {
    const view = buildGymView({
      todayKey: TODAY,
      history: {
        sessions: [
          session("2026-09-01", { exercises: [{ name: "Press inclinado", muscleId: "chest", sets: 2, reps: "8, 8", weight: 26 }] }),
          session("2026-10-12", { exercises: [{ name: "Press inclinado", muscleId: "unknown", sets: 2, reps: "8, 7", weight: 30 }, { name: "Jalón al pecho", muscleId: "", sets: 3, reps: "10", weight: null }] }),
        ],
        weights: [],
      },
      vault: vault({ lifts: [{ exercise: "Sentadilla", value: 135, unit: "lb", kg: 61.2, key: "2026-08-20", text: "", source: { path: "a", title: "a" } }] }),
      fallbackRoutine: [],
    });
    const press = view.lifts.find((lift) => lift.name === "Press inclinado")!;
    expect(press.best).toEqual({ kg: 30, key: "2026-10-12" });
    expect(press.series.map((point) => point.value)).toEqual([26, 30]);
    expect(press.change).toBe(4);
    expect(view.lifts.find((lift) => lift.name === "Sentadilla")?.mention?.value).toBe(135);
    expect(view.ghosts["press inclinado"]).toMatchObject({ kg: 30, reps: "8, 7", best: 30, unit: "kg" });
    expect(view.ghosts["sentadilla"]).toMatchObject({ value: 135, unit: "lb" });
    const chest = view.muscles.find((muscle) => muscle.id === "chest")!;
    expect(chest).toMatchObject({ done: 2, planned: 4 });
    expect(view.muscles.find((muscle) => muscle.id === "lats")).toMatchObject({ done: 3, planned: 4 });
  });
});
