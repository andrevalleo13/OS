import { describe, expect, it } from "vitest";
import {
  bulletField,
  contentLines,
  datedBullets,
  examKindOf,
  extractExamTime,
  extractResults,
  parseCallouts,
  parseHqAlerts,
  parseRiskCell,
  parseScholarshipFacts,
  parseSemesterNote,
  parseTables,
  parseWeights,
  splitTableRow,
} from "./parse";
import { nameSimilarity } from "./text";

const today = "2026-10-14";

const SEMESTER = `---
tipo: area
tags: [universidad]
---

# Universidad

> [!caution] **MATERIAS EN RIESGO POR FALTAS**
> **Derivados** tiene solo **2 faltas restantes**.

## Calendario Parcial 2 — Octubre 2026

| Fecha | Materia | Faltas | Restantes | Nota P1 | Nota P2 | Riesgo |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Lunes 12 Oct** | Finanzas Corporativas | 1.5 | 4.5 | **10** | **10** 🏆 | ✅ RESUELTA |
| **Miércoles 14 Oct** | Análisis de Inversiones BBVA | 1.5 | 4.5 | **9** | — | ✅ |
| **Viernes 16 Oct** | Introducción al Cristianismo | 3.5 | 2.5 | **5.0** | — | 🔴 Doble |
| **Lunes 19 Oct** | Derivados Financieros | 4.0 | 2.0 | **8.5** | — | 🔴 Faltas |
| **Viernes 23 Oct** | Finanzas Tecnológicas (Fintech) | 1.0 | 5.0 | **6.0** | — | ⚠️ Nota |

## Syllabus

### 1. Finanzas Corporativas (2662)
- **Nota P1:** 10
- **Pesos:** Parcial 1 (30%) · Parcial 2 (30%) · Final (30%) · Tareas (10%)

### 2. Análisis de Inversiones BBVA (FIN009)
- **Profesor:** Francisco Carmona · fcarmona@up.edu.mx
- **Examen P2:** 14 Oct (Miércoles)
- **Temas que entran al P2:**
  - Derivados de Divisas
  - **Volatilidad de Tasas** ← tema del examen
- **Temas siguientes (Post P2):** CVA, Equity
- **Formato:** Master class en Torre BBVA

### 3. Derivados Financieros (2760)
- **Pesos:**
  - Parcial 1: 30% (7 sep)
  - Parcial 2: 30% (19 oct)
  - Final (Proyecto): 30% (30 nov)
  - Participación/Tareas: 10%

### 7. Finanzas Tecnológicas / Fintech (FIN506 / 2586)
- **Faltas:** 1.0 ✅
- **Pesos Oficiales:**
  - Tareas, participación y trabajos: **10%**
  - Proyecto final: **20%**
  - Exámenes parciales (P1 15% + P2 15%): **30%**
  - Examen final: **40%**
- **Estrategia:** El final es el salvavidas.

### 8. Introducción al Cristianismo (HUM018 / 2150)
- **Pesos Oficiales:**
  - **Primer Parcial (25%):** Hojas de Trabajo (20%), Videos de Lectura (40%)
  - **Segundo Parcial (25%):** Hojas de Trabajo (20%), Videos de Lectura (40%)
  - **Evaluación Final (50%):** Presentación Final oral (30%)
- **Examen Final:** 26 Nov

## Calendario de Finales (Nov - Dic 2026)

| Fecha | Materia |
| :--- | :--- |
| Lun 23 Nov | Finanzas Corporativas |
| Lun 30 Nov | Derivados Financieros |

## Estrategia
1. **Derivados y Finanzas Corporativas:** Asistencia obligatoria.
2. **Derivados Financieros P2:** Enfócate en las Griegas.
3. **Objetivo Q4:** Promedios arriba de 8.5.
`;

describe("bloques Markdown", () => {
  it("divide filas respetando wikilinks con alias y pipes escapados", () => {
    expect(splitTableRow("| [[Nota|alias]] | a \\| b | c |")).toEqual(["[[Nota|alias]]", "a | b", "c"]);
  });
  it("lee tablas con su encabezado y rellena celdas faltantes", () => {
    const tables = parseTables("## Tabla\n\n| A | B |\n|---|---|\n| 1 |\n| 2 | 3 |\n\n```\n| x | y |\n|---|---|\n```");
    expect(tables).toHaveLength(1);
    expect(tables[0]).toMatchObject({ heading: "Tabla", headers: ["A", "B"], rows: [["1", ""], ["2", "3"]] });
  });
  it("separa clave y valor de viñetas", () => {
    expect(bulletField("**Nota P1:** 8.5 (bien)")).toEqual({ key: "Nota P1", value: "8.5 (bien)" });
    expect(bulletField("**Primer Parcial (25%):** Hojas")).toEqual({ key: "Primer Parcial (25%)", value: "Hojas" });
    expect(bulletField("Parcial 1: 30% (7 sep)")).toEqual({ key: "Parcial 1", value: "30% (7 sep)" });
    expect(bulletField("**Volatilidad** ← tema")).toEqual({ key: null, value: "**Volatilidad** ← tema" });
  });
  it("lee callouts", () => {
    expect(parseCallouts("> [!warning] **Ojo**\n> línea 1\n> línea 2\n\ntexto")).toEqual([
      expect.objectContaining({ type: "warning", title: "Ojo", body: "línea 1 línea 2" }),
    ]);
  });
});

