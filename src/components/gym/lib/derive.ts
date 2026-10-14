/**
 * Combina el historial de la base de datos con lo que dice la bóveda y produce
 * la vista que pinta /gym. Pura y determinista: recibe la fecha de hoy.
 */

import type { DayRoutine } from "@/components/gym/MuscleData";
import { addDays, daysBetween, mondayOf, WEEKDAY_NAMES, weekdayOf } from "./dates";
import { muscleName, resolveMuscleId } from "./muscles";
import { fold } from "./text";
import { completeWeek } from "./vault-parse";
import type {
  CalendarDay,
  DailyEntry,
  DayStatus,
  Ghost,
  GymHistory,
  GymVaultSnapshot,
  GymView,
  HistorySession,
  LiftCard,
  LiftMention,
  MuscleVolume,
  NoteRef,
  RoutineDay,
  SeriesPoint,
  SeriesStat,
  WeekDay,
} from "./types";

export const CALENDAR_WEEKS = 26;
const FALLBACK_SETS = 2;

export type BuildInput = {
  todayKey: string;
  history: GymHistory;
  vault: GymVaultSnapshot | null;
  /** Rutina local usada cuando la bóveda no está disponible. */
  fallbackRoutine: RoutineDay[];
};

/** Convierte la plantilla local (`WEEKLY_ROUTINES`) al formato de la bóveda. */
export function routineFromTemplate(template: Record<number, DayRoutine>): RoutineDay[] {
  return Object.entries(template).map(([weekday, routine]) => ({
    weekday: Number(weekday),
    day: WEEKDAY_NAMES[Number(weekday)] ?? routine.day,
    name: routine.name,
    focus: null,
    kind: routine.isRest ? "descanso" : "fuerza",
    exercises: routine.exercises.map((item) => ({ name: item.name, muscleId: item.muscleId, sets: item.sets || null, reps: item.reps || null })),
    notes: [],
  }));
}

