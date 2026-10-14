/**
 * Aritmética sobre claves de día `yyyy-MM-dd`. Las claves ya vienen en la zona
 * horaria del usuario; aquí se tratan como fechas UTC puras para no desplazarlas.
 */

const DAY_MS = 86_400_000;

function toDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function addDays(key: string, days: number): string {
  const date = toDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** 0 = domingo … 6 = sábado. */
export function weekdayOf(key: string): number {
  return toDate(key).getUTCDay();
}

/** Lunes de la semana que contiene `key`. */
export function mondayOf(key: string): string {
  return addDays(key, -((weekdayOf(key) + 6) % 7));
}

/** Días de `from` a `to` (positivo si `to` es posterior). */
export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / DAY_MS);
}

export const WEEKDAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;
export const WEEKDAY_SHORT = ["D", "L", "M", "M", "J", "V", "S"] as const;
/** Orden visual de la semana (lunes primero). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const dayFormatter = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
const shortFormatter = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
const longFormatter = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export function formatDay(key: string): string {
  return dayFormatter.format(toDate(key)).replace(/\./g, "");
}

export function formatShort(key: string): string {
  return shortFormatter.format(toDate(key)).replace(/\./g, "");
}

export function formatLong(key: string): string {
  return longFormatter.format(toDate(key));
}

/** "hoy", "ayer", "hace 3 días", "mañana", "en 2 días". */
export function relativeDay(key: string, today: string): string {
  const diff = daysBetween(today, key);
  if (diff === 0) return "hoy";
  if (diff === -1) return "ayer";
  if (diff === 1) return "mañana";
  if (diff < 0) return `hace ${-diff} días`;
  return `en ${diff} días`;
}

/** Primera letra en mayúscula ("mié 14 oct" → "Mié 14 oct"). */
export function sentence(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value;
}
