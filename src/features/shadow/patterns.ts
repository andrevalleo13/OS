import { differenceInHours } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { dateKey } from "@/lib/dates";

type TimedValue = { date: Date };
type FoodPoint = TimedValue & { calories: number; water: number };
type WorkoutPoint = TimedValue;
type FinancePoint = TimedValue & { amount: number };
type SleepPoint = TimedValue & { sleep: number | null };

export type PatternCandidate = {
  signature: string;
  kind: "meal_timing" | "workout_cadence" | "spending_baseline" | "sleep_baseline";
  subject: string;
  title: string;
  description: string;
  evidence: Record<string, unknown>;
  confidence: number;
  sampleSize: number;
};

export type BehaviorPatternInput = {
  timezone: string;
  food: FoodPoint[];
  workouts: WorkoutPoint[];
  transactions: FinancePoint[];
  biometrics: SleepPoint[];
};

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function hourInTimezone(date: Date, timezone: string): number {
  return Number(formatInTimeZone(date, timezone, "H"));
}

function confidence(sampleSize: number, idealSampleSize: number): number {
  return Math.min(0.96, Math.max(0.5, sampleSize / idealSampleSize));
}

export function detectBehaviorPatterns(input: BehaviorPatternInput): PatternCandidate[] {
  const patterns: PatternCandidate[] = [];
  const mealHours = input.food
    .filter((point) => point.calories >= 150)
    .map((point) => hourInTimezone(point.date, input.timezone))
    .filter((hour) => hour >= 11 && hour <= 16);

  if (mealHours.length >= 4) {
    const typicalHour = median(mealHours);
    patterns.push({
      signature: "nutrition:lunch-window",
      kind: "meal_timing",
      subject: "comida principal",
      title: "Horario habitual de comida",
      description: `La comida principal suele registrarse alrededor de las ${Math.floor(typicalHour).toString().padStart(2, "0")}:00.`,
      evidence: { typicalHour, observedHours: mealHours.toSorted((a, b) => a - b) },
      confidence: confidence(mealHours.length, 12),
      sampleSize: mealHours.length,
    });
  }

  const workoutDates = [...new Set(input.workouts.map((point) => dateKey(point.date, input.timezone)))]
    .toSorted()
    .map((key) => new Date(`${key}T12:00:00.000Z`));
  const workoutIntervals = workoutDates.slice(1).map((date, index) =>
    Math.max(0.5, differenceInHours(date, workoutDates[index]) / 24)
  );
  if (workoutIntervals.length >= 2) {
    const cadenceDays = Math.round(median(workoutIntervals) * 10) / 10;
    patterns.push({
      signature: "fitness:workout-cadence",
      kind: "workout_cadence",
      subject: "entrenamiento",
      title: "Cadencia de entrenamiento",
      description: `El intervalo habitual entre entrenamientos es de ${cadenceDays} días.`,
      evidence: { cadenceDays, intervals: workoutIntervals.map((value) => Math.round(value * 10) / 10) },
      confidence: confidence(workoutIntervals.length, 10),
      sampleSize: workoutIntervals.length,
    });
  }

  const dailySpending = new Map<string, number>();
  for (const transaction of input.transactions) {
    if (transaction.amount >= 0) continue;
    const key = dateKey(transaction.date, input.timezone);
    dailySpending.set(key, (dailySpending.get(key) ?? 0) + Math.abs(transaction.amount));
  }
  const spendingValues = [...dailySpending.values()];
  if (spendingValues.length >= 5) {
    const dailyAverage = Math.round(average(spendingValues) * 100) / 100;
    const dailyDeviation = Math.round(standardDeviation(spendingValues) * 100) / 100;
    patterns.push({
      signature: "finance:daily-spending-baseline",
      kind: "spending_baseline",
      subject: "gasto diario",
      title: "Línea base de gasto",
      description: `En días con movimientos, el gasto medio es $${Math.round(dailyAverage)}.`,
      evidence: { dailyAverage, dailyDeviation, daysObserved: spendingValues.length },
      confidence: confidence(spendingValues.length, 14),
      sampleSize: spendingValues.length,
    });
  }

  const sleepValues = input.biometrics
    .map((point) => point.sleep)
    .filter((value): value is number => value !== null && value > 0 && value <= 24);
  if (sleepValues.length >= 5) {
    const averageHours = Math.round(average(sleepValues) * 10) / 10;
    patterns.push({
      signature: "health:sleep-baseline",
      kind: "sleep_baseline",
      subject: "sueño",
      title: "Línea base de sueño",
      description: `El promedio reciente de sueño es ${averageHours} horas.`,
      evidence: { averageHours, minimum: Math.min(...sleepValues), maximum: Math.max(...sleepValues) },
      confidence: confidence(sleepValues.length, 14),
      sampleSize: sleepValues.length,
    });
  }

  return patterns;
}
