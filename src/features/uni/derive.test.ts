import { describe, expect, it } from "vitest";
import {
  absenceLevel,
  buildOverview,
  completeWeights,
  scholarshipMath,
  studyScore,
  subjectMath,
  type DbAssignmentInput,
  type DbCourseInput,
  type VaultUniInput,
} from "./derive";
import { contentLines, parseHqAlerts, parseSemesterNote } from "./parse";
import { nameSimilarity } from "./text";
import type { UniComponent } from "./types";

const timezone = "America/Mexico_City";
// 14 oct 2026, 12:00 en Ciudad de México.
const now = new Date("2026-10-14T18:00:00Z");
const today = "2026-10-14";

const SEMESTER = `# Universidad

## Calendario Parcial 2 — Octubre 2026

| Fecha | Materia | Faltas | Restantes | Nota P1 | Nota P2 | Riesgo |
| --- | --- | --- | --- | --- | --- | --- |
| Lunes 12 Oct | Finanzas Corporativas | 1.5 | 4.5 | 10 | — | ✅ |
| Miércoles 14 Oct | Análisis de Inversiones BBVA | 1.5 | 4.5 | 9 | — | ✅ |
| Viernes 16 Oct | Introducción al Cristianismo | 3.5 | 2.5 | 5.0 | — | 🔴 Doble |
| Lunes 19 Oct | Derivados Financieros | 4.0 | 2.0 | 8.5 | — | 🔴 Faltas |

### Introducción al Cristianismo (HUM018)
- **Pesos Oficiales:**
  - **Primer Parcial (25%):** Hojas
  - **Segundo Parcial (25%):** Hojas
  - **Evaluación Final (50%):** Quiz

### Derivados Financieros (2760)
- **Temas que entran al P2:**
  - **Las Griegas** (Delta, Gamma)
  - Black-Scholes

## Estrategia
1. **Derivados Financieros P2:** Enfócate en las Griegas.
`;

const HQ = `## Alertas (Universidad)
> [!warning] **SEMANA DE PARCIALES — 14–19 OCT**
> Examen BBVA hoy (14 Oct, Torre BBVA). Próximos: Cristianismo 16 Oct, Derivados 19 Oct.
`;

const DAILY = `---
fecha: 2026-10-12
---
# 2026-10-12
- **Examen Finanzas Corporativas (10:30 AM):** Calificación de **10.0**.
- Estudié para Derivados con las Griegas.
`;

const semesterMtime = Date.parse("2026-10-13T12:00:00Z");

function vault(overrides: Partial<VaultUniInput> = {}): VaultUniInput {
  return {
    semester: { path: "100 - Proyectos/Universidad.md", mtime: semesterMtime, facts: parseSemesterNote(SEMESTER, { today, similarity: nameSimilarity }) },
    hq: { path: "000 - HQ.md", mtime: semesterMtime, alerts: parseHqAlerts(HQ, { today }) },
    dailies: [{ path: "Diario/2026-10-12.md", date: "2026-10-12", mtime: Date.parse("2026-10-12T23:00:00Z"), lines: contentLines(DAILY) }],
    memories: [{ path: "200 - Áreas/Universidad (UP).md", date: "2026-09-07", text: "Cristianismo: 5 — el profe es estricto." }],
    scholarship: { threshold: 8, percent: 55 },
    notes: [{ path: "200 - Áreas/Finanzas UP/Derivados Financieros.md", title: "Derivados Financieros" }],
    ...overrides,
  };
}

const created = "2026-08-17T19:47:00.000Z";
const courses: DbCourseInput[] = [
  { id: "c-fin", name: "Finanzas Corporativas", professor: "Asignado", schedule: "Lun/Jue 10:30am", currentGrade: 0, absences: 0, maxAbsences: 6, createdAt: created },
  { id: "c-bbva", name: "Análisis de Inversiones", professor: "Asignado", schedule: "Mié 4:00pm", currentGrade: 0, absences: 0, maxAbsences: 6, createdAt: created },
  { id: "c-der", name: "Derivados Financieros", professor: "Asignado", schedule: "Lun/Vie 1:30pm", currentGrade: 0, absences: 0, maxAbsences: 6, createdAt: created },
  { id: "c-old", name: "Presupuestos", professor: "Asignado", schedule: "Sáb", currentGrade: 0, absences: 0, maxAbsences: 6, createdAt: created },
];
const assignment = (id: string, courseId: string, courseName: string, title: string, dueDate: string, extra: Partial<DbAssignmentInput> = {}): DbAssignmentInput => ({
  id, title, courseId, courseName, dueDate: `${dueDate}T06:00:00.000Z`, status: "pending", weight: 33, grade: null, createdAt: created, ...extra,
});
const assignments: DbAssignmentInput[] = [
  assignment("a1", "c-fin", "Finanzas Corporativas", "2° Parcial", "2026-10-21"),
  assignment("a2", "c-der", "Derivados Financieros", "3° Parcial", "2026-11-27"),
  assignment("a3", "c-old", "Presupuestos", "1° Parcial", "2026-02-28"),
  assignment("a4", "c-bbva", "Análisis de Inversiones", "Reporte BBVA", "2026-10-15"),
];