/** Una sesión sin ejercicios ni volumen es una prueba o un arranque abandonado. */
export function isValidSession(session: HistorySession): boolean {
  return session.exercises.length > 0 || session.volume > 0;
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function stat(points: SeriesPoint[], window = 7): SeriesStat {
  const last = points[points.length - 1] ?? null;
  const recent = points.slice(-window);
  return {
    last: last?.value ?? null,
    lastKey: last?.key ?? null,
    avg: recent.length ? round(recent.reduce((sum, point) => sum + point.value, 0) / recent.length) : null,
    series: points,
  };
}

function quantile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

type DayIndex = {
  sessions: Map<string, HistorySession[]>;
  daily: Map<string, DailyEntry>;
};

function trainedOn(index: DayIndex, key: string): boolean {
  return index.sessions.has(key) || index.daily.get(key)?.gym === "si";
}

function otherOn(index: DayIndex, key: string): string | null {
  return index.daily.get(key)?.other ?? null;
}

/**
 * Racha en sesiones: cada día entrenado suma; los días de descanso, partido o
 * rendimiento no la rompen, ni hoy mientras siga pendiente. Un día de fuerza
 * sin registro la corta.
 */
export function computeStreak(index: DayIndex, routine: RoutineDay[], todayKey: string) {
  const keys = [...index.sessions.keys(), ...[...index.daily.values()].filter((entry) => entry.gym || entry.other).map((entry) => entry.key)].filter((key) => key <= todayKey).sort();
  if (!keys.length) return { current: 0, best: 0, lastKey: null };
  let run = 0;
  let best = 0;
  let lastKey: string | null = null;
  for (let key = keys[0]; key <= todayKey; key = addDays(key, 1)) {
    if (trainedOn(index, key)) {
      run += 1;
      best = Math.max(best, run);
      lastKey = key;
      continue;
    }
    if (key === todayKey) continue;
    if (routine[weekdayOf(key)]?.kind !== "fuerza" || otherOn(index, key)) continue;
    run = 0;
  }
  return { current: run, best, lastKey };
}

function dayStatus(index: DayIndex, plan: RoutineDay, key: string, todayKey: string): DayStatus {
  if (trainedOn(index, key)) return "hecho";
  if (otherOn(index, key)) return "otro";
  const restLike = plan.kind === "descanso" || plan.kind === "partido";
  if (key > todayKey) return restLike ? "descanso" : "proximo";
  if (restLike) return "descanso";
  if (key === todayKey) return "pendiente";
  return "sin-registro";
}

function buildLifts(sessions: HistorySession[], routine: RoutineDay[], mentions: LiftMention[], todayKey: string): LiftCard[] {
  const logs = new Map<string, { name: string; muscleId: string | null; entries: { key: string; kg: number; reps: string; sets: number }[] }>();
  for (const session of sessions) {
    for (const item of session.exercises) {
      if (!item.weight || item.weight <= 0) continue;
      const id = fold(item.name);
      const entry = logs.get(id) ?? { name: item.name, muscleId: resolveMuscleId(item.muscleId, item.name), entries: [] };
      entry.entries.push({ key: session.key, kg: item.weight, reps: item.reps, sets: item.sets });
      logs.set(id, entry);
    }
  }

  const mentionByName = new Map<string, LiftMention>();
  for (const mention of mentions) {
    const id = fold(mention.exercise);
    const current = mentionByName.get(id);
    if (!current || (mention.key ?? "") > (current.key ?? "")) mentionByName.set(id, mention);
  }

  const candidates: { name: string; muscleId: string | null }[] = [];
  for (const day of routine) {
    if (day.kind !== "fuerza" || !day.exercises[0]) continue;
    candidates.push({ name: day.exercises[0].name, muscleId: day.exercises[0].muscleId });
  }
  const routineExercises = routine.flatMap((day) => day.exercises);
  for (const mention of mentionByName.values()) {
    candidates.push({ name: mention.exercise, muscleId: routineExercises.find((item) => fold(item.name) === fold(mention.exercise))?.muscleId ?? null });
  }
  for (const entry of [...logs.values()].sort((a, b) => new Set(b.entries.map((item) => item.key)).size - new Set(a.entries.map((item) => item.key)).size)) {
    candidates.push({ name: entry.name, muscleId: entry.muscleId });
  }

  const seen = new Set<string>();
  const cards: LiftCard[] = [];
  for (const candidate of candidates) {
    const id = fold(candidate.name);
    if (seen.has(id)) continue;
    seen.add(id);
    const entry = logs.get(id);
    const byDay = new Map<string, number>();
    for (const item of entry?.entries ?? []) byDay.set(item.key, Math.max(byDay.get(item.key) ?? 0, item.kg));
    const series = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({ key, value }));
    const bestPoint = series.reduce<SeriesPoint | null>((best, point) => (!best || point.value >= best.value ? point : best), null);
    const lastEntry = entry?.entries[entry.entries.length - 1] ?? null;
    const windowStart = addDays(todayKey, -90);
    const recent = series.filter((point) => point.key >= windowStart);
    cards.push({
      name: entry?.name ?? candidate.name,
      muscleId: candidate.muscleId ?? entry?.muscleId ?? null,
      best: bestPoint ? { kg: bestPoint.value, key: bestPoint.key } : null,
      last: lastEntry ? { kg: lastEntry.kg, reps: lastEntry.reps, key: lastEntry.key } : null,
      series,
      sessions: series.length,
      change: recent.length >= 2 ? round(recent[recent.length - 1].value - recent[0].value) : null,
      mention: mentionByName.get(id) ?? null,
      log: [...(entry?.entries ?? [])].reverse().slice(0, 12),
    });
    if (cards.length >= 6) break;
  }
  return cards;
}

function buildGhosts(sessions: HistorySession[], mentions: LiftMention[]): Record<string, Ghost> {
  const ghosts: Record<string, Ghost> = {};
  for (const mention of mentions) {
    const id = fold(mention.exercise);
    if (!ghosts[id] || (mention.key ?? "") > ghosts[id].key) {
      ghosts[id] = { kg: mention.kg, value: mention.value, unit: mention.unit, reps: "", key: mention.key ?? "", best: mention.kg };
    }
  }
  const fromDb = new Set<string>();
  for (const session of sessions) {
    for (const item of session.exercises) {
      const id = fold(item.name);
      const weight = item.weight && item.weight > 0 ? item.weight : null;
      const previousBest = fromDb.has(id) ? ghosts[id]?.best ?? null : null;
      fromDb.add(id);
      ghosts[id] = {
        kg: weight,
        value: weight,
        unit: "kg",
        reps: item.reps,
        key: session.key,
        best: weight === null ? previousBest : Math.max(previousBest ?? 0, weight),
      };
    }
  }
  return ghosts;
}

