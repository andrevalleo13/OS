import { foldText } from "@/features/vault/parse";

/**
 * Utilidades puras para leer el español "de cuaderno" de la bóveda: fechas
 * como "Lunes 12 Oct", calificaciones como "**10** 🏆", horarios como
 * "Lun/Jue 10:30am" y nombres de materia abreviados.
 */

const MONTHS: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12,
};
const MONTH_PATTERN = "(ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:t|tiembre)?|set(?:iembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)\\.?(?![a-z])";
const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const PICTOGRAPHS = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}]/gu;

/** Quita el formato Markdown en línea, emojis y LaTeX simple. */
export function stripInline(text: string): string {
  return text
    .replace(/!?\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2")
    .replace(/!?\[\[([^\]]*)\]\]/g, (_, target: string) => target.split("/").pop()?.replace(/\.md$/i, "").split("#")[0] ?? target)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\$\\ge\s*/g, "≥ ").replace(/\$\\le\s*/g, "≤ ").replace(/\$/g, "")
    .replace(/\\ge\b/g, "≥").replace(/\\le\b/g, "≤")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__)/g, "")
    .replace(/(^|\s)[*_](\S[^*_]*?)[*_](?=\s|$|[.,;:])/g, "$1$2")
    .replace(PICTOGRAPHS, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Texto plano de una línea de lista o encabezado. */
export function cleanLine(line: string): string {
  return stripInline(line.replace(/^\s*(?:>\s*)*(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX/-]\]\s+)?|\d+[.)]\s+)?/, ""));
}

/** Minúsculas sin acentos ni formato: base para comparar. */
export function fold(text: string): string {
  return foldText(stripInline(text)).replace(/\s+/g, " ").trim();
}

