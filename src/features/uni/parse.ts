import { forEachLine, splitFrontmatter } from "@/features/vault/parse";
import type { ExamKind, RiskLevel, UniTopic } from "./types";
import {
  cleanLine,
  distinctiveTokens,
  fold,
  mentionsAny,
  parseGrade,
  parseMonth,
  parseNumber,
  parseSpanishDate,
  parseTime,
  parseYear,
  splitSubjectName,
  stripInline,
  toKey,
} from "./text";

/**
 * Parsers defensivos para las notas de la Universidad. Todo es puro: reciben
 * texto Markdown y devuelven hechos; nada se escribe en la bóveda.
 */

// ---------------------------------------------------------------------------
// Bloques Markdown genéricos
// ---------------------------------------------------------------------------

export type MdTable = { headers: string[]; rows: string[][]; line: number; heading: string | null };

/** Divide una fila `| a | b |` respetando `\|` y los `|` dentro de [[enlace|alias]]. */
export function splitTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  const cells: string[] = [];
  let current = "";
  let depth = 0;
  for (let index = 0; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char === "\\" && trimmed[index + 1] === "|") {
      current += "|";
      index += 1;
      continue;
    }
    if (char === "[" && trimmed[index + 1] === "[") depth += 1;
    if (char === "]" && trimmed[index + 1] === "]" && depth > 0) depth -= 1;
    if (char === "|" && depth === 0) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

const TABLE_SEPARATOR = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;

export function parseTables(text: string): MdTable[] {
  const lines: { text: string; inCode: boolean }[] = [];
  forEachLine(text, (line, _index, inCode) => lines.push({ text: line, inCode }));
  const tables: MdTable[] = [];
  let heading: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const { text: line, inCode } = lines[index];
    if (inCode) continue;
    const headingMatch = HEADING.exec(line);
    if (headingMatch) {
      heading = cleanLine(headingMatch[2]);
      continue;
    }
    const next = lines[index + 1];
    if (!line.includes("|") || !next || next.inCode || !TABLE_SEPARATOR.test(next.text) || !next.text.includes("-")) continue;
    const headers = splitTableRow(line).map((cell) => stripInline(cell));
    const rows: string[][] = [];
    let cursor = index + 2;
    while (cursor < lines.length && !lines[cursor].inCode && lines[cursor].text.trim().includes("|") && lines[cursor].text.trim() !== "") {
      const cells = splitTableRow(lines[cursor].text);
      while (cells.length < headers.length) cells.push("");
      rows.push(cells.slice(0, headers.length));
      cursor += 1;
    }
    tables.push({ headers, rows, line: index, heading });
    index = cursor - 1;
  }
  return tables;
}

export type BulletNode = { raw: string; text: string; depth: number; line: number; children: BulletNode[] };
export type Section = { heading: string; level: number; line: number; parents: string[]; bullets: BulletNode[]; body: string[] };

const BULLET = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/;

function indentWidth(indent: string): number {
  return indent.replace(/\t/g, "    ").length;
}

/** Secciones por encabezado con su árbol de viñetas (sangría = jerarquía). */
export function parseSections(text: string): Section[] {
  const { bodyLine } = splitFrontmatter(text);
  const sections: Section[] = [];
  const stack: { level: number; heading: string }[] = [];
  let current: Section = { heading: "", level: 0, line: 0, parents: [], bullets: [], body: [] };
  let bulletStack: BulletNode[] = [];
  sections.push(current);

  forEachLine(text, (line, index, inCode) => {
    if (index < bodyLine || inCode) return;
    const heading = HEADING.exec(line);
    if (heading) {
      const level = heading[1].length;
      while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
      current = { heading: cleanLine(heading[2]), level, line: index, parents: stack.map((item) => item.heading), bullets: [], body: [] };
      stack.push({ level, heading: current.heading });
      sections.push(current);
      bulletStack = [];
      return;
    }
    current.body.push(line);
    const bullet = BULLET.exec(line);
    if (!bullet) {
      if (line.trim() === "") return;
      // Texto de continuación: se pega a la última viñeta si está sangrado.
      const last = bulletStack[bulletStack.length - 1];
      if (last && /^\s+\S/.test(line)) {
        last.raw += ` ${line.trim()}`;
        last.text = cleanLine(last.raw);
      } else bulletStack = [];
      return;
    }
    const depth = indentWidth(bullet[1]);
    const node: BulletNode = { raw: bullet[2], text: cleanLine(bullet[2]), depth, line: index, children: [] };
    while (bulletStack.length && bulletStack[bulletStack.length - 1].depth >= depth) bulletStack.pop();
    const parent = bulletStack[bulletStack.length - 1];
    if (parent) parent.children.push(node);
    else current.bullets.push(node);
    bulletStack.push(node);
  });
  return sections;
}

