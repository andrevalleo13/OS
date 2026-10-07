import { describe, expect, it } from "vitest";
import { mergeSources, sourceFromToolUse, sourcesFromRoute } from "./sources";

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
