import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dateKey } from "@/lib/dates";

const state = vi.hoisted(() => ({ vault: "" }));
const upsertMemory = vi.hoisted(() => vi.fn(async () => ({})));
const createRevision = vi.hoisted(() => vi.fn(async () => ({ id: "revision" })));
const upsertEvent = vi.hoisted(() => vi.fn(async () => ({})));
const upsertEntity = vi.hoisted(() => vi.fn(async () => ({ id: "entity" })));

vi.mock("@/lib/config", () => ({
  serverConfig: {
    paths: {
      home: os.homedir(),
      get vault() { return state.vault; },
    },
    locale: "es-MX",
    timezone: "America/Mexico_City",
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shadowMemory: { upsert: upsertMemory },
    obsidianRevision: { create: createRevision },
    lifeEvent: { upsert: upsertEvent },
    lifeEntity: { upsert: upsertEntity },
  },
}));

import { invalidateVaultIndex } from "@/features/vault/index";
import { curateObsidianMemory } from "./obsidian";

const TODAY = dateKey(new Date(), "America/Mexico_City");
const PERSONAS = "500 - Entidades/Personas";

const DAILY_TEMPLATE = `---
fecha: {{date:YYYY-MM-DD}}
tipo: diario
tags:
  - diario
---
# 📝 {{date:YYYY-MM-DD}}

## ⚡ Qué pasó
-

## 🔁 Propagado a
_Notas de entidad que [[Shadow]] tocó hoy con un bullet fechado._
-

## ➡️ Mañana
-
`;

