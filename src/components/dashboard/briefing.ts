import { NUTRITION_GOALS } from "@/features/nutrition/nutrition";
import type { DashboardInitialData } from "./types";

export const OWNER_NAME = "Andre";

/** Tres como máximo: más que eso deja de ser un resumen y vuelve a ser ruido. */
const MAX_ITEMS = 3;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type BriefingTone = "focus" | "care" | "good";

export type BriefingItem = {
  id: string;
  tone: BriefingTone;
  label: string;
  href: string;
};

export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function relativeDue(due: Date, now: Date): string {
  const hours = Math.round((due.getTime() - now.getTime()) / HOUR);
  if (hours < 0) return "vencida";
  if (hours < 1) return "en menos de una hora";
  if (hours < 24) return `en ${hours} h`;
  return due.toDateString() === new Date(now.getTime() + DAY).toDateString() ? "mañana" : `en ${Math.round(hours / 24)} días`;
}

/** Fracción del día "comible" que ya pasó (7:00 a 22:00). */
function dayProgress(now: Date): number {
  const hours = now.getHours() + now.getMinutes() / 60;
  return Math.min(1, Math.max(0, (hours - 7) / 15));
}

/**
 * Lo que Shadow considera importante ahora, ordenado por urgencia. Es
 * determinista y se basa solo en datos reales: si no hay nada que decir, lo
 * dice en lugar de inventar urgencia.
 */
export function buildBriefing(data: DashboardInitialData, now: Date): BriefingItem[] {
  const items: BriefingItem[] = [];

  const upcoming = data.assignments
    .filter((assignment) => assignment.status !== "done")
    .map((assignment) => ({ ...assignment, due: new Date(assignment.dueDate) }))
    .filter((assignment) => assignment.due.getTime() - now.getTime() < 2 * DAY)
    .sort((a, b) => a.due.getTime() - b.due.getTime());
  for (const assignment of upcoming.slice(0, 2)) {
    const overdue = assignment.due.getTime() < now.getTime();
    items.push({
      id: `assignment:${assignment.id}`,
      tone: overdue ? "care" : "focus",
      label: `${assignment.title} · ${relativeDue(assignment.due, now)}`,
      href: "/uni",
    });
  }

  const readiness = data.biometrics.readiness;
  const hasBiometrics = Object.values(data.biometrics.latest).some((value) => value !== null);
  if (hasBiometrics && readiness < 45) {
    items.push({ id: "readiness:low", tone: "care", label: `Recuperación baja (${readiness}) — hoy entrena suave`, href: "/biometrics" });
  } else if (hasBiometrics && readiness >= 80) {
    items.push({ id: "readiness:high", tone: "good", label: `Recuperación alta (${readiness}) — buen día para empujar`, href: "/biometrics" });
  }

  const caloriesRatio = data.nutrition.totals.calories / NUTRITION_GOALS.calories;
  if (now.getHours() >= 13 && caloriesRatio < dayProgress(now) - 0.25) {
    items.push({ id: "nutrition:behind", tone: "care", label: `Vas en ${Math.round(caloriesRatio * 100)}% de tus calorías — come algo con proteína`, href: "/food" });
  } else if (data.nutrition.totals.protein >= NUTRITION_GOALS.protein) {
    items.push({ id: "nutrition:protein", tone: "good", label: "Proteína del día cubierta", href: "/food" });
  }

  const lastSession = data.gym.sessionHistory
    .map((session) => new Date(session.date).getTime())
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => b - a)[0];
  if (lastSession !== undefined) {
    const daysIdle = Math.floor((now.getTime() - lastSession) / DAY);
    if (daysIdle >= 3) items.push({ id: "gym:idle", tone: "focus", label: `Llevas ${daysIdle} días sin entrenar`, href: "/gym" });
  }

  const { spentThisWeek, incomeThisWeek } = data.finance;
  if (spentThisWeek > 0 && spentThisWeek > incomeThisWeek) {
    items.push({ id: "finance:spend", tone: "focus", label: `Llevas $${Math.round(spentThisWeek).toLocaleString("es-MX")} gastados esta semana`, href: "/finances" });
  }

  return items.slice(0, MAX_ITEMS);
}
