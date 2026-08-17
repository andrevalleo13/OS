// Muscle group geometry definitions and mock data for the 3D body model.
// Each muscle group has a unique ID, a display name, and one or more
// geometric "parts" that together form its 3D shape on the body.

export interface MusclePartDef {
  type: 'sphere' | 'capsule' | 'box' | 'cylinder';
  args: number[];
  position: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}

export interface MuscleGroupDef {
  id: string;
  name: string;
  parts: MusclePartDef[];
}

export interface MuscleInfo {
  name: string;
  lastTrained: string;
  soreness: number;
  weeklyVolume: number;
  exercises: string[];
}

// ─── Interactive Muscle Group Definitions ───

export const MUSCLE_GROUPS: MuscleGroupDef[] = [
  {
    id: 'chest',
    name: 'Chest',
    parts: [
      { type: 'sphere', args: [0.09, 24, 24], position: [-0.085, 0.45, 0.06], scale: [1.15, 0.72, 0.55] },
      { type: 'sphere', args: [0.09, 24, 24], position: [0.085, 0.45, 0.06], scale: [1.15, 0.72, 0.55] },
    ],
  },
  {
    id: 'shoulders',
    name: 'Shoulders',
    parts: [
      { type: 'sphere', args: [0.065, 24, 24], position: [-0.22, 0.52, 0], scale: [1.2, 1.05, 1] },
      { type: 'sphere', args: [0.065, 24, 24], position: [0.22, 0.52, 0], scale: [1.2, 1.05, 1] },
    ],
  },
  {
    id: 'biceps',
    name: 'Biceps',
    parts: [
      { type: 'capsule', args: [0.042, 0.14, 8, 16], position: [-0.28, 0.32, 0.025] },
      { type: 'capsule', args: [0.042, 0.14, 8, 16], position: [0.28, 0.32, 0.025] },
    ],
  },
  {
    id: 'triceps',
    name: 'Triceps',
    parts: [
      { type: 'capsule', args: [0.038, 0.13, 8, 16], position: [-0.28, 0.32, -0.025] },
      { type: 'capsule', args: [0.038, 0.13, 8, 16], position: [0.28, 0.32, -0.025] },
    ],
  },
  {
    id: 'forearms',
    name: 'Forearms',
    parts: [
      { type: 'capsule', args: [0.032, 0.16, 8, 16], position: [-0.31, 0.05, 0.02] },
      { type: 'capsule', args: [0.032, 0.16, 8, 16], position: [0.31, 0.05, 0.02] },
    ],
  },
  {
    id: 'abs',
    name: 'Abs',
    parts: [
      { type: 'box', args: [0.12, 0.18, 0.04], position: [0, 0.22, 0.065] },
    ],
  },
  {
    id: 'obliques',
    name: 'Obliques',
    parts: [
      { type: 'box', args: [0.04, 0.15, 0.06], position: [-0.13, 0.22, 0.025] },
      { type: 'box', args: [0.04, 0.15, 0.06], position: [0.13, 0.22, 0.025] },
    ],
  },
  {
    id: 'traps',
    name: 'Traps',
    parts: [
      { type: 'box', args: [0.2, 0.07, 0.08], position: [0, 0.62, -0.02], scale: [1, 1, 0.8] },
    ],
  },
  {
    id: 'lats',
    name: 'Lats',
    parts: [
      { type: 'box', args: [0.06, 0.18, 0.07], position: [-0.16, 0.35, -0.04] },
      { type: 'box', args: [0.06, 0.18, 0.07], position: [0.16, 0.35, -0.04] },
    ],
  },
  {
    id: 'lower_back',
    name: 'Lower Back',
    parts: [
      { type: 'box', args: [0.14, 0.12, 0.05], position: [0, 0.18, -0.065] },
    ],
  },
  {
    id: 'glutes',
    name: 'Glutes',
    parts: [
      { type: 'sphere', args: [0.075, 20, 20], position: [-0.07, -0.02, -0.04], scale: [1, 0.85, 0.7] },
      { type: 'sphere', args: [0.075, 20, 20], position: [0.07, -0.02, -0.04], scale: [1, 0.85, 0.7] },
    ],
  },
  {
    id: 'quads',
    name: 'Quads',
    parts: [
      { type: 'capsule', args: [0.062, 0.22, 8, 16], position: [-0.1, -0.33, 0.02] },
      { type: 'capsule', args: [0.062, 0.22, 8, 16], position: [0.1, -0.33, 0.02] },
    ],
  },
  {
    id: 'hamstrings',
    name: 'Hamstrings',
    parts: [
      { type: 'capsule', args: [0.055, 0.2, 8, 16], position: [-0.1, -0.33, -0.025] },
      { type: 'capsule', args: [0.055, 0.2, 8, 16], position: [0.1, -0.33, -0.025] },
    ],
  },
  {
    id: 'calves',
    name: 'Calves',
    parts: [
      { type: 'capsule', args: [0.042, 0.18, 8, 16], position: [-0.09, -0.72, -0.015] },
      { type: 'capsule', args: [0.042, 0.18, 8, 16], position: [0.09, -0.72, -0.015] },
    ],
  },
];

// ─── Non-interactive structural body parts ───

export const STRUCTURAL_PARTS: MusclePartDef[] = [
  // Head
  { type: 'sphere', args: [0.11, 32, 32], position: [0, 0.85, 0] },
  // Neck
  { type: 'cylinder', args: [0.04, 0.05, 0.1, 16], position: [0, 0.7, 0] },
  // Torso core fill
  { type: 'box', args: [0.28, 0.55, 0.14], position: [0, 0.34, 0] },
  // Hip connector
  { type: 'box', args: [0.24, 0.12, 0.13], position: [0, 0.02, 0] },
];

