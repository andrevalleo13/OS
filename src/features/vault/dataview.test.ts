import { describe, expect, it } from "vitest";
import { createLinkResolver } from "./parse";
import {
  dataviewSourceFromIndex,
  formatDataviewDate,
  runDataviewQuery,
  type DataviewCell,
  type DataviewPage,
  type DataviewSource,
} from "./dataview";

const at = (day: number, hour = 9, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();
const NOW = at(14, 12);

type Fake = Partial<DataviewPage> & { path: string; links?: string[] };

function source(fakes: Fake[]): DataviewSource {
  const resolve = createLinkResolver(fakes.map((fake) => fake.path));
  const pages = fakes.map((fake, index): DataviewPage => ({
    path: fake.path,
    frontmatter: fake.frontmatter ?? {},
    tags: fake.tags ?? [],
    aliases: fake.aliases ?? [],
    mtime: fake.mtime ?? at(1, index),
    ctime: fake.ctime ?? at(1, 0),
    size: fake.size ?? 100,
    text: fake.text,
    outlinks: (fake.links ?? []).map((target) => {
      const resolved = resolve(target, fake.path);
      return { path: resolved ?? target, resolved: Boolean(resolved) };
    }),
  }));
  return { pages, resolve };
}

const vault = source([
  { path: "000 - HQ.md", frontmatter: { tipo: "moc" }, tags: ["hq"], links: ["Cord", "Diego", "Casa10"] },
  {
    path: "100 - Proyectos/Cord.md",
    frontmatter: { tipo: "proyecto", estado: "activo", tags: ["proyecto", [["SaaS"]], "cord", "flouvia"], ticket: "5000 MXN" },
    tags: ["proyecto", "SaaS", "cord", "flouvia"],
    mtime: at(13),
    links: ["Flouvia", "Diego"],
  },
  {
    path: "100 - Proyectos/Casa10.md",
    frontmatter: { tipo: "proyecto", estado: "propuesta", area: [["Flouvia"]], tags: ["flouvia", "proyecto"], ticket: "30000 MXN" },
    tags: ["flouvia", "proyecto"],
    mtime: at(12),
    links: ["Flouvia"],
  },
  {
    path: "100 - Proyectos/Masuma.md",
    frontmatter: { tipo: "proyecto", estado: "en_desarrollo", tags: ["proyecto", [["Flouvia"]]] },
    tags: ["proyecto", "Flouvia"],
    mtime: at(11),
    links: ["Flouvia"],
  },
  { path: "100 - Proyectos/Flouvia.md", frontmatter: { status: "active", tags: ["project"] }, tags: ["project"], mtime: at(10) },
  { path: "500 - Entidades/Personas/Diego.md", frontmatter: { tipo: "persona", relacion: "Mejor amigo", tags: ["entidad", "core"] }, tags: ["entidad", "core"] },
  { path: "500 - Entidades/Personas/Diego (Primo Mamá).md", frontmatter: { tipo: "persona", relacion: "Primo de Mamá" }, links: ["Diego"] },
  { path: "500 - Entidades/Personas/Daniel (Papá).md", frontmatter: { tipo: "persona", relacion: "Papá", tags: ["familia"] }, tags: ["familia"] },
  { path: "500 - Entidades/Personas/Thomas.md", frontmatter: { tipo: "persona", relacion: "Primo" }, links: ["Fantasma"] },
  { path: "500 - Entidades/Personas/Pau.md", frontmatter: { Tipo: "persona", relacion: "Amiga [[UP]]" }, links: ["UP"] },
  { path: "500 - Entidades/Grupos/UP.md", frontmatter: { tipo: "grupo" } },
  { path: "500 - Entidades/Conceptos/Sin tipo.md", frontmatter: {} },
  { path: "Diario/2026-10-10.md", mtime: at(10, 22, 5) },
  { path: "Diario/2026-10-11.md", mtime: at(11, 23, 40) },
  { path: "Diario/2026-10-12.md", mtime: at(12, 21, 15) },
  { path: "Diario/000 - Diario (MOC).md", mtime: at(2) },
  {
    path: "Tareas.md",
    text: "# Tareas\n- [ ] Llamar a [[Diego]] #urgente\n- [x] Pagar renta\n- [/] Leer libro\n```\n- [ ] no cuenta\n```\n> - [ ] en cita",
  },
]);

const run = (query: string, from = "000 - HQ.md") => runDataviewQuery(query, vault, from, { now: NOW });

function names(rows: DataviewCell[][]): string[] {
  return rows.map((row) => (row[0].kind === "link" ? row[0].text : "?"));
}

function text(cell: DataviewCell | undefined): string | null {
  if (!cell) return null;
  if (cell.kind === "empty") return null;
  if (cell.kind === "list") return cell.items.map(text).join(", ");
  return cell.text;
}

describe("dataview: consultas reales de la bóveda", () => {
  it("proyectos activos ordenados por mtime con LIMIT", () => {
    const result = run(`TABLE estado, ticket
FROM "100 - Proyectos"
WHERE estado = "activo" OR estado = "en_progreso" OR tipo = "proyecto"
SORT file.mtime DESC
LIMIT 8`);
    expect(result.error).toBeUndefined();
    expect(result.type).toBe("table");
    expect(result.headers).toEqual(["Archivo", "estado", "ticket"]);
    expect(names(result.rows)).toEqual(["Cord", "Casa10", "Masuma"]);
    expect(result.rows[0].map(text)).toEqual(["Cord", "activo", "5000 MXN"]);
    expect(result.rows[2][2]).toEqual({ kind: "empty" });
  });

  it("contains(file.name, ...) es subcadena sensible a mayúsculas", () => {
    const result = run(`TABLE relacion FROM "500 - Entidades/Personas" WHERE contains(file.name, "Diego") OR contains(file.name, "Pau")`);
    expect(names(result.rows)).toEqual(["Diego (Primo Mamá)", "Diego", "Pau"]);
    expect(run(`TABLE relacion FROM "500 - Entidades/Personas" WHERE contains(file.name, "diego")`).rows).toHaveLength(0);
  });

  it("file.mtime AS \"Fecha\" desde una carpeta, formateado YYYY-MM-DD HH:mm", () => {
    const result = run(`TABLE file.mtime AS "Fecha" FROM "Diario" SORT file.mtime DESC LIMIT 3`);
    expect(result.headers).toEqual(["Archivo", "Fecha"]);
    expect(names(result.rows)).toEqual(["2026-10-12", "2026-10-11", "2026-10-10"]);
    expect(result.rows[0][1]).toEqual({ kind: "date", ms: at(12, 21, 15), text: "2026-10-12 21:15" });
  });

  it("contains(tags, ...) sobre listas del frontmatter y SORT de texto con números", () => {
    const result = run(`TABLE estado, ticket, file.mtime AS "Última actualización" FROM "100 - Proyectos" WHERE contains(tags, "flouvia") SORT ticket DESC`);
    expect(result.headers).toEqual(["Archivo", "estado", "ticket", "Última actualización"]);
    // Masuma tiene [[Flouvia]] (enlace) en sus tags: se compara por nombre.
    expect(names(result.rows)).toEqual(["Casa10", "Cord", "Masuma"]);
  });

  it("length(file.inlinks) y tipo != null, con claves de frontmatter sin distinguir mayúsculas", () => {
    const result = run(`TABLE length(file.inlinks) AS "Referencias", tipo FROM "500 - Entidades" WHERE tipo != null SORT length(file.inlinks) DESC LIMIT 15`);
    expect(result.headers).toEqual(["Archivo", "Referencias", "tipo"]);
    expect(result.rows[0].map(text)).toEqual(["Diego", "3", "persona"]);
    expect(names(result.rows)).toContain("Pau");
    expect(names(result.rows)).toContain("UP");
    expect(names(result.rows)).not.toContain("Sin tipo");
    expect(result.rows.find((row) => text(row[0]) === "UP")?.[1]).toEqual({ kind: "number", value: 1, text: "1" });
  });

  it("contains(relacion, ...) OR nombre, SORT file.name ASC", () => {
    const result = run(`TABLE relacion FROM "500 - Entidades/Personas" WHERE contains(relacion, "Papá") OR contains(file.name, "Thomas") SORT file.name ASC`);
    expect(names(result.rows)).toEqual(["Daniel (Papá)", "Thomas"]);
  });

  it("file.name = ... exacto", () => {
    const result = run(`TABLE file.mtime AS "Actualizado" FROM "100 - Proyectos" WHERE file.name = "Cord"`);
    expect(names(result.rows)).toEqual(["Cord"]);
  });

  it("contains(tags, \"core\") OR relacion = \"Mejor amigo\"", () => {
    const result = run(`TABLE relacion FROM "500 - Entidades/Personas" WHERE contains(tags, "core") OR relacion = "Mejor amigo"`);
    expect(names(result.rows)).toEqual(["Diego"]);
  });
});

describe("dataview: tolerancia a wikilinks dentro de comillas", () => {
  it("\"[[Diego]]\" en WHERE se trata como enlace (palabra completa)", () => {
    const result = run(`TABLE relacion FROM "500 - Entidades/Personas" WHERE contains(file.name, "[[Diego]]") OR contains(file.name, "[[Pau]]")`);
    expect(names(result.rows)).toEqual(["Diego (Primo Mamá)", "Diego", "Pau"]);
  });

  it("FROM \"[[Diario]]\" es la carpeta Diario", () => {
    const result = run(`TABLE file.mtime AS "Fecha" FROM "[[Diario]]" SORT file.mtime DESC LIMIT 5`);
    expect(result.rows).toHaveLength(4);
  });

  it("contains(tags, \"[[Flouvia]]\") encuentra tags en minúsculas y enlaces", () => {
    const result = run(`TABLE estado FROM "100 - Proyectos" WHERE contains(tags, "[[Flouvia]]") SORT file.name ASC`);
    expect(names(result.rows)).toEqual(["Casa10", "Cord", "Masuma"]);
  });

  it("contains(relacion, \"[[UP]]\") y file.name = \"[[Cord]]\"", () => {
    expect(names(run(`TABLE relacion FROM "500 - Entidades/Personas" WHERE contains(relacion, "[[UP]]")`).rows)).toEqual(["Pau"]);
    expect(names(run(`TABLE estado FROM "100 - Proyectos" WHERE file.name = "[[Cord]]"`).rows)).toEqual(["Cord"]);
  });

  it("un enlace del frontmatter se compara con texto por nombre de archivo", () => {
    expect(names(run(`TABLE area FROM "100 - Proyectos" WHERE area = "Flouvia"`).rows)).toEqual(["Casa10"]);
    const cell = run(`TABLE area FROM "100 - Proyectos" WHERE area = "Flouvia"`).rows[0][1];
    expect(cell).toMatchObject({ kind: "link", path: "100 - Proyectos/Flouvia.md", text: "Flouvia", resolved: true });
  });
});

describe("dataview: sintaxis", () => {
  it("TABLE WITHOUT ID", () => {
    const result = run(`TABLE WITHOUT ID file.name AS "Nombre", estado FROM "100 - Proyectos" WHERE estado SORT file.name ASC`);
    expect(result.headers).toEqual(["Nombre", "estado"]);
    expect(result.idColumn).toBe(false);
    expect(result.rows.map((row) => text(row[0]))).toEqual(["Casa10", "Cord", "Masuma"]);
  });

  it("LIST, LIST expr y LIST WITHOUT ID", () => {
    const plain = run(`LIST FROM #flouvia SORT file.name ASC`);
    expect(plain.type).toBe("list");
    // Los tags no distinguen mayúsculas: Masuma tiene "Flouvia".
    expect(names(plain.rows)).toEqual(["Casa10", "Cord", "Masuma"]);
    const withValue = run(`LIST estado FROM "100 - Proyectos" WHERE estado SORT file.name ASC`);
    expect(withValue.rows[0].map(text)).toEqual(["Casa10", "propuesta"]);
    const withoutId = run(`LIST WITHOUT ID upper(file.name) FROM "100 - Proyectos" WHERE tipo = "proyecto" SORT file.name ASC`);
    expect(withoutId.rows.map((row) => text(row[0]))).toEqual(["CASA10", "CORD", "MASUMA"]);
  });

  it("TASK con WHERE sobre campos de la tarea; ignora código", () => {
    const all = run(`TASK FROM "Tareas"`);
    expect(all.type).toBe("task");
    expect(all.groups?.[0].tasks.map((task) => [task.status, task.text, task.line])).toEqual([
      [" ", "Llamar a [[Diego]] #urgente", 1],
      ["x", "Pagar renta", 2],
      ["/", "Leer libro", 3],
      [" ", "en cita", 7],
    ]);
    const open = run(`TASK FROM "Tareas" WHERE !completed`);
    expect(open.groups?.[0].tasks).toHaveLength(3);
    const tagged = run(`TASK WHERE contains(tags, "#urgente")`);
    expect(tagged.groups?.[0].tasks.map((task) => task.text)).toEqual(["Llamar a [[Diego]] #urgente"]);
  });

  it("FROM con [[enlace]], outgoing(), negación y or", () => {
    expect(names(run(`LIST FROM [[Flouvia]] SORT file.name ASC`).rows)).toEqual(["Casa10", "Cord", "Masuma"]);
    expect(names(run(`LIST FROM outgoing([[000 - HQ]]) SORT file.name ASC`).rows)).toEqual(["Casa10", "Cord", "Diego"]);
    expect(names(run(`LIST FROM "100 - Proyectos" AND -#flouvia SORT file.name ASC`).rows)).toEqual(["Flouvia"]);
    expect(names(run(`LIST FROM #hq OR "Diario/2026-10-10" SORT file.name ASC`).rows)).toEqual(["000 - HQ", "2026-10-10"]);
    expect(names(run(`LIST FROM ("100 - Proyectos" and #proyecto) and !#cord SORT file.name ASC`).rows)).toEqual(["Casa10", "Masuma"]);
  });

  it("[[]] en FROM es la nota actual", () => {
    expect(names(run(`LIST FROM [[]]`, "100 - Proyectos/Flouvia.md").rows).sort()).toEqual(["Casa10", "Cord", "Masuma"]);
  });

  it("AND, OR, NOT y paréntesis", () => {
    const result = run(`LIST FROM "100 - Proyectos" WHERE NOT (estado = "activo") AND (tipo = "proyecto" OR status = "active") SORT file.name ASC`);
    expect(names(result.rows)).toEqual(["Casa10", "Flouvia", "Masuma"]);
  });

  it("comparaciones numéricas, de fechas y duraciones", () => {
    expect(names(run(`LIST FROM "Diario" WHERE file.mtime >= date(today) - dur(3 days) SORT file.name ASC`).rows)).toEqual(["2026-10-11", "2026-10-12"]);
    expect(names(run(`LIST FROM "Diario" WHERE file.day < date("2026-10-11") SORT file.name ASC`).rows)).toEqual(["2026-10-10"]);
    expect(names(run(`LIST FROM "Diario" WHERE file.day = date(yesterday) - dur(1 day)`).rows)).toEqual(["2026-10-12"]);
    expect(names(run(`LIST FROM "500 - Entidades" WHERE length(file.inlinks) >= 2`).rows)).toEqual(["Diego"]);
    expect(names(run(`LIST FROM "500 - Entidades" WHERE length(file.inlinks) > 0 AND length(file.inlinks) <= 1 SORT file.name ASC`).rows)).toEqual(["UP"]);
  });

  it("startswith, endswith, lower, icontains", () => {
    expect(names(run(`LIST FROM "500 - Entidades/Personas" WHERE startswith(lower(file.name), "dieg") SORT file.name ASC`).rows)).toEqual(["Diego", "Diego (Primo Mamá)"]);
    expect(names(run(`LIST FROM "500 - Entidades/Personas" WHERE endswith(file.name, ")") SORT file.name ASC`).rows)).toEqual(["Daniel (Papá)", "Diego (Primo Mamá)"]);
    expect(names(run(`LIST FROM "500 - Entidades/Personas" WHERE icontains(relacion, "MEJOR")`).rows)).toEqual(["Diego"]);
  });

  it("SORT con varias claves", () => {
    const result = run(`TABLE tipo FROM "500 - Entidades" WHERE tipo SORT tipo ASC, file.name DESC`);
    expect(names(result.rows)).toEqual(["UP", "Thomas", "Pau", "Diego (Primo Mamá)", "Diego", "Daniel (Papá)"]);
  });

  it("file.* y this", () => {
    const result = run(`TABLE file.folder, file.path, file.tags, file.outlinks, file.size, file.day FROM "Diario/2026-10-12"`);
    const row = result.rows[0];
    expect(text(row[1])).toBe("Diario");
    expect(text(row[2])).toBe("Diario/2026-10-12.md");
    expect(row[3]).toEqual({ kind: "empty" });
    expect(row[5]).toEqual({ kind: "number", value: 100, text: "100" });
    expect(row[6]).toMatchObject({ kind: "date", text: "2026-10-12" });
    const tags = run(`TABLE file.tags FROM "000 - HQ"`).rows[0][1];
    expect(tags).toEqual({ kind: "list", items: [{ kind: "text", text: "#hq" }] });
    expect(names(run(`LIST WHERE file.name = this.file.name`, "100 - Proyectos/Cord.md").rows)).toEqual(["Cord"]);
    const outlinks = run(`TABLE file.outlinks FROM "500 - Entidades/Personas/Thomas"`).rows[0][1];
    expect(outlinks).toEqual({ kind: "list", items: [{ kind: "link", path: "Fantasma", text: "Fantasma", resolved: false, subpath: undefined }] });
  });

  it("acceso a campos a través de enlaces", () => {
    const result = run(`TABLE area.status AS "Estado del área" FROM "100 - Proyectos" WHERE area`);
    expect(result.rows[0].map(text)).toEqual(["Casa10", "active"]);
  });

  it("sin FROM recorre toda la bóveda", () => {
    expect(run(`LIST WHERE tipo = "grupo"`).rows.map((row) => text(row[0]))).toEqual(["UP"]);
  });

  it("errores legibles en vez de excepciones", () => {
    expect(run(`TABLE estado FROM "100 - Proyectos" GROUP BY estado`).error).toMatch(/GROUP BY no soportado/);
    expect(run(`TABLE estado FLATTEN tags`).error).toMatch(/FLATTEN no soportado/);
    expect(run(`CALENDAR file.day`).error).toMatch(/CALENDAR/);
    expect(run(`TABLE estado WHERE foo(estado)`).error).toMatch(/Función no soportada: foo/);
    expect(run(`TABLE estado WHERE (estado = "x"`).error).toMatch(/Se esperaba «\)»/);
    expect(run(`TABLE "sin cerrar`).error).toMatch(/comilla/);
    expect(run(``).error).toMatch(/vacía/);
    expect(run(`SELECT * FROM x`).error).toMatch(/Tipo de consulta desconocido/);
    const failed = run(`LIST WHERE x`);
    expect(failed.error).toBeUndefined();
    expect(run(`LIST FROM "100 - Proyectos" WHERE estado SORT`).error).toBeTruthy();
  });

  it("palabras clave sin distinguir mayúsculas y comentarios //", () => {
    const result = run(`table estado\n// comentario\nfrom "100 - Proyectos"\nwhere estado = "activo"\nsort file.name asc\nlimit 1`);
    expect(names(result.rows)).toEqual(["Cord"]);
  });
});

