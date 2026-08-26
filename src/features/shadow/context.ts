import "server-only";

import { startOfWeek } from "date-fns";
import { readObsidianNote, searchObsidianNotes } from "@/app/actions/obsidian";
import { WEEKLY_ROUTINES } from "@/components/gym/MuscleData";
import { NUTRITION_GOALS } from "@/features/nutrition/nutrition";
import { listCalendarEvents } from "@/features/calendar/calendar.service";
import { dayRange } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { serverConfig } from "@/lib/config";
import type { ShadowContextRoute, ShadowDomain } from "./context-router";
import { recentLifeEvents } from "./events";
import { semanticSearchAsContext } from "./knowledge-index";
import { lifeGraphContext } from "./life-graph";

async function nutritionContext(): Promise<string> {
  const { start, end } = dayRange(new Date(), serverConfig.timezone);
  const aggregate = await prisma.foodLog.aggregate({
    where: { date: { gte: start, lte: end } },
    _sum: { calories: true, protein: true, carbs: true, fat: true, water: true },
  });
  return [
    `Nutrición hoy: ${Math.round(aggregate._sum.calories ?? 0)}/${NUTRITION_GOALS.calories} kcal`,
    `${Math.round(aggregate._sum.protein ?? 0)}/${NUTRITION_GOALS.protein}g proteína`,
    `${Math.round(aggregate._sum.carbs ?? 0)}/${NUTRITION_GOALS.carbs}g carbohidratos`,
    `${Math.round(aggregate._sum.fat ?? 0)}/${NUTRITION_GOALS.fat}g grasa`,
    `${(aggregate._sum.water ?? 0).toFixed(1)}L agua`,
  ].join("; ");
}

async function fitnessContext(): Promise<string> {
  const routine = WEEKLY_ROUTINES[new Date().getDay()];
  const [latestWorkout, latestBiometric] = await Promise.all([
    prisma.workoutSession.findFirst({
      orderBy: { date: "desc" },
      select: { date: true, title: true, duration: true, volume: true },
    }),
    prisma.biometricLog.findFirst({
      orderBy: { date: "desc" },
      select: { date: true, weight: true, sleep: true, hrv: true, steps: true },
    }),
  ]);
  const planned = routine.isRest
    ? `${routine.name} (descanso)`
    : `${routine.name}: ${routine.exercises.map((exercise) => exercise.name).join(", ")}`;
  const latest = latestWorkout
    ? `Último entrenamiento: ${latestWorkout.title}, ${latestWorkout.duration} min, ${Math.round(latestWorkout.volume)} kg de volumen, ${latestWorkout.date.toISOString()}`
    : "Sin entrenamientos registrados";
  const biometric = latestBiometric
    ? `Última biometría: peso ${latestBiometric.weight ?? "n/d"}kg, sueño ${latestBiometric.sleep ?? "n/d"}h, HRV ${latestBiometric.hrv ?? "n/d"}, pasos ${latestBiometric.steps ?? "n/d"}`
    : "Sin biometría registrada";
  return `Rutina prevista: ${planned}. ${latest}. ${biometric}.`;
}

async function financeContext(): Promise<string> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const [weekly, recent] = await Promise.all([
    prisma.transaction.aggregate({
      where: { date: { gte: weekStart } },
      _sum: { amount: true },
      _count: { id: true },
    }),
    prisma.transaction.findMany({
      orderBy: { date: "desc" },
      take: 5,
      select: { amount: true, type: true, category: true, note: true, date: true },
    }),
  ]);
  const recentText = recent.map((item) =>
    `${item.date.toISOString()}: ${item.type} $${Math.abs(item.amount)} ${item.category}${item.note ? ` (${item.note})` : ""}`
  ).join("; ");
  return `Finanzas esta semana: balance $${weekly._sum.amount ?? 0} en ${weekly._count.id} movimientos. Recientes: ${recentText || "ninguno"}.`;
}

async function universityContext(): Promise<string> {
  const assignments = await prisma.assignment.findMany({
    where: { status: { not: "done" } },
    orderBy: { dueDate: "asc" },
    take: 10,
    select: { title: true, dueDate: true, status: true, course: { select: { name: true } } },
  });
  return assignments.length > 0
    ? `Pendientes de universidad: ${assignments.map((item) => `${item.course.name} — ${item.title} (${item.status}, ${item.dueDate.toISOString()})`).join("; ")}.`
    : "No hay entregas pendientes registradas.";
}

async function calendarContext(): Promise<string> {
  try {
    const events = await listCalendarEvents();
    return events.length > 0
      ? `Próximos eventos: ${events.slice(0, 12).map((event) => `${event.title} (${event.start}–${event.end}, ${event.calendar})`).join("; ")}.`
      : "No hay eventos próximos en los calendarios conectados.";
  } catch {
    return "El calendario conectado no estuvo disponible para esta consulta.";
  }
}

const domainLoaders: Record<ShadowDomain, () => Promise<string>> = {
  nutrition: nutritionContext,
  fitness: fitnessContext,
  finance: financeContext,
  university: universityContext,
  calendar: calendarContext,
};

export async function buildShadowContext(route: ShadowContextRoute): Promise<string> {
  const now = new Intl.DateTimeFormat(serverConfig.locale, {
    timeZone: serverConfig.timezone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());

  const sections = [`Fecha y hora local: ${now}.`];
  const domainSections = await Promise.all(route.domains.map((domain) => domainLoaders[domain]()));
  sections.push(...domainSections);

  if (route.needsObsidian && route.personalQuery) {
    try {
      const [semantic, graph] = await Promise.all([
        semanticSearchAsContext(route.personalQuery),
        lifeGraphContext(route.personalQuery),
      ]);
      const graphText = graph.map((entity) => {
        const outgoing = entity.outgoing.map((relation) => `${relation.type} → ${relation.toEntity.name}`).join(", ");
        const incoming = entity.incoming.map((relation) => `${relation.fromEntity.name} → ${relation.type}`).join(", ");
        return `${entity.name} (${entity.kind}): ${entity.description ?? "sin descripción"}${outgoing || incoming ? `; conexiones: ${[outgoing, incoming].filter(Boolean).join("; ")}` : ""}`;
      }).join("\n");
      const fallback = semantic.includes("No se encontró")
        ? (await searchObsidianNotes(route.personalQuery)).slice(0, 4_000)
        : semantic;
      sections.push(`Memoria personal relevante:\n${fallback}\n\nGrafo personal:\n${graphText || "Sin entidades relacionadas."}`);
    } catch {
      sections.push("La memoria personal no estuvo disponible para esta consulta.");
    }
  }

  if (route.needsDirectives) {
    try {
      sections.push(`Directivas personales relevantes:\n${(await readObsidianNote("900 - Sistema/Directivas de Shadow.md")).slice(0, 5_000)}`);
    } catch {
      sections.push("No hay directivas personales adicionales disponibles.");
    }
  }

  if (route.intent !== "general") {
    try {
      const events = await recentLifeEvents(10);
      sections.push(`Eventos recientes del sistema:\n${events.map((event) => `${event.occurredAt.toISOString()} · ${event.type}: ${event.summary}`).join("\n") || "Ninguno."}`);
    } catch {
      // Event context is supplemental; a missing event stream must not break chat.
    }
  }

  return sections.join("\n\n");
}
