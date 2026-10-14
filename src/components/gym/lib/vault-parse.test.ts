import { describe, expect, it } from "vitest";
import { inferMuscleId } from "./muscles";
import { cleanInline, labeled, parseNumber, splitList } from "./text";
import {
  completeWeek,
  extractLiftMentions,
  extractMemory,
  isDailyNote,
  isGymNote,
  kindOf,
  matchExercise,
  parseBodySection,
  parseDaily,
  parseDefaultSets,
  parseFicha,
  parseGymFlag,
  parseMetricBullets,
  parseProtocol,
  parseRoutine,
  parseSchedule,
  parseWeeklyTarget,
  pickPartnerLine,
  splitNameFocus,
} from "./vault-parse";

const HEADING_ROUTINE = `# Protocolo Híbrido — 70 kg

**Métricas Iniciales:**
- **Peso:** 62 kg
- **Estatura:** 1.75 m
- **Objetivo:** 70 kg (Hipertrofia + Fútbol)

## Bases del Protocolo
- **Nutrición:** 2,850 kcal diarias.
- **Intensidad de Fuerza:** 2 series al fallo absoluto por ejercicio.

## Rutina Semanal

### Lunes: Upper (Énfasis Pecho / Hombro)
- Press inclinado con mancuernas
- Peck deck (Flyes)
- Curl predicador

### Miércoles: Rendimiento en casa (Agilidad y Potencia)
- 3 series de pliometría:
  - Saltos de patinador
  - Saltos verticales
- 15 minutos de agilidad con balón

### Sábado: Descanso Activo
- Solo cumplir pasos (10k).

### Domingo: Gameday
- Partido de fútbol.
`;

const BULLET_ROUTINE = `## Protocolo de Entrenamiento
- **Intensidad:** 2 series por ejercicio, al fallo.
- **Split Base (Upper/Lower):**
  - **Lunes (Upper - Pecho):** Press inclinado con mancuernas, Peck deck, Face pull (hombro posterior, articulaciones).
  - **Martes (Lower - Sentadilla):** Sentadilla, Prensa, Leg curl.
`;

describe("text helpers", () => {
  it("cleans nested wikilinks, bold and code", () => {
    expect(cleanInline("Pick [[UP]] a [[Vida Social#[[Diego]]|Diego]] -> **gym** `x`")).toBe("Pick UP a Diego -> gym x");
    expect(cleanInline("[[Universidad ([[UP]])]]")).toBe("Universidad (UP)");
  });

  it("parses labeled bullets and lists", () => {
    expect(labeled("**Gym:** Sí (empuje)")).toEqual({ label: "Gym", text: "Sí (empuje)" });
    expect(labeled("**Rutina**: 5am")).toEqual({ label: "Rutina", text: "5am" });
    expect(splitList("A, B (x, y), C.")).toEqual(["A", "B (x, y)", "C"]);
  });

  it("reads numbers defensively", () => {
    expect(parseNumber(7)).toBe(7);
    expect(parseNumber("~7,5 h")).toBe(7.5);
    expect(parseNumber("_/10_")).toBeNull();
    expect(parseNumber(null)).toBeNull();
  });
});

