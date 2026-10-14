import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  contentLines,
  examKindOf,
  examLabel,
  extractExamTime,
  extractResults,
  subjectAliases,
  type HqAlerts,
  type SemesterFacts,
  type SubjectFacts,
  type WeightFact,
} from "./parse";
import { diffDays, fold, mentionsAny, nameSimilarity, nameTokens, parseSchedule, slugify, weekdayOf } from "./text";
import type {
  DataSource,
  ExamKind,
  RiskLevel,
  SubjectStanding,
  UniAssignment,
  UniComponent,
  UniExam,
  UniMention,
  UniOverview,
  UniScholarship,
  UniStudyItem,
  UniSubject,
} from "./types";

/**
 * Fusiona la bóveda (notas del semestre, HQ y diario) con la base de datos
 * (cursos y entregas) y calcula todo lo que la página necesita: línea de
 * exámenes, estado por materia, matemática de la beca y cola de estudio.
 * Función pura: recibe `now` y la zona horaria para poder probarla.
 */

export type DbCourseInput = {
  id: string;
  name: string;
  professor: string | null;
  schedule: string | null;
  currentGrade: number | null;
  absences: number;
  maxAbsences: number;
  createdAt: string;
};

export type DbAssignmentInput = {
  id: string;
  title: string;
  dueDate: string;
  status: string;
  weight: number | null;
  grade: number | null;
  courseId: string;
  courseName: string;
  createdAt: string;
};

export type DailyInput = { path: string; date: string; mtime: number; lines: ReturnType<typeof contentLines> };

export type VaultUniInput = {
  semester: { path: string; mtime: number; facts: SemesterFacts } | null;
  hq: { path: string; mtime: number; alerts: HqAlerts | null } | null;
  dailies: DailyInput[];
  memories: { path: string; date: string; text: string }[];
  scholarship: { threshold: number | null; percent: number | null };
  notes: { path: string; title: string }[];
};

export type BuildInput = {
  vault: VaultUniInput | null;
  vaultReason?: string | null;
  courses: DbCourseInput[] | null;
  assignments: DbAssignmentInput[] | null;
  now: Date;
  timezone: string;
};

const PASSING = 6;
const DEFAULT_THRESHOLD = 8;
const RISK_ORDER: RiskLevel[] = ["bajo", "medio", "alto", "critico"];
const PLACEHOLDER = /^(asignado|tbd|por asignar|catedra|cátedra|n\/a|—|-|\?)$/i;
const MATCH_THRESHOLD = 0.75;

