import { describe, expect, it } from "vitest";
import { chunkMarkdown, normalizeSearchText, scoreSemanticText } from "./knowledge-index";

describe("knowledge index", () => {
  it("divide Markdown conservando encabezados", () => {
    const chunks = chunkMarkdown("# Sofi\nAmiga cercana.\n\n## Proyectos\nConoce Cord.");
    expect(chunks).toHaveLength(2);
    expect(chunks[0]).toMatchObject({ position: 0, heading: "Sofi" });
    expect(chunks[1]).toMatchObject({ position: 1, heading: "Proyectos" });
  });

  it("normaliza acentos y puntúa términos semánticos expandidos", () => {
    const searchable = normalizeSearchText("Sofía participa en el SaaS Cord");
    expect(searchable).toBe("sofia participa en el saas cord");
    expect(scoreSemanticText(searchable, "mi amiga de Cord", ["sofia", "cord", "amistad"])).toBeGreaterThan(2);
  });
});