/** "**Nota P1:** 8.5 (…)" → { key: "Nota P1", value: "8.5 (…)" }. */
export function bulletField(raw: string): { key: string | null; value: string } {
  const bold = /^\s*\*\*([^*]+?)\*\*\s*:?\s*(.*)$/.exec(raw);
  if (bold && (bold[1].trim().endsWith(":") || /^\s*:/.test(raw.slice(raw.indexOf("**", 2) + 2)))) {
    return { key: stripInline(bold[1].replace(/:\s*$/, "")), value: bold[2].trim() };
  }
  const plain = /^([^:*]{2,48}?):\s+(.+)$/.exec(stripInline(raw));
  if (plain && !/\d{1,2}:\d{2}/.test(plain[0].slice(0, plain[1].length + 3))) return { key: plain[1].trim(), value: plain[2].trim() };
  return { key: null, value: raw.trim() };
}

export type Callout = { type: string; title: string; body: string; raw: string; line: number; section: string | null };

export function parseCallouts(text: string): Callout[] {
  const callouts: Callout[] = [];
  let section: string | null = null;
  let current: Callout | null = null;
  forEachLine(text, (line, index, inCode) => {
    if (inCode) return;
    const heading = HEADING.exec(line);
    if (heading) section = cleanLine(heading[2]);
    const start = /^\s*>\s*\[!([\w-]+)\][+-]?\s*(.*)$/.exec(line);
    if (start) {
      current = { type: start[1].toLowerCase(), title: stripInline(start[2]), body: "", raw: start[2], line: index, section };
      callouts.push(current);
      return;
    }
    const quoted = /^\s*>\s?(.*)$/.exec(line);
    if (quoted && current) {
      current.body = `${current.body} ${stripInline(quoted[1])}`.trim();
      current.raw = `${current.raw}\n${quoted[1]}`;
      return;
    }
    current = null;
  });
  return callouts;
}

// ---------------------------------------------------------------------------
// Vocabulario académico
// ---------------------------------------------------------------------------

/** "Nota P2", "Examen Final", "Primer Parcial", "2° Parcial", "Proyecto Final" → tipo de evaluación. */
export function examKindOf(label: string): ExamKind | null {
  const text = fold(label);
  const numbered = /\bp\s?([1-3])\b|\bparcial\s*([1-3])\b|\b([1-3])\s*(?:°|º|o|er|do|ro)?\s*parcial\b/.exec(text);
  if (numbered) return `P${numbered[1] ?? numbered[2] ?? numbered[3]}` as ExamKind;
  if (/\bprimer(?:o)?\s+parcial\b/.test(text)) return "P1";
  if (/\bsegundo\s+parcial\b/.test(text)) return "P2";
  if (/\btercer(?:o)?\s+parcial\b/.test(text)) return "P3";
  if (/\bfinal(es)?\b/.test(text)) return "Final";
  if (/\bcontrol\b/.test(text)) return "Control";
  return null;
}

export function examLabel(kind: ExamKind): string {
  if (kind === "P1" || kind === "P2" || kind === "P3") return `Parcial ${kind.slice(1)}`;
  if (kind === "Final") return "Final";
  if (kind === "Control") return "Examen control";
  return "Evaluación";
}

