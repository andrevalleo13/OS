import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dateKey } from "@/lib/dates";

const state = vi.hoisted(() => ({ vault: "" }));
const createRevision = vi.hoisted(() => vi.fn(async () => ({ id: "revision" })));

vi.mock("@/lib/config", () => ({
  serverConfig: {
    paths: { get vault() { return state.vault; } },
    locale: "es-MX",
    timezone: "America/Mexico_City",
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: { obsidianRevision: { create: createRevision } } }));

import { invalidateVaultIndex } from "./index";
import { appendToDaily, appendToVaultNote, createVaultNote, readVaultNote } from "./shadow-writes";

const TODAY = dateKey(new Date(), "America/Mexico_City");

async function write(relative: string, content: string) {
  const target = path.join(state.vault, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
}

const read = (relative: string) => fs.readFile(path.join(state.vault, relative), "utf8");

function revisionData(call = 0) {
  return (createRevision.mock.calls[call] as unknown as [{ data: Record<string, unknown> }])[0].data;
}

const PERSON = "---\ntipo: persona\ntags: [entidad, persona]\n---\n\n# Marco\n\n> [!info] Resumen\n> Amigo.\n\n## 🔗 Conexiones\n- [[Pau]]\n\n## Memoria de Shadow\n- **[2026-10-14]** Amigo del Trío.\n";

describe("escrituras de Shadow en la bóveda", () => {
  beforeEach(async () => {
    state.vault = await fs.mkdtemp(path.join(os.tmpdir(), "valleos-writes-test-"));
    await write("500 - Entidades/Personas/Pau.md", "# Pau\n\n## Memoria de [[Shadow]]\n- **[2026-09-01]** Va al CUM.\n");
    await write("500 - Entidades/Personas/Jerry (UP).md", "# Jerry (UP)\n");
    await write("100 - Proyectos/Cord.md", "# Cord\n\n## Conexiones\n- [[Pau]]\n");
    await write(".obsidian/daily-notes.json", JSON.stringify({ folder: "Diario", format: "YYYY-MM-DD", template: "900 - Sistema/Plantillas/Diario" }));
    await write("900 - Sistema/Plantillas/Diario.md", "# {{date:YYYY-MM-DD}}\n\n## ⚡ Qué pasó\n- \n\n## 🫀 Cuerpo\n- **Sueño:** ~_h_\n- \n\n## 🧠 Descarga mental (raw)\n_Todo lo que trae Andre._\n\n## ➡️ Mañana\n- \n");
    invalidateVaultIndex();
    createRevision.mockClear();
  });

  afterEach(async () => {
    invalidateVaultIndex();
    await fs.rm(state.vault, { recursive: true, force: true });
  });

  it("crea notas válidas en carpetas PARA reales y registra la revisión", async () => {
    const result = await createVaultNote({ folder: "personas", title: "[[Marco]]", content: PERSON });
    expect(result).toMatchObject({ path: "500 - Entidades/Personas/Marco.md", title: "Marco", created: true });
    expect(await read("500 - Entidades/Personas/Marco.md")).toBe(PERSON);
    expect(revisionData()).toMatchObject({ path: "500 - Entidades/Personas/Marco.md", operation: "create", beforeContent: "" });
  });

  it("no duplica notas existentes ni acepta carpetas inventadas o contenido roto", async () => {
    await expect(createVaultNote({ folder: "500 - Entidades/Personas", title: "pau", content: PERSON })).rejects.toThrow(/append_to_obsidian_note/);
    await expect(createVaultNote({ folder: "Personas Random", title: "Nuevo", content: PERSON })).rejects.toThrow(/Carpeta no válida/);
    await expect(createVaultNote({ folder: "500 - Entidades/Personas", title: "Nuevo", content: "---\ntags: [entidad, [[Cord]]]\n---\n# Nuevo\n" }))
      .rejects.toThrow(/convenciones/);
    expect(createRevision).not.toHaveBeenCalled();
  });

  it("agrega a una nota resuelta por nombre, en la sección correcta y sin repetir", async () => {
    const bullet = "- **[2026-10-14]** Juega fútbol con [[Pau]].";
    const result = await appendToVaultNote({ target: "Jerry", section: "Memoria de Shadow", content: bullet });
    expect(result).toMatchObject({ path: "500 - Entidades/Personas/Jerry (UP).md", changed: true });
    expect(await read("500 - Entidades/Personas/Jerry (UP).md")).toBe(`# Jerry (UP)\n\n## Memoria de Shadow\n${bullet}\n`);
    expect(await appendToVaultNote({ target: "Jerry (UP)", section: "Memoria de Shadow", content: bullet })).toMatchObject({ changed: false });

    await appendToVaultNote({ target: "[[cord]]", section: "🔗 Conexiones", content: "- [[Jerry (UP)]]" });
    expect(await read("100 - Proyectos/Cord.md")).toBe("# Cord\n\n## Conexiones\n- [[Pau]]\n- [[Jerry (UP)]]\n");
    expect(revisionData(1)).toMatchObject({ path: "100 - Proyectos/Cord.md", operation: "update", beforeContent: "# Cord\n\n## Conexiones\n- [[Pau]]\n" });
  });

  it("no crea una segunda sección de memoria ni enlaces anidados", async () => {
    await expect(appendToVaultNote({ target: "Pau", content: "## Memoria de Shadow\n- **[2026-10-14]** x" })).rejects.toThrow(/Memoria de Shadow/);
    await expect(appendToVaultNote({ target: "Pau", section: "Memoria de Shadow", content: "- [[Jerry ([[UP]])]]" })).rejects.toThrow(/anidados/);
    await expect(appendToVaultNote({ target: "Nadie", content: "- x" })).rejects.toThrow(/No encontré/);
  });

  it("escribe en el diario desde la plantilla y la creación se puede deshacer", async () => {
    const result = await appendToDaily({ section: "Qué pasó", content: "- Examen de finanzas: 10." });
    expect(result).toMatchObject({ path: `Diario/${TODAY}.md`, created: true, changed: true });
    const daily = await read(`Diario/${TODAY}.md`);
    expect(daily).toContain("## ⚡ Qué pasó\n- Examen de finanzas: 10.\n\n## 🫀 Cuerpo");
    expect(revisionData()).toMatchObject({ operation: "create", beforeContent: "" });
  });

  it("el resumen de nutrición reemplaza su línea en vez de duplicarla", async () => {
    await appendToDaily({ section: "🫀 Cuerpo", content: "- **Nutrición:** 1800 kcal", replaceLinePrefix: "- **Nutrición:**" });
    await appendToDaily({ section: "🫀 Cuerpo", content: "- **Nutrición:** 2100 kcal", replaceLinePrefix: "- **Nutrición:**" });
    const daily = await read(`Diario/${TODAY}.md`);
    expect(daily).toContain("## 🫀 Cuerpo\n- **Sueño:** ~_h_\n- **Nutrición:** 2100 kcal\n\n## 🧠");
    expect(daily).not.toContain("1800 kcal");
    expect(revisionData(1)).toMatchObject({ operation: "update" });
  });

  it("lee notas por nombre, alias o sin acentos", async () => {
    await write("500 - Entidades/Personas/Daniel (Papá).md", "---\naliases: [Papá]\n---\n# Daniel (Papá)\n");
    invalidateVaultIndex();
    expect((await readVaultNote("papa")).path).toBe("500 - Entidades/Personas/Daniel (Papá).md");
    expect((await readVaultNote("Papá")).path).toBe("500 - Entidades/Personas/Daniel (Papá).md");
    expect((await readVaultNote("100 - Proyectos/Cord")).path).toBe("100 - Proyectos/Cord.md");
  });
});
