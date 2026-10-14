/**
 * Formato de fechas estilo moment.js (el que usan Obsidian, Daily Notes y
 * Templater) y render de plantillas con sintaxis de Obsidian y Templater.
 */

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const TOKEN = /\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|DDDD|DD|Do|D|dddd|ddd|dd|d|HH|H|hh|h|mm|m|ss|s|A|a|ww|w|gggg|Q/g;

function pad(value: number, size = 2): string {
  return String(value).padStart(size, "0");
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Semana ISO 8601 (la que usa `ww` en Obsidian con locale es). */
export function isoWeek(date: Date): { week: number; year: number } {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  return { week: Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7), year: target.getUTCFullYear() };
}

/** Formatea una fecha local con tokens de moment.js en español. */
export function formatMoment(date: Date, format: string): string {
  return format.replace(TOKEN, (token, literal: string | undefined) => {
    if (literal !== undefined) return literal;
    const day = date.getDay();
    switch (token) {
      case "YYYY": return String(date.getFullYear());
      case "YY": return String(date.getFullYear()).slice(-2);
      case "MMMM": return capitalize(MONTHS[date.getMonth()]);
      case "MMM": return capitalize(MONTHS[date.getMonth()].slice(0, 3));
      case "MM": return pad(date.getMonth() + 1);
      case "M": return String(date.getMonth() + 1);
      case "DDDD": {
        const start = new Date(date.getFullYear(), 0, 0);
        return pad(Math.floor((date.getTime() - start.getTime()) / 86_400_000), 3);
      }
      case "DD": return pad(date.getDate());
      case "Do": return `${date.getDate()}º`;
      case "D": return String(date.getDate());
      case "dddd": return capitalize(WEEKDAYS[day]);
      case "ddd": return capitalize(WEEKDAYS[day].slice(0, 3));
      case "dd": return capitalize(WEEKDAYS[day].slice(0, 2));
      case "d": return String(day);
      case "HH": return pad(date.getHours());
      case "H": return String(date.getHours());
      case "hh": return pad(date.getHours() % 12 || 12);
      case "h": return String(date.getHours() % 12 || 12);
      case "mm": return pad(date.getMinutes());
      case "m": return String(date.getMinutes());
      case "ss": return pad(date.getSeconds());
      case "s": return String(date.getSeconds());
      case "A": return date.getHours() < 12 ? "AM" : "PM";
      case "a": return date.getHours() < 12 ? "am" : "pm";
      case "ww": return pad(isoWeek(date).week);
      case "w": return String(isoWeek(date).week);
      case "gggg": return String(isoWeek(date).year);
      case "Q": return String(Math.floor(date.getMonth() / 3) + 1);
      default: return token;
    }
  });
}

export type TemplateContext = { title: string; date: Date };

function shiftDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

/**
 * Sustituye variables de plantillas: `{{title}}`, `{{date}}`, `{{time}}`,
 * `{{date:FORMATO}}` (core) y las llamadas más comunes de Templater
 * (`tp.file.title`, `tp.date.now`, `tp.date.today/tomorrow/yesterday`).
 */
export function renderTemplate(template: string, context: TemplateContext): string {
  const { title, date } = context;
  return template
    .replace(/{{\s*title\s*}}/gi, title)
    .replace(/{{\s*date\s*(?::\s*([^}]*?))?\s*}}/gi, (_match, format?: string) => formatMoment(date, format || "YYYY-MM-DD"))
    .replace(/{{\s*time\s*(?::\s*([^}]*?))?\s*}}/gi, (_match, format?: string) => formatMoment(date, format || "HH:mm"))
    .replace(/<%[-_]?\s*([\s\S]*?)\s*[-_]?%>/g, (match, expression: string) => {
      const call = expression.trim();
      if (/^tp\.file\.title$/.test(call)) return title;
      const dateCall = /^tp\.date\.(now|today|tomorrow|yesterday)\(\s*(?:["'`]([^"'`]*)["'`])?\s*(?:,\s*(-?\d+))?[^)]*\)$/.exec(call);
      if (dateCall) {
        const [, kind, format, offset] = dateCall;
        const base = kind === "tomorrow" ? shiftDays(date, 1) : kind === "yesterday" ? shiftDays(date, -1) : date;
        return formatMoment(shiftDays(base, Number(offset ?? 0)), format || "YYYY-MM-DD");
      }
      if (/^tp\.file\.creation_date\(/.test(call)) return formatMoment(date, "YYYY-MM-DD HH:mm");
      if (/^tp\.file\.cursor\(/.test(call)) return "";
      return match;
    });
}