/** Columna "Riesgo": 🔴 / ⚠️ / ✅ más palabras clave ("Faltas", "Nota", "Doble"). */
export function parseRiskCell(cell: string): { level: RiskLevel | null; grade: boolean; absences: boolean; resolved: boolean; text: string } {
  const text = stripInline(cell);
  const folded = fold(cell);
  let level: RiskLevel | null = null;
  if (/🔴|🚨|‼/u.test(cell) || /\b(critico|alto|rojo)\b/.test(folded)) level = "alto";
  else if (/⚠|🟠|🟡/u.test(cell) || /\b(medio|cuidado|atencion)\b/.test(folded)) level = "medio";
  else if (/✅|🟢|✔/u.test(cell) || /\b(bajo|ok|resuelt[ao]|asegurad[ao])\b/.test(folded)) level = "bajo";
  const doble = /\bdoble\b/.test(folded);
  return {
    level,
    grade: doble || /\b(nota|calificacion|promedio)\b/.test(folded),
    absences: doble || /\bfaltas?\b/.test(folded),
    resolved: /\b(resuelt[ao]|asegurad[ao]|cerrad[ao])\b/.test(folded),
    text,
  };
}

/** "Volatilidad de Tasas ← tema del examen", "**Las Griegas** (Delta, …)". */
export function parseTopic(node: BulletNode): UniTopic {
  const [left, ...rest] = node.raw.split(/\s*(?:←|<-|⬅)\s*/);
  const note = rest.length ? stripInline(rest.join(" ")) : null;
  const text = stripInline(left);
  const focus = /^\s*\*\*/.test(node.raw) || Boolean(note && /examen|clave|importante|foco|entra/i.test(note));
  return { text, note, focus };
}

function flatten(nodes: BulletNode[]): BulletNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

// ---------------------------------------------------------------------------
// Nota del semestre
// ---------------------------------------------------------------------------

export type WeightFact = { kind: ExamKind | "Tareas" | "Proyecto"; label: string; weight: number; date: string | null };

export type SubjectFacts = {
  name: string;
  names: string[];
  aliases: string[];
  codes: string[];
  professor: string | null;
  email: string | null;
  grades: Partial<Record<ExamKind, { grade: number; date: string | null }>>;
  exams: Partial<Record<ExamKind, string>>;
  absences: number | null;
  absencesRemaining: number | null;
  risk: ReturnType<typeof parseRiskCell> | null;
  weights: WeightFact[];
  topics: UniTopic[];
  laterTopics: string[];
  tips: string[];
  details: { label: string; value: string }[];
  place: string | null;
  sectionLine: number | null;
};

export type SemesterFacts = {
  subjects: SubjectFacts[];
  callouts: Callout[];
  /** Título de la tabla de parciales, p. ej. "Calendario Parcial 2 — Octubre 2026". */
  calendarTitle: string | null;
};

type Column = "date" | "subject" | "absences" | "remaining" | "risk" | "place" | "time" | `grade:${ExamKind}`;

function classifyHeader(header: string): Column | null {
  const text = fold(header);
  if (/^(fecha|dia|cuando)\b/.test(text)) return "date";
  if (/^(materia|asignatura|clase|curso)\b/.test(text)) return "subject";
  if (/^(faltas restantes|restantes|quedan)\b/.test(text)) return "remaining";
  if (/^(faltas|inasistencias|ausencias)\b/.test(text)) return "absences";
  if (/^(riesgo|estado|status)\b/.test(text)) return "risk";
  if (/^(lugar|salon|aula|sede)\b/.test(text)) return "place";
  if (/^(hora|horario)\b/.test(text)) return "time";
  if (/^(nota|calificacion|cal\.?)\b/.test(text)) {
    const kind = examKindOf(text.replace(/^(nota|calificacion|cal\.?)\s*/, "")) ?? "P1";
    return `grade:${kind}`;
  }
  return null;
}

const PLACE = /\b((?:Torre|Edificio|Aula|Sal[oó]n|Auditorio|Laboratorio|Campus|Sede)\s+[A-ZÁÉÍÓÚÑ0-9][\wÁÉÍÓÚÑáéíóúñ-]*(?:\s+[A-ZÁÉÍÓÚÑ0-9][\wÁÉÍÓÚÑáéíóúñ-]*)?)/u;

export function findPlace(text: string): string | null {
  const match = PLACE.exec(stripInline(text));
  return match ? match[1].trim() : null;
}

function emptySubject(rawName: string): SubjectFacts {
  const { base, aliases, codes } = splitSubjectName(rawName);
  return {
    name: base,
    names: [base],
    aliases,
    codes,
    professor: null,
    email: null,
    grades: {},
    exams: {},
    absences: null,
    absencesRemaining: null,
    risk: null,
    weights: [],
    topics: [],
    laterTopics: [],
    tips: [],
    details: [],
    place: null,
    sectionLine: null,
  };
}

