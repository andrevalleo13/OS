import "server-only";

import { differenceInHours, subDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dateKey, dayRange } from "@/lib/dates";
import { serverConfig } from "@/lib/config";
import { queueAutonomyJob, getAutonomyPolicy } from "./autonomy";
import { publishLifeEvent } from "./events";
import { detectBehaviorPatterns, type PatternCandidate } from "./patterns";

type StoredPattern = PatternCandidate & { id: string };

type AssignmentSnapshot = {
  id: string;
  title: string;
  course: string;
  dueDate: Date;
  status: string;
};

export type ProactiveSnapshot = {
  now: Date;
  timezone: string;
  todayCalories: number;
  todayWater: number;
  todayExpense: number;
  latestWorkoutAt?: Date;
  latestSleep?: number;
  assignments: AssignmentSnapshot[];
  patterns: StoredPattern[];
};

export type InsightCandidate = {
  dedupeKey: string;
  patternId?: string;
  type: string;
  title: string;
  body: string;
  rationale: string;
  evidence: Record<string, unknown>;
  urgency: number;
  expiresAt?: Date;
};

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function minutesOfDay(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function isWithinQuietHours(now: Date, timezone: string, quietStart: string, quietEnd: string): boolean {
  const current = Number(formatInTimeZone(now, timezone, "H")) * 60 + Number(formatInTimeZone(now, timezone, "m"));
  const start = minutesOfDay(quietStart);
  const end = minutesOfDay(quietEnd);
  if (start === end) return false;
  return start < end ? current >= start && current < end : current >= start || current < end;
}

function numericEvidence(pattern: StoredPattern | undefined, key: string): number | undefined {
  const value = pattern?.evidence[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function buildProactiveCandidates(snapshot: ProactiveSnapshot): InsightCandidate[] {
  const candidates: InsightCandidate[] = [];
  const localDate = dateKey(snapshot.now, snapshot.timezone);
  const localHour = Number(formatInTimeZone(snapshot.now, snapshot.timezone, "H"));
  const endOfDay = dayRange(snapshot.now, snapshot.timezone).end;
  const mealPattern = snapshot.patterns.find((pattern) => pattern.kind === "meal_timing");
  const workoutPattern = snapshot.patterns.find((pattern) => pattern.kind === "workout_cadence");
  const spendingPattern = snapshot.patterns.find((pattern) => pattern.kind === "spending_baseline");

  const typicalMealHour = numericEvidence(mealPattern, "typicalHour") ?? 14;
  if (localHour >= Math.max(15, typicalMealHour + 1) && snapshot.todayCalories < 850) {
    candidates.push({
      dedupeKey: `nutrition:meal-gap:${localDate}`,
      patternId: mealPattern?.id,
      type: "nutrition.meal_gap",
      title: "Comida pendiente",
      body: `Ya pasó tu horario habitual de comida y llevas ${Math.round(snapshot.todayCalories)} kcal registradas.`,
      rationale: "Shadow comparó el horario actual con tu patrón de comida y el registro nutricional de hoy.",
      evidence: { localHour, typicalMealHour, todayCalories: snapshot.todayCalories },
      urgency: 62,
      expiresAt: endOfDay,
    });
  }

  if (localHour >= 18 && snapshot.todayWater < 1.5) {
    candidates.push({
      dedupeKey: `nutrition:hydration:${localDate}`,
      type: "nutrition.hydration",
      title: "Hidratación baja",
      body: `Llevas ${snapshot.todayWater.toFixed(1)} L de agua registrados hoy.`,
      rationale: "El consumo registrado está por debajo del umbral vespertino de 1.5 L.",
      evidence: { todayWater: snapshot.todayWater, localHour },
      urgency: 48,
      expiresAt: endOfDay,
    });
  }

  if (snapshot.latestWorkoutAt) {
    const gapHours = differenceInHours(snapshot.now, snapshot.latestWorkoutAt);
    const gapDays = Math.round((gapHours / 24) * 10) / 10;
    const cadenceDays = numericEvidence(workoutPattern, "cadenceDays") ?? 2.5;
    const threshold = Math.max(4, cadenceDays * 1.75);
    if (gapDays >= threshold) {
      candidates.push({
        dedupeKey: `fitness:cadence-gap:${localDate}`,
        patternId: workoutPattern?.id,
        type: "fitness.cadence_gap",
        title: "Ritmo de entrenamiento fuera de patrón",
        body: `Han pasado ${gapDays} días desde el último entrenamiento; tu intervalo habitual es ${cadenceDays} días.`,
        rationale: "El intervalo actual superó el margen de tu cadencia reciente.",
        evidence: { gapDays, cadenceDays, threshold },
        urgency: 55,
        expiresAt: endOfDay,
      });
    }
  }

  if (snapshot.latestSleep !== undefined && snapshot.latestSleep < 6) {
    candidates.push({
      dedupeKey: `health:low-sleep:${localDate}`,
      type: "health.low_sleep",
      title: "Recuperación comprometida",
      body: `El último registro marca ${snapshot.latestSleep} horas de sueño. Conviene bajar intensidad y proteger el descanso hoy.`,
      rationale: "La última noche quedó por debajo del umbral de seis horas.",
      evidence: { latestSleep: snapshot.latestSleep },
      urgency: 70,
      expiresAt: endOfDay,
    });
  }

  const averageSpend = numericEvidence(spendingPattern, "dailyAverage");
  const spendThreshold = averageSpend ? Math.max(500, averageSpend * 2) : undefined;
  if (averageSpend !== undefined && spendThreshold !== undefined && snapshot.todayExpense > spendThreshold) {
    candidates.push({
      dedupeKey: `finance:spend-anomaly:${localDate}`,
      patternId: spendingPattern?.id,
      type: "finance.spend_anomaly",
      title: "Gasto fuera de línea base",
      body: `Hoy llevas $${Math.round(snapshot.todayExpense)} en gastos, más del doble de tu base reciente de $${Math.round(averageSpend)}.`,
      rationale: "El gasto acumulado cruzó el umbral dinámico de anomalía.",
      evidence: { todayExpense: snapshot.todayExpense, averageSpend, spendThreshold },
      urgency: 68,
      expiresAt: endOfDay,
    });
  }

  for (const assignment of snapshot.assignments) {
    const hours = differenceInHours(assignment.dueDate, snapshot.now);
    if (hours > 72 || hours < -168) continue;
    const overdue = hours < 0;
    candidates.push({
      dedupeKey: `university:deadline:${assignment.id}:${overdue ? "overdue" : localDate}`,
      type: overdue ? "university.overdue" : "university.deadline",
      title: overdue ? "Entrega vencida" : "Entrega próxima",
      body: overdue
        ? `${assignment.course}: ${assignment.title} venció hace ${Math.abs(hours)} horas y sigue ${assignment.status}.`
        : `${assignment.course}: ${assignment.title} vence en ${hours} horas.`,
      rationale: "La entrega pendiente entró en la ventana prioritaria de 72 horas.",
      evidence: { assignmentId: assignment.id, dueDate: assignment.dueDate.toISOString(), hours },
      urgency: overdue ? 95 : hours <= 24 ? 85 : 72,
      expiresAt: overdue ? undefined : assignment.dueDate,
    });
  }

  return candidates.toSorted((a, b) => b.urgency - a.urgency);
}

async function persistPatterns(patterns: PatternCandidate[]): Promise<StoredPattern[]> {
  const saved: StoredPattern[] = [];
  for (const pattern of patterns) {
    const record = await prisma.shadowPattern.upsert({
      where: { signature: pattern.signature },
      create: { ...pattern, evidence: jsonValue(pattern.evidence) },
      update: {
        title: pattern.title,
        description: pattern.description,
        evidence: jsonValue(pattern.evidence),
        confidence: pattern.confidence,
        sampleSize: pattern.sampleSize,
        lastObservedAt: new Date(),
      },
    });
    if (record.status === "active") saved.push({ ...pattern, id: record.id });
  }
  return saved;
}

async function persistInsight(candidate: InsightCandidate) {
  return prisma.shadowInsight.upsert({
    where: { dedupeKey: candidate.dedupeKey },
    create: {
      ...candidate,
      evidence: jsonValue(candidate.evidence),
      suggestedActionType: "notification.macos",
      suggestedActionInput: jsonValue({ title: candidate.title, body: candidate.body }),
    },
    update: {
      title: candidate.title,
      body: candidate.body,
      rationale: candidate.rationale,
      evidence: jsonValue(candidate.evidence),
      urgency: candidate.urgency,
      expiresAt: candidate.expiresAt,
    },
  });
}

export async function runProactiveCycle(now = new Date()) {
  const timezone = serverConfig.timezone;
  const since = subDays(now, 30);
  const today = dayRange(now, timezone);
  const [food, workouts, transactions, biometrics, assignments, policy] = await Promise.all([
    prisma.foodLog.findMany({ where: { date: { gte: since, lte: now } }, select: { date: true, calories: true, water: true } }),
    prisma.workoutSession.findMany({ where: { date: { gte: since, lte: now } }, orderBy: { date: "asc" }, select: { date: true } }),
    prisma.transaction.findMany({ where: { date: { gte: since, lte: now } }, select: { date: true, amount: true } }),
    prisma.biometricLog.findMany({ where: { date: { gte: since, lte: now } }, orderBy: { date: "asc" }, select: { date: true, sleep: true } }),
    prisma.assignment.findMany({
      where: {
        status: { not: "done" },
        dueDate: { gte: subDays(now, 7), lte: new Date(now.getTime() + 72 * 60 * 60 * 1_000) },
      },
      orderBy: { dueDate: "asc" },
      take: 20,
      select: { id: true, title: true, dueDate: true, status: true, course: { select: { name: true } } },
    }),
    getAutonomyPolicy(),
  ]);
  const detectedPatterns = detectBehaviorPatterns({ timezone, food, workouts, transactions, biometrics });
  const detectedSignatures = detectedPatterns.map((pattern) => pattern.signature);
  await prisma.shadowPattern.updateMany({
    where: {
      status: "active",
      kind: { in: ["meal_timing", "workout_cadence", "spending_baseline", "sleep_baseline"] },
      ...(detectedSignatures.length > 0 ? { signature: { notIn: detectedSignatures } } : {}),
    },
    data: { status: "expired" },
  });
  const patterns = await persistPatterns(detectedPatterns);
  const todayFood = food.filter((entry) => entry.date >= today.start && entry.date <= today.end);
  const todayTransactions = transactions.filter((entry) => entry.date >= today.start && entry.date <= today.end && entry.amount < 0);
  const latestSleep = biometrics.toReversed().find((entry) => entry.sleep !== null)?.sleep ?? undefined;
  const candidates = buildProactiveCandidates({
    now,
    timezone,
    todayCalories: todayFood.reduce((sum, entry) => sum + entry.calories, 0),
    todayWater: todayFood.reduce((sum, entry) => sum + entry.water, 0),
    todayExpense: todayTransactions.reduce((sum, entry) => sum + Math.abs(entry.amount), 0),
    latestWorkoutAt: workouts.at(-1)?.date,
    latestSleep,
    assignments: assignments.map((assignment) => ({ ...assignment, course: assignment.course.name })),
    patterns,
  });

  const activeOverdueKeys = candidates.filter((candidate) => candidate.type === "university.overdue").map((candidate) => candidate.dedupeKey);
  await prisma.shadowInsight.updateMany({
    where: {
      status: "pending",
      type: "university.overdue",
      ...(activeOverdueKeys.length > 0 ? { dedupeKey: { notIn: activeOverdueKeys } } : {}),
    },
    data: { status: "expired" },
  });

  await prisma.shadowInsight.updateMany({
    where: { status: "pending", expiresAt: { lt: now } },
    data: { status: "expired" },
  });
  const insights = [];
  for (const candidate of candidates) {
    const insight = await persistInsight(candidate);
    insights.push(insight);
    if (insight.createdAt.getTime() === insight.updatedAt.getTime()) {
      await publishLifeEvent({
        type: "insight.detected",
        source: "shadow",
        sourceId: insight.id,
        summary: insight.title,
        payload: { insightId: insight.id, type: insight.type, urgency: insight.urgency },
        priority: insight.urgency,
      });
    }
  }

  const deliveredToday = await prisma.shadowInsight.count({
    where: { deliveredAt: { gte: today.start, lte: today.end } },
  });
  const quiet = isWithinQuietHours(now, timezone, policy.quietStart, policy.quietEnd);
  let queued = 0;
  if (!quiet && policy.mode !== "observe") {
    const capacity = Math.max(0, policy.dailyDeliveryLimit - deliveredToday);
    for (const insight of insights.filter((item) => item.status === "pending").slice(0, capacity)) {
      await queueAutonomyJob({
        idempotencyKey: `insight:notification:${insight.id}`,
        insightId: insight.id,
        actionType: "notification.macos",
        summary: insight.title,
        payload: { title: `Shadow · ${insight.title}`, body: insight.body },
        scheduledFor: now,
        expiresAt: insight.expiresAt ?? undefined,
      });
      queued += 1;
    }
  }
  return { patterns: patterns.length, insights: insights.length, queued, quiet };
}

export async function getNextProactiveInsight() {
  const insight = await prisma.shadowInsight.findFirst({
    where: {
      status: "pending",
      availableAt: { lte: new Date() },
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: [{ urgency: "desc" }, { createdAt: "asc" }],
    select: { id: true, title: true, body: true, urgency: true, type: true },
  });
  return insight;
}
