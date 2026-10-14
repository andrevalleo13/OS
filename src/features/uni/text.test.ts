import { describe, expect, it } from "vitest";
import {
  cleanLine,
  diffDays,
  distinctiveTokens,
  mentionsAny,
  nameSimilarity,
  parseGrade,
  parseSchedule,
  parseSpanishDate,
  parseTime,
  splitSubjectName,
  stripInline,
  weekdayOf,
} from "./text";

const today = "2026-10-14";

describe("stripInline / cleanLine", () => {
  it("quita negritas, wikilinks, emojis y LaTeX simple", () => {
    expect(stripInline("**10** 🏆 [[Universidad (UP)|la UP]] ($\\ge 8.0$)")).toBe("10 la UP (≥ 8.0)");
    expect(cleanLine("- **Nota P1:** 8.5 ✅")).toBe("Nota P1: 8.5");
    expect(cleanLine("### 1. Finanzas Corporativas (2662)")).toBe("1. Finanzas Corporativas (2662)");
  });
});

describe("parseGrade", () => {
  it("lee calificaciones con formato y comentarios", () => {
    expect(parseGrade("**10** 🏆 (12 de octubre de 2026)")).toBe(10);
    expect(parseGrade("8.5 (Parcial 1 cubrió: Intro, Tipos de Mercados)")).toBe(8.5);
    expect(parseGrade("5,0")).toBe(5);
    expect(parseGrade("10/10")).toBe(10);
    expect(parseGrade("95")).toBe(9.5);
  });
  it("devuelve null para celdas vacías o pendientes", () => {
    expect(parseGrade("—")).toBeNull();
    expect(parseGrade("")).toBeNull();
    expect(parseGrade("pendiente")).toBeNull();
    expect(parseGrade("250")).toBeNull();
  });
});

describe("parseSpanishDate", () => {
  it("entiende los formatos de la bóveda", () => {
    expect(parseSpanishDate("**Lunes 12 Oct**", { today })).toBe("2026-10-12");
    expect(parseSpanishDate("Mar 1 Dic", { today })).toBe("2026-12-01");
    expect(parseSpanishDate("12 de octubre de 2026", { today })).toBe("2026-10-12");
    expect(parseSpanishDate("Parcial 1: 30% (7 sep)", { today })).toBe("2026-09-07");
    expect(parseSpanishDate("2026-10-14", { today })).toBe("2026-10-14");
  });
  it("usa el año más cercano a hoy y respeta pistas de año", () => {
    expect(parseSpanishDate("15 ene", { today })).toBe("2027-01-15");
    expect(parseSpanishDate("15 ene", { today, yearHint: 2026 })).toBe("2026-01-15");
  });
  it("acepta un día suelto si se da el mes", () => {
    expect(parseSpanishDate("Estadística 20", { today, monthHint: 10 })).toBe("2026-10-20");
  });
  it("no confunde palabras con meses", () => {
    expect(parseSpanishDate("3 marcas nuevas", { today })).toBeNull();
    expect(parseSpanishDate("31 feb", { today })).toBeNull();
  });
});

describe("parseTime / parseSchedule", () => {
  it("convierte horas con am/pm y 24 h", () => {
    expect(parseTime("Examen (10:30 AM)")).toBe("10:30");
    expect(parseTime("4:00pm")).toBe("16:00");
    expect(parseTime("12pm")).toBe("12:00");
    expect(parseTime("a las 7:05")).toBe("07:05");
    expect(parseTime("sin hora")).toBeNull();
  });
  it("empareja días y horas del horario de clase", () => {
    const fintech = parseSchedule("Jue/Vie 8:30am / 12pm");
    expect(fintech.get(4)).toBe("08:30");
    expect(fintech.get(5)).toBe("12:00");
    const fincorp = parseSchedule("Lun/Jue 10:30am");
    expect(fincorp.get(1)).toBe("10:30");
    expect(fincorp.get(4)).toBe("10:30");
    expect(parseSchedule("Mié 4:00pm").get(3)).toBe("16:00");
    expect(parseSchedule("Sáb").get(6)).toBeNull();
    expect(parseSchedule(null).size).toBe(0);
  });
});

describe("fechas civiles", () => {
  it("calcula días y día de la semana sin zona horaria", () => {
    expect(diffDays("2026-10-14", "2026-10-23")).toBe(9);
    expect(diffDays("2026-10-14", "2026-10-12")).toBe(-2);
    expect(weekdayOf("2026-10-14")).toBe(3);
  });
});

describe("nombres de materia", () => {
  it("separa base, alias y claves", () => {
    expect(splitSubjectName("7. Finanzas Tecnológicas / Fintech (FIN506 / 2586)")).toEqual({ base: "Finanzas Tecnológicas", aliases: ["Fintech"], codes: ["FIN506", "2586"] });
    expect(splitSubjectName("Finanzas Tecnológicas (Fintech)")).toEqual({ base: "Finanzas Tecnológicas", aliases: ["Fintech"], codes: [] });
  });
  it("empareja abreviaturas de la base con la bóveda", () => {
    expect(nameSimilarity("Análisis y Proc. de Info", "Análisis y Procesamiento de la Información")).toBe(1);
    expect(nameSimilarity("Intro al Cristianismo", "Introducción al Cristianismo")).toBe(1);
    expect(nameSimilarity("Análisis de Inversiones", "Análisis de Inversiones BBVA")).toBe(1);
    expect(nameSimilarity("A&P", "Análisis y Procesamiento")).toBe(1);
    expect(nameSimilarity("Macro", "Macroeconomía")).toBe(1);
  });
  it("no confunde materias parecidas", () => {
    expect(nameSimilarity("Análisis Financiero", "Análisis de Inversiones")).toBeLessThan(0.75);
    expect(nameSimilarity("Prob. y Estadística", "Estadística Inferencial")).toBeLessThan(0.75);
    expect(nameSimilarity("Finanzas Corporativas", "Finanzas Tecnológicas")).toBeLessThan(0.75);
  });
  it("encuentra palabras distintivas y menciones completas", () => {
    const tokens = distinctiveTokens(["Derivados Financieros"], [["Finanzas Corporativas"], ["Análisis de Inversiones"]]);
    expect(tokens).toEqual(["derivados"]);
    expect(mentionsAny("Repasar **Derivados** hoy", tokens)).toBe(true);
    expect(mentionsAny("derivadosx", tokens)).toBe(false);
    expect(mentionsAny("Examen de A&P el jueves", ["A&P"])).toBe(true);
  });
});
