/**
 * Borrador de una sesión en curso. Vive en el cliente (localStorage) hasta que
 * se guarda; estas funciones son puras para poder probarlas.
 */

import { inferMuscleId } from "./muscles";
import { fold } from "./text";
import type { Ghost, RoutineDay } from "./types";

export type Unit = "kg" | "lb";

export type DraftSet = { id: string; weight: string; reps: string; unit: Unit; done: boolean };

export type DraftExercise = { id: string; name: string; muscleId: string | null; target: string | null; sets: DraftSet[] };

export type SessionDraft = {
  v: 1;
  title: string;
  subtitle: string | null;
  weekday: number | null;
  startedAt: number;
  exercises: DraftExercise[];
  rest: { until: number; total: number } | null;
  restDefault: number;
};

export const LB_PER_KG = 2.20462;
export const DEFAULT_REST_SECONDS = 120;

let counter = 0;
export function uid(prefix = "s"): string {
  counter = (counter + 1) % 1_000_000;
  return `${prefix}${counter.toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function toKg(value: number, unit: Unit): number {
  return unit === "lb" ? value / LB_PER_KG : value;
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function parseLoad(set: Pick<DraftSet, "weight" | "reps" | "unit">): { kg: number | null; reps: number | null } {
  const weight = Number.parseFloat(set.weight.replace(",", "."));
  const reps = Number.parseInt(set.reps, 10);
  return {
    kg: Number.isFinite(weight) && weight > 0 ? round1(toKg(weight, set.unit)) : null,
    reps: Number.isFinite(reps) && reps > 0 ? reps : null,
  };
}

function emptySet(unit: Unit): DraftSet {
  return { id: uid(), weight: "", reps: "", unit, done: false };
}

export function newExercise(name: string, sets: number, ghost?: Ghost, target: string | null = null, muscleId?: string | null): DraftExercise {
  const unit = ghost?.unit ?? "kg";
  return {
    id: uid("e"),
    name,
    muscleId: muscleId ?? inferMuscleId(name),
    target,
    sets: Array.from({ length: Math.max(1, sets) }, () => emptySet(unit)),
  };
}

export function sessionTitle(day: Pick<RoutineDay, "name" | "focus">): string {
  return day.focus ? `${day.name} (${day.focus})` : day.name;
}

export function createDraft(day: RoutineDay | null, ghosts: Record<string, Ghost>, defaultSets: number, now: number, target: string | null): SessionDraft {
  return {
    v: 1,
    title: day && day.exercises.length ? sessionTitle(day) : "Sesión libre",
    subtitle: day?.exercises.length ? day.day : null,
    weekday: day?.weekday ?? null,
    startedAt: now,
    exercises: (day?.exercises ?? []).map((item) => newExercise(item.name, item.sets ?? defaultSets, ghosts[fold(item.name)], item.reps ?? target, item.muscleId)),
    rest: null,
    restDefault: DEFAULT_REST_SECONDS,
  };
}

export function isDraft(value: unknown): value is SessionDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<SessionDraft>;
  return draft.v === 1 && typeof draft.title === "string" && typeof draft.startedAt === "number" && Array.isArray(draft.exercises);
}

export type SessionSummary = {
  doneSets: number;
  totalSets: number;
  loggedSets: number;
  volume: number;
  prs: { name: string; kg: number; previous: number }[];
  payload: { name: string; sets: number; reps: string; weight: number | null; muscleId: string }[];
};

/** Series válidas = con repeticiones. El peso es opcional (peso corporal, pliometría). */
export function summarizeDraft(draft: SessionDraft, ghosts: Record<string, Ghost>): SessionSummary {
  let doneSets = 0;
  let totalSets = 0;
  let loggedSets = 0;
  let volume = 0;
  const prs: SessionSummary["prs"] = [];
  const payload: SessionSummary["payload"] = [];

  for (const exercise of draft.exercises) {
    let maxKg = 0;
    const reps: number[] = [];
    for (const set of exercise.sets) {
      totalSets += 1;
      if (set.done) doneSets += 1;
      const load = parseLoad(set);
      if (load.reps === null) continue;
      loggedSets += 1;
      reps.push(load.reps);
      if (load.kg !== null) {
        maxKg = Math.max(maxKg, load.kg);
        volume += load.kg * load.reps;
      }
    }
    if (!reps.length) continue;
    const previous = ghosts[fold(exercise.name)]?.best ?? null;
    if (previous !== null && maxKg > previous) prs.push({ name: exercise.name, kg: maxKg, previous });
    payload.push({
      name: exercise.name,
      sets: reps.length,
      reps: reps.join(", "),
      weight: maxKg > 0 ? maxKg : null,
      muscleId: exercise.muscleId ?? inferMuscleId(exercise.name) ?? "other",
    });
  }

  return { doneSets, totalSets, loggedSets, volume: Math.round(volume), prs, payload };
}

/** ¿Esta serie supera el mejor registro conocido del ejercicio? */
export function isSetPr(set: DraftSet, ghost: Ghost | undefined): boolean {
  if (!ghost?.best) return false;
  const load = parseLoad(set);
  return load.kg !== null && load.reps !== null && load.kg > ghost.best;
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const mm = hours ? String(minutes).padStart(2, "0") : String(minutes);
  return `${hours ? `${hours}:` : ""}${mm}:${String(rest).padStart(2, "0")}`;
}