export function parseNumber(text: string): number | null {
  const match = /-?\d+(?:[.,]\d+)?/.exec(text);
  if (!match) return null;
  const value = Number.parseFloat(match[0].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/**
 * Lee una calificación en escala 0-10. Ignora lo que va entre paréntesis
 * ("8.5 (Parcial 1 cubrió…)") y acepta "10/10" o porcentajes (95 → 9.5).
 */
export function parseGrade(text: string): number | null {
  const clean = stripInline(text).replace(/\([^)]*\)/g, " ").trim();
  if (!clean || /^[—–\-?x]+$/i.test(clean) || /pendiente|sin calificar|n\/a/i.test(clean)) return null;
  const value = parseNumber(clean);
  if (value === null || value < 0) return null;
  if (value <= 10) return Math.round(value * 100) / 100;
  if (value <= 100) return Math.round(value * 10) / 100;
  return null;
}

// ---------------------------------------------------------------------------
// Fechas civiles (YYYY-MM-DD) sin zona horaria
// ---------------------------------------------------------------------------

export function toKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function keyToUtc(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function diffDays(from: string, to: string): number {
  return Math.round((keyToUtc(to) - keyToUtc(from)) / 86_400_000);
}

export function addDays(key: string, days: number): string {
  const date = new Date(keyToUtc(key) + days * 86_400_000);
  return toKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

/** 0 = domingo … 6 = sábado. */
export function weekdayOf(key: string): number {
  return new Date(keyToUtc(key)).getUTCDay();
}

export function monthShort(month: number): string {
  return MONTH_SHORT[month - 1] ?? "";
}

function validDay(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1;
}

/** Elige el año que deja la fecha más cerca de hoy (el semestre cruza años). */
function nearestYear(month: number, day: number, today: string): number {
  const base = Number(today.slice(0, 4));
  let best = base;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const year of [base - 1, base, base + 1]) {
    if (!validDay(year, month, day)) continue;
    const distance = Math.abs(diffDays(today, toKey(year, month, day)));
    if (distance < bestDistance) {
      best = year;
      bestDistance = distance;
    }
  }
  return best;
}

/**
 * "Lunes 12 Oct", "Mar 1 Dic", "12 de octubre de 2026", "(7 sep)", "2026-10-14".
 * Devuelve `YYYY-MM-DD` o null. El año sale del texto, de `yearHint` o del más cercano a hoy.
 */
export function parseSpanishDate(text: string, options: { today: string; yearHint?: number | null; monthHint?: number | null }): string | null {
  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(text);
  if (iso) {
    const [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    return validDay(year, month, day) ? toKey(year, month, day) : null;
  }
  const folded = fold(text);
  const match = new RegExp(`(?:^|[^\\d])(\\d{1,2})\\s*(?:de\\s+)?${MONTH_PATTERN}(?:\\s*(?:de|del)?\\s*(\\d{4}))?`).exec(folded);
  let day: number;
  let month: number;
  let year: number | null = null;
  if (match) {
    day = Number(match[1]);
    month = MONTHS[match[2].slice(0, 3)];
    year = match[3] ? Number(match[3]) : null;
  } else if (options.monthHint) {
    const bare = /(?:^|[^\d.,:])(\d{1,2})(?![\d.,:%])/.exec(folded);
    if (!bare) return null;
    day = Number(bare[1]);
    month = options.monthHint;
  } else {
    return null;
  }
  year ??= options.yearHint ?? nearestYear(month, day, options.today);
  return validDay(year, month, day) ? toKey(year, month, day) : null;
}

export function parseMonth(text: string): number | null {
  const match = new RegExp(`\\b${MONTH_PATTERN}`).exec(fold(text));
  return match ? MONTHS[match[1].slice(0, 3)] : null;
}

export function parseYear(text: string): number | null {
  const match = /\b(20\d{2})\b/.exec(text);
  return match ? Number(match[1]) : null;
}

/** "10:30 AM", "4:00pm", "12pm", "16:00" → "HH:mm". */
export function parseTime(text: string): string | null {
  const meridian = /\b(\d{1,2})(?::(\d{2}))?\s*(a\.?\s?m\.?|p\.?\s?m\.?)(?![a-z])/i.exec(text);
  if (meridian) {
    let hour = Number(meridian[1]);
    const minute = Number(meridian[2] ?? "0");
    const pm = meridian[3].toLowerCase().startsWith("p");
    if (hour < 1 || hour > 12 || minute > 59) return null;
    if (pm && hour !== 12) hour += 12;
    if (!pm && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  }
  const clock = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(text);
  return clock ? `${clock[1].padStart(2, "0")}:${clock[2]}` : null;
}

const WEEKDAYS: Record<string, number> = { dom: 0, lun: 1, mar: 2, mie: 3, jue: 4, vie: 5, sab: 6 };

/**
 * Horario de clase de la base: "Lun/Jue 7:00am", "Jue/Vie 8:30am / 12pm", "Mié 4:00pm".
 * Si hay tantas horas como días se emparejan en orden; si no, la primera hora aplica a todos.
 */
export function parseSchedule(text: string | null | undefined): Map<number, string | null> {
  const result = new Map<number, string | null>();
  if (!text) return result;
  const folded = foldText(text).toLowerCase();
  const days = [...folded.matchAll(/\b(dom|lun|mar|mie|jue|vie|sab)[a-z]*\.?(?=[\s/,;-]|$)/g)].map((match) => WEEKDAYS[match[1]]);
  const times = [...folded.matchAll(/\b\d{1,2}(?::\d{2})?\s*(?:a\.?\s?m\.?|p\.?\s?m\.?)|\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g)]
    .map((match) => parseTime(match[0]))
    .filter((time): time is string => Boolean(time));
  days.forEach((day, index) => {
    if (result.has(day)) return;
    result.set(day, times.length === days.length ? times[index] : times[0] ?? null);
  });
  return result;
}

// ---------------------------------------------------------------------------
// Nombres de materia
// ---------------------------------------------------------------------------

const STOPWORDS = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "al", "a", "en", "the", "of", "and"]);
const CODE = /^[A-Z]{0,4}\d{3,4}$/;

/** Separa "Finanzas Tecnológicas / Fintech (FIN506 / 2586)" en base, alias y códigos. */
export function splitSubjectName(raw: string): { base: string; aliases: string[]; codes: string[] } {
  const clean = stripInline(raw).replace(/^\d+[.)]\s+/, "").trim();
  const inner = [...clean.matchAll(/\(([^)]*)\)/g)].map((match) => match[1].trim()).filter(Boolean);
  const base = clean.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const codes: string[] = [];
  const aliases: string[] = [];
  for (const part of inner) {
    const pieces = part.split(/\s*[/,]\s*/).filter(Boolean);
    if (pieces.every((piece) => CODE.test(piece))) codes.push(...pieces);
    else aliases.push(part);
  }
  const slashParts = base.split(/\s+\/\s+/).map((part) => part.trim()).filter(Boolean);
  if (slashParts.length > 1) aliases.push(...slashParts.slice(1));
  return { base: slashParts[0] ?? base, aliases: [...new Set(aliases)], codes: [...new Set(codes)] };
}