describe("routine parsing", () => {
  it("reads heading-style splits", () => {
    const days = parseRoutine(HEADING_ROUTINE);
    expect(days.map((day) => [day.weekday, day.name, day.kind])).toEqual([
      [0, "Gameday", "partido"],
      [1, "Upper", "fuerza"],
      [3, "Rendimiento en casa", "rendimiento"],
      [6, "Descanso Activo", "descanso"],
    ]);
    const monday = days.find((day) => day.weekday === 1)!;
    expect(monday.focus).toBe("Énfasis Pecho / Hombro");
    expect(monday.exercises.map((item) => [item.name, item.muscleId])).toEqual([
      ["Press inclinado con mancuernas", "chest"],
      ["Peck deck (Flyes)", "chest"],
      ["Curl predicador", "biceps"],
    ]);
    const wednesday = days.find((day) => day.weekday === 3)!;
    expect(wednesday.notes).toEqual(["3 series de pliometría"]);
    expect(wednesday.exercises.map((item) => item.name)).toEqual(["Saltos de patinador", "Saltos verticales", "15 minutos de agilidad con balón"]);
    expect(days.find((day) => day.weekday === 6)!.exercises).toEqual([]);
  });

  it("falls back to bullet-style splits", () => {
    const days = parseRoutine(BULLET_ROUTINE);
    expect(days.map((day) => [day.day, day.name, day.focus])).toEqual([
      ["Lunes", "Upper", "Pecho"],
      ["Martes", "Lower", "Sentadilla"],
    ]);
    expect(days[0].exercises.map((item) => item.name)).toEqual(["Press inclinado con mancuernas", "Peck deck", "Face pull (hombro posterior, articulaciones)"]);
  });

  it("completes the week with rest days", () => {
    const week = completeWeek(parseRoutine(BULLET_ROUTINE));
    expect(week).toHaveLength(7);
    expect(week[3]).toMatchObject({ day: "Miércoles", kind: "descanso", exercises: [] });
  });

  it("classifies days and splits names", () => {
    expect(kindOf("Lower", "Énfasis Cadena Posterior")).toBe("fuerza");
    expect(kindOf("Descanso Activo", null)).toBe("descanso");
    expect(splitNameFocus("Upper - Pecho.")).toEqual({ name: "Upper", focus: "Pecho" });
  });

  it("returns nothing for unrelated notes", () => {
    expect(parseRoutine("## 🌅 Lunes a Viernes (Hustle Mode)\n- **05:00 AM** - Wake up")).toEqual([]);
  });
});

describe("protocol and metrics", () => {
  it("reads protocol rules, sets and targets", () => {
    const protocol = parseProtocol(HEADING_ROUTINE);
    expect(protocol.map((line) => line.label)).toEqual(["Nutrición", "Intensidad de Fuerza"]);
    expect(parseDefaultSets(protocol)).toBe(2);
    expect(parseProtocol(BULLET_ROUTINE).map((line) => line.label)).toEqual(["Intensidad"]);
    expect(parseWeeklyTarget("| 💪 Gym | 4x semana. |")).toBe(4);
    expect(parseWeeklyTarget("Gym: 3 veces por semana")).toBe(3);
    expect(parseWeeklyTarget("sin datos")).toBeNull();
  });

  it("reads metric bullets", () => {
    expect(parseMetricBullets(HEADING_ROUTINE)).toEqual({ startWeight: 62, height: 1.75, goalWeight: 70, goalNote: "Hipertrofia + Fútbol" });
  });

  it("reads the ficha", () => {
    const ficha = parseFicha(`- Mide **1.75 m**, pesa **~63 kg** (complexión delgada).
- Lesión activa: **rodilla**, secuela del [[Club América (Fútbol)]].
- Fuma. Suplemento: **creatina** (proteína en polvo no).`);
    expect(ficha.height).toBe(1.75);
    expect(ficha.refWeight).toBe(63);
    expect(ficha.traits).toEqual([
      { label: "Lesión", value: "rodilla", detail: "secuela del Club América (Fútbol)" },
      { label: "Suplemento", value: "creatina", detail: "(proteína en polvo no)" },
    ]);
  });
});

describe("daily notes", () => {
  const note = (frontmatter: Record<string, unknown>, body = "") => ({
    path: "Diario/2026-10-10.md",
    title: "2026-10-10",
    text: `---\nfecha: 2026-10-10\n---\n${body}`,
    frontmatter,
    tags: [],
    mtime: 0,
  });

  it("interprets the gym field", () => {
    expect(parseGymFlag("sí")).toMatchObject({ flag: "si" });
    expect(parseGymFlag(true)).toMatchObject({ flag: "si" });
    expect(parseGymFlag("no (partido fut)")).toEqual({ flag: "no", detail: "partido fut", other: "Fútbol" });
    expect(parseGymFlag("pendiente")).toMatchObject({ flag: "pendiente" });
    expect(parseGymFlag("_sí/no_")).toMatchObject({ flag: null });
    expect(parseGymFlag(null)).toMatchObject({ flag: null });
  });

  it("skips template placeholders in the body section", () => {
    const body = parseBodySection(`## 🫀 Cuerpo
- **Sueño:** ~_h_ · **Gym:** _sí/no_ · **Ánimo:** _/10_
-
- **Gym:** Sí (empuje al mediodía).

## 👥 Personas
- Nadie`);
    expect(body).toEqual([{ label: "Gym", text: "Sí (empuje al mediodía)." }]);
  });

  it("builds a daily entry and falls back to the body section", () => {
    const entry = parseDaily(note({ peso: 67, sueno_horas: "7", energia: 8, animo: "", gym: null }, "## 🫀 Cuerpo\n- **Gym:** Sí\n\n## ⚡ Qué pasó\n- **Sesión de gimnasio:** fui a entrenar"))!;
    expect(entry).toMatchObject({ key: "2026-10-10", gym: "si", weight: 67, sleep: 7, energy: 8, mood: null });
    expect(entry.body.map((line) => line.label)).toEqual(["Gym", "Sesión de gimnasio"]);
  });

  it("classifies notes by folder and name", () => {
    expect(isDailyNote({ path: "Diario/2026-10-10.md", title: "2026-10-10" })).toBe(true);
    expect(isDailyNote({ path: "Proyectos/2026-10-10.md", title: "2026-10-10" })).toBe(false);
    expect(isGymNote({ path: "200 - Áreas/Salud y Fitness.md", title: "Salud y Fitness", tags: [] })).toBe(true);
    expect(isGymNote({ path: "300 - Recursos/Plantilla Diario.md", title: "Plantilla Diario", tags: ["gym"] })).toBe(false);
  });
});