async function write(relative: string, content: string) {
  const target = path.join(state.vault, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
}

async function read(relative: string) {
  return fs.readFile(path.join(state.vault, relative), "utf8");
}

function count(content: string, pattern: RegExp) {
  return content.match(pattern)?.length ?? 0;
}

describe("curateObsidianMemory", () => {
  beforeEach(async () => {
    state.vault = await fs.mkdtemp(path.join(os.tmpdir(), "valleos-vault-test-"));
    await write(`${PERSONAS}/Sofi.md`, "---\ntitle: Sofi\naliases: []\n---\n\n# Sofi\n");
    await write(".obsidian/daily-notes.json", JSON.stringify({ folder: "Diario", format: "YYYY-MM-DD", template: "900 - Sistema/Plantillas/Diario" }));
    await write("900 - Sistema/Plantillas/Diario.md", DAILY_TEMPLATE);
    invalidateVaultIndex();
    upsertMemory.mockClear();
    createRevision.mockClear();
    upsertEvent.mockClear();
    upsertEntity.mockClear();
  });

  afterEach(async () => {
    invalidateVaultIndex();
    await fs.rm(state.vault, { recursive: true, force: true });
  });

  it("actualiza la entidad existente, conecta puntos y evita duplicados", async () => {
    const memory = {
      kind: "person",
      subject: "Sofi",
      fact: "Sofi conoce el proyecto Cord.",
      relatedEntities: ["Cord"],
      confidence: 0.95,
    };

    expect(await curateObsidianMemory(memory)).toMatchObject({ status: "updated" });
    expect(await curateObsidianMemory(memory)).toMatchObject({ status: "duplicate" });

    const content = await read(`${PERSONAS}/Sofi.md`);
    expect(count(content, /Sofi conoce el proyecto Cord\./g)).toBe(1);
    expect(count(content, /\[\[Cord\]\]/g)).toBe(1);
    expect(content).toContain("## Memoria de Shadow");
    expect(content).toContain("## 🔗 Conexiones");
    // Las conexiones van antes de la memoria, como en el Protocolo.
    expect(content.indexOf("## 🔗 Conexiones")).toBeLessThan(content.indexOf("## Memoria de Shadow"));
    expect(upsertMemory).toHaveBeenCalledTimes(2);
  });

  it("reconoce `## Memoria de [[Shadow]]` y no duplica la sección", async () => {
    await write(`${PERSONAS}/Jerry (UP).md`, [
      "---", "tipo: persona", "tags: [entidad, persona]", "---", "", "# Jerry (UP)", "",
      "## Memoria de [[Shadow]]",
      "- **[2026-08-28]** Trío dentro de la UP.",
      "",
    ].join("\n"));
    invalidateVaultIndex();

    await curateObsidianMemory({ kind: "person", subject: "Jerry (UP)", fact: "Juega fútbol con el equipo de Bruno." });
    const content = await read(`${PERSONAS}/Jerry (UP).md`);
    expect(count(content, /^## Memoria de/gm)).toBe(1);
    expect(content).toContain("## Memoria de [[Shadow]]");
  });

  it("agrega bullets fechados al final, en orden cronológico, y deduplica sin la fecha", async () => {
    await write(`${PERSONAS}/Pau.md`, [
      "# Pau", "",
      "## Memoria de [[Shadow]]",
      "- **[2026-08-01]** Hecho viejo.",
      "- **[2026-09-01]** Va al CUM.",
      "",
      "## Notas",
      "- algo",
      "",
    ].join("\n"));
    invalidateVaultIndex();

    await curateObsidianMemory({ kind: "person", subject: "Pau", fact: "Le gusta el café." });
    let content = await read(`${PERSONAS}/Pau.md`);
    const memory = content.slice(content.indexOf("## Memoria"), content.indexOf("## Notas"));
    const bullets = memory.split("\n").filter((line) => line.startsWith("- "));
    expect(bullets).toEqual([
      "- **[2026-08-01]** Hecho viejo.",
      "- **[2026-09-01]** Va al CUM.",
      `- **[${TODAY}]** Le gusta el café. ([[${TODAY}|diario]])`,
    ]);

    // El mismo hecho con otra fecha (o sin enlace al diario) es un duplicado.
    expect(await curateObsidianMemory({ kind: "person", subject: "Pau", fact: "Va al CUM." })).toMatchObject({ status: "duplicate" });
    content = await read(`${PERSONAS}/Pau.md`);
    expect(count(content, /Va al CUM/g)).toBe(1);
  });

  it("usa `## Conexiones` sin emoji si ya existe", async () => {
    await write(`${PERSONAS}/Lugo.md`, [
      "---", "tipo: persona", "tags: [entidad, persona]", "---", "", "# Lugo", "",
      "## Conexiones",
      "- Mejor amiga de: [[Pau]]",
      "",
      "## Memoria de [[Shadow]]",
      "- **[2026-09-30]** Trabaja en Mutti.",
      "",
    ].join("\n"));
    await write(`${PERSONAS}/Pau.md`, "# Pau\n");
    await write(`${PERSONAS}/Isa.md`, "# Isa\n");
    invalidateVaultIndex();

    const result = await curateObsidianMemory({ kind: "person", subject: "Lugo", fact: "Trabaja con Isa en Mutti.", relatedEntities: ["Isa", "pau"] });
    expect(result).toMatchObject({ connectionsAdded: 1 });
    const content = await read(`${PERSONAS}/Lugo.md`);
    expect(content).not.toContain("🔗 Conexiones");
    expect(count(content, /^## Conexiones/gm)).toBe(1);
    const connections = content.slice(content.indexOf("## Conexiones"), content.indexOf("## Memoria"));
    expect(connections).toContain("- [[Isa]]");
    expect(count(content, /\[\[Pau\]\]/g)).toBe(1);
  });

  it("canoniza entidades relacionadas: nombre real, alias, sin corchetes ni enlaces anidados", async () => {
    await write(`${PERSONAS}/Jerry (UP).md`, "# Jerry (UP)\n");
    await write(`${PERSONAS}/Daniel (Papá).md`, "---\naliases: [Papá]\n---\n# Daniel (Papá)\n");
    await write("100 - Proyectos/Cord.md", "# Cord\n");
    invalidateVaultIndex();

    await curateObsidianMemory({
      kind: "person",
      subject: "Sofi",
      fact: "Sofi conoce a [[Jerry ([[UP]])]].",
      relatedEntities: ["[[Jerry ([[UP]])]]", "papá", "[[cord|el proyecto]]", "Nadie Conocido"],
    });

    const content = await read(`${PERSONAS}/Sofi.md`);
    expect(content).toContain("- [[Jerry (UP)]]");
    expect(content).toContain("- [[Daniel (Papá)]]");
    expect(content).toContain("- [[Cord]]");
    expect(content).toContain("- [[Nadie Conocido]]");
    expect(content).toContain("Sofi conoce a [[Jerry (UP)]].");
    expect(content).not.toMatch(/\[\[[^\]]*\[\[/);
  });

  it("crea entidades nuevas con el formato de la bóveda", async () => {
    await write(`${PERSONAS}/Pau.md`, "# Pau\n");
    invalidateVaultIndex();

    expect(await curateObsidianMemory({ kind: "person", subject: "Marco", fact: "Amigo del Trío Calavera.", relatedEntities: ["Pau"] }))
      .toMatchObject({ status: "created", path: `${PERSONAS}/Marco.md` });
    const content = await read(`${PERSONAS}/Marco.md`);
    expect(content).toBe([
      "---",
      "tipo: persona",
      "tags: [entidad, persona]",
      "estado: activo",
      "---",
      "",
      "# Marco",
      "",
      "> [!info] Resumen",
      "> Amigo del Trío Calavera.",
      "",
      "## 🔗 Conexiones",
      "- [[Pau]]",
      "",
      "## Memoria de Shadow",
      `- **[${TODAY}]** Amigo del Trío Calavera. ([[${TODAY}|diario]])`,
      "",
    ].join("\n"));
    expect(content).not.toMatch(/title:|entity/);
    expect(createRevision).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ path: `${PERSONAS}/Marco.md`, operation: "create", beforeContent: "" }) }));
  });

  it("propaga el hecho a “🔁 Propagado a” del diario sin repetir líneas", async () => {
    const memory = { kind: "person", subject: "Sofi", fact: "Sofi empezó a trabajar en Flouvia." };
    expect(await curateObsidianMemory(memory)).toMatchObject({ propagatedTo: `Diario/${TODAY}.md` });
    await curateObsidianMemory(memory);
    await curateObsidianMemory({ kind: "person", subject: "Sofi", fact: "Sofi vive en Coyoacán." });

    const daily = await read(`Diario/${TODAY}.md`);
    expect(daily).toContain("tipo: diario");
    const section = daily.slice(daily.indexOf("## 🔁 Propagado a"), daily.indexOf("## ➡️ Mañana"));
    expect(section.split("\n").filter((line) => line.startsWith("-"))).toEqual([
      "- [[Sofi]] — Sofi empezó a trabajar en Flouvia.",
      "- [[Sofi]] — Sofi vive en Coyoacán.",
    ]);
    // La plantilla conserva sus otras secciones intactas.
    expect(daily).toMatch(/## ⚡ Qué pasó\n- ?\n/);
  });
});