describe("vocabulario académico", () => {
  it("reconoce tipos de evaluación", () => {
    expect(examKindOf("Nota P2")).toBe("P2");
    expect(examKindOf("2° Parcial")).toBe("P2");
    expect(examKindOf("Primer Parcial")).toBe("P1");
    expect(examKindOf("Examen Final")).toBe("Final");
    expect(examKindOf("Proyecto Final")).toBe("Final");
    expect(examKindOf("Tarea 3")).toBeNull();
  });
  it("interpreta la columna de riesgo", () => {
    expect(parseRiskCell("🔴 Doble")).toMatchObject({ level: "alto", grade: true, absences: true });
    expect(parseRiskCell("⚠️ Nota")).toMatchObject({ level: "medio", grade: true, absences: false });
    expect(parseRiskCell("✅ RESUELTA")).toMatchObject({ level: "bajo", resolved: true });
  });
  it("lee pesos en sus distintas formas", () => {
    const kinds = (lines: string[]) => parseWeights(lines, today, 2026).map((weight) => `${weight.kind}:${weight.weight}`);
    expect(kinds(["P1 30% · P2 30% · Final 30% · Tareas/Participación 10%"])).toEqual(["P1:30", "P2:30", "Final:30", "Tareas:10"]);
    expect(kinds(["Exámenes parciales (P1 15% + P2 15%): **30%**", "Proyecto final: **20%**", "Examen final: **40%**"])).toEqual(["P1:15", "P2:15", "Proyecto:20", "Final:40"]);
    expect(parseWeights(["Parcial 1: 30% (7 sep)"], today, 2026)[0]).toMatchObject({ kind: "P1", date: "2026-09-07" });
  });
});

describe("parseSemesterNote", () => {
  const facts = parseSemesterNote(SEMESTER, { today, similarity: nameSimilarity });
  const subject = (name: string) => facts.subjects.find((item) => item.names.some((candidate) => candidate.includes(name)));

  it("une la tabla, el syllabus y los finales en una materia por nombre", () => {
    expect(facts.calendarTitle).toBe("Calendario Parcial 2 — Octubre 2026");
    expect(facts.subjects.map((item) => item.name)).toEqual([
      "Finanzas Corporativas",
      "Análisis de Inversiones BBVA",
      "Introducción al Cristianismo",
      "Derivados Financieros",
      "Finanzas Tecnológicas",
    ]);
  });

  it("extrae fechas, calificaciones, faltas y riesgo de la tabla", () => {
    const fincorp = subject("Corporativas");
    expect(fincorp?.exams).toMatchObject({ P2: "2026-10-12", Final: "2026-11-23" });
    expect(fincorp?.grades.P1?.grade).toBe(10);
    expect(fincorp?.grades.P2?.grade).toBe(10);
    const cristianismo = subject("Cristianismo");
    expect(cristianismo).toMatchObject({ absences: 3.5, absencesRemaining: 2.5 });
    expect(cristianismo?.risk).toMatchObject({ level: "alto", grade: true });
    expect(cristianismo?.exams.Final).toBe("2026-11-26");
    expect(subject("BBVA")?.risk?.level).toBe("bajo");
  });

  it("lee el syllabus: profesor, temas, lugar y alias", () => {
    const bbva = subject("BBVA");
    expect(bbva).toMatchObject({ professor: "Francisco Carmona", email: "fcarmona@up.edu.mx", place: "Torre BBVA", codes: ["FIN009"] });
    expect(bbva?.topics).toEqual([
      { text: "Derivados de Divisas", note: null, focus: false },
      { text: "Volatilidad de Tasas", note: "tema del examen", focus: true },
    ]);
    expect(bbva?.laterTopics).toEqual(["CVA", "Equity"]);
    const fintech = subject("Tecnológicas");
    expect(fintech?.aliases).toContain("Fintech");
    expect(fintech?.codes).toEqual(["FIN506", "2586"]);
    expect(fintech?.weights.map((weight) => `${weight.kind}:${weight.weight}`)).toEqual(["Tareas:10", "Proyecto:20", "P1:15", "P2:15", "Final:40"]);
  });

  it("toma fechas de examen desde los pesos y la estrategia por materia", () => {
    const derivados = subject("Derivados");
    expect(derivados?.exams).toMatchObject({ P1: "2026-09-07", P2: "2026-10-19", Final: "2026-11-30" });
    expect(derivados?.tips).toEqual(["Asistencia obligatoria.", "Enfócate en las Griegas."]);
    expect(subject("Corporativas")?.tips).toEqual(["Asistencia obligatoria."]);
    expect(subject("BBVA")?.tips).toEqual([]);
    expect(subject("Cristianismo")?.weights.map((weight) => `${weight.kind}:${weight.weight}`)).toEqual(["P1:25", "P2:25", "Final:50"]);
  });

  it("no revienta con notas vacías o raras", () => {
    expect(parseSemesterNote("", { today, similarity: nameSimilarity }).subjects).toEqual([]);
    expect(parseSemesterNote("| a |\n|---|\n| x |", { today, similarity: nameSimilarity }).subjects).toEqual([]);
  });
});