/** Pesos: "Parcial 1 (30%) · Parcial 2 (30%)", "P1 30% · Final 30%", "Parcial 1: 30% (7 sep)", "Exámenes parciales (P1 15% + P2 15%): 30%". */
export function parseWeights(lines: string[], today: string, yearHint: number | null): WeightFact[] {
  const weights: WeightFact[] = [];
  const push = (label: string, weight: number, date: string | null) => {
    const folded = fold(label);
    const kind: WeightFact["kind"] = /\bproyecto\b/.test(folded) ? "Proyecto" : examKindOf(label) ?? "Tareas";
    if (!(weight > 0 && weight <= 100)) return;
    if (kind !== "Tareas" && weights.some((item) => item.kind === kind)) return;
    weights.push({ kind, label: stripInline(label).replace(/[:\s]+$/, ""), weight, date });
  };
  const number = (value: string) => Number(value.replace(",", "."));
  for (const raw of lines) {
    for (const segment of stripInline(raw).split(/\s+[·•|]\s+|\s*;\s*/)) {
      const nested = /\(([^)]*\bP[1-3]\s*\d{1,3}(?:[.,]\d+)?\s*%[^)]*)\)/.exec(segment);
      if (nested) {
        for (const match of nested[1].matchAll(/\bP([1-3])\s*(\d{1,3}(?:[.,]\d+)?)\s*%/g)) push(`Parcial ${match[1]}`, number(match[2]), null);
        continue;
      }
      const short = /^P([1-3])\s+(\d{1,3}(?:[.,]\d+)?)\s*%\s*(.*)$/.exec(segment);
      if (short) {
        push(`Parcial ${short[1]}`, number(short[2]), parseSpanishDate(short[3], { today, yearHint }));
        continue;
      }
      const match = /^(.+?):\s*(\d{1,3}(?:[.,]\d+)?)\s*%\s*(.*)$/.exec(segment)
        ?? /^(.+?)\s*\((\d{1,3}(?:[.,]\d+)?)\s*%\)\s*:?\s*(.*)$/.exec(segment)
        ?? /^([^\d%]{2,60}?)\s+(\d{1,3}(?:[.,]\d+)?)\s*%\s*(.*)$/.exec(segment);
      if (!match) continue;
      const label = match[1].replace(/\([^)]*\)/g, "").trim();
      if (!label || label.length > 60) continue;
      push(label, number(match[2]), parseSpanishDate(match[3] ?? "", { today, yearHint }));
    }
  }
  return weights;
}