export function buildGymView({ todayKey, history, vault, fallbackRoutine }: BuildInput): GymView {
  const routineDays = completeWeek(vault?.routine?.days.length ? vault.routine.days : fallbackRoutine);
  const defaultSets = vault?.defaultSets ?? FALLBACK_SETS;
  const sessions = history.sessions.filter(isValidSession).sort((a, b) => a.date.localeCompare(b.date));
  const daily = [...(vault?.daily ?? [])].sort((a, b) => a.key.localeCompare(b.key));

  const index: DayIndex = { sessions: new Map(), daily: new Map() };
  for (const session of sessions) index.sessions.set(session.key, [...(index.sessions.get(session.key) ?? []), session]);
  for (const entry of daily) index.daily.set(entry.key, entry);

  // Semana actual (lunes → domingo)
  const monday = mondayOf(todayKey);
  const weekEnd = addDays(monday, 6);
  const weekDays: WeekDay[] = Array.from({ length: 7 }, (_, offset) => {
    const key = addDays(monday, offset);
    const weekday = weekdayOf(key);
    const plan = routineDays[weekday];
    return {
      key,
      weekday,
      isToday: key === todayKey,
      plan,
      status: dayStatus(index, plan, key, todayKey),
      sessionTitle: index.sessions.get(key)?.[0]?.title ?? null,
    };
  });
  const strengthDays = routineDays.filter((day) => day.kind === "fuerza").length;
  const todayDay = weekDays.find((day) => day.isToday) ?? weekDays[0];

  let next: GymView["next"] = null;
  for (let offset = 1; offset <= 7; offset += 1) {
    const key = addDays(todayKey, offset);
    const weekday = weekdayOf(key);
    if (routineDays[weekday].kind === "fuerza") {
      next = { key, weekday, inDays: offset };
      break;
    }
  }

  // Peso: base de datos + diario, con la ficha como referencia.
  const weightByDay = new Map<string, { value: number; source: "db" | "diario" }>();
  for (const entry of daily) if (entry.weight !== null) weightByDay.set(entry.key, { value: entry.weight, source: "diario" });
  for (const log of [...history.weights].sort((a, b) => a.date.localeCompare(b.date))) weightByDay.set(log.key, { value: log.weight, source: "db" });
  const weightSeries = [...weightByDay.entries()].filter(([key]) => key <= todayKey).sort(([a], [b]) => a.localeCompare(b)).map(([key, point]) => ({ key, ...point }));
  const lastWeight = weightSeries[weightSeries.length - 1] ?? null;
  const measurements = vault?.measurements;
  const current = lastWeight?.value ?? measurements?.refWeight ?? null;
  const height = measurements?.height ?? null;
  const monthAgo = addDays(todayKey, -30);
  const inMonth = weightSeries.filter((point) => point.key >= monthAgo);

  // Calendario de consistencia
  const calendarStart = addDays(monday, -7 * (CALENDAR_WEEKS - 1));
  const sessionVolumes = sessions.filter((session) => session.key >= calendarStart).map((session) => session.volume).filter((volume) => volume > 0);
  const strongVolume = quantile(sessionVolumes, 0.75);
  const calendarDays: CalendarDay[] = Array.from({ length: CALENDAR_WEEKS * 7 }, (_, offset) => {
    const key = addDays(calendarStart, offset);
    const daySessions = index.sessions.get(key) ?? [];
    const note = index.daily.get(key);
    const volume = daySessions.reduce((sum, session) => sum + session.volume, 0);
    const trained = trainedOn(index, key);
    const other = otherOn(index, key);
    const level: CalendarDay["level"] = daySessions.length ? (strongVolume > 0 && volume >= strongVolume ? 4 : 3) : trained ? 2 : other ? 1 : 0;
    return {
      key,
      level,
      trained,
      other,
      future: key > todayKey,
      sessions: daySessions.map((session) => ({ title: session.title, volume: session.volume, duration: session.duration, sets: session.exercises.reduce((sum, item) => sum + item.sets, 0) })),
      noteFlag: note?.gym ?? null,
      notePath: note?.path ?? null,
    };
  });
  const ninetyAgo = addDays(todayKey, -89);
  const lastNinety = calendarDays.filter((day) => day.key >= ninetyAgo && !day.future);

  // Volumen semanal por músculo: series hechas vs. planeadas en el split.
  const muscles = new Map<string, MuscleVolume>();
  const touch = (id: string) => {
    const current = muscles.get(id) ?? { id, name: muscleName(id), done: 0, planned: 0, exercises: [] };
    muscles.set(id, current);
    return current;
  };
  for (const day of routineDays) {
    if (day.kind !== "fuerza") continue;
    for (const item of day.exercises) {
      if (!item.muscleId) continue;
      const muscle = touch(item.muscleId);
      muscle.planned += item.sets ?? defaultSets;
      if (!muscle.exercises.includes(item.name)) muscle.exercises.push(item.name);
    }
  }
  const weekSessions = sessions.filter((session) => session.key >= monday && session.key <= weekEnd);
  for (const session of weekSessions) {
    for (const item of session.exercises) {
      const id = resolveMuscleId(item.muscleId, item.name);
      if (!id) continue;
      const muscle = touch(id);
      muscle.done += item.sets;
      if (!muscle.exercises.includes(item.name)) muscle.exercises.push(item.name);
    }
  }

  const mentions = vault?.lifts ?? [];
  const sources = new Map<string, NoteRef>();
  for (const ref of [vault?.routine?.source, ...(measurements?.sources ?? []), ...(vault?.protocol.map((line) => line.source) ?? [])]) {
    if (ref) sources.set(ref.path, ref);
  }

  return {
    todayKey,
    vaultAvailable: Boolean(vault),
    routine: { source: vault?.routine?.source ?? null, days: routineDays, defaultSets },
    week: {
      start: monday,
      days: weekDays,
      done: weekDays.filter((day) => day.status === "hecho").length,
      target: strengthDays || vault?.weeklyTarget || null,
    },
    today: { status: todayDay.status, sessionTitle: todayDay.sessionTitle },
    next,
    streak: computeStreak(index, routineDays, todayKey),
    weight: {
      current,
      currentKey: lastWeight?.key ?? measurements?.refWeightKey ?? null,
      source: lastWeight?.source ?? (measurements?.refWeight ? "ficha" : null),
      start: measurements?.startWeight ?? weightSeries[0]?.value ?? null,
      goal: measurements?.goalWeight ?? null,
      goalNote: measurements?.goalNote ?? null,
      height,
      bmi: current && height ? round(current / (height * height)) : null,
      series: weightSeries,
      change30: inMonth.length >= 2 ? round(inMonth[inMonth.length - 1].value - inMonth[0].value) : null,
    },
    recovery: {
      sleep: stat(daily.filter((entry) => entry.sleep !== null).map((entry) => ({ key: entry.key, value: entry.sleep as number }))),
      energy: stat(daily.filter((entry) => entry.energy !== null).map((entry) => ({ key: entry.key, value: entry.energy as number }))),
      mood: stat(daily.filter((entry) => entry.mood !== null).map((entry) => ({ key: entry.key, value: entry.mood as number }))),
    },
    calendar: {
      start: calendarStart,
      weeks: CALENDAR_WEEKS,
      days: calendarDays,
      trained90: lastNinety.filter((day) => day.trained).length,
      other90: lastNinety.filter((day) => !day.trained && day.other).length,
    },
    muscles: [...muscles.values()].sort((a, b) => b.planned - a.planned || b.done - a.done || a.name.localeCompare(b.name, "es")),
    lifts: buildLifts(sessions, routineDays, mentions, todayKey),
    sessions: [...sessions].reverse().slice(0, 8).map((session) => ({
      id: session.id,
      key: session.key,
      title: session.title,
      duration: session.duration,
      volume: session.volume,
      sets: session.exercises.reduce((sum, item) => sum + item.sets, 0),
      exercises: session.exercises.length,
    })),
    totals: {
      sessions: sessions.length,
      volume: Math.round(sessions.reduce((sum, session) => sum + session.volume, 0)),
      weekVolume: Math.round(weekSessions.reduce((sum, session) => sum + session.volume, 0)),
      weekSets: weekSessions.reduce((sum, session) => sum + session.exercises.reduce((total, item) => total + item.sets, 0), 0),
    },
    ghosts: buildGhosts(sessions, mentions),
    protocol: vault?.protocol ?? [],
    traits: vault?.traits ?? [],
    memory: [...(vault?.memory ?? [])].sort((a, b) => (b.key ?? "").localeCompare(a.key ?? "")).slice(0, 8),
    partners: vault?.partners ?? [],
    schedule: vault?.schedule ?? { time: null, place: null, source: null },
    body: daily.filter((entry) => entry.body.length && entry.key <= todayKey).reverse().slice(0, 6),
    sources: [...sources.values()],
  };
}

/** Días desde la última sesión registrada (null si nunca). */
export function daysSince(lastKey: string | null, todayKey: string): number | null {
  return lastKey ? daysBetween(lastKey, todayKey) : null;
}