describe("dataview: utilidades", () => {
  it("formatDataviewDate", () => {
    expect(formatDataviewDate(at(3, 7, 5))).toBe("2026-10-03 07:05");
    expect(formatDataviewDate(at(3, 7, 5), false)).toBe("2026-10-03");
  });

  it("dataviewSourceFromIndex adapta un índice con la forma de VaultIndex", () => {
    const resolve = createLinkResolver(["A.md", "B.md"]);
    const index = {
      notes: new Map([
        ["A.md", { path: "A.md", text: "[[B]]", mtime: 1, ctime: 1, size: 5, parsed: { frontmatter: { tipo: "x" }, tags: ["t"], aliases: [] } }],
        ["B.md", { path: "B.md", text: "", mtime: 2, ctime: 2, size: 0, parsed: { frontmatter: {}, tags: [], aliases: [] } }],
      ]),
      outgoing: new Map([["A.md", [{ target: "B", resolved: "B.md" }, { target: "Nada", resolved: null }]]]),
      resolve,
    };
    const adapted = dataviewSourceFromIndex(index);
    expect(adapted.pages.find((page) => page.path === "A.md")?.outlinks).toEqual([
      { path: "B.md", resolved: true },
      { path: "Nada", resolved: false },
    ]);
    expect(dataviewSourceFromIndex(index)).toBe(adapted);
    const result = runDataviewQuery(`TABLE length(file.inlinks) AS "n"`, adapted, "A.md");
    expect(result.rows.map((row) => row.map(text))).toEqual([["A", "0"], ["B", "1"]]);
  });
});
