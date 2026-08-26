import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

import { curateObsidianMemory } from "./obsidian";

describe("curateObsidianMemory", () => {
  beforeEach(async () => {
    state.vault = await fs.mkdtemp(path.join(os.tmpdir(), "valleos-vault-test-"));
    await fs.mkdir(path.join(state.vault, "500 - Entidades/Personas"), { recursive: true });
    await fs.writeFile(
      path.join(state.vault, "500 - Entidades/Personas/Sofi.md"),
      "---\ntitle: Sofi\naliases: []\n---\n\n# Sofi\n",
      "utf8",
    );
    upsertMemory.mockClear();
    createRevision.mockClear();
    upsertEvent.mockClear();
    upsertEntity.mockClear();
  });

  afterEach(async () => {
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

    const content = await fs.readFile(path.join(state.vault, "500 - Entidades/Personas/Sofi.md"), "utf8");
    expect(content.match(/Sofi conoce el proyecto Cord\./g)).toHaveLength(1);
    expect(content.match(/\[\[Cord\]\]/g)).toHaveLength(1);
    expect(content).toContain("## Memoria de Shadow");
    expect(content).toContain("## 🔗 Conexiones");
    expect(upsertMemory).toHaveBeenCalledTimes(2);
  });
});