function applyField(subject: SubjectFacts, key: string, node: BulletNode, today: string, yearHint: number | null) {
  const folded = fold(key);
  const value = bulletField(node.raw).value;
  const childText = node.children.map((child) => child.raw);
  if (/^profesor|^profesora|^docente|^maestr/.test(folded)) {
    const clean = stripInline(value);
    const email = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/.exec(clean)?.[0] ?? null;
    const name = clean.replace(email ?? "", "").replace(/[·•|,]\s*$/, "").replace(/\s*[·•|]\s*/g, " ").trim();
    subject.professor = name && !/^[—–-]+$/.test(name) ? name : subject.professor;
    subject.email = email ?? subject.email;
    return;
  }
  if (/^(nota|calificacion)\b/.test(folded)) {
    const kind = examKindOf(folded.replace(/^(nota|calificacion)\s*/, ""));
    const grade = parseGrade(value);
    if (kind && grade !== null) subject.grades[kind] = { grade, date: parseSpanishDate(value, { today, yearHint }) };
    return;
  }
  if (/^(examen|fecha)\b/.test(folded)) {
    const kind = examKindOf(folded.replace(/^(examen|fecha)\s*(de\s*)?/, "")) ?? (/final/.test(folded) ? "Final" : null);
    const date = parseSpanishDate(value, { today, yearHint });
    if (kind && date) subject.exams[kind] = date;
    const place = findPlace(value);
    if (place) subject.place ??= place;
    return;
  }
  if (/^(faltas|inasistencias)\b/.test(folded)) {
    const used = parseNumber(stripInline(value));
    if (used !== null) subject.absences = used;
    const remaining = /(\d+(?:[.,]\d+)?)\s*restantes?/i.exec(stripInline(value));
    if (remaining) subject.absencesRemaining = Number(remaining[1].replace(",", "."));
    return;
  }
  if (/^pesos del parcial\s*([1-3])/.test(folded)) {
    const kind = `P${/^pesos del parcial\s*([1-3])/.exec(folded)?.[1]}` as ExamKind;
    const total = /(\d{1,3})\s*%\s*del\s*total/i.exec(stripInline(key) + " " + stripInline(value));
    if (total && !subject.weights.some((item) => item.kind === kind)) {
      subject.weights.push({ kind, label: examLabel(kind), weight: Number(total[1]), date: null });
    }
    if (childText.length) subject.details.push({ label: stripInline(key), value: childText.map(stripInline).join(" · ") });
    return;
  }
  if (/^pesos/.test(folded) || /^ponderacion|^evaluacion$/.test(folded)) {
    const parsed = parseWeights([value, ...childText].filter(Boolean), today, yearHint);
    for (const weight of parsed) if (!subject.weights.some((item) => item.kind === weight.kind && item.kind !== "Tareas")) subject.weights.push(weight);
    for (const weight of parsed) if (weight.date && (weight.kind === "P1" || weight.kind === "P2" || weight.kind === "P3" || weight.kind === "Final")) subject.exams[weight.kind] ??= weight.date;
    return;
  }
  if (/^temas/.test(folded)) {
    if (/siguiente|despues|post|proxim/.test(folded)) {
      subject.laterTopics.push(...(node.children.length ? node.children.map((child) => child.text) : stripInline(value).split(/\s*,\s*/)).filter(Boolean));
    } else {
      subject.topics.push(...node.children.map(parseTopic).filter((topic) => topic.text));
    }
    return;
  }
  if (/^(estrategia|accion|tip|consejo|plan)/.test(folded)) {
    subject.tips.push(stripInline(value));
    return;
  }
  if (/^(libro|libros|bibliografia)/.test(folded)) {
    subject.details.push({ label: "Libro", value: stripInline(value) });
    return;
  }
  if (/^(lugar|salon|aula|sede)/.test(folded)) {
    subject.place = stripInline(value);
    return;
  }
  const text = [stripInline(value), ...node.children.map((child) => child.text)].filter(Boolean).join(" · ");
  if (text) subject.details.push({ label: stripInline(key), value: text });
  const place = findPlace(value);
  if (place) subject.place ??= place;
}

/** Nombres, alias y palabras distintivas de una materia ("Derivados", "Cristianismo"). */
export function subjectAliases(subject: Pick<SubjectFacts, "names" | "aliases">, all: Pick<SubjectFacts, "names" | "aliases">[]): string[] {
  const own = [...subject.names, ...subject.aliases];
  const others = all.filter((item) => item !== subject).map((item) => [...item.names, ...item.aliases]);
  return [...new Set([...own, ...distinctiveTokens(own, others)])];
}

function sameSubject(a: string, b: SubjectFacts, similarity: (x: string, y: string) => number): number {
  return Math.max(...[...b.names, ...b.aliases].map((name) => similarity(a, name)));
}

/**
 * Extrae materias, exámenes, faltas y pesos de la nota del semestre:
 * tablas con columnas Fecha/Materia (+ Faltas, Nota Pn, Riesgo), secciones por
 * materia con viñetas `**Clave:** valor` y la sección de estrategia.
 */
