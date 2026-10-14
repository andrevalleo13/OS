import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ vault: "" }));

vi.mock("@/lib/config", () => ({
  serverConfig: { paths: { home: os.homedir(), get vault() { return state.vault; } }, locale: "es-MX", timezone: "America/Mexico_City" },
}));

import { getVaultIndex, invalidateVaultIndex, localGraph, noteMeta, searchVault } from "./index";

async function write(relative: string, content: string) {
  const target = path.join(state.vault, relative);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
}

describe("índice de la bóveda", () => {
  beforeEach(async () => {
    state.vault = await fs.mkdtemp(path.join(os.tmpdir(), "valleos-vault-index-"));
    invalidateVaultIndex();
    // Cadena A — B — C — D: el grafo local de A a profundidad 1 solo debe tener A y B.
    await write("A.md", "Enlaza a [[B]].");
    await write("B.md", "Enlaza a [[C]]. Menciona a Diego sin enlace.");
    await write("C.md", "Enlaza a [[D]].");
    await write("D.md", "---\naliases: [Dee]\ntags: [persona]\n---\n# D\nFin. #nota");
    await write("Personas/Diego.md", "# Diego");
  });

  afterEach(async () => {
    await fs.rm(state.vault, { recursive: true, force: true });
    invalidateVaultIndex();
  });

  it("el grafo local respeta la profundidad", async () => {
    const index = await getVaultIndex();
    expect(localGraph(index, "A.md", 1).nodes.map((node) => node.id).sort()).toEqual(["A.md", "B.md"]);
    expect(localGraph(index, "A.md", 2).nodes.map((node) => node.id).sort()).toEqual(["A.md", "B.md", "C.md"]);
  });

  it("calcula backlinks, menciones sin enlazar y tags", async () => {
    const index = await getVaultIndex();
    expect(noteMeta(index, "C.md").backlinks.map((item) => item.path)).toEqual(["B.md"]);
    expect(noteMeta(index, "Personas/Diego.md").unlinked.map((item) => item.path)).toEqual(["B.md"]);
    expect(noteMeta(index, "D.md").tags).toEqual(expect.arrayContaining(["persona", "nota"]));
  });

  it("busca con operadores", async () => {
    const index = await getVaultIndex();
    expect(searchVault(index, "tag:#persona").map((hit) => hit.path)).toEqual(["D.md"]);
    expect(searchVault(index, "enlaza -file:a").map((hit) => hit.path).sort()).toEqual(["B.md", "C.md"]);
    expect(searchVault(index, "dee").map((hit) => hit.path)).toEqual(["D.md"]);
  });
});
