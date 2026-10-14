/**
 * Lectura del entrenamiento de André desde notas de Obsidian. Todo es puro y
 * defensivo: si una nota cambia de formato, el parser devuelve menos datos,
 * nunca lanza.
 */

import { WEEKDAY_NAMES } from "./dates";
import { inferMuscleId } from "./muscles";
import {
  bullets,
  cleanInline,
  fold,
  headingText,
  labeled,
  parseDateKey,
  parseNumber,
  sections,
  sentenceMatching,
  splitList,
  stripFrontmatter,
  truncate,
  type Bullet,
} from "./text";
import type { DailyEntry, GymFlag, LabeledLine, LiftMention, MemoryLine, NoteRef, RoutineDay, RoutineExercise, RoutineKind } from "./types";

export type VaultNoteInput = {
  path: string;
  title: string;
  text: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  mtime: number;
};

/** Palabras que delatan contenido de entrenamiento (sobre texto ya plegado). */
export const GYM_PATTERN = /\b(gym|gimnasio|entren\w*|pesas|al fallo|creatina|press|sentadilla|peso muerto|ego lift|split|\d+\s?lbs?)\b/;
const PARTNER_PATTERN = /\b(gym|gimnasio|entren\w*|5\s?am)\b/;

export function noteRef(note: Pick<VaultNoteInput, "path" | "title">): NoteRef {
  return { path: note.path, title: note.title };
}

// ---------------------------------------------------------------------------
// Clasificación de notas
// ---------------------------------------------------------------------------

const DAILY_NAME = /^\d{4}-\d{2}-\d{2}$/;

export function isDailyNote(note: Pick<VaultNoteInput, "path" | "title">): boolean {
  const folder = note.path.split("/").slice(0, -1).join("/");
  return DAILY_NAME.test(note.title) && /(^|\/)diario($|\/)/.test(fold(folder));
}

export function isGymNote(note: Pick<VaultNoteInput, "path" | "title" | "tags">): boolean {
  if (isDailyNote(note) || /plantilla|template/.test(fold(note.path))) return false;
  const tags = note.tags.map(fold);
  return /salud|fitness|entrenamiento|gym|gimnasio|rutina/.test(fold(note.title)) || tags.some((tag) => /^(gym|fitness|health|salud|entrenamiento)$/.test(tag));
}

export function isFichaNote(note: Pick<VaultNoteInput, "title" | "tags">): boolean {
  return /ficha/.test(fold(note.title)) || note.tags.some((tag) => fold(tag) === "ficha");
}

// ---------------------------------------------------------------------------
// Rutina (split semanal)
// ---------------------------------------------------------------------------

const DAY_TOKEN = "(lunes|martes|miercoles|jueves|viernes|sabado|domingo)";
const HEADING_DAY = new RegExp(`^${DAY_TOKEN}\\s*[:\\-–—]\\s*(.+)$`);
const LABEL_DAY = new RegExp(`^${DAY_TOKEN}\\s*(?:\\((.*)\\))?\\s*$`);
const WEEKDAY_BY_NAME: Record<string, number> = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };

export function kindOf(name: string, focus: string | null): RoutineKind {
  const text = fold(`${name} ${focus ?? ""}`);
  if (/descanso|rest\b|recuperacion|off\b/.test(text)) return "descanso";
  if (/partido|gameday|game day|futbol|match/.test(text)) return "partido";
  if (/casa|rendimiento|agilidad|pliometr|potencia|cardio|movilidad|conditioning/.test(text)) return "rendimiento";
  return "fuerza";
}

/** `Upper (Énfasis Pecho / Hombro)` → nombre + enfoque. */
export function splitNameFocus(value: string): { name: string; focus: string | null } {
  const text = cleanInline(value).replace(/\.+$/, "").trim();
  const paren = /^(.*?)\s*\((.+)\)\s*$/.exec(text);
  if (paren && paren[1].trim()) return { name: paren[1].trim(), focus: paren[2].trim() };
  const dash = /^(.*?)\s+[-–—]\s+(.+)$/.exec(text);
  if (dash) return { name: dash[1].trim(), focus: dash[2].trim() };
  return { name: text, focus: null };
}