export function parseSemesterNote(text: string, options: { today: string; similarity: (a: string, b: string) => number }): SemesterFacts {
  const { today, similarity } = options;
  const subjects: SubjectFacts[] = [];
  const find = (name: string): SubjectFacts | null => {
    let best: SubjectFacts | null = null;
    let bestScore = 0;
    for (const subject of subjects) {
      const score = sameSubject(name, subject, similarity);
      if (score > bestScore) {
        best = subject;
        bestScore = score;
      }
    }
    return bestScore >= 0.75 ? best : null;
  };
  const upsert = (rawName: string): SubjectFacts => {
    const { base, aliases, codes } = splitSubjectName(rawName);
    const existing = find(base) ?? aliases.map(find).find(Boolean) ?? null;
    if (existing) {
      if (!existing.names.includes(base)) existing.names.push(base);
      for (const alias of aliases) if (!existing.aliases.includes(alias)) existing.aliases.push(alias);
      for (const code of codes) if (!existing.codes.includes(code)) existing.codes.push(code);
      return existing;
    }
    const subject = emptySubject(rawName);
    subjects.push(subject);
    return subject;
  };

  let calendarTitle: string | null = null;
  for (const table of parseTables(text)) {
    const columns = table.headers.map(classifyHeader);
    const subjectIndex = columns.indexOf("subject");
    const dateIndex = columns.indexOf("date");
    if (subjectIndex === -1) continue;
    const headingKind = table.heading ? examKindOf(table.heading) : null;
    const yearHint = table.heading ? parseYear(table.heading) : null;
    const gradeColumns = columns.flatMap((column, index) => (column?.startsWith("grade:") ? [{ index, kind: column.slice(6) as ExamKind }] : []));
    let examKind: ExamKind | null = headingKind;
    if (!examKind && dateIndex !== -1) {
      const pending = gradeColumns.find(({ index }) => table.rows.some((row) => parseGrade(row[index] ?? "") === null));
      examKind = pending?.kind ?? null;
    }
    if (dateIndex !== -1 && examKind && examKind !== "Final" && !calendarTitle) calendarTitle = table.heading;

    for (const row of table.rows) {
      const rawName = row[subjectIndex];
      if (!rawName || !stripInline(rawName)) continue;
      const subject = upsert(rawName);
      columns.forEach((column, index) => {
        const cell = row[index] ?? "";
        if (!column || !cell.trim()) return;
        if (column === "date" && examKind) {
          const date = parseSpanishDate(cell, { today, yearHint });
          if (date) subject.exams[examKind] = date;
        } else if (column === "absences") {
          subject.absences = parseNumber(stripInline(cell)) ?? subject.absences;
        } else if (column === "remaining") {
          subject.absencesRemaining = parseNumber(stripInline(cell)) ?? subject.absencesRemaining;
        } else if (column === "risk") {
          subject.risk = parseRiskCell(cell);
        } else if (column === "place") {
          subject.place = stripInline(cell) || subject.place;
        } else if (column.startsWith("grade:")) {
          const grade = parseGrade(cell);
          const kind = column.slice(6) as ExamKind;
          if (grade !== null) subject.grades[kind] = { grade, date: parseSpanishDate(cell, { today, yearHint }) };
        }
      });
    }
  }

  const sections = parseSections(text);
  const yearHint = parseYear(text.slice(0, 2_000));
  for (const section of sections) {
    if (!section.heading || section.level < 2) continue;
    const fields = section.bullets.map((node) => ({ node, ...bulletField(node.raw) }));
    const looksLikeSubject = fields.some(({ key }) => key && /^(nota|examen|faltas|profesor|profesora|pesos|temas)/.test(fold(key)));
    const isStrategy = /estrategia|plan de ataque|prioridades/.test(fold(section.heading));
    if (isStrategy) {
      for (const node of flatten(section.bullets)) {
        const { key, value } = bulletField(node.raw);
        const label = key ?? "";
        if (!label) continue;
        const targets = subjects.filter((subject) => mentionsAny(label, subjectAliases(subject, subjects)));
        for (const subject of targets) subject.tips.push(stripInline(value));
      }
      continue;
    }
    if (!looksLikeSubject) continue;
    const subject = upsert(section.heading);
    subject.sectionLine ??= section.line;
    for (const { node, key } of fields) {
      if (!key) {
        if (node.text) subject.details.push({ label: "Nota", value: node.text });
        continue;
      }
      applyField(subject, key, node, today, yearHint);
    }
    if (!subject.place) subject.place = findPlace(section.body.join(" "));
  }

  // Cualquier fecha de examen anotada en los pesos sin tabla sigue sumando.
  for (const subject of subjects) {
    for (const weight of subject.weights) {
      if (weight.date && (weight.kind === "P1" || weight.kind === "P2" || weight.kind === "P3" || weight.kind === "Final")) subject.exams[weight.kind] ??= weight.date;
    }
  }

  return { subjects, callouts: parseCallouts(text), calendarTitle };
}