describe("matemática", () => {
  it("completa pesos faltantes con 30 / 30 / 40", () => {
    const { weights, assumed } = completeWeights([{ kind: "P2", label: "Parcial 2", weight: 30, date: null }]);
    expect(assumed).toBe(true);
    expect(weights.map((weight) => `${weight.kind}:${weight.weight}:${weight.assumed}`)).toEqual(["P1:30:true", "P2:30:false", "Final:40:true"]);
  });

  it("calcula lo asegurado y lo necesario por materia", () => {
    const components: UniComponent[] = [
      { kind: "P1", label: "Parcial 1", weight: 30, grade: 10, date: null, assumed: false },
      { kind: "P2", label: "Parcial 2", weight: 30, grade: 10, date: null, assumed: false },
      { kind: "Final", label: "Final", weight: 40, grade: null, date: null, assumed: false },
    ];
    expect(subjectMath(components, 8)).toMatchObject({ current: 10, securedPoints: 6, gradedWeight: 0.6, neededForThreshold: 5, standing: "asegurada" });
    const weak = subjectMath([{ ...components[0], weight: 25, grade: 5 }, { ...components[2], weight: 75 }], 8);
    expect(weak).toMatchObject({ current: 5, neededForThreshold: 9, standing: "exigente" });
    expect(subjectMath([], 8).standing).toBe("sin-datos");
  });

  it("calcula la beca como promedio simple de materias", () => {
    const base = { components: [{ kind: "P1", label: "P1", weight: 30, grade: 0, date: null, assumed: false }] as UniComponent[] };
    const result = scholarshipMath([
      { ...base, id: "a", name: "A", current: 10, securedPoints: 6, gradedWeight: 0.6, standing: "asegurada" },
      { ...base, id: "b", name: "B", current: 5, securedPoints: 1.25, gradedWeight: 0.25, standing: "exigente" },
    ], 8, 55);
    expect(result.current).toBe(7.5);
    // (8 × 2 − 7.25) / (0.4 + 0.75)
    expect(result.neededRemaining).toBeCloseTo(7.61, 2);
    expect(result.secured).toEqual(["a"]);
    expect(result.dragging).toEqual([{ id: "b", name: "B", delta: -3 }]);
  });

  it("clasifica faltas y prioriza por cercanía y riesgo", () => {
    expect([absenceLevel(1), absenceLevel(2), absenceLevel(2.5), absenceLevel(5), absenceLevel(null)]).toEqual(["critico", "alto", "medio", "bajo", "bajo"]);
    const soonWeak = studyScore({ weight: 25, current: 5, needed: 9, vaultGradeRisk: "alto", daysUntil: 2 });
    const laterStrong = studyScore({ weight: 30, current: 8.7, needed: 7.7, vaultGradeRisk: null, daysUntil: 6 });
    expect(soonWeak).toBeGreaterThan(laterStrong);
  });
});