function exercise(name: string): RoutineExercise {
  const clean = cleanInline(name).replace(/\.+$/, "").trim();
  return { name: clean, muscleId: inferMuscleId(clean), sets: null, reps: null };
}

function makeDay(weekday: number, title: string, items: Bullet[] | string[]): RoutineDay {
  const { name, focus } = splitNameFocus(title);
  const kind = kindOf(name, focus);
  const exercises: RoutineExercise[] = [];
  const notes: string[] = [];
  for (const item of items) {
    if (typeof item === "string") {
      exercises.push(exercise(item));
      continue;
    }
    if (item.children.length) {
      notes.push(cleanInline(item.text).replace(/:$/, ""));
      const flatten = (children: Bullet[]) => children.forEach((child) => {
        exercises.push(exercise(child.text));
        flatten(child.children);
      });
      flatten(item.children);
    } else if (item.text.trim()) {
      exercises.push(exercise(item.text));
    }
  }
  const restLike = kind === "descanso" || kind === "partido";
  return {
    weekday,
    day: WEEKDAY_NAMES[weekday],
    name: name || WEEKDAY_NAMES[weekday],
    focus,
    kind,
    exercises: restLike ? [] : exercises.filter((item) => item.name),
    notes: restLike ? [...notes, ...exercises.map((item) => item.name)].filter(Boolean) : notes.filter(Boolean),
  };
}

/**
 * Detecta el split en dos formatos:
 * - `### Lunes: Upper (Énfasis Pecho)` seguido de viñetas.
 * - `- **Lunes (Upper - Pecho):** Ejercicio, Ejercicio, …`.
 */
export function parseRoutine(text: string): RoutineDay[] {
  const found = new Map<number, RoutineDay>();

  for (const section of sections(text)) {
    if (!section.level) continue;
    const match = HEADING_DAY.exec(fold(headingText(section.heading)));
    if (!match) continue;
    const weekday = WEEKDAY_BY_NAME[match[1]];
    if (found.has(weekday)) continue;
    // Recupera el título con acentos/mayúsculas originales.
    const original = headingText(section.heading);
    const title = original.slice(original.search(/[:\-–—]/) + 1).trim();
    found.set(weekday, makeDay(weekday, title, bullets(section.lines)));
  }

  if (found.size < 2) {
    const fromBullets = new Map<number, RoutineDay>();
    for (const line of stripFrontmatter(text).split("\n")) {
      const match = /^\s*(?:[-*+]|\d+[.)])\s+\*\*([^*]+?)\*\*\s*(.*)$/.exec(line);
      if (!match) continue;
      const label = cleanInline(match[1]).replace(/:\s*$/, "").trim();
      const day = LABEL_DAY.exec(fold(label));
      if (!day) continue;
      const weekday = WEEKDAY_BY_NAME[day[1]];
      if (fromBullets.has(weekday)) continue;
      const inner = /\((.*)\)/.exec(label)?.[1] ?? "";
      const items = splitList(cleanInline(match[2].replace(/^[:\s]+/, "")));
      fromBullets.set(weekday, makeDay(weekday, inner || WEEKDAY_NAMES[weekday], items));
    }
    if (fromBullets.size > found.size) return [...fromBullets.values()].sort((a, b) => a.weekday - b.weekday);
  }

  return [...found.values()].sort((a, b) => a.weekday - b.weekday);
}

/** Semana completa indexada por día (0–6); los días sin plan son descanso. */
export function completeWeek(days: RoutineDay[]): RoutineDay[] {
  return WEEKDAY_NAMES.map((day, weekday) => days.find((item) => item.weekday === weekday) ?? {
    weekday,
    day,
    name: "Descanso",
    focus: null,
    kind: "descanso" as const,
    exercises: [],
    notes: [],
  });
}

