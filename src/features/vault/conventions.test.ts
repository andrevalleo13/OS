import { describe, expect, it } from "vitest";
import {
  appendUnderHeading,
  cleanEntityName,
  datedBullet,
  existingHeading,
  factKey,
  findSections,
  flattenNestedLinks,
  headingKey,
  noteProblems,
  shortFact,
  snippetProblems,
} from "./conventions";

describe("encabezados", () => {
  it("compara sin emojis, acentos ni corchetes", () => {
    expect(headingKey("Memoria de [[Shadow]]")).toBe(headingKey("Memoria de Shadow"));
    expect(headingKey("🔗 Conexiones")).toBe(headingKey("Conexiones"));
    expect(headingKey("⚡ Qué pasó")).toBe(headingKey("Que paso"));
  });

  it("acepta un prefijo único e ignora encabezados dentro de código", () => {
    const note = "# Día\n\n```md\n## Trabajo falso\n```\n\n## 🚀 Trabajo / [[Cord]]\n- \n";
    expect(findSections(note, "Trabajo")).toHaveLength(0);
    expect(existingHeading(note, "Trabajo")).toBe("🚀 Trabajo / [[Cord]]");
  });
});

describe("appendUnderHeading", () => {
  it("escribe al final de la última sección y quita bullets vacíos", () => {
    const note = "## Memoria de [[Shadow]]\n- a\n\n## Memoria de [[Shadow]]\n- b\n- \n\n## Otra\n- c\n";
    expect(appendUnderHeading(note, "Memoria de Shadow", "- nuevo", { which: "last" }))
      .toBe("## Memoria de [[Shadow]]\n- a\n\n## Memoria de [[Shadow]]\n- b\n- nuevo\n\n## Otra\n- c\n");
  });

  it("crea la sección antes de la memoria cuando no existe", () => {
    const note = "# Pau\n## Memoria de Shadow\n- x\n";
    expect(appendUnderHeading(note, "🔗 Conexiones", "- [[Isa]]", { before: "Memoria de Shadow" }))
      .toBe("# Pau\n\n## 🔗 Conexiones\n- [[Isa]]\n\n## Memoria de Shadow\n- x\n");
  });
});

describe("enlaces y hechos", () => {
  it("aplana enlaces anidados y limpia nombres del modelo", () => {
    expect(flattenNestedLinks("Con [[Jerry ([[UP]])]] y [[Cord]]")).toBe("Con [[Jerry (UP)]] y [[Cord]]");
    expect(cleanEntityName("[[Jerry ([[UP]])]]")).toBe("Jerry (UP)");
    expect(cleanEntityName("[[Cord|el proyecto]]")).toBe("Cord");
    expect(cleanEntityName("Sofi.md")).toBe("Sofi");
  });

  it("deduplica sin fecha ni enlace al diario", () => {
    expect(factKey("- **[2026-09-01]** Va al [[CUM]]. ([[2026-09-01|diario]])")).toBe(factKey("Va al CUM."));
    expect(datedBullet("2026-10-14", "Hecho\nen dos líneas", "2026-10-14")).toBe("- **[2026-10-14]** Hecho en dos líneas ([[2026-10-14|diario]])");
  });

  it("recorta sin partir un enlace", () => {
    const fact = `${"palabra ".repeat(12)}[[Una Nota Muy Larga Con Nombre]] y más texto al final`;
    const short = shortFact(fact, 110);
    expect(short.endsWith("…")).toBe(true);
    expect(short.split("[[").length).toBe(short.split("]]").length);
  });
});

describe("validación", () => {
  it("rechaza enlaces anidados y enlaces en código", () => {
    expect(snippetProblems("- [[Jerry ([[UP]])]]")).toHaveLength(1);
    expect(snippetProblems("Usa `[[Diario]]/fecha`")).toHaveLength(1);
    expect(snippetProblems("```\n[[Nota]]\n```")).toHaveLength(1);
    expect(snippetProblems("- **[2026-10-14]** Vio a [[Pau]].")).toEqual([]);
  });

  it("exige frontmatter en español y sin enlaces en tags o tipo", () => {
    const bad = "---\ntitle: Marco\ntipo: [[Persona]]\ntags: [entidad, [[Cord]]]\n---\n# Marco\n";
    const problems = noteProblems(bad, { entity: true }).join(" ");
    expect(problems).toContain("`title`");
    expect(problems).toContain("`tags` no puede llevar enlaces");
    expect(problems).toContain("`tipo` no puede llevar enlaces");
    expect(noteProblems("# Marco\n", { entity: true })).toHaveLength(1);
    expect(noteProblems("---\ntipo: persona\ntags: [entidad, persona]\n---\n# Marco\n## Memoria de Shadow\n- x\n## Memoria de [[Shadow]]\n", { entity: true }))
      .toEqual(["Solo puede haber una sección `## Memoria de Shadow` por nota."]);
    expect(noteProblems("---\ntipo: persona\ntags: [entidad, persona]\nestado: activo\n---\n# Marco\n", { entity: true })).toEqual([]);
  });
});
