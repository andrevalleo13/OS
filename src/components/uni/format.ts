/**
 * Formato de fechas civiles (`YYYY-MM-DD`) sin `Intl`: mismo resultado en el
 * servidor y en el navegador, sin desajustes de hidratación.
 */

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const WEEKDAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function dateParts(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return { year, month, day, weekday };
}

export function shortDate(key: string): string {
  const { day, month, weekday } = dateParts(key);
  return `${WEEKDAYS[weekday]} ${day} ${MONTHS[month - 1]}`;
}

export function dayMonth(key: string): string {
  const { day, month } = dateParts(key);
  return `${day} ${MONTHS[month - 1]}`;
}

export function weekdayShort(key: string): string {
  return WEEKDAYS[dateParts(key).weekday];
}

export function weekdayLong(key: string): string {
  return WEEKDAYS_LONG[dateParts(key).weekday];
}

export function isWeekend(key: string): boolean {
  const { weekday } = dateParts(key);
  return weekday === 0 || weekday === 6;
}

export function relativeDays(days: number): string {
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  if (days === -1) return "ayer";
  if (days > 1) return `en ${days} días`;
  return `hace ${-days} días`;
}

export function compactDays(days: number): string {
  if (days === 0) return "hoy";
  if (days === 1) return "mañana";
  if (days > 1) return `${days} d`;
  return `−${-days} d`;
}

export function grade(value: number | null | undefined, digits = 1): string {
  return value === null || value === undefined ? "—" : value.toFixed(digits);
}

export function signed(value: number, digits = 1): string {
  if (Math.abs(value) < 10 ** -digits / 2) return (0).toFixed(digits);
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(digits)}`;
}

export function noteHref(path: string): string {
  return `/obsidian?note=${encodeURIComponent(path)}`;
}

export function ago(fromIso: string, toIso: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000));
  if (minutes < 1) return "hace un momento";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

export function addDaysKey(key: string, days: number): string {
  const { year, month, day } = dateParts(key);
  const date = new Date(Date.UTC(year, month - 1, day) + days * 86_400_000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function daysBetween(from: string, to: string): number {
  const a = dateParts(from);
  const b = dateParts(to);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
}

export const RISK_LABEL = { critico: "Crítico", alto: "Alto", medio: "Medio", bajo: "Bajo" } as const;
export const STANDING_LABEL = {
  asegurada: "Asegurada",
  "en-control": "En control",
  exigente: "Exigente",
  "fuera-de-alcance": "Fuera de alcance",
  "sin-datos": "Sin datos",
} as const;