// ---------------------------------------------------------------------------
// HQ: alertas de la universidad
// ---------------------------------------------------------------------------

export type AlertItem = { label: string; date: string | null; day: number; place: string | null; flagged: boolean; note: string | null };
export type HqAlerts = { title: string | null; body: string; window: { start: string; end: string } | null; items: AlertItem[] };

/**
 * "SEMANA DE PARCIALES — 14–23 OCT" + "Examen BBVA hoy (14 Oct, Torre BBVA). Próximos: Cristianismo 16 Oct 🔴, …".
 */
export function parseHqAlerts(text: string, options: { today: string }): HqAlerts | null {
  const callouts = parseCallouts(text);
  const callout = callouts.find((item) => /parcial|examen|final/i.test(`${item.title} ${item.body}`) && /universidad|parcial/i.test(`${item.section ?? ""} ${item.title}`))
    ?? callouts.find((item) => /parcial|examen/i.test(`${item.title} ${item.body}`));
  if (!callout) return null;
  const header = fold(callout.title);
  const month = parseMonth(callout.title) ?? parseMonth(callout.body);
  const year = parseYear(callout.title) ?? Number(options.today.slice(0, 4));
  let window: HqAlerts["window"] = null;
  const range = /(\d{1,2})\s*[–—-]\s*(\d{1,2})/.exec(header);
  if (range && month) {
    let startMonth = month;
    const startDay = Number(range[1]);
    const endDay = Number(range[2]);
    if (startDay > endDay) startMonth = month === 1 ? 12 : month - 1;
    window = { start: toKey(startMonth === 12 && month === 1 ? year - 1 : year, startMonth, startDay), end: toKey(year, month, endDay) };
  }

  const items: AlertItem[] = [];
  const rawBody = callout.raw.split("\n").slice(1).join(" ");
  const body = stripInline(rawBody.replace(/🔴|🚨|‼️?/gu, " ⟦!⟧ ").replace(/⚠️?/gu, " ⟦!⟧ "));
  const pattern = /([A-ZÁÉÍÓÚÑ][\p{L}&.]*(?:\s+(?:y\s+)?[A-ZÁÉÍÓÚÑ&][\p{L}&.]*)*)\s+(?:hoy\s+)?\(?\s*(\d{1,2})(?![\p{L}\d])(?:\s+([A-Za-zé]{3,10}))?\.?([^,.;]*(?:\([^)]*\))?)?/gu;
  for (const match of body.matchAll(pattern)) {
    const label = match[1].replace(/^(Examen(?:es)?|Próximos?|Ver|Hoy|Mañana)\s+/i, "").trim();
    if (!label || /^(Próximos?|Ver|Semana|Hoy)$/i.test(label)) continue;
    const day = Number(match[2]);
    if (!(day >= 1 && day <= 31)) continue;
    const rest = `${match[3] ?? ""} ${match[4] ?? ""}`;
    const itemMonth = parseMonth(match[3] ?? "") ?? month;
    const date = itemMonth ? parseSpanishDate(`${day} ${["", "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"][itemMonth]}`, { today: options.today, yearHint: year }) : null;
    const tail = body.slice((match.index ?? 0) + match[0].length - (match[4]?.length ?? 0), (match.index ?? 0) + match[0].length + 40);
    const place = findPlace(`${match[0]} ${tail.split(/[.;]/)[0]}`);
    const note = /\(([^)]*)\)/.exec(rest)?.[1] ?? null;
    items.push({ label, date, day, place, flagged: match[0].includes("⟦!⟧"), note: note && !findPlace(note) && !/^\d/.test(note) ? stripInline(note) : null });
  }
  return { title: callout.title, body: callout.body.replace(/\s+/g, " ").trim(), window, items };
}

// ---------------------------------------------------------------------------
// Diario: resultados y menciones
// ---------------------------------------------------------------------------

export type LineResult = { kind: ExamKind | null; grade: number };

/**
 * Resultados explícitos en una línea del diario: "(P1: 10, P2: 10)",
 * "Calificación de **10.0**", "destruido con 10 perfecto". Ignora metas
 * ("espera sacar un 10", "objetivo: 9").
 */