describe("buildOverview", () => {
  const overview = buildOverview({ vault: vault(), courses, assignments, now, timezone });
  const subject = (name: string) => overview.subjects.find((item) => item.name.includes(name));

  it("prefiere la bóveda (más reciente) y oculta cursos viejos de la base", () => {
    expect(overview.subjects.map((item) => item.name)).toEqual([
      "Análisis de Inversiones BBVA",
      "Introducción al Cristianismo",
      "Derivados Financieros",
      "Finanzas Corporativas",
    ]);
    expect(subject("Derivados")?.absences).toEqual({ used: 4, limit: 6, remaining: 2, level: "alto" });
    expect(subject("Corporativas")?.dbCourseId).toBe("c-fin");
    expect(subject("Corporativas")?.professor).toBeNull();
  });

  it("usa el diario para el resultado y la hora y el horario de la base para inferir horas", () => {
    const fincorpP2 = overview.exams.find((exam) => exam.id.startsWith("finanzas-corporativas") && exam.kind === "P2");
    expect(fincorpP2).toMatchObject({ date: "2026-10-12", grade: 10, time: "10:30", timeSource: "nota", status: "hecho", source: "diario" });
    expect(overview.nextExam).toMatchObject({ subject: "Análisis de Inversiones BBVA", date: "2026-10-14", time: "16:00", timeSource: "horario", place: "Torre BBVA", status: "hoy" });
  });

  it("aprende alias del HQ y arma la ventana de parciales", () => {
    expect(subject("BBVA")?.aliases).toContain("BBVA");
    expect(overview.window).toMatchObject({ label: "Semana de parciales", start: "2026-10-14", end: "2026-10-19", rangeStart: "2026-10-12", active: true, day: 1, days: 6 });
  });

  it("calcula riesgo y estado por materia", () => {
    const cristianismo = subject("Cristianismo");
    expect(cristianismo?.components.map((item) => `${item.kind}:${item.weight}`)).toEqual(["P1:25", "P2:25", "Final:50"]);
    expect(cristianismo).toMatchObject({ current: 5, neededForThreshold: 9, standing: "exigente" });
    expect(cristianismo?.risk.level).toBe("alto");
    expect(subject("Corporativas")).toMatchObject({ current: 10, standing: "asegurada" });
    expect(overview.scholarship.secured).toEqual(["finanzas-corporativas"]);
    expect(overview.scholarship.percent).toBe(55);
  });

  it("ordena el estudio: hoy primero y luego riesgo × cercanía", () => {
    expect(overview.study.map((item) => item.subject)).toEqual(["Análisis de Inversiones BBVA", "Introducción al Cristianismo", "Derivados Financieros"]);
    expect(overview.study[0].today).toBe(true);
    const derivados = overview.study.find((item) => item.subject.startsWith("Derivados"));
    expect(derivados?.tip).toBe("Enfócate en las Griegas.");
    expect(derivados?.topics[0]).toMatchObject({ text: "Las Griegas (Delta, Gamma)", focus: true });
  });

  it("concilia entregas de la base con la bóveda y archiva las viejas", () => {
    const fincorp = overview.assignments.find((item) => item.id === "a1");
    expect(fincorp).toMatchObject({ dueDate: "2026-10-12", grade: 10, effectiveStatus: "done", synced: "diario" });
    expect(overview.assignments.find((item) => item.id === "a3")?.archived).toBe(true);
    expect(overview.assignments.find((item) => item.id === "a4")).toMatchObject({ dueDate: "2026-10-15", effectiveStatus: "pending", synced: null });
    expect(overview.courses.find((course) => course.id === "c-old")?.current).toBe(false);
  });

  it("encuentra menciones y la nota propia de la materia", () => {
    expect(subject("Derivados")?.mentions.map((mention) => mention.date)).toEqual(["2026-10-12"]);
    expect(subject("Cristianismo")?.mentions[0]).toMatchObject({ date: "2026-09-07", path: "200 - Áreas/Universidad (UP).md" });
    expect(subject("Derivados")?.notePath).toBe("200 - Áreas/Finanzas UP/Derivados Financieros.md");
    expect(subject("Cristianismo")?.notePath).toBe("100 - Proyectos/Universidad.md");
  });

  it("sin bóveda, rinde solo con la base", () => {
    const dbOnly = buildOverview({ vault: null, vaultReason: "sin bóveda", courses, assignments, now, timezone });
    expect(dbOnly.vault).toMatchObject({ available: false, reason: "sin bóveda" });
    expect(dbOnly.subjects.map((item) => item.name).sort()).toEqual(["Análisis de Inversiones", "Derivados Financieros", "Finanzas Corporativas", "Presupuestos"]);
    // 21 oct es miércoles: no hay clase de Finanzas Corporativas, así que no se inventa hora.
    expect(dbOnly.nextExam).toMatchObject({ subject: "Finanzas Corporativas", kind: "P2", date: "2026-10-21", time: null, timeSource: null });
    expect(dbOnly.window).toBeNull();
  });

  it("sin ninguna fuente devuelve estados vacíos", () => {
    const empty = buildOverview({ vault: null, courses: null, assignments: null, now, timezone });
    expect(empty).toMatchObject({ subjects: [], exams: [], study: [], assignments: [], nextExam: null, db: { available: false } });
    expect(empty.scholarship).toMatchObject({ current: null, neededRemaining: null, subjectsCounted: 0 });
  });
});
