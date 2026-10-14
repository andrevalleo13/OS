/**
 * Tipos del módulo Gimnasio. Todo lo que cruza de servidor a cliente es
 * serializable (fechas como `yyyy-MM-dd` o ISO).
 */

export type RoutineKind = "fuerza" | "rendimiento" | "descanso" | "partido";

export type NoteRef = { path: string; title: string };

export type RoutineExercise = {
  name: string;
  muscleId: string | null;
  sets: number | null;
  reps: string | null;
};

export type RoutineDay = {
  /** 0 = domingo … 6 = sábado (igual que `Date#getDay`). */
  weekday: number;
  day: string;
  name: string;
  focus: string | null;
  kind: RoutineKind;
  exercises: RoutineExercise[];
  notes: string[];
};

export type LabeledLine = { label: string | null; text: string };

export type GymFlag = "si" | "no" | "pendiente" | null;

export type DailyEntry = {
  key: string;
  path: string;
  gym: GymFlag;
  gymDetail: string | null;
  /** Otra actividad física del día (p. ej. "Fútbol"). */
  other: string | null;
  weight: number | null;
  sleep: number | null;
  energy: number | null;
  mood: number | null;
  body: LabeledLine[];
};

export type LiftMention = {
  exercise: string;
  value: number;
  unit: "kg" | "lb";
  kg: number;
  key: string | null;
  text: string;
  source: NoteRef;
};

export type MemoryLine = { key: string | null; text: string; source: NoteRef };

export type Partner = {
  name: string;
  path: string;
  relation: string | null;
  line: string | null;
  score: number;
};

export type GymVaultSnapshot = {
  routine: { source: NoteRef; days: RoutineDay[] } | null;
  protocol: (LabeledLine & { source: NoteRef })[];
  defaultSets: number | null;
  weeklyTarget: number | null;
  measurements: {
    height: number | null;
    refWeight: number | null;
    refWeightKey: string | null;
    startWeight: number | null;
    goalWeight: number | null;
    goalNote: string | null;
    sources: NoteRef[];
  };
  traits: { label: string; value: string; detail: string | null; source: NoteRef }[];
  daily: DailyEntry[];
  lifts: LiftMention[];
  memory: MemoryLine[];
  partners: Partner[];
  schedule: { time: string | null; place: string | null; source: NoteRef | null };
};

export type HistoryExercise = {
  name: string;
  muscleId: string;
  sets: number;
  reps: string;
  weight: number | null;
};

export type HistorySession = {
  id: string;
  date: string;
  key: string;
  title: string;
  duration: number;
  volume: number;
  exercises: HistoryExercise[];
};

export type GymHistory = {
  sessions: HistorySession[];
  weights: { date: string; key: string; weight: number }[];
};

// ---------------------------------------------------------------------------
// Vista derivada que consume la UI
// ---------------------------------------------------------------------------

export type DayStatus = "hecho" | "otro" | "pendiente" | "sin-registro" | "proximo" | "descanso";

export type WeekDay = {
  key: string;
  weekday: number;
  isToday: boolean;
  plan: RoutineDay;
  status: DayStatus;
  sessionTitle: string | null;
};

export type CalendarDay = {
  key: string;
  level: 0 | 1 | 2 | 3 | 4;
  trained: boolean;
  other: string | null;
  future: boolean;
  sessions: { title: string; volume: number; duration: number; sets: number }[];
  noteFlag: GymFlag;
  notePath: string | null;
};

export type SeriesPoint = { key: string; value: number };

export type SeriesStat = { last: number | null; lastKey: string | null; avg: number | null; series: SeriesPoint[] };

export type LiftCard = {
  name: string;
  muscleId: string | null;
  best: { kg: number; key: string } | null;
  last: { kg: number; reps: string; key: string } | null;
  series: SeriesPoint[];
  sessions: number;
  change: number | null;
  mention: LiftMention | null;
  log: { key: string; kg: number; reps: string; sets: number }[];
};

export type MuscleVolume = { id: string; name: string; done: number; planned: number; exercises: string[] };

export type RecentSession = {
  id: string;
  key: string;
  title: string;
  duration: number;
  volume: number;
  sets: number;
  exercises: number;
};

/** Lo último que se sabe de un ejercicio, para sugerirlo durante la sesión. */
export type Ghost = {
  kg: number | null;
  /** Valor en la unidad en que se registró (la bóveda suele citar libras). */
  value: number | null;
  unit: "kg" | "lb";
  reps: string;
  key: string;
  best: number | null;
};

export type GymView = {
  todayKey: string;
  vaultAvailable: boolean;
  routine: { source: NoteRef | null; days: RoutineDay[]; defaultSets: number };
  week: { start: string; days: WeekDay[]; done: number; target: number | null };
  today: { status: DayStatus; sessionTitle: string | null };
  next: { key: string; weekday: number; inDays: number } | null;
  streak: { current: number; best: number; lastKey: string | null };
  weight: {
    current: number | null;
    currentKey: string | null;
    source: "db" | "diario" | "ficha" | null;
    start: number | null;
    goal: number | null;
    goalNote: string | null;
    height: number | null;
    bmi: number | null;
    series: (SeriesPoint & { source: "db" | "diario" })[];
    change30: number | null;
  };
  recovery: { sleep: SeriesStat; energy: SeriesStat; mood: SeriesStat };
  calendar: { start: string; weeks: number; days: CalendarDay[]; trained90: number; other90: number };
  muscles: MuscleVolume[];
  lifts: LiftCard[];
  sessions: RecentSession[];
  totals: { sessions: number; volume: number; weekVolume: number; weekSets: number };
  ghosts: Record<string, Ghost>;
  protocol: GymVaultSnapshot["protocol"];
  traits: GymVaultSnapshot["traits"];
  memory: MemoryLine[];
  partners: Partner[];
  schedule: GymVaultSnapshot["schedule"];
  body: DailyEntry[];
  sources: NoteRef[];
};