// ---------------------------------------------------------------------------
// Protocolo, métricas y ficha
// ---------------------------------------------------------------------------

/** Viñetas `**Etiqueta:** texto` de secciones de protocolo/bases/reglas. */
export function parseProtocol(text: string): LabeledLine[] {
  const result: LabeledLine[] = [];
  for (const section of sections(text)) {
    // El H1 suele ser el título de la nota; las reglas viven en secciones H2+.
    if (section.level < 2 || !/protocolo|bases|reglas/.test(fold(section.heading))) continue;
    for (const item of bullets(section.lines)) {
      const line = labeled(item.text);
      if (!line.label || !line.text || /^(peso|estatura|altura|objetivo|meta)\b/.test(fold(line.label))) continue;
      result.push(line);
    }
  }
  return result;
}

export function mergeProtocol<T extends LabeledLine>(groups: T[][]): T[] {
  const result: T[] = [];
  for (const line of groups.flat()) {
    const key = fold(line.label ?? line.text);
    if (result.some((item) => {
      const other = fold(item.label ?? item.text);
      return other.startsWith(key) || key.startsWith(other);
    })) continue;
    result.push(line);
  }
  return result;
}

export function parseDefaultSets(lines: LabeledLine[]): number | null {
  for (const line of lines) {
    const match = /(\d+)\s*series/.exec(fold(line.text));
    if (match) {
      const sets = Number(match[1]);
      if (sets > 0 && sets <= 10) return sets;
    }
  }
  return null;
}

export function parseWeeklyTarget(text: string): number | null {
  const match = /(\d)\s*(?:x|veces)\s*(?:(?:por|a la|\/)\s*)?semana/.exec(fold(cleanInline(text)));
  if (!match) return null;
  const value = Number(match[1]);
  return value >= 1 && value <= 7 ? value : null;
}

/** Viñetas tipo `**Peso:** 62 kg`, `**Estatura:** 1.75 m`, `**Objetivo:** 70 kg (…)`. */
export function parseMetricBullets(text: string) {
  const result: { startWeight: number | null; height: number | null; goalWeight: number | null; goalNote: string | null } = {
    startWeight: null,
    height: null,
    goalWeight: null,
    goalNote: null,
  };
  for (const line of stripFrontmatter(text).split("\n")) {
    const match = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (!match) continue;
    const { label, text: value } = labeled(match[1]);
    if (!label) continue;
    const key = fold(label);
    const folded = fold(value);
    const kg = /(\d{2,3}(?:[.,]\d+)?)\s*kg/.exec(folded);
    if (/^peso\b/.test(key) && kg && result.startWeight === null) result.startWeight = Number(kg[1].replace(",", "."));
    else if (/^(estatura|altura)/.test(key) && result.height === null) {
      const meters = /(\d(?:[.,]\d+)?)\s*m\b/.exec(folded);
      const cm = /(\d{3})\s*cm/.exec(folded);
      if (meters) result.height = Number(meters[1].replace(",", "."));
      else if (cm) result.height = Number(cm[1]) / 100;
    } else if (/^(objetivo|meta)/.test(key) && kg && result.goalWeight === null) {
      result.goalWeight = Number(kg[1].replace(",", "."));
      result.goalNote = /\((.+)\)/.exec(value)?.[1]?.trim() ?? null;
    }
  }
  return result;
}