describe("lifts, memory and partner", () => {
  const source = { path: "Salud.md", title: "Salud" };
  const exercises = ["Press inclinado con mancuernas", "Press inclinado", "Curl predicador", "Extensión de tríceps", "Remo"];

  it("matches free text to routine exercises", () => {
    expect(matchExercise("Levanta las de 60 lbs en press inclinado con mancuernas", exercises)).toBe("Press inclinado con mancuernas");
    expect(matchExercise("Predicador en máquina (Levanta 90lb)", exercises)).toBe("Curl predicador");
    expect(matchExercise("definición de espalda, hombros y tríceps hacia los 70kg", exercises)).toBeNull();
  });

  it("extracts lift mentions with units", () => {
    const mentions = extractLiftMentions([
      { text: "**[2026-08-27]** Ego lift: Press inclinado con mancuernas. Levanta las de 60 lbs.", key: "2026-08-27" },
      { text: "Pesa 63kg", key: null },
    ], exercises, source);
    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toMatchObject({ exercise: "Press inclinado con mancuernas", value: 60, unit: "lb", kg: 27.2, key: "2026-08-27" });
  });

  it("keeps only dated training memories", () => {
    const memory = extractMemory(`- **[2026-09-30]** **Gym frecuencia:** 4 veces por semana.
- **[2026-08-27]** Series de confort: Suits.
- Sin fecha: gym diario.`, source);
    expect(memory).toEqual([{ key: "2026-09-30", text: "Gym frecuencia: 4 veces por semana.", source }]);
  });

  it("picks the partner's gym sentence", () => {
    expect(pickPartnerLine("- **Rutina:** A las 5am paso por él para ir al gym de la [[UP]]. Es socio.")).toBe("A las 5am paso por él para ir al gym de la UP.");
    expect(pickPartnerLine("- **[2026-09-01]** Se unió al gym.\n- **[2026-09-16]** Se fue de viaje. No se le ha visto en el gym.")).toBe("No se le ha visto en el gym.");
    expect(pickPartnerLine("- Va a la escuela.")).toBeNull();
  });

  it("finds the gym schedule", () => {
    expect(parseSchedule("- **5:00 AM** despierta. Pasa por [[Diego]] → gym de la [[UP]].")).toEqual({ time: "5:00 AM", place: "UP" });
    expect(parseSchedule("- Gym sin hora")).toEqual({ time: null, place: null });
  });
});

describe("muscle inference", () => {
  it.each([
    ["Press inclinado con mancuernas", "chest"],
    ["Jalón al pecho", "lats"],
    ["Remo espalda alta", "traps"],
    ["Extensión de cuádriceps", "quads"],
    ["Extensión de tríceps", "triceps"],
    ["Leg curl", "hamstrings"],
    ["Peso Muerto Rumano (RDL)", "hamstrings"],
    ["Peso muerto", "lower_back"],
    ["Face pull", "shoulders"],
    ["Core: Plancha con peso o Press Pallof", "abs"],
    ["Saltos de patinador", null],
  ])("%s → %s", (name, muscle) => {
    expect(inferMuscleId(name)).toBe(muscle);
  });
});