describe("parseHqAlerts", () => {
  const HQ = `## 🚨 Alertas (Universidad)
> [!warning] **SEMANA DE PARCIALES — 14–23 OCT**
> Examen BBVA hoy (14 Oct, Torre BBVA). Próximos: Cristianismo 16 Oct 🔴, Derivados 19 Oct 🔴 (faltas al límite), Estadística 20, Macro 21, A&P 22. Ver [[Universidad (5to Semestre)]].
`;
  it("lee la ventana, los exámenes y sus marcas", () => {
    const alerts = parseHqAlerts(HQ, { today });
    expect(alerts?.window).toEqual({ start: "2026-10-14", end: "2026-10-23" });
    expect(alerts?.items.map((item) => [item.label, item.date, item.flagged])).toEqual([
      ["BBVA", "2026-10-14", false],
      ["Cristianismo", "2026-10-16", true],
      ["Derivados", "2026-10-19", true],
      ["Estadística", "2026-10-20", false],
      ["Macro", "2026-10-21", false],
      ["A&P", "2026-10-22", false],
    ]);
    expect(alerts?.items[0].place).toBe("Torre BBVA");
    expect(alerts?.items[2].note).toBe("faltas al límite");
  });
  it("devuelve null sin alertas", () => {
    expect(parseHqAlerts("# HQ\nnada", { today })).toBeNull();
  });
});

describe("diario", () => {
  it("extrae resultados explícitos e ignora metas", () => {
    expect(extractResults("Examen destruido con 10 perfecto (P1: 10, P2: 10).")).toEqual([{ kind: "P1", grade: 10 }, { kind: "P2", grade: 10 }]);
    expect(extractResults("- **Examen Finanzas Corporativas (10:30 AM):** Calificación de **10.0**.")).toEqual([{ kind: null, grade: 10 }]);
    expect(extractResults("Saqué 8.5 en el 2° parcial")).toEqual([{ kind: "P2", grade: 8.5 }]);
    expect(extractResults("Espera sacar un 10 en el final")).toEqual([]);
    expect(extractResults("Con 4 faltas cada una")).toEqual([]);
  });
  it("lee la hora del examen", () => {
    expect(extractExamTime("**Examen Finanzas Corporativas (10:30 AM):** 10")).toBe("10:30");
    expect(extractExamTime("Gym a las 5am")).toBeNull();
  });
  it("lee viñetas fechadas y líneas con contenido", () => {
    expect(datedBullets("- **[2026-09-07]** Resultados: **10** ✅\n- sin fecha")).toEqual([{ date: "2026-09-07", text: "Resultados: 10", line: 0 }]);
    const lines = contentLines("---\nfecha: 2026-10-12\n---\n# Título\n- Examen de Macro mañana temprano\n- ok\n```\n- Examen en código\n```");
    expect(lines.map((line) => line.text)).toEqual(["Examen de Macro mañana temprano"]);
    expect(lines[0].section).toBe("Título");
  });
});

describe("parseScholarshipFacts", () => {
  it("lee umbral y porcentaje de la beca", () => {
    expect(parseScholarshipFacts("Condiciones de la beca (55%): mantener **promedio ≥ 8.0**")).toEqual({ threshold: 8, percent: 55 });
    expect(parseScholarshipFacts("Tengo 55% de beca. Para la beca el promedio mínimo de 8.5")).toEqual({ threshold: 8.5, percent: 55 });
    expect(parseScholarshipFacts("promedio 9.2 en gym")).toEqual({ threshold: null, percent: null });
  });
});