export function maxRisk(...levels: (RiskLevel | null | undefined)[]): RiskLevel {
  return levels.reduce<RiskLevel>((best, level) => (level && RISK_ORDER.indexOf(level) > RISK_ORDER.indexOf(best) ? level : best), "bajo");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function truncate(text: string, length = 240) {
  return text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text;
}

function isExamKind(kind: UniComponent["kind"]): kind is ExamKind {
  return kind !== "Tareas" && kind !== "Proyecto";
}

/** Completa los pesos que faltan con el esquema típico de la UP (30 / 30 / 40). */
export function completeWeights(weights: WeightFact[]): { weights: (WeightFact & { assumed: boolean })[]; assumed: boolean } {
  const result = weights.map((weight) => ({ ...weight, assumed: false }));
  const has = (kind: WeightFact["kind"]) => result.some((weight) => weight.kind === kind);
  let assumed = false;
  if (!has("P1")) {
    result.push({ kind: "P1", label: "Parcial 1", weight: 30, date: null, assumed: true });
    assumed = true;
  }
  if (!has("P2")) {
    result.push({ kind: "P2", label: "Parcial 2", weight: 30, date: null, assumed: true });
    assumed = true;
  }
  const total = result.reduce((sum, weight) => sum + weight.weight, 0);
  if (!has("Final") && total < 100) {
    result.push({ kind: "Final", label: "Final", weight: 100 - total, date: null, assumed: true });
    assumed = true;
  }
  const order: WeightFact["kind"][] = ["P1", "P2", "P3", "Control", "Final", "Proyecto", "Tareas", "Otro"];
  result.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return { weights: result, assumed };
}

/** Matemática de una materia: puntos asegurados, promedio actual y lo que falta. */
export function subjectMath(components: UniComponent[], threshold: number) {
  const total = components.reduce((sum, component) => sum + component.weight, 0);
  if (total <= 0) return { current: null, securedPoints: 0, gradedWeight: 0, neededForThreshold: null, neededToPass: null, standing: "sin-datos" as SubjectStanding };
  let securedPoints = 0;
  let gradedWeight = 0;
  for (const component of components) {
    if (component.grade === null) continue;
    securedPoints += (component.weight / total) * component.grade;
    gradedWeight += component.weight / total;
  }
  const remaining = 1 - gradedWeight;
  const current = gradedWeight > 0 ? securedPoints / gradedWeight : null;
  const neededForThreshold = remaining > 0.001 ? (threshold - securedPoints) / remaining : null;
  const neededToPass = remaining > 0.001 ? (PASSING - securedPoints) / remaining : null;
  let standing: SubjectStanding;
  if (gradedWeight === 0) standing = "sin-datos";
  else if (neededForThreshold === null) standing = securedPoints >= threshold ? "asegurada" : "fuera-de-alcance";
  else if (neededForThreshold <= PASSING) standing = "asegurada";
  else if (neededForThreshold <= 8) standing = "en-control";
  else if (neededForThreshold <= 10) standing = "exigente";
  else standing = "fuera-de-alcance";
  return {
    current: current === null ? null : round(current),
    securedPoints: round(securedPoints, 3),
    gradedWeight: round(gradedWeight, 4),
    neededForThreshold: neededForThreshold === null ? null : round(neededForThreshold),
    neededToPass: neededToPass === null ? null : round(neededToPass),
    standing,
  };
}

/** Beca: promedio actual, promedio necesario en lo que falta y techo posible. */
export function scholarshipMath(subjects: Pick<UniSubject, "id" | "name" | "current" | "securedPoints" | "gradedWeight" | "standing" | "components">[], threshold: number, percent: number | null): UniScholarship {
  const counted = subjects.filter((subject) => subject.components.length > 0);
  const n = counted.length;
  const securedPointsTotal = counted.reduce((sum, subject) => sum + subject.securedPoints, 0);
  const remainingWeightTotal = counted.reduce((sum, subject) => sum + (1 - subject.gradedWeight), 0);
  const graded = counted.filter((subject) => subject.current !== null);
  const current = graded.length ? graded.reduce((sum, subject) => sum + (subject.current ?? 0), 0) / graded.length : null;
  const neededRemaining = n && remainingWeightTotal > 0.001 ? (threshold * n - securedPointsTotal) / remainingWeightTotal : null;
  const balance = graded
    .map((subject) => ({ id: subject.id, name: subject.name, current: subject.current ?? 0, delta: round((subject.current ?? 0) - threshold) }))
    .sort((a, b) => a.delta - b.delta);
  return {
    threshold,
    percent,
    current: current === null ? null : round(current),
    neededRemaining: neededRemaining === null ? null : round(neededRemaining),
    ceiling: n ? round((securedPointsTotal + remainingWeightTotal * 10) / n) : null,
    securedPointsTotal: round(securedPointsTotal, 3),
    remainingWeightTotal: round(remainingWeightTotal, 4),
    subjectsCounted: n,
    secured: counted.filter((subject) => subject.standing === "asegurada").map((subject) => subject.id),
    dragging: balance.filter((item) => item.delta < 0).map(({ id, name, delta }) => ({ id, name, delta })),
    balance,
  };
}

export function absenceLevel(remaining: number | null): RiskLevel {
  if (remaining === null) return "bajo";
  if (remaining <= 1) return "critico";
  if (remaining <= 2) return "alto";
  if (remaining <= 3) return "medio";
  return "bajo";
}

/** Prioridad de estudio: peso del examen × riesgo de la materia × cercanía. */
export function studyScore(input: { weight: number | null; current: number | null; needed: number | null; vaultGradeRisk: RiskLevel | null; daysUntil: number }): number {
  const weight = (input.weight ?? 30) / 100;
  const current = input.current ?? 7;
  let risk = clamp((9.5 - current) / 3.5, 0.15, 1.2);
  if (input.needed !== null) risk += clamp((input.needed - 7) / 3, 0, 1) * 0.5;
  if (input.vaultGradeRisk === "alto" || input.vaultGradeRisk === "critico") risk += 0.3;
  else if (input.vaultGradeRisk === "medio") risk += 0.15;
  return (weight * risk) / (Math.max(0, input.daysUntil) + 1);
}

type Draft = {
  id: string;
  facts: SubjectFacts | null;
  names: string[];
  aliases: string[];
  learned: string[];
  db: DbCourseInput | null;
  hqPlace: string | null;
  hqFlag: boolean;
};

function displayName(facts: SubjectFacts): { name: string; fullName: string | null } {
  const single = facts.aliases.find((alias) => nameTokens(alias).length === 1 && !/^\d/.test(alias));
  const longest = [...facts.names].sort((a, b) => b.length - a.length)[0] ?? facts.name;
  if (single && nameTokens(facts.name).length > 1) return { name: single, fullName: longest };
  return { name: facts.name, fullName: longest !== facts.name ? longest : null };
}

function draftScore(draft: Draft, name: string): number {
  return Math.max(0, ...[...draft.names, ...draft.aliases].map((candidate) => nameSimilarity(name, candidate)));
}

export function buildOverview(input: BuildInput): UniOverview {
  const { vault, now, timezone } = input;
  const today = formatInTimeZone(now, timezone, "yyyy-MM-dd");
  const dateOf = (iso: string) => formatInTimeZone(new Date(iso), timezone, "yyyy-MM-dd");
  const courses = input.courses ?? [];
  const assignments = input.assignments ?? [];
  const semester = vault?.semester ?? null;
  const semesterMtime = semester?.mtime ?? 0;
  const threshold = vault?.scholarship.threshold ?? DEFAULT_THRESHOLD;

  // 1. Materias de la bóveda.
  const drafts: Draft[] = (semester?.facts.subjects ?? []).map((facts) => ({
    id: slugify(facts.name),
    facts,
    names: [...facts.names],
    aliases: [...facts.aliases],
    learned: [],
    db: null,
    hqPlace: null,
    hqFlag: false,
  }));

  // 2. Alias y lugares aprendidos del HQ ("Macro 21", "A&P 22", "BBVA hoy (14 Oct, Torre BBVA)").
  for (const item of vault?.hq?.alerts?.items ?? []) {
    const byDate = item.date ? drafts.filter((draft) => Object.values(draft.facts?.exams ?? {}).includes(item.date as string)) : [];
    const candidates = byDate.length ? byDate : drafts;
    const ranked = candidates
      .map((draft) => ({ draft, score: draftScore(draft, item.label) }))
      .sort((a, b) => b.score - a.score);
    const best = byDate.length === 1 ? { draft: byDate[0], score: 1 } : ranked[0];
    if (!best || best.score < (byDate.length ? 0.5 : MATCH_THRESHOLD)) continue;
    const { draft } = best;
    if (![...draft.names, ...draft.aliases, ...draft.learned].some((name) => fold(name) === fold(item.label))) draft.learned.push(item.label);
    draft.hqPlace ??= item.place;
    draft.hqFlag ||= item.flagged;
  }

  // 3. Cursos de la base: se emparejan por nombre; los que no están en la bóveda solo cuentan si tienen entregas futuras.
  const pairs = courses.flatMap((course) => drafts.map((draft) => ({ course, draft, score: draftScore(draft, course.name) })))
    .filter((pair) => pair.score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score);
  const usedCourses = new Set<string>();
  for (const pair of pairs) {
    if (usedCourses.has(pair.course.id) || pair.draft.db) continue;
    pair.draft.db = pair.course;
    usedCourses.add(pair.course.id);
  }
  const futureCourseIds = new Set(assignments.filter((item) => item.status !== "done" && dateOf(item.dueDate) >= today).map((item) => item.courseId));
  for (const course of courses) {
    if (usedCourses.has(course.id)) continue;
    if (semester && !futureCourseIds.has(course.id)) continue;
    drafts.push({ id: `db-${slugify(course.name)}`, facts: null, names: [course.name], aliases: [], learned: [], db: course, hqPlace: null, hqFlag: false });
  }
  const seenIds = new Set<string>();
  for (const draft of drafts) {
    let id = draft.id;
    for (let suffix = 2; seenIds.has(id); suffix += 1) id = `${draft.id}-${suffix}`;
    draft.id = id;
    seenIds.add(id);
  }

  const aliasesOf = new Map<string, string[]>();
  for (const draft of drafts) {
    const base = subjectAliases(draft, drafts);
    aliasesOf.set(draft.id, [...new Set([...base, ...draft.learned])]);
  }

  // 4. Diario: resultados, horas de examen y menciones.
  const dailies = [...(vault?.dailies ?? [])].filter((daily) => daily.date <= today).sort((a, b) => b.date.localeCompare(a.date));
  /** `dated`: el examen de ese tipo fue el mismo día de la nota, así que la fecha también es dato. */
  type DiaryResult = { kind: ExamKind; grade: number; date: string; mtime: number; dated: boolean };
  const diaryResults = new Map<string, DiaryResult[]>();
  const diaryTimes = new Map<string, { date: string; time: string }[]>();
  const mentions = new Map<string, UniMention[]>();
  for (const daily of dailies) {
    for (const line of daily.lines) {
      const mentioned = drafts.filter((draft) => mentionsAny(line.text, aliasesOf.get(draft.id) ?? []));
      for (const draft of mentioned) {
        const list = mentions.get(draft.id) ?? [];
        list.push({ date: daily.date, text: truncate(line.text), path: daily.path });
        mentions.set(draft.id, list);
      }
      if (mentioned.length !== 1) continue;
      const [draft] = mentioned;
      const examsOnDay = Object.entries(draft.facts?.exams ?? {}).filter(([, date]) => date === daily.date).map(([kind]) => kind as ExamKind);
      for (const result of extractResults(line.raw)) {
        const kind = result.kind ?? (examsOnDay.length === 1 ? examsOnDay[0] : null);
        if (!kind) continue;
        const list = diaryResults.get(draft.id) ?? [];
        list.push({ kind, grade: result.grade, date: daily.date, mtime: daily.mtime, dated: examsOnDay.includes(kind) });
        diaryResults.set(draft.id, list);
      }
      const time = examsOnDay.length ? extractExamTime(line.raw) : null;
      if (time) diaryTimes.set(draft.id, [...(diaryTimes.get(draft.id) ?? []), { date: daily.date, time }]);
    }
  }
  for (const memory of vault?.memories ?? []) {
    if (memory.date > today) continue;
    for (const draft of drafts) {
      if (!mentionsAny(memory.text, aliasesOf.get(draft.id) ?? [])) continue;
      const list = mentions.get(draft.id) ?? [];
      list.push({ date: memory.date, text: truncate(memory.text), path: memory.path });
      mentions.set(draft.id, list);
    }
  }

  // 5. Entregas de la base agrupadas por curso.
  const assignmentsByCourse = new Map<string, DbAssignmentInput[]>();
  for (const item of assignments) assignmentsByCourse.set(item.courseId, [...(assignmentsByCourse.get(item.courseId) ?? []), item]);

  const examKindForAssignment = (title: string, components: UniComponent[]): ExamKind | null => {
    const kind = examKindOf(title);
    if (kind === "P3" && !components.some((component) => component.kind === "P3") && components.some((component) => component.kind === "Final")) return "Final";
    return kind;
  };

  // 6. Materias finales.
  const exams: UniExam[] = [];
  const syncedAssignments = new Map<string, { date: string; grade: number | null; source: DataSource }>();
  const subjects: UniSubject[] = drafts.map((draft) => {
    const facts = draft.facts;
    const db = draft.db;
    const vaultNewer = !db || semesterMtime >= Date.parse(db.createdAt);
    const names = facts ? displayName(facts) : { name: db?.name ?? draft.id, fullName: null };

    // Componentes y calificaciones.
    let components: UniComponent[];
    let weightsAssumed = false;
    if (facts) {
      const completed = completeWeights(facts.weights);
      weightsAssumed = completed.assumed;
      components = completed.weights.map((weight) => ({
        kind: weight.kind,
        label: weight.kind === "Tareas" || weight.kind === "Proyecto" ? weight.label : examLabel(weight.kind),
        weight: weight.weight,
        grade: isExamKind(weight.kind) ? facts.grades[weight.kind]?.grade ?? null : null,
        date: isExamKind(weight.kind) ? facts.exams[weight.kind] ?? facts.grades[weight.kind]?.date ?? weight.date : weight.date,
        assumed: weight.assumed,
      }));
    } else {
      const own = (db ? assignmentsByCourse.get(db.id) : undefined) ?? [];
      components = own
        .filter((item) => item.weight && item.weight > 0)
        .map((item) => ({
          kind: examKindOf(item.title) ?? "Tareas",
          label: item.title,
          weight: item.weight ?? 0,
          grade: item.grade === null ? null : item.grade > 10 ? round(item.grade / 10) : item.grade,
          date: dateOf(item.dueDate),
          assumed: false,
        }));
    }

    // Resultados del diario (más recientes que la nota del semestre ganan).
    for (const result of diaryResults.get(draft.id) ?? []) {
      const component = components.find((item) => item.kind === result.kind);
      if (!component) continue;
      if (component.grade === null || (result.mtime > semesterMtime && component.grade !== result.grade)) component.grade = result.grade;
      if (result.dated) component.date ??= result.date;
    }

    // Exámenes de la base que la bóveda no conoce (o donde la base es más reciente).
    const ownAssignments = (db ? assignmentsByCourse.get(db.id) : undefined) ?? [];
    const examDates = new Map<ExamKind, { date: string; source: DataSource }>();
    for (const component of components) {
      if (isExamKind(component.kind) && component.date) examDates.set(component.kind, { date: component.date, source: "boveda" });
    }
    for (const item of ownAssignments) {
      const kind = examKindForAssignment(item.title, components);
      if (!kind) continue;
      const known = examDates.get(kind);
      const assignmentNewer = Date.parse(item.createdAt) > semesterMtime;
      const dbDate = dateOf(item.dueDate);
      if (!known || (assignmentNewer && facts)) examDates.set(kind, { date: dbDate, source: "db" });
      const component = components.find((entry) => entry.kind === kind);
      const dbGrade = item.grade === null ? null : item.grade > 10 ? round(item.grade / 10) : item.grade;
      if (component && dbGrade !== null && (component.grade === null || assignmentNewer)) component.grade = dbGrade;
      if (component && !component.date) component.date = examDates.get(kind)?.date ?? null;
      const effective = examDates.get(kind);
      if (facts && effective && effective.source !== "db") {
        syncedAssignments.set(item.id, { date: effective.date, grade: component?.grade ?? null, source: diaryResults.get(draft.id)?.some((result) => result.kind === kind) ? "diario" : "boveda" });
      } else if (facts && component?.grade !== null && component?.grade !== undefined && dbGrade === null) {
        syncedAssignments.set(item.id, { date: dbDate, grade: component.grade, source: "boveda" });
      }
    }

    const math = subjectMath(components, threshold);

    // Faltas.
    const dbUsed = db ? db.absences : null;
    const vaultUsed = facts?.absences ?? null;
    const used = vaultUsed !== null && (vaultNewer || dbUsed === null) ? vaultUsed : dbUsed ?? vaultUsed;
    const vaultLimit = facts && facts.absences !== null && facts.absencesRemaining !== null ? facts.absences + facts.absencesRemaining : null;
    const limit = vaultLimit ?? db?.maxAbsences ?? 6;
    const vaultRemaining = facts?.absencesRemaining ?? null;
    let remaining: number | null = null;
    if (used !== null) remaining = used === vaultUsed && vaultRemaining !== null ? vaultRemaining : round(limit - used, 1);
    const absences = { used, limit, remaining, level: absenceLevel(remaining) };

    // Riesgo.
    const reasons: string[] = [];
    let gradeLevel: RiskLevel = "bajo";
    if (math.standing === "fuera-de-alcance") gradeLevel = "critico";
    else if (math.neededForThreshold !== null && math.neededForThreshold >= 9) gradeLevel = "alto";
    else if (math.neededForThreshold !== null && math.neededForThreshold >= 8) gradeLevel = "medio";
    if (math.neededToPass !== null && math.neededToPass >= 8) gradeLevel = "critico";
    if (math.neededForThreshold !== null && gradeLevel !== "bajo") reasons.push(`Necesitas ${math.neededForThreshold.toFixed(1)} en lo que falta para ${threshold.toFixed(1)}`);
    if (math.standing === "fuera-de-alcance") reasons.push(`${threshold.toFixed(1)} ya no es alcanzable en la materia`);
    if (absences.level !== "bajo" && remaining !== null) reasons.push(remaining <= 2 ? `Faltas al límite: ${remaining.toFixed(1)} restantes` : `${remaining.toFixed(1)} faltas restantes`);
    const vaultRisk = facts?.risk && !facts.risk.resolved ? facts.risk : null;
    const vaultLevel = vaultRisk?.level ?? (draft.hqFlag ? "alto" : null);
    if (vaultRisk && vaultRisk.level && vaultRisk.level !== "bajo") {
      const label = vaultRisk.text.trim();
      if (label) reasons.push(`Bóveda marca riesgo: ${label.toLowerCase()}`);
    }
    const level = maxRisk(gradeLevel, absences.level, vaultLevel === "bajo" ? null : vaultLevel);

    const place = facts?.place ?? draft.hqPlace ?? null;
    const schedule = db?.schedule ?? null;
    const scheduleTimes = parseSchedule(schedule);
    const subjectExams: UniExam[] = [];
    for (const [kind, { date, source }] of examDates) {
      const component = components.find((item) => item.kind === kind);
      const noted = (diaryTimes.get(draft.id) ?? []).find((entry) => entry.date === date)?.time ?? null;
      const scheduled = kind === "Final" ? null : scheduleTimes.get(weekdayOf(date)) ?? null;
      const time = noted ?? scheduled;
      const at = time ? fromZonedTime(`${date}T${time}:00`, timezone).toISOString() : null;
      const grade = component?.grade ?? null;
      const daysUntil = diffDays(today, date);
      let status: UniExam["status"];
      if (grade !== null) status = "hecho";
      else if (daysUntil < 0) status = "sin-resultado";
      else if (daysUntil === 0) status = at && now.getTime() > Date.parse(at) + 2 * 3_600_000 ? "sin-resultado" : "hoy";
      else status = "proximo";
      const total = components.reduce((sum, item) => sum + item.weight, 0) || 100;
      subjectExams.push({
        id: `${draft.id}:${kind}`,
        subjectId: draft.id,
        subject: names.name,
        kind,
        label: examLabel(kind),
        date,
        time,
        timeSource: noted ? "nota" : scheduled ? "horario" : null,
        at,
        place: kind === "Final" ? null : place,
        grade,
        weight: component ? round((component.weight / total) * 100, 1) : null,
        status,
        daysUntil,
        source: (diaryResults.get(draft.id) ?? []).some((result) => result.kind === kind && result.dated && result.date === date) ? "diario" : source,
        risk: level,
      });
    }
    subjectExams.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
    exams.push(...subjectExams);
    const nextExam = subjectExams.find((exam) => exam.status === "hoy" || exam.status === "proximo") ?? null;

    // Nota de la bóveda para la materia: una nota propia si existe, si no la del semestre.
    const ownNote = (vault?.notes ?? []).find((note) => [...draft.names, ...draft.aliases].some((name) => nameSimilarity(note.title, name) >= 1 && nameTokens(note.title).length >= Math.min(2, nameTokens(name).length)));
    const details = [...(facts?.details ?? [])];
    if (facts?.codes.length) details.unshift({ label: "Clave", value: facts.codes.join(" · ") });
    if (schedule) details.push({ label: "Horario", value: schedule });
    if (weightsAssumed) details.push({ label: "Pesos", value: "Algunos pesos no están en la bóveda: se asume 30 / 30 / 40." });

    const subjectMentions = (mentions.get(draft.id) ?? [])
      .sort((a, b) => b.date.localeCompare(a.date))
      .filter((mention, index, list) => list.findIndex((other) => other.text === mention.text) === index)
      .slice(0, 5);

    const sources: DataSource[] = [];
    if (facts) sources.push("boveda");
    if (diaryResults.has(draft.id) || subjectMentions.some((mention) => mention.path.includes("/"))) sources.push("diario");
    if (db) sources.push("db");

    const professor = facts?.professor ?? (db?.professor && !PLACEHOLDER.test(db.professor.trim()) ? db.professor : null);

    return {
      id: draft.id,
      name: names.name,
      fullName: names.fullName,
      codes: facts?.codes ?? [],
      aliases: [...new Set([...draft.aliases, ...draft.learned])],
      professor,
      email: facts?.email ?? null,
      schedule,
      place,
      components,
      weightsAssumed,
      current: math.current ?? (db?.currentGrade ? round(db.currentGrade / 10) : null),
      securedPoints: math.securedPoints,
      gradedWeight: math.gradedWeight,
      neededForThreshold: math.neededForThreshold,
      neededToPass: math.neededToPass,
      standing: math.standing,
      absences,
      risk: { level, reasons },
      nextExam,
      topics: facts?.topics ?? [],
      laterTopics: facts?.laterTopics ?? [],
      tips: [...new Set(facts?.tips ?? [])],
      details,
      mentions: subjectMentions,
      notePath: ownNote?.path ?? semester?.path ?? null,
      dbCourseId: db?.id ?? null,
      sources,
    };
  });

  exams.sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "99").localeCompare(b.time ?? "99") || a.subject.localeCompare(b.subject, "es"));
  const upcoming = exams.filter((exam) => exam.status === "hoy" || exam.status === "proximo");
  const nextExam = upcoming[0] ?? null;

  // 7. Ventana de exámenes.
  let window: UniOverview["window"] = null;
  const hqWindow = vault?.hq?.alerts?.window ?? null;
  const calendarKind = (() => {
    const title = semester?.facts.calendarTitle;
    return title ? examKindOf(title) : null;
  })();
  const calendarExams = exams.filter((exam) => exam.kind === (calendarKind ?? nextExam?.kind) && exam.kind !== "Final");
  const start = hqWindow?.start ?? calendarExams[0]?.date ?? null;
  const end = hqWindow?.end ?? calendarExams[calendarExams.length - 1]?.date ?? null;
  const enoughEvidence = Boolean(hqWindow) || calendarExams.length >= 2;
  if (start && end && enoughEvidence && diffDays(end, today) <= 7 && diffDays(today, start) <= 21) {
    const near = calendarExams.filter((exam) => diffDays(exam.date, start) <= 7 && diffDays(end, exam.date) <= 7);
    const rangeStart = [start, ...near.map((exam) => exam.date)].sort()[0];
    const rangeEnd = [end, ...near.map((exam) => exam.date)].sort().reverse()[0];
    const rawLabel = vault?.hq?.alerts?.title?.split(/\s+[—–-]\s+/)[0]?.trim();
    const label = rawLabel ? rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1).toLowerCase() : `Semana de ${calendarKind === "Final" ? "finales" : "parciales"}`;
    window = {
      label,
      start,
      end,
      rangeStart,
      rangeEnd,
      active: today >= start && today <= end,
      day: diffDays(start, today) + 1,
      days: diffDays(start, end) + 1,
    };
  }

  // 8. Beca.
  const scholarship = scholarshipMath(subjects, threshold, vault?.scholarship.percent ?? null);

  // 9. Qué estudiar ahora.
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const draftById = new Map(drafts.map((draft) => [draft.id, draft]));
  const studyRaw = upcoming
    .filter((exam) => exam.daysUntil <= 30)
    .map((exam) => {
      const subject = subjectById.get(exam.subjectId);
      const facts = draftById.get(exam.subjectId)?.facts ?? null;
      const vaultGradeRisk = facts?.risk && facts.risk.grade && !facts.risk.resolved ? facts.risk.level : null;
      const score = studyScore({ weight: exam.weight, current: subject?.current ?? null, needed: subject?.neededForThreshold ?? null, vaultGradeRisk, daysUntil: exam.daysUntil });
      const previous = subject?.components.filter((component) => isExamKind(component.kind) && component.grade !== null) ?? [];
      const reasons: string[] = [];
      for (const component of previous.slice(0, 2)) reasons.push(`${component.kind} ${component.grade?.toFixed(1)}`);
      if (exam.weight) reasons.push(`vale ${Math.round(exam.weight)}%`);
      if (subject?.neededForThreshold !== null && subject?.neededForThreshold !== undefined && subject.neededForThreshold > 10) reasons.push(`${threshold.toFixed(1)} fuera de alcance`);
      if (vaultGradeRisk && vaultGradeRisk !== "bajo") reasons.push(`riesgo ${facts?.risk?.text.toLowerCase() || "marcado"}`);
      const tips = subject?.tips.filter((text) => !/^asistencia/i.test(text)) ?? [];
      const tip = tips.find((text) => /\bP[1-3]\b|parcial|examen|enf[oó]c|estudi|repas|pr[aá]ctica|teor[ií]a/i.test(text)) ?? tips[0] ?? null;
      const target = subject?.neededForThreshold ?? null;
      return {
        examId: exam.id,
        subjectId: exam.subjectId,
        subject: exam.subject,
        label: exam.label,
        date: exam.date,
        time: exam.time,
        daysUntil: exam.daysUntil,
        priority: 0,
        today: exam.status === "hoy",
        target: target === null ? null : round(clamp(target, 0, 10), 1),
        reasons,
        topics: subject?.topics ?? [],
        tip,
        score,
      };
    });
  const maxScore = Math.max(0.0001, ...studyRaw.map((item) => item.score));
  const study: UniStudyItem[] = studyRaw
    .sort((a, b) => Number(b.today) - Number(a.today) || b.score - a.score)
    .map(({ score, ...item }) => ({ ...item, priority: Math.max(4, Math.round((score / maxScore) * 100)) }));

  // 10. Entregas.
  const subjectByCourse = new Map(subjects.filter((subject) => subject.dbCourseId).map((subject) => [subject.dbCourseId as string, subject]));
  const uniAssignments: UniAssignment[] = assignments.map((item) => {
    const synced = syncedAssignments.get(item.id) ?? null;
    const due = synced?.date ?? dateOf(item.dueDate);
    const grade = synced?.grade ?? (item.grade === null ? null : item.grade > 10 ? round(item.grade / 10) : item.grade);
    const done = item.status === "done" || grade !== null;
    const effectiveStatus: UniAssignment["effectiveStatus"] = done ? "done" : item.status === "in-progress" ? "in-progress" : "pending";
    return {
      id: item.id,
      title: item.title,
      courseId: item.courseId,
      course: subjectByCourse.get(item.courseId)?.name ?? item.courseName,
      subjectId: subjectByCourse.get(item.courseId)?.id ?? null,
      dueDate: due,
      status: item.status,
      effectiveStatus,
      weight: item.weight,
      grade,
      synced: synced?.source ?? null,
      archived: effectiveStatus !== "done" && diffDays(due, today) > 45,
    };
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.course.localeCompare(b.course, "es"));

  const currentCourseIds = new Set([...subjectByCourse.keys(), ...futureCourseIds]);
  const courseOptions = courses
    .map((course) => ({ id: course.id, name: subjectByCourse.get(course.id)?.name ?? course.name, current: currentCourseIds.has(course.id) }))
    .sort((a, b) => Number(b.current) - Number(a.current) || a.name.localeCompare(b.name, "es"));

  // 11. Alertas de la bóveda.
  const alerts: UniOverview["alerts"] = [];
  for (const callout of semester?.facts.callouts ?? []) {
    if (!/caution|warning|danger|important|alert|error/.test(callout.type)) continue;
    alerts.push({ title: callout.title, body: callout.body, path: semester?.path ?? "" });
  }
  if (vault?.hq?.alerts) alerts.push({ title: vault.hq.alerts.title ?? "Alerta", body: vault.hq.alerts.body, path: vault.hq.path });

  const subjectOrder = (subject: UniSubject) => subject.nextExam ? `0${subject.nextExam.date}${subject.nextExam.time ?? "99"}` : `1${9 - RISK_ORDER.indexOf(subject.risk.level)}`;
  subjects.sort((a, b) => subjectOrder(a).localeCompare(subjectOrder(b)) || a.name.localeCompare(b.name, "es"));

  return {
    generatedAt: now.toISOString(),
    today,
    timezone,
    vault: {
      available: Boolean(semester),
      notePath: semester?.path ?? null,
      updatedAt: semester ? new Date(semester.mtime).toISOString() : null,
      reason: semester ? null : input.vaultReason ?? (vault ? "No encontré la nota del semestre en la bóveda." : "La bóveda no está disponible en este entorno."),
    },
    db: { available: input.courses !== null },
    window,
    alerts,
    subjects,
    exams,
    finals: exams.filter((exam) => exam.kind === "Final"),
    nextExam,
    scholarship,
    study,
    assignments: uniAssignments,
    courses: courseOptions,
  };
}
