/**
 * Taxonomía muscular y plantilla local de rutina. La rutina real se lee de la
 * bóveda en /gym; `WEEKLY_ROUTINES` queda como respaldo y para otros módulos.
 */

export const MUSCLE_DETAILS: Record<string, { name: string; description: string }> = {
  chest: { name: "Pectorales", description: "Músculos del pecho." },
  abs: { name: "Abdomen", description: "Core y estabilización." },
  shoulders: { name: "Hombros", description: "Deltoides (Frontal, Lateral, Posterior)." },
  biceps: { name: "Bíceps", description: "Parte frontal del brazo." },
  triceps: { name: "Tríceps", description: "Parte posterior del brazo." },
  forearms: { name: "Antebrazos", description: "Agarre y flexión de muñeca." },
  quads: { name: "Cuádriceps", description: "Parte frontal de la pierna." },
  hamstrings: { name: "Isquiotibiales", description: "Parte posterior de la pierna." },
  calves: { name: "Pantorrillas", description: "Músculos gemelos y sóleo." },
  lats: { name: "Dorsales", description: "Músculos laterales de la espalda." },
  traps: { name: "Trapecios", description: "Parte superior de la espalda y cuello." },
  lower_back: { name: "Espalda Baja", description: "Lumbares y estabilización." },
  glutes: { name: "Glúteos", description: "Cadera y estabilización." },
};

export interface SessionHistory {
  id: string;
  date: string;
  routineName: string;
  duration: string;
  totalVolume: number;
}

export interface PersonalRecord {
  id: string;
  lift: string;
  weight: number;
  date: string;
}

export interface ExerciseDef {
  id: string;
  name: string;
  sets: number;
  reps: string;
  targetRpe?: number;
  muscleId: string;
}

export interface DayRoutine {
  day: string;
  name: string;
  exercises: ExerciseDef[];
  isRest?: boolean;
}

export const WEEKLY_ROUTINES: Record<number, DayRoutine> = {
  1: {
    day: "Lunes",
    name: "Push Hypertrophy",
    exercises: [
      { id: "e1", name: "Incline Dumbbell Press", sets: 3, reps: "8-10", targetRpe: 8, muscleId: "chest" },
      { id: "e2", name: "Machine Chest Press", sets: 3, reps: "10-12", targetRpe: 9, muscleId: "chest" },
      { id: "e3", name: "Lateral Raises", sets: 4, reps: "12-15", targetRpe: 9, muscleId: "shoulders" },
      { id: "e4", name: "Tricep Pushdowns", sets: 3, reps: "10-12", targetRpe: 8, muscleId: "triceps" }
    ]
  },
  2: {
    day: "Martes",
    name: "Pull Hypertrophy",
    exercises: [
      { id: "e5", name: "Pull-ups", sets: 3, reps: "AMRAP", targetRpe: 9, muscleId: "lats" },
      { id: "e6", name: "Barbell Rows", sets: 3, reps: "8-10", targetRpe: 8, muscleId: "lats" },
      { id: "e7", name: "Face Pulls", sets: 3, reps: "12-15", targetRpe: 8, muscleId: "traps" },
      { id: "e8", name: "Bicep Curls", sets: 3, reps: "10-12", targetRpe: 9, muscleId: "biceps" }
    ]
  },
  3: {
    day: "Miércoles",
    name: "Legs & Core",
    exercises: [
      { id: "e9", name: "Squats", sets: 3, reps: "6-8", targetRpe: 8, muscleId: "quads" },
      { id: "e10", name: "Leg Press", sets: 3, reps: "10-12", targetRpe: 9, muscleId: "quads" },
      { id: "e11", name: "Romanian Deadlifts", sets: 3, reps: "8-10", targetRpe: 8, muscleId: "hamstrings" },
      { id: "e12", name: "Calf Raises", sets: 4, reps: "15-20", targetRpe: 9, muscleId: "calves" }
    ]
  },
  4: {
    day: "Jueves",
    name: "Active Recovery",
    exercises: [],
    isRest: true
  },
  5: {
    day: "Viernes",
    name: "Upper Power",
    exercises: [
      { id: "e13", name: "Bench Press", sets: 3, reps: "4-6", targetRpe: 8, muscleId: "chest" },
      { id: "e14", name: "Weighted Pull-ups", sets: 3, reps: "4-6", targetRpe: 8, muscleId: "lats" },
      { id: "e15", name: "Overhead Press", sets: 3, reps: "6-8", targetRpe: 8, muscleId: "shoulders" }
    ]
  },
  6: {
    day: "Sábado",
    name: "Lower Power",
    exercises: [
      { id: "e16", name: "Deadlifts", sets: 3, reps: "3-5", targetRpe: 8, muscleId: "lower_back" },
      { id: "e17", name: "Front Squats", sets: 3, reps: "6-8", targetRpe: 8, muscleId: "quads" },
      { id: "e18", name: "Leg Curls", sets: 3, reps: "10-12", targetRpe: 9, muscleId: "hamstrings" }
    ]
  },
  0: {
    day: "Domingo",
    name: "Rest Day",
    exercises: [],
    isRest: true
  }
};
