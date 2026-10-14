import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import {
  MATH_MARK,
  calloutKind,
  embedKind,
  extractSection,
  findSubpathLine,
  headingSlug,
  parseEmbedSize,
  parseEmbedSrc,
  parseTagHref,
  parseWikilinkHref,
  prepareMarkdown,
  previewExcerpt,
  remarkObsidian,
  stripFrontmatter,
  toggleTaskLine,
  transformObsidianMarkdown,
  vaultFileUrl,
  wikilinkHref,
} from "./markdown";

const lines = (text: string) => text.split("\n").length;
const t = transformObsidianMarkdown;

function html(markdown: string): string {
  return renderToStaticMarkup(
    createElement(
      Markdown,
      {
        remarkPlugins: [remarkGfm, remarkObsidian],
        urlTransform: (url: string) => (/^(wikilink|embed|tag):/.test(url) ? url : defaultUrlTransform(url)),
      },
      t(markdown),
    ),
  );
}

describe("transformObsidianMarkdown: wikilinks y embeds", () => {
  it("convierte wikilinks con alias, encabezado y bloque", () => {
    expect(t("Ver [[Nota]] y [[Carpeta/Otra|alias]].")).toBe("Ver [Nota](wikilink:Nota) y [alias](wikilink:Carpeta%2FOtra).");
    expect(t("[[Nota#Estado Operativo]]")).toBe(`[Nota > Estado Operativo](${wikilinkHref("Nota", "Estado Operativo")})`);
    expect(t("[[#Sección]]")).toBe(`[Sección](${wikilinkHref("", "Sección")})`);
    expect(t("[[Nota#^abc123|ver]]")).toBe(`[ver](${wikilinkHref("Nota", "^abc123")})`);
  });

  it("codifica paréntesis y escapa el texto del enlace", () => {
    const out = t("[[Diego (Primo Mamá)]] [[Nota|a *b* [c]]]");
    expect(out).toContain("(wikilink:Diego%20%28Primo%20Mam%C3%A1%29)");
    expect(parseWikilinkHref("wikilink:Diego%20%28Primo%20Mam%C3%A1%29")).toEqual({ target: "Diego (Primo Mamá)" });
    expect(parseWikilinkHref(wikilinkHref("Nota", "H1#H2"))).toEqual({ target: "Nota", subpath: "H1#H2" });
    expect(parseWikilinkHref("https://x.com")).toBeNull();
  });

  it("acepta la barra escapada en tablas", () => {
    expect(t("| [[Nota\\|Alias]] | x |")).toBe("| [Alias](wikilink:Nota) | x |");
  });

  it("convierte embeds en imágenes con esquema embed:", () => {
    const out = t("![[foto.png|300x200]] y ![[Nota#Encabezado]]");
    const sources = Array.from(out.matchAll(/!\[\]\((embed:[^)]+)\)/g), (match) => parseEmbedSrc(match[1]));
    expect(sources).toEqual([
      { target: "foto.png", subpath: undefined, alias: "300x200" },
      { target: "Nota", subpath: "Encabezado", alias: undefined },
    ]);
  });

  it("deja intacto lo que está en código", () => {
    const source = "`[[no]] #no ==no==` y [[si]]\n```\n[[no]] #no %%no%%\n```\n~~~js\n#no\n~~~";
    const out = t(source);
    expect(out).toContain("`[[no]] #no ==no==`");
    expect(out).toContain("[si](wikilink:si)");
    expect(out.split("\n").slice(1).join("\n")).toBe("```\n[[no]] #no %%no%%\n```\n~~~js\n#no\n~~~");
  });

  it("respeta bloques de código dentro de callouts", () => {
    expect(t("> [!example]\n> ```js\n> const tag = '#no';\n> ```\n> #si")).toBe("> [!example]\n> ```js\n> const tag = '#no';\n> ```\n> [#si](tag:si)");
  });

  it("no rompe wikilinks anidados por un auto-enlazador", () => {
    expect(t("[[Rubio (Emilio [[UP]])]]")).toBe("[[Rubio (Emilio [UP](wikilink:UP))]]");
  });
});

describe("transformObsidianMarkdown: tags", () => {
  it("convierte tags en enlaces tag:", () => {
    expect(t("Hola #proyecto/activo y (#otro), #último")).toBe("Hola [#proyecto/activo](tag:proyecto%2Factivo) y ([#otro](tag:otro)), [#último](tag:%C3%BAltimo)");
    expect(parseTagHref("tag:proyecto%2Factivo")).toBe("proyecto/activo");
  });

  it("ignora encabezados, números, URLs, anclas y palabras con #", () => {
    expect(t("# Título")).toBe("# Título");
    expect(t("## Sub #tag")).toBe("## Sub [#tag](tag:tag)");
    expect(t("#123 C# https://x.com/#frag [a](#ancla) <https://y.com/#b>")).toBe("#123 C# https://x.com/#frag [a](#ancla) <https://y.com/#b>");
    expect(t("`code`#pegado")).toBe("`code`#pegado");
    expect(t("\\#escapado")).toBe("\\#escapado");
  });
});