// ─── Mock Muscle Detail Data (to be replaced by Prisma DB) ───

export const MUSCLE_DETAILS: Record<string, MuscleInfo> = {
  chest:      { name: 'Chest',      lastTrained: '2 days ago', soreness: 35, weeklyVolume: 16, exercises: ['Bench Press', 'Incline DB Press', 'Cable Fly'] },
  shoulders:  { name: 'Shoulders',  lastTrained: '1 day ago',  soreness: 60, weeklyVolume: 12, exercises: ['OHP', 'Lateral Raises', 'Face Pulls'] },
  biceps:     { name: 'Biceps',     lastTrained: '3 days ago', soreness: 15, weeklyVolume: 10, exercises: ['Barbell Curl', 'Hammer Curl'] },
  triceps:    { name: 'Triceps',    lastTrained: '2 days ago', soreness: 30, weeklyVolume: 10, exercises: ['Skull Crushers', 'Pushdown', 'Dips'] },
  forearms:   { name: 'Forearms',   lastTrained: '4 days ago', soreness: 10, weeklyVolume: 6,  exercises: ['Wrist Curls', 'Reverse Curls'] },
  abs:        { name: 'Abs',        lastTrained: '1 day ago',  soreness: 45, weeklyVolume: 8,  exercises: ['Cable Crunch', 'Leg Raise', 'Ab Wheel'] },
  obliques:   { name: 'Obliques',   lastTrained: '3 days ago', soreness: 20, weeklyVolume: 6,  exercises: ['Woodchoppers', 'Side Plank'] },
  traps:      { name: 'Traps',      lastTrained: '5 days ago', soreness: 5,  weeklyVolume: 8,  exercises: ['Shrugs', 'Face Pulls'] },
  lats:       { name: 'Lats',       lastTrained: '1 day ago',  soreness: 55, weeklyVolume: 14, exercises: ['Pull-ups', 'Barbell Row', 'Lat Pulldown'] },
  lower_back: { name: 'Lower Back', lastTrained: '3 days ago', soreness: 25, weeklyVolume: 6,  exercises: ['Deadlift', 'Hyperextension'] },
  glutes:     { name: 'Glutes',     lastTrained: '2 days ago', soreness: 40, weeklyVolume: 10, exercises: ['Hip Thrust', 'RDL', 'Glute Bridge'] },
  quads:      { name: 'Quads',      lastTrained: '4 days ago', soreness: 50, weeklyVolume: 14, exercises: ['Squat', 'Leg Press', 'Leg Extension'] },
  hamstrings: { name: 'Hamstrings', lastTrained: '4 days ago', soreness: 45, weeklyVolume: 10, exercises: ['RDL', 'Leg Curl', 'Nordic Curl'] },
  calves:     { name: 'Calves',     lastTrained: '6 days ago', soreness: 0,  weeklyVolume: 8,  exercises: ['Standing Calf Raise', 'Seated Calf Raise'] },
};

// ─── Extended Gym Dashboard Data (To be replaced by Prisma) ───

export interface RoutineExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  targetRpe?: number;
}

export interface SessionHistory {
  id: string;
  date: string;
  routineName: string;
  duration: string;
  totalVolume: number; // in kg
}

export interface PersonalRecord {
  id: string;
  lift: string;
  weight: number; // in kg
  date: string;
}

export const MOCK_CURRENT_ROUTINE = {
  name: "Push Hypertrophy",
  day: "Day 1 of 4",
  exercises: [
    { id: "e1", name: "Incline Dumbbell Press", sets: 3, reps: "8-10", targetRpe: 8 },
    { id: "e2", name: "Flat Barbell Bench", sets: 3, reps: "8-12", targetRpe: 8 },
    { id: "e3", name: "Seated Machine Fly", sets: 3, reps: "12-15", targetRpe: 9 },
    { id: "e4", name: "Overhead Tricep Extension", sets: 4, reps: "10-12", targetRpe: 8 },
    { id: "e5", name: "Lateral Raises", sets: 4, reps: "15-20", targetRpe: 9 },
  ] as RoutineExercise[]
};

export const MOCK_SESSION_HISTORY: SessionHistory[] = [
  { id: "s1", date: "Today", routineName: "Pull Power", duration: "1h 15m", totalVolume: 12450 },
  { id: "s2", date: "Yesterday", routineName: "Legs Volume", duration: "1h 30m", totalVolume: 18200 },
  { id: "s3", date: "3 days ago", routineName: "Push Hypertrophy", duration: "1h 10m", totalVolume: 11200 },
  { id: "s4", date: "4 days ago", routineName: "Pull Volume", duration: "1h 20m", totalVolume: 13500 },
  { id: "s5", date: "6 days ago", routineName: "Legs Power", duration: "1h 45m", totalVolume: 21000 },
];

export const MOCK_PRS: PersonalRecord[] = [
  { id: "pr1", lift: "Bench Press", weight: 110, date: "2 weeks ago" },
  { id: "pr2", lift: "Squat", weight: 160, date: "1 month ago" },
  { id: "pr3", lift: "Deadlift", weight: 190, date: "3 months ago" },
  { id: "pr4", lift: "Overhead Press", weight: 75, date: "2 weeks ago" },
];
