import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ vault: "" }));

vi.mock("@/lib/config", () => ({
  serverConfig: {
    paths: { home: os.homedir(), get vault() { return state.vault; } },
    locale: "es-MX",
    timezone: "America/Mexico_City",
  },
}));

import { invalidateVaultIndex } from "./index";
import { appendToSection, createNote, deleteEntry, getOrCreateDailyNote, readNote, renameEntry, saveNote } from "./ops";

async function write(relative: string, content: string) {
  const target = path.join(state.vault, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
}

async function read(relative: string) {
  return fs.readFile(path.join(state.vault, relative), "utf8");
}

describe("operaciones de la bóveda", () => {
  beforeEach(async () => {
    state.vault = await fs.mkdtemp(path.join(os.tmpdir(), "valleos-vault-ops-"));
    invalidateVaultIndex();
    await write("500 - Entidades/Personas/Diego.md", "# Diego\nSocio en [[El Zarco]].\n");
    await write("100 - Proyectos/El Zarco.md", "# El Zarco\n");
    await write("Diario/2026-10-12.md", "Hoy con [[Diego]] y [[El Zarco#Ventas|el negocio]]. ![[El Zarco]]\n```\n[[El Zarco]]\n```\n");
    await write(".obsidian/daily-notes.json", JSON.stringify({ folder: "Diario", format: "YYYY-MM-DD", template: "900 - Sistema/Plantillas/Plantilla Diario" }));
    await write("900 - Sistema/Plantillas/Plantilla Diario.md", "---\nfecha: {{date:YYYY-MM-DD}}\n---\n# 📝 {{date:YYYY-MM-DD}}\n\n## 🧠 Descarga mental (raw)\n- \n\n## ➡️ Mañana\n- \n");
  });

  afterEach(async () => {
    await fs.rm(state.vault, { recursive: true, force: true });
    invalidateVaultIndex();
  });

  it("renombra y actualiza enlaces (con alias, subruta y embeds), sin tocar código", async () => {
    const result = await renameEntry("100 - Proyectos/El Zarco.md", "100 - Proyectos/El Zarco Distribuidora.md");
    expect(result.updatedLinks).toBe(3);
    expect(await read("500 - Entidades/Personas/Diego.md")).toContain("[[El Zarco Distribuidora]]");
    const daily = await read("Diario/2026-10-12.md");
    expect(daily).toContain("[[El Zarco Distribuidora#Ventas|el negocio]]");
    expect(daily).toContain("![[El Zarco Distribuidora]]");
    expect(daily).toContain("```\n[[El Zarco]]\n```");
  });

  it("mover a otra carpeta conserva enlaces por nombre", async () => {
    const result = await renameEntry("100 - Proyectos/El Zarco.md", "400 - Archivo/El Zarco.md");
    expect(result.updatedLinks).toBe(0);
    expect(await read("400 - Archivo/El Zarco.md")).toBe("# El Zarco\n");
  });

  it("detecta conflictos al guardar si el archivo cambió en disco", async () => {
    const note = await readNote("500 - Entidades/Personas/Diego.md");
    await new Promise((resolve) => setTimeout(resolve, 15));
    await write("500 - Entidades/Personas/Diego.md", "# Diego\nEditado en Obsidian.\n");
    const result = await saveNote(note.path, "# Diego\nMi versión.\n", note.mtime);
    expect(result.ok).toBe(false);
    expect(await read("500 - Entidades/Personas/Diego.md")).toContain("Editado en Obsidian");
  });

  it("crea notas con nombre único y manda borrados a .trash", async () => {
    const first = await createNote({ folder: "000 - Inbox", name: "Idea" });
    const second = await createNote({ folder: "000 - Inbox", name: "Idea" });
    expect(first.path).toBe("000 - Inbox/Idea.md");
    expect(second.path).toBe("000 - Inbox/Idea 1.md");
    await deleteEntry(second.path);
    await expect(fs.access(path.join(state.vault, ".trash/Idea 1.md"))).resolves.toBeUndefined();
  });

  it("crea la nota diaria desde la plantilla configurada", async () => {
    const result = await getOrCreateDailyNote("2026-10-14");
    expect(result).toEqual({ path: "Diario/2026-10-14.md", created: true });
    const content = await read("Diario/2026-10-14.md");
    expect(content).toContain("fecha: 2026-10-14");
    expect(content).toContain("# 📝 2026-10-14");
    expect((await getOrCreateDailyNote("2026-10-14")).created).toBe(false);
  });

  it("rechaza rutas fuera de la bóveda u ocultas", async () => {
    await expect(readNote("../secreto.md")).rejects.toThrow();
    await expect(readNote(".obsidian/app.json")).rejects.toThrow();
  });
});

describe("appendToSection", () => {
  it("agrega al final de la sección correcta y reemplaza el bullet vacío de plantilla", () => {
    const content = "# Día\n\n## 🧠 Descarga mental (raw)\n- \n\n## ➡️ Mañana\n- algo\n";
    const next = appendToSection(content, "Descarga mental (raw)", "- 09:00 idea");
    expect(next).toBe("# Día\n\n## 🧠 Descarga mental (raw)\n- 09:00 idea\n\n## ➡️ Mañana\n- algo\n");
  });

  it("reconoce encabezados con [[enlaces]] y crea la sección si falta", () => {
    expect(appendToSection("## Memoria de [[Shadow]]\n- a\n", "Memoria de Shadow", "- b")).toBe("## Memoria de [[Shadow]]\n- a\n- b\n");
    expect(appendToSection("# Nota\n", "Conexiones", "- [[X]]")).toBe("# Nota\n\n## Conexiones\n- [[X]]\n");
  });
});