export function extractResults(line: string): LineResult[] {
  const text = stripInline(line);
  const results: LineResult[] = [];
  for (const match of text.matchAll(/\bP\s?([1-3])\s*(?::|=|fue|de)\s*(\d{1,2}(?:[.,]\d{1,2})?)(?!\s*%)/gi)) {
    const grade = parseGrade(match[2]);
    if (grade !== null) results.push({ kind: `P${match[1]}` as ExamKind, grade });
  }
  if (results.length) return results;
  if (/\b(espera|esperar|objetivo|meta|necesit|para sacar|quiere|quiero)\b/i.test(text)) return results;
  const explicit = /(?:calificaci[oó]n(?:\s+(?:de|final|del parcial))?|saqu[eé](?:\s+un)?|sac[oó](?:\s+un)?|obtuvo(?:\s+un)?|obtuve(?:\s+un)?|resultado(?:\s+de)?)\s*:?\s*(\d{1,2}(?:[.,]\d{1,2})?)(?:\s*\/\s*10)?/i.exec(text)
    ?? /\b(\d{1,2}(?:[.,]\d{1,2})?)\s+perfecto\b/i.exec(text);
  if (explicit) {
    const grade = parseGrade(explicit[1]);
    if (grade !== null) results.push({ kind: examKindOf(text), grade });
  }
  return results;
}

/** Hora de examen anotada en una línea: "Examen Finanzas Corporativas (10:30 AM)". */
export function extractExamTime(line: string): string | null {
  if (!/examen|parcial|final/i.test(line)) return null;
  return parseTime(stripInline(line));
}

/** Viñetas fechadas de memoria: "- **[2026-10-12]** texto". */
export function datedBullets(text: string): { date: string; text: string; line: number }[] {
  const items: { date: string; text: string; line: number }[] = [];
  forEachLine(text, (line, index, inCode) => {
    if (inCode) return;
    const match = /^\s*[-*+]\s+(?:\*\*)?\[(\d{4}-\d{2}-\d{2})\](?:\*\*)?\s*(.+)$/.exec(line);
    if (match) items.push({ date: match[1], text: cleanLine(match[2]), line: index });
  });
  return items;
}

/** Líneas con contenido de una nota diaria (sin frontmatter, código ni encabezados). */
export function contentLines(text: string): { text: string; raw: string; line: number; section: string | null }[] {
  const { bodyLine } = splitFrontmatter(text);
  const lines: { text: string; raw: string; line: number; section: string | null }[] = [];
  let section: string | null = null;
  forEachLine(text, (line, index, inCode) => {
    if (index < bodyLine || inCode) return;
    const heading = HEADING.exec(line);
    if (heading) {
      section = cleanLine(heading[2]);
      return;
    }
    const clean = cleanLine(line);
    if (clean.length < 12 || TABLE_SEPARATOR.test(line)) return;
    lines.push({ text: clean, raw: line, line: index, section });
  });
  return lines;
}

// ---------------------------------------------------------------------------
// Beca
// ---------------------------------------------------------------------------

/** "promedio ≥ 8.0", "Beca 55%", "55% de beca". */
export function parseScholarshipFacts(text: string): { threshold: number | null; percent: number | null } {
  const plain = stripInline(text);
  let threshold: number | null = null;
  let percent: number | null = null;
  const thresholdMatch = /promedio[^\d\n]{0,24}?(?:≥|>=|mayor o igual a|minimo de|mínimo de|de al menos|arriba de)?\s*(\d{1,2}(?:[.,]\d)?)/i.exec(plain);
  if (thresholdMatch && /beca/i.test(plain.slice(Math.max(0, (thresholdMatch.index ?? 0) - 160), (thresholdMatch.index ?? 0) + 160))) {
    const value = Number(thresholdMatch[1].replace(",", "."));
    if (value >= 5 && value <= 10) threshold = value;
  }
  const percentMatch = /beca[^\d\n%]{0,16}?(\d{1,3})\s*%/i.exec(plain) ?? /(\d{1,3})\s*%\s*de\s*beca/i.exec(plain);
  if (percentMatch) {
    const value = Number(percentMatch[1]);
    if (value > 0 && value <= 100) percent = value;
  }
  return { threshold, percent };
}