export function nameTokens(name: string): string[] {
  return fold(name).split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

function initials(name: string): string {
  return nameTokens(name).filter((token) => !/^\d+$/.test(token)).map((token) => token[0]).join("");
}

function tokenMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 3 && long.startsWith(short);
}

/**
 * Similitud 0-1 entre dos nombres de materia: tokens significativos que
 * coinciden (por prefijo, para "Proc." ≈ "Procesamiento") sobre el nombre
 * más corto. Siglas como "A&P" se comparan con las iniciales.
 */
export function nameSimilarity(a: string, b: string): number {
  const foldedA = fold(a);
  const foldedB = fold(b);
  if (!foldedA || !foldedB) return 0;
  if (foldedA === foldedB) return 1;
  const acronym = (value: string) => /^[A-Z&.]{2,5}$/.test(stripInline(value).replace(/\s+/g, ""));
  if (acronym(a) && !/^[A-Z]{3,}$/.test(stripInline(a))) {
    return stripInline(a).replace(/[^A-Z]/g, "").toLowerCase() === initials(b) ? 1 : 0;
  }
  if (acronym(b) && !/^[A-Z]{3,}$/.test(stripInline(b))) {
    return stripInline(b).replace(/[^A-Z]/g, "").toLowerCase() === initials(a) ? 1 : 0;
  }
  const tokensA = nameTokens(a);
  const tokensB = nameTokens(b);
  if (!tokensA.length || !tokensB.length) return 0;
  const [small, large] = tokensA.length <= tokensB.length ? [tokensA, tokensB] : [tokensB, tokensA];
  const used = new Set<number>();
  let matched = 0;
  for (const token of small) {
    const index = large.findIndex((candidate, position) => !used.has(position) && tokenMatch(token, candidate));
    if (index !== -1) {
      used.add(index);
      matched += 1;
    }
  }
  return matched / small.length;
}

export function slugify(text: string): string {
  return fold(text).replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "materia";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** ¿El texto menciona alguno de los alias como palabra completa? */
export function mentionsAny(text: string, aliases: string[]): boolean {
  const folded = fold(text);
  return aliases.some((alias) => {
    const key = fold(alias);
    if (key.length < 3) return false;
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(key)}($|[^\\p{L}\\p{N}])`, "u").test(folded);
  });
}

/** Palabras que no distinguen una materia de otra. */
const GENERIC = new Set([
  "analisis", "finanzas", "financieros", "financiero", "financiera", "financieras", "introduccion", "informacion",
  "tecnologicas", "general", "aplicada", "aplicado", "semestre", "materia", "taller", "seminario", "proc", "info", "intro",
]);

/** Tokens de un nombre que no aparecen en ninguna otra materia: "Derivados", "Cristianismo". */
export function distinctiveTokens(names: string[], others: string[][]): string[] {
  const otherTokens = new Set(others.flatMap((list) => list.flatMap(nameTokens)));
  const tokens = new Set(names.flatMap(nameTokens));
  return [...tokens].filter((token) => token.length >= 5 && !GENERIC.has(token) && ![...otherTokens].some((other) => tokenMatch(token, other)));
}