describe("transformObsidianMarkdown: comentarios, matemáticas y block ids", () => {
  it("oculta comentarios en línea y multilínea sin cambiar el número de líneas", () => {
    const source = "a %%oculto%% b\nc %%empieza\nmedio [[x]]\ntermina%% d\ne";
    const out = t(source);
    expect(out).toBe("a  b\nc \n\n d\ne");
    expect(lines(out)).toBe(lines(source));
  });

  it("un comentario puede contener cercas de código", () => {
    const out = t("%%\n```\ncodigo\n```\n%%\n#tag");
    expect(out).toBe("\n\n\n\n\n[#tag](tag:tag)");
  });

  it("matemáticas en línea y en bloque", () => {
    expect(t("Area $x^2 + y$ fin")).toBe(`Area \`${MATH_MARK}$x^2 + y$\` fin`);
    expect(t("$$\n\\frac{a}{b}\n$$")).toBe("```math\n\\frac{a}{b}\n```");
    expect(t("$$E = mc^2$$")).toBe(`\`${MATH_MARK}$$E = mc^2$$\``);
  });

  it("no confunde precios con matemáticas", () => {
    const money = "Ticket $30,000 MXN — $10,000 cobrado; $1,000 Andre / $500 socio. Costo = $0.";
    expect(t(money)).toBe(money);
    expect(t("| [[Casa10]] | $30,000 MXN | Pendiente |")).toBe("| [Casa10](wikilink:Casa10) | $30,000 MXN | Pendiente |");
  });

  it("quita los block ids", () => {
    expect(t("Un párrafo ^abc-1\n^solo\n- item ^x")).toBe("Un párrafo\n\n- item");
  });

  it("conserva el número de líneas en un documento mixto", () => {
    const source = [
      "# HQ", "", "> [!info] Título", "> cuerpo %%c", "sigue%% [[x]]", "", "```dataview", "TABLE x", "```", "", "$$", "a", "$$", "- [ ] tarea #t ^id",
    ].join("\n");
    expect(lines(t(source))).toBe(lines(source));
  });
});

describe("prepareMarkdown", () => {
  it("quita el frontmatter y reporta el desplazamiento", () => {
    const prepared = prepareMarkdown("---\ntipo: proyecto\ntags: [a, b]\n---\n# Hola\n[[x]]");
    expect(prepared.lineOffset).toBe(4);
    expect(prepared.frontmatter).toEqual({ tipo: "proyecto", tags: ["a", "b"] });
    expect(prepared.frontmatterRaw).toBe("tipo: proyecto\ntags: [a, b]");
    expect(prepared.markdown).toBe("# Hola\n[x](wikilink:x)");
  });

  it("sin frontmatter el desplazamiento es 0", () => {
    const prepared = prepareMarkdown("Hola\r\nmundo");
    expect(prepared.lineOffset).toBe(0);
    expect(prepared.markdown).toBe("Hola\nmundo");
  });
});

describe("utilidades de líneas", () => {
  const note = "---\na: 1\n---\n# Uno\ntexto\n- [ ] tarea\n  - [x] hecha\n> - [/] en cita\n1. [ ] ordenada\n## Dos\nmás ^blk\n### Tres\nfin\n# Cuatro";

  it("toggleTaskLine alterna solo esa línea", () => {
    expect(toggleTaskLine(note, 5)?.split("\n")[5]).toBe("- [x] tarea");
    expect(toggleTaskLine(note, 6)?.split("\n")[6]).toBe("  - [ ] hecha");
    expect(toggleTaskLine(note, 7)?.split("\n")[7]).toBe("> - [ ] en cita");
    expect(toggleTaskLine(note, 8)?.split("\n")[8]).toBe("1. [x] ordenada");
    expect(toggleTaskLine(note, 4)).toBeNull();
    expect(toggleTaskLine(note, 99)).toBeNull();
    expect(toggleTaskLine(note, 5)?.split("\n").length).toBe(note.split("\n").length);
  });

  it("findSubpathLine encuentra encabezados y bloques", () => {
    expect(findSubpathLine(note, "Dos")).toBe(9);
    expect(findSubpathLine(note, "dos")).toBe(9);
    expect(findSubpathLine(note, "Dos#Tres")).toBe(11);
    expect(findSubpathLine(note, "^blk")).toBe(10);
    expect(findSubpathLine(note, "Nada")).toBeNull();
    expect(findSubpathLine("## 🚀 Estado Operativo", "Estado Operativo")).toBe(0);
  });

  it("extractSection corta en el siguiente encabezado de igual o mayor nivel", () => {
    expect(extractSection(note, "Dos")).toEqual({ text: "## Dos\nmás ^blk\n### Tres\nfin", startLine: 9 });
    expect(extractSection(note, "Tres")).toEqual({ text: "### Tres\nfin", startLine: 11 });
    expect(extractSection(note, "^blk")).toEqual({ text: "más ^blk", startLine: 10 });
    expect(extractSection("párrafo\nlargo\n^id\n\notro", "^id")).toEqual({ text: "párrafo\nlargo", startLine: 0 });
    expect(extractSection(note, "Nada")).toBeNull();
  });

  it("headingSlug, stripFrontmatter y previewExcerpt", () => {
    expect(headingSlug("🚀 Estado Operativo!")).toBe("estado-operativo");
    expect(stripFrontmatter(note)).toMatchObject({ startLine: 3 });
    expect(previewExcerpt("---\na: 1\n---\nuno\n```\ncódigo\nmás", 5)).toBe("uno\n```\ncódigo\nmás\n```");
  });
});

