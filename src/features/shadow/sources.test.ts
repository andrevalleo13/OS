import { describe, expect, it } from "vitest";
import { contextStepLabel, mergeSources, sourceFromToolUse, sourcesFromRoute, toolStepLabel } from "./sources";

describe("shadow sources", () => {
  it("describe dominios y memoria consultados", () => {
    const sources = sourcesFromRoute({ domains: ["finance", "calendar"], needsObsidian: true });
    expect(sources.map((source) => source.label)).toEqual(["Finanzas", "Calendario", "Memoria personal"]);
  });

  it("nunca expone el mantenimiento silencioso de memoria", () => {
    expect(sourceFromToolUse("remember_personal_context", { fact: "x" })).toBeNull();
  });

  it("usa el título de la nota y el host de la web", () => {
    expect(sourceFromToolUse("read_obsidian_note", { filename: "200 - Personas/Mamá.md" })?.label).toBe("Mamá");
    const web = sourceFromToolUse("read_url", { url: "https://www.example.com/a" });
    expect(web).toMatchObject({ kind: "web", label: "example.com", url: "https://www.example.com/a" });
  });

  it("descarta URLs que no son http", () => {
    expect(sourceFromToolUse("read_url", { url: "javascript:alert(1)" })).toBeNull();
  });

  it("deduplica y limita", () => {
    const many = Array.from({ length: 12 }, (_, index) => ({ id: `a${index}`, kind: "action" as const, label: `${index}` }));
    const merged = mergeSources([many[0]], many);
    expect(merged).toHaveLength(8);
    expect(merged[0].id).toBe("a0");
    expect(merged.filter((source) => source.id === "a0")).toHaveLength(1);
  });
});

describe("shadow step labels", () => {
  it("describe pasos reales y calla la memoria silenciosa", () => {
    expect(toolStepLabel("read_obsidian_note", { filename: "Personas/Diego.md" })).toBe("Leyendo Diego");
    expect(toolStepLabel("search_web", { query: "clima" })).toBe("Buscando en la web: “clima”");
    expect(toolStepLabel("add_expense", { amount: 1 })).toBe("Registrando gasto");
    expect(toolStepLabel("remember_personal_context", {})).toBeNull();
    expect(toolStepLabel("algo_nuevo", {})).toBe("Usando herramientas");
  });

  it("nombra el contexto que se carga", () => {
    expect(contextStepLabel({ domains: ["finance"], needsObsidian: true })).toBe("Leyendo tu contexto: Finanzas, memoria personal");
    expect(contextStepLabel({ domains: [], needsObsidian: false })).toBe("Leyendo tu contexto");
  });
});
