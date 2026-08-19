export interface MusclePartDef {
  type: "sphere" | "capsule" | "box" | "cylinder" | "cone";
  args: number[];
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

export interface MuscleGroupDef {
  id: string;
  parts: MusclePartDef[];
}

// Escultura Proporcional "Cybernetic" 
export const STRUCTURAL_PARTS: MusclePartDef[] = [
  // Head
  { type: "sphere", args: [0.11, 32, 32], position: [0, 0.72, 0], scale: [1, 1.25, 1.1] },
  // Neck
  { type: "cylinder", args: [0.04, 0.05, 0.1, 16], position: [0, 0.58, -0.02] },
  // Core Spine/Ribcage
  { type: "box", args: [0.22, 0.45, 0.12], position: [0, 0.25, -0.03] },
  // Pelvis / Hips
  { type: "box", args: [0.26, 0.12, 0.14], position: [0, -0.04, 0] },
  // Knee Joints
  { type: "sphere", args: [0.05, 16, 16], position: [0.12, -0.50, 0.02] },
  { type: "sphere", args: [0.05, 16, 16], position: [-0.12, -0.50, 0.02] },
  // Elbow Joints
  { type: "sphere", args: [0.035, 16, 16], position: [0.35, 0.18, 0] },
  { type: "sphere", args: [0.035, 16, 16], position: [-0.35, 0.18, 0] },
];

export const MUSCLE_GROUPS: MuscleGroupDef[] = [
  {
    id: "chest",
    parts: [
      { type: "sphere", args: [0.14, 32, 32], position: [0.10, 0.40, 0.05], scale: [1, 0.75, 0.35], rotation: [0.1, 0.1, -0.05] },
      { type: "sphere", args: [0.14, 32, 32], position: [-0.10, 0.40, 0.05], scale: [1, 0.75, 0.35], rotation: [0.1, -0.1, 0.05] }
    ]
  },
  {
    id: "abs",
    parts: [
      { type: "box", args: [0.07, 0.07, 0.04], position: [0.045, 0.28, 0.06], rotation: [0.05, 0, 0] },
      { type: "box", args: [0.07, 0.07, 0.04], position: [-0.045, 0.28, 0.06], rotation: [0.05, 0, 0] },
      { type: "box", args: [0.07, 0.07, 0.04], position: [0.045, 0.19, 0.065] },
      { type: "box", args: [0.07, 0.07, 0.04], position: [-0.045, 0.19, 0.065] },
      { type: "box", args: [0.07, 0.08, 0.04], position: [0.045, 0.09, 0.06], rotation: [-0.05, 0, 0] },
      { type: "box", args: [0.07, 0.08, 0.04], position: [-0.045, 0.09, 0.06], rotation: [-0.05, 0, 0] },
    ]
  },
  {
    id: "shoulders",
    parts: [
      { type: "sphere", args: [0.09, 32, 32], position: [0.24, 0.46, 0], scale: [1, 1.2, 1], rotation: [0, 0, -0.2] },
      { type: "sphere", args: [0.09, 32, 32], position: [-0.24, 0.46, 0], scale: [1, 1.2, 1], rotation: [0, 0, 0.2] }
    ]
  },
  {
    id: "biceps",
    parts: [
      { type: "capsule", args: [0.045, 0.14, 16, 16], position: [0.30, 0.30, 0.03], rotation: [0, 0, -0.15] },
      { type: "capsule", args: [0.045, 0.14, 16, 16], position: [-0.30, 0.30, 0.03], rotation: [0, 0, 0.15] }
    ]
  },
  {
    id: "triceps",
    parts: [
      { type: "capsule", args: [0.04, 0.16, 16, 16], position: [0.32, 0.30, -0.03], rotation: [0, 0, -0.15] },
      { type: "capsule", args: [0.04, 0.16, 16, 16], position: [-0.32, 0.30, -0.03], rotation: [0, 0, 0.15] }
    ]
  },
  {
    id: "forearms",
    parts: [
      { type: "cylinder", args: [0.04, 0.025, 0.24, 16], position: [0.35, 0.04, 0.02], rotation: [0, 0, -0.1] },
      { type: "cylinder", args: [0.04, 0.025, 0.24, 16], position: [-0.35, 0.04, 0.02], rotation: [0, 0, 0.1] }
    ]
  },
  {
    id: "quads",
    parts: [
      { type: "cylinder", args: [0.08, 0.06, 0.38, 16], position: [0.12, -0.28, 0.04], rotation: [0.05, 0, -0.05] },
      { type: "cylinder", args: [0.08, 0.06, 0.38, 16], position: [-0.12, -0.28, 0.04], rotation: [0.05, 0, 0.05] }
    ]
  },
  {
    id: "hamstrings",
    parts: [
      { type: "cylinder", args: [0.07, 0.05, 0.36, 16], position: [0.12, -0.28, -0.04], rotation: [-0.05, 0, -0.05] },
      { type: "cylinder", args: [0.07, 0.05, 0.36, 16], position: [-0.12, -0.28, -0.04], rotation: [-0.05, 0, 0.05] }
    ]
  },
  {
    id: "calves",
    parts: [
      { type: "cylinder", args: [0.06, 0.03, 0.32, 16], position: [0.12, -0.68, -0.02] },
      { type: "cylinder", args: [0.06, 0.03, 0.32, 16], position: [-0.12, -0.68, -0.02] }
    ]
  },
  {
    id: "lats",
    parts: [
      { type: "cone", args: [0.14, 0.35, 16], position: [0.16, 0.25, -0.05], scale: [1, 1, 0.3], rotation: [0, 0, -0.25] },
      { type: "cone", args: [0.14, 0.35, 16], position: [-0.16, 0.25, -0.05], scale: [1, 1, 0.3], rotation: [0, 0, 0.25] }
    ]
  },
  {
    id: "traps",
    parts: [
      { type: "cone", args: [0.09, 0.15, 16], position: [0.10, 0.52, -0.02], rotation: [0, 0, 0.7], scale: [1, 1, 0.4] },
      { type: "cone", args: [0.09, 0.15, 16], position: [-0.10, 0.52, -0.02], rotation: [0, 0, -0.7], scale: [1, 1, 0.4] }
    ]
  },
  {
    id: "lower_back",
    parts: [
      { type: "box", args: [0.20, 0.15, 0.06], position: [0, 0.10, -0.08] }
    ]
  },
  {
    id: "glutes",
    parts: [
      { type: "sphere", args: [0.11, 32, 32], position: [0.09, -0.05, -0.08], scale: [1, 0.9, 0.8], rotation: [0.2, 0, 0] },
      { type: "sphere", args: [0.11, 32, 32], position: [-0.09, -0.05, -0.08], scale: [1, 0.9, 0.8], rotation: [0.2, 0, 0] }
    ]
  }
];

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