describe("otras utilidades", () => {
  it("calloutKind resuelve alias y cae en note", () => {
    expect(calloutKind("TIP")).toBe("tip");
    expect(calloutKind("important")).toBe("tip");
    expect(calloutKind("caution")).toBe("warning");
    expect(calloutKind("cite")).toBe("quote");
    expect(calloutKind("tldr")).toBe("abstract");
    expect(calloutKind("error")).toBe("danger");
    expect(calloutKind("raro")).toBe("note");
  });

  it("embedKind, parseEmbedSize y vaultFileUrl", () => {
    expect(embedKind("a/b.PNG")).toBe("image");
    expect(embedKind("Nota")).toBe("note");
    expect(embedKind("x.md")).toBe("note");
    expect(embedKind("x.excalidraw.md")).toBe("excalidraw");
    expect(embedKind("Diario.base")).toBe("base");
    expect(embedKind("Sin título.canvas")).toBe("canvas");
    expect(embedKind("a.pdf")).toBe("pdf");
    expect(embedKind("a.m4a")).toBe("audio");
    expect(embedKind("a.mov")).toBe("video");
    expect(embedKind("a.zip")).toBe("file");
    expect(parseEmbedSize("300")).toEqual({ width: 300, height: undefined });
    expect(parseEmbedSize("300x200")).toEqual({ width: 300, height: 200 });
    expect(parseEmbedSize("alias")).toBeNull();
    expect(vaultFileUrl("A b/c.png")).toBe("/api/vault/file?path=A%20b%2Fc.png");
  });
});

describe("remarkObsidian (render completo)", () => {
  it("callouts con tipo, plegado, título y cuerpo", () => {
    const out = html("> [!warning]- **Ojo** con [[Esto]]\n> Cuerpo ==clave==\n>\n> Otro párrafo");
    expect(out).toContain('data-callout="warning"');
    expect(out).toContain('data-callout-type="warning"');
    expect(out).toContain('data-callout-fold="-"');
    expect(out).toMatch(/<div data-callout-title="">.*<strong>Ojo<\/strong> con <a href="wikilink:Esto">Esto<\/a><\/div>/);
    expect(out).toContain("<p>Cuerpo <mark>clave</mark></p>");
    expect(out).toContain("<p>Otro párrafo</p>");
    expect(out).not.toContain("<blockquote");
  });

  it("callout sin título usa el tipo; blockquote normal sigue igual", () => {
    expect(html("> [!TIP]\n> texto")).toMatch(/data-callout="tip".*<div data-callout-title="">Tip<\/div>/);
    expect(html("> cita normal")).toContain("<blockquote>");
  });

  it("tareas con estados extra", () => {
    const out = html("- [ ] abierta\n- [x] hecha\n- [/] en curso\n- [-] cancelada\n- normal");
    expect(out.match(/type="checkbox"/g)).toHaveLength(4);
    expect(out).toContain('data-task=" "');
    expect(out).toContain('data-task="x"');
    expect(out).toContain('data-task="/"');
    expect(out).toContain('data-task="-"');
    expect(out).toContain("en curso");
    expect(out).not.toContain("[/]");
  });

  it("resaltado que abarca formato y saltos de línea simples", () => {
    expect(html("a ==b **c** d== e")).toContain("<p>a <mark>b <strong>c</strong> d</mark> e</p>");
    expect(html("uno\ndos")).toMatch(/<p>uno<br\/>\s*dos<\/p>/);
    expect(html("sin ==cierre")).toContain("<p>sin ==cierre</p>");
    expect(html("`==no==`")).toContain("<code>==no==</code>");
  });

  it("<br> y comentarios HTML", () => {
    expect(html("| a<br>b |\n|---|\n| c |")).toMatch(/a<br\/>\s*b/);
    expect(html("x <!-- oculto --> y")).not.toContain("oculto");
  });

  it("tags y wikilinks llegan como enlaces", () => {
    const out = html("Ver [[Nota|esto]] #tag");
    expect(out).toContain('<a href="wikilink:Nota">esto</a>');
    expect(out).toContain('<a href="tag:tag">#tag</a>');
  });
});
