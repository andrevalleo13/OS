import { describe, expect, it } from "vitest";
import { createLinkResolver, foldText, parseNote, rewriteWikiLinks, splitLinkInner } from "./parse";

describe("parseNote", () => {
  const note = `---
tipo: persona
tags: [entidad, persona]
aliases:
  - Regina Lugo
personas:
  - "[[Pau]]"
---
# Lore de Lugo

Amiga de [[Pau]] y [[Ren Saron|Ren]]. Ver ![[foto.png|300]] y [[Cord#Pricing]].
#social #trio/core

\`\`\`dataview
TABLE relacion FROM "[[NoEsEnlace]]"
\`\`\`
Inline \`[[TampocoEsEnlace]]\`.
- [x] hecho
- [ ] pendiente
## Memoria de Shadow`;

  const parsed = parseNote(note);

  it("lee frontmatter, aliases y tags", () => {
    expect(parsed.frontmatter.tipo).toBe("persona");
    expect(parsed.aliases).toEqual(["Regina Lugo"]);
    expect(parsed.tags).toEqual(expect.arrayContaining(["entidad", "persona", "social", "trio/core"]));
  });

  it("encuentra enlaces del cuerpo y del frontmatter, sin los de código", () => {
    const targets = parsed.links.map((link) => link.target);
    expect(targets).toEqual(expect.arrayContaining(["Pau", "Ren Saron", "foto.png", "Cord"]));
    expect(targets).not.toContain("NoEsEnlace");
    expect(targets).not.toContain("TampocoEsEnlace");
    expect(parsed.links.find((link) => link.target === "foto.png")?.embed).toBe(true);
    expect(parsed.links.find((link) => link.target === "Cord")?.subpath).toBe("Pricing");
  });

  it("cuenta encabezados y tareas", () => {
    expect(parsed.headings.map((heading) => heading.text)).toEqual(["Lore de Lugo", "Memoria de Shadow"]);
    expect(parsed.tasks).toEqual({ done: 1, total: 2 });
  });
});

describe("splitLinkInner", () => {
  it("separa destino, subruta y alias", () => {
    expect(splitLinkInner("Nota#Sección|texto")).toEqual({ target: "Nota", subpath: "Sección", alias: "texto" });
    expect(splitLinkInner("#^bloque")).toEqual({ target: "", subpath: "^bloque", alias: undefined });
  });
});

describe("createLinkResolver", () => {
  const resolve = createLinkResolver(
    ["500 - Entidades/Personas/Diego.md", "500 - Entidades/Personas/Diego (Primo Mamá).md", "100 - Proyectos/Cord.md", "Diario/2026-10-12.md", "assets/foto.png", "Otra/Cord.md"],
    new Map([["regina lugo", "500 - Entidades/Personas/Lugo.md"]]),
  );

  it("resuelve por nombre, sin importar mayúsculas", () => {
    expect(resolve("diego")).toBe("500 - Entidades/Personas/Diego.md");
    expect(resolve("2026-10-12")).toBe("Diario/2026-10-12.md");
    expect(resolve("foto.png")).toBe("assets/foto.png");
  });

  it("prefiere la misma carpeta y luego la ruta más corta", () => {
    expect(resolve("Cord", "Otra/Algo.md")).toBe("Otra/Cord.md");
    expect(resolve("100 - Proyectos/Cord")).toBe("100 - Proyectos/Cord.md");
  });

  it("usa aliases y devuelve null si no existe", () => {
    expect(resolve("Regina Lugo")).toBe("500 - Entidades/Personas/Lugo.md");
    expect(resolve("No existe")).toBeNull();
  });
});

describe("rewriteWikiLinks", () => {
  it("reescribe enlaces fuera de código", () => {
    const text = "Ver [[Vieja]] y [[Vieja#H|alias]].\n```\n[[Vieja]]\n```\n`[[Vieja]]`";
    const result = rewriteWikiLinks(text, (link) => link.target === "Vieja" ? `[[Nueva${link.subpath ? `#${link.subpath}` : ""}${link.alias ? `|${link.alias}` : ""}]]` : null);
    expect(result.changed).toBe(2);
    expect(result.text).toBe("Ver [[Nueva]] y [[Nueva#H|alias]].\n```\n[[Vieja]]\n```\n`[[Vieja]]`");
  });
});

describe("foldText", () => {
  it("quita acentos sin cambiar la longitud", () => {
    const value = "Mamá Ñoño";
    expect(foldText(value)).toBe("mama nono");
    expect(foldText(value)).toHaveLength(value.length);
  });
});