const TRAIT_PATTERNS: [RegExp, string][] = [
  [/lesion(?:es)?(?: activas?)?\s*:\s*([^,.;(]+)([^.]*)/, "Lesión"],
  [/suplementos?(?:cion)?\s*:\s*([^,.;(]+)([^.]*)/, "Suplemento"],
];

/** Datos duros de la ficha: estatura, peso de referencia, lesión, suplemento. */
export function parseFicha(text: string) {
  const plain = stripFrontmatter(text).split("\n").map(cleanInline);
  let height: number | null = null;
  let refWeight: number | null = null;
  const traits: { label: string; value: string; detail: string | null }[] = [];
  for (const line of plain) {
    const folded = fold(line);
    if (height === null) {
      const match = /\bmide\s*~?\s*(\d(?:[.,]\d+)?)\s*m\b/.exec(folded);
      if (match) height = Number(match[1].replace(",", "."));
    }
    if (refWeight === null) {
      const match = /\bpesa\s*~?\s*(\d{2,3}(?:[.,]\d+)?)\s*kg/.exec(folded);
      if (match) refWeight = Number(match[1].replace(",", "."));
    }
    for (const [pattern, label] of TRAIT_PATTERNS) {
      if (traits.some((trait) => trait.label === label)) continue;
      const match = pattern.exec(folded);
      if (!match) continue;
      // Recorta el valor original (con acentos) usando las posiciones del texto plegado.
      const start = match.index + match[0].indexOf(match[1]);
      const value = line.slice(start, start + match[1].length).trim();
      const detail = line.slice(start + match[1].length, start + match[1].length + match[2].length).replace(/^[\s,;–—-]+/, "").trim();
      if (value) traits.push({ label, value, detail: detail ? truncate(detail, 90) : null });
    }
  }
  return { height, refWeight, traits };
}

// ---------------------------------------------------------------------------
// Diario
// ---------------------------------------------------------------------------

const TEMPLATE_HINT = /_←|←\s*llenar|_\/10_|_si\/no_|~_h_|^_[^_]*_$/;

export function parseGymFlag(value: unknown): { flag: GymFlag; detail: string | null; other: string | null } {
  if (typeof value === "boolean") return { flag: value ? "si" : "no", detail: null, other: null };
  if (typeof value !== "string") return { flag: null, detail: null, other: null };
  const raw = value.trim();
  const folded = fold(raw);
  if (!folded || folded.includes("/") || TEMPLATE_HINT.test(folded)) return { flag: null, detail: null, other: null };
  const detail = /\((.+)\)/.exec(raw)?.[1]?.trim() ?? null;
  const other = /fut|partido|cancha/.test(folded) ? "Fútbol" : null;
  if (/^(si|yes|y|true|x|hecho|listo|ok)\b/.test(folded) || /^[✓✅]/.test(raw)) return { flag: "si", detail, other };
  if (/^(no|false)\b/.test(folded)) return { flag: "no", detail, other };
  if (/^(pendiente|pending|tbd|por hacer)/.test(folded)) return { flag: "pendiente", detail, other };
  return { flag: null, detail: raw, other };
}

/** Viñetas de la sección "🫀 Cuerpo", sin los marcadores de plantilla. */
export function parseBodySection(text: string): LabeledLine[] {
  const section = sections(text).find((item) => item.level > 0 && /cuerpo/.test(fold(item.heading)));
  if (!section) return [];
  const result: LabeledLine[] = [];
  for (const item of bullets(section.lines)) {
    const raw = item.text.trim();
    if (!raw || TEMPLATE_HINT.test(fold(raw)) || /_←|_\/10_|_s[ií]\/no_|~_h_/.test(raw)) continue;
    const line = labeled(raw);
    if (!line.text) continue;
    result.push(line);
  }
  return result;
}

/** Líneas del diario fuera de "Cuerpo" que hablan del gym (p. ej. en "Qué pasó"). */
export function gymLinesOutsideBody(text: string): LabeledLine[] {
  const result: LabeledLine[] = [];
  for (const section of sections(text)) {
    if (!section.level || /cuerpo|descarga|deducci|propagado|conexiones/.test(fold(section.heading))) continue;
    for (const item of bullets(section.lines)) {
      const line = labeled(item.text);
      if (!/\b(gym|gimnasio|entrenar|entreno|entrenamiento)\b/.test(fold(`${line.label ?? ""} ${line.text}`))) continue;
      result.push(line);
    }
  }
  return result;
}

export function parseDaily(note: VaultNoteInput): DailyEntry | null {
  const key = parseDateKey(note.title) ?? parseDateKey(note.frontmatter.fecha);
  if (!key) return null;
  const fm = note.frontmatter;
  let { flag, detail, other } = parseGymFlag(fm.gym);
  const body = parseBodySection(note.text);

  // Si el frontmatter está vacío, intenta con "**Gym:** Sí (…)" o "**Fútbol:** Sí" del cuerpo.
  if (flag === null) {
    const gymLine = body.find((line) => line.label && /^(gym|gimnasio|pesas)/.test(fold(line.label)));
    if (gymLine) ({ flag, detail } = parseGymFlag(gymLine.text));
  }
  if (!other) {
    const sport = body.find((line) => line.label && /futbol|partido/.test(fold(line.label)) && /^(si|yes)\b/.test(fold(line.text)));
    if (sport) other = "Fútbol";
  }

  const extra = gymLinesOutsideBody(note.text).filter((line) => !body.some((item) => item.text === line.text));
  const entry: DailyEntry = {
    key,
    path: note.path,
    gym: flag,
    gymDetail: detail,
    other,
    weight: parseNumber(fm.peso ?? fm.weight),
    sleep: parseNumber(fm.sueno_horas ?? fm.sueño_horas ?? fm.sueno ?? fm.sleep),
    energy: parseNumber(fm.energia ?? fm.energía ?? fm.energy),
    mood: parseNumber(fm.animo ?? fm.ánimo ?? fm.mood),
    body: [...body, ...extra].map((line) => ({ label: line.label, text: truncate(line.text, 220) })),
  };
  if (entry.weight !== null && (entry.weight < 30 || entry.weight > 250)) entry.weight = null;
  if (entry.sleep !== null && (entry.sleep < 0 || entry.sleep > 24)) entry.sleep = null;
  return entry;
}

// ---------------------------------------------------------------------------
// Marcas citadas, memoria y compañero
// ---------------------------------------------------------------------------

const STOPWORDS = new Set(["de", "del", "con", "en", "la", "el", "los", "las", "al", "y", "o", "a", "por", "para", "un", "una", "maquina", "mancuerna", "mancuernas", "barra", "polea", "smith"]);
const MUSCLE_WORDS = new Set(["pecho", "espalda", "hombro", "hombros", "triceps", "biceps", "cuadriceps", "pantorrilla", "pantorrillas", "gluteo", "gluteos", "core", "trapecio", "trapecios", "abdomen", "isquios", "femoral", "pierna", "piernas", "peso"]);

function tokens(value: string): string[] {
  return fold(value).split(/[^a-z0-9]+/).filter(Boolean);
}

/** Ejercicio de la rutina que mejor encaja con una línea libre, o null. */
export function matchExercise(line: string, exercises: string[]): string | null {
  const lineTokens = new Set(tokens(line));
  let best: { name: string; score: number } | null = null;
  for (const name of exercises) {
    const distinct = tokens(name).filter((token) => token.length >= 4 && !STOPWORDS.has(token) && !MUSCLE_WORDS.has(token));
    if (!distinct.length) continue;
    const present = distinct.filter((token) => lineTokens.has(token));
    if (!present.length || present.length / distinct.length < 0.5 || !present.some((token) => token.length >= 6)) continue;
    const score = present.length / distinct.length + name.length / 1000;
    if (!best || score > best.score) best = { name, score };
  }
  return best?.name ?? null;
}

const LIFT_WEIGHT = /(\d{2,3}(?:[.,]\d)?)\s*(lbs?|libras|kg|kilos)\b/;

export function extractLiftMentions(lines: { text: string; key: string | null }[], exercises: string[], source: NoteRef): LiftMention[] {
  const result: LiftMention[] = [];
  for (const { text, key } of lines) {
    const plain = cleanInline(text);
    const weight = LIFT_WEIGHT.exec(fold(plain));
    if (!weight) continue;
    const exerciseName = matchExercise(plain, exercises);
    if (!exerciseName) continue;
    const value = Number(weight[1].replace(",", "."));
    const unit = /^(kg|kilos)$/.test(weight[2]) ? "kg" : "lb";
    result.push({
      exercise: exerciseName,
      value,
      unit,
      kg: unit === "kg" ? value : Math.round((value / 2.20462) * 10) / 10,
      key,
      text: truncate(plain.replace(/^\[?\d{4}-\d{2}-\d{2}\]?\s*/, ""), 160),
      source,
    });
  }
  return result;
}

/** Fecha al inicio de una viñeta: `**[2026-08-27]**`, `[[2026-08-19]]`, `[2026-08-19]`. */
export function lineDate(raw: string): string | null {
  const match = /^\s*(?:\*\*)?\[{1,2}(\d{4}-\d{2}-\d{2})\]{1,2}(?:\*\*)?/.exec(raw);
  return match ? match[1] : null;
}

/** Líneas de una nota con su fecha (si la viñeta empieza con una). */
export function datedLines(text: string): { text: string; key: string | null }[] {
  return stripFrontmatter(text)
    .split("\n")
    .map((line) => /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line)?.[1] ?? "")
    .filter(Boolean)
    .map((line) => ({ text: line, key: lineDate(line) }));
}

/** Memorias fechadas de una nota que hablan de entrenamiento. */
export function extractMemory(text: string, source: NoteRef): MemoryLine[] {
  return datedLines(text)
    .filter((line) => line.key && GYM_PATTERN.test(fold(cleanInline(line.text))))
    .map((line) => ({
      key: line.key,
      text: truncate(cleanInline(line.text).replace(/^\[?\d{4}-\d{2}-\d{2}\]?\s*/, ""), 200),
      source,
    }));
}

/** Frase de una nota de persona que explica su papel en el gym. */
export function pickPartnerLine(text: string): string | null {
  const lines = datedLines(text).filter((line) => PARTNER_PATTERN.test(fold(cleanInline(line.text))));
  if (!lines.length) return null;
  const dated = lines.filter((line) => line.key).sort((a, b) => (b.key ?? "").localeCompare(a.key ?? ""));
  const chosen = dated[0] ?? lines[0];
  const plain = cleanInline(chosen.text).replace(/^\[?\d{4}-\d{2}-\d{2}\]?\s*/, "");
  const withoutLabel = plain.replace(/^[^:]{1,40}:\s*/, "");
  return truncate(sentenceMatching(withoutLabel, PARTNER_PATTERN), 160);
}

export function partnerScoreLine(line: string): boolean {
  return PARTNER_PATTERN.test(fold(cleanInline(line)));
}

/** Horario y lugar del gym: `5:00 AM … gym de la UP`. */
export function parseSchedule(text: string): { time: string | null; place: string | null } {
  for (const raw of stripFrontmatter(text).split("\n")) {
    const line = cleanInline(raw);
    const folded = fold(line);
    if (!/\b(gym|gimnasio)\b/.test(folded)) continue;
    const time = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/.exec(folded);
    if (!time) continue;
    const place = /\b(?:gym|gimnasio)\s+(?:de\s+la|del|de)\s+([\p{Lu}][\p{L}]*)/u.exec(line)?.[1] ?? null;
    return { time: `${Number(time[1])}:${time[2] ?? "00"} ${time[3].toUpperCase()}`, place };
  }
  return { time: null, place: null };
}

/** Proteína diaria objetivo desde el frontmatter (`macros_target_protein`). */
export function proteinTarget(frontmatter: Record<string, unknown>): number | null {
  for (const [key, value] of Object.entries(frontmatter)) {
    if (!/prote/.test(fold(key))) continue;
    const number = parseNumber(value);
    if (number && number > 20 && number < 500) return number;
  }
  return null;
}
