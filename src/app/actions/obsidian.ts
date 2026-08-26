"use server";

import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { serverConfig } from "@/lib/config";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { publishLifeEvent } from "@/features/shadow/events";
import { upsertLifeEntity } from "@/features/shadow/life-graph";

const filenameSchema = z.string().trim().min(1).max(500).refine((value) => !value.includes("\0"));
const contentSchema = z.string().min(1).max(100_000);

function assertInside(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ForbiddenError("Intento de acceso fuera de la bóveda.");
  }
}

async function vaultRoot(): Promise<string> {
  if (!serverConfig.paths.vault) throw new ValidationError("OBSIDIAN_VAULT_PATH no está configurado.");
  return fs.realpath(serverConfig.paths.vault);
}

async function nearestExistingDirectory(input: string): Promise<string> {
  let current = input;
  while (true) {
    try {
      return await fs.realpath(current);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(current);
      if (parent === current) throw error;
      current = parent;
    }
  }
}

async function safeTarget(filename: string, mode: "read" | "append"): Promise<string> {
  const root = await vaultRoot();
  const parsed = filenameSchema.parse(filename);
  const withExtension = parsed.endsWith(".md") ? parsed : `${parsed}.md`;
  const target = path.resolve(root, withExtension);
  assertInside(root, target);

  if (mode === "read") {
    const realTarget = await fs.realpath(target);
    assertInside(root, realTarget);
    return realTarget;
  }

  const parent = path.dirname(target);
  const realAncestor = await nearestExistingDirectory(parent);
  assertInside(root, realAncestor);
  await fs.mkdir(parent, { recursive: true });
  const realParent = await fs.realpath(parent);
  assertInside(root, realParent);

  try {
    const stat = await fs.lstat(target);
    if (stat.isSymbolicLink()) throw new ForbiddenError("No se permite escribir mediante enlaces simbólicos.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return target;
}

async function getAllMarkdownFiles(directory: string, root: string, output: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".") || entry.isSymbolicLink()) continue;
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) await getAllMarkdownFiles(filePath, root, output);
    else if (entry.isFile() && entry.name.endsWith(".md")) {
      const realFile = await fs.realpath(filePath);
      assertInside(root, realFile);
      output.push(realFile);
    }
  }
  return output;
}

export async function readObsidianNote(filename: string) {
  return fs.readFile(await safeTarget(filename, "read"), "utf8");
}

export async function appendObsidianNote(filename: string, content: string, source = "Shadow") {
  const safeContent = contentSchema.parse(content);
  const safeSource = z.string().trim().max(80).parse(source);
  const target = await safeTarget(filename, "append");
  const suffix = safeSource ? ` - ${safeSource}` : "";
  await fs.appendFile(target, `\n- ${safeContent}${suffix}\n`, "utf8");
  revalidatePath("/");
  revalidatePath("/obsidian");
  return `Contenido agregado a '${filename}'.`;
}

export async function searchObsidianNotes(query: string) {
  const safeQuery = z.string().trim().min(1).max(200).parse(query);
  const root = await vaultRoot();
  const files = await getAllMarkdownFiles(root, root);
  const keywords = safeQuery.toLocaleLowerCase(serverConfig.locale).split(/\s+/).filter((word) => word.length > 2);
  if (keywords.length === 0) keywords.push(safeQuery.toLocaleLowerCase(serverConfig.locale));

  const results: string[] = [];
  for (let index = 0; index < files.length; index += 20) {
    const batch = files.slice(index, index + 20);
    const matches = await Promise.all(batch.map(async (file) => {
      const content = await fs.readFile(file, "utf8");
      const lowerContent = content.toLocaleLowerCase(serverConfig.locale);
      const lowerTitle = path.basename(file).toLocaleLowerCase(serverConfig.locale);
      if (!keywords.some((keyword) => lowerTitle.includes(keyword) || lowerContent.includes(keyword))) return null;
      const matchIndex = keywords.reduce((first, keyword) => {
        const found = lowerContent.indexOf(keyword);
        return found !== -1 && (first === -1 || found < first) ? found : first;
      }, -1);
      const start = Math.max(0, matchIndex === -1 ? 0 : matchIndex - 200);
      const snippet = content.slice(start, start + 800);
      return `--- Nota: ${path.relative(root, file)} ---\n${start > 0 ? "..." : ""}${snippet}${start + 800 < content.length ? "..." : ""}`;
    }));
    results.push(...matches.filter((match): match is string => match !== null));
    if (results.length >= 20) break;
  }

  return results.length > 0
    ? `Información encontrada:\n\n${results.slice(0, 20).join("\n\n")}`
    : `No encontré información para '${safeQuery}'.`;
}

export async function getRecentNotes(limit = 3) {
  const safeLimit = z.number().int().min(1).max(20).parse(limit);
  const root = await vaultRoot();
  const files = await getAllMarkdownFiles(root, root);
  const stats = await Promise.all(files.map(async (file) => ({ file, stat: await fs.stat(file) })));
  stats.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  return Promise.all(stats.slice(0, safeLimit).map(async ({ file }) => {
    const content = await fs.readFile(file, "utf8");
    return {
      name: path.relative(root, file),
      content: content.length > 800 ? `${content.slice(0, 800)}... [truncado]` : content,
    };
  }));
}

const memoryKindSchema = z.enum([
  "person",
  "place",
  "project",
  "concept",
  "preference",
  "goal",
  "relationship",
  "routine",
]);

const curatedMemorySchema = z.object({
  kind: memoryKindSchema,
  subject: z.string().trim().min(1).max(160),
  fact: z.string().trim().min(1).max(2_000),
  relatedEntities: z.array(z.string().trim().min(1).max(160)).max(12).default([]),
  confidence: z.number().min(0).max(1).default(0.8),
  sensitive: z.boolean().default(false),
});

type CuratedMemory = z.infer<typeof curatedMemorySchema>;

function normalizeMemoryValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function noteIdentities(file: string, content: string): string[] {
  const identities = new Set<string>([path.basename(file, ".md")]);
  const title = content.match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1];
  const heading = content.match(/^#\s+(.+?)\s*$/m)?.[1];
  const inlineAliases = content.match(/^aliases:\s*\[(.*?)\]\s*$/m)?.[1];
  if (title) identities.add(title);
  if (heading) identities.add(heading.replace(/^[^\p{L}\p{N}]+/u, ""));
  if (inlineAliases) {
    for (const alias of inlineAliases.split(",")) identities.add(alias.replace(/["']/g, "").trim());
  }
  return [...identities].filter(Boolean);
}

function expectedFolder(kind: CuratedMemory["kind"]): string | undefined {
  if (kind === "person" || kind === "relationship") return "500 - Entidades/Personas";
  if (kind === "place") return "500 - Entidades/Lugares";
  if (kind === "project") return "100 - Proyectos";
  if (kind === "concept") return "500 - Entidades/Conceptos";
  return undefined;
}

function fixedMemoryTarget(kind: CuratedMemory["kind"]): string | undefined {
  if (kind === "preference") return "900 - Sistema/Directivas de Shadow.md";
  if (kind === "goal") return "001 - Status Board.md";
  if (kind === "routine") return "900 - Sistema/Rutina Diaria.md";
  return undefined;
}

function candidateScore(subject: string, identities: string[], relativePath: string, kind: CuratedMemory["kind"]): number {
  const target = normalizeMemoryValue(subject);
  let score = 0;
  for (const identity of identities) {
    const candidate = normalizeMemoryValue(identity);
    if (candidate === target) score = Math.max(score, 100);
    else if (candidate.length >= 4 && target.length >= 4 && (candidate.includes(target) || target.includes(candidate))) {
      score = Math.max(score, 82);
    } else {
      const targetWords = new Set(target.split(" ").filter(Boolean));
      const candidateWords = new Set(candidate.split(" ").filter(Boolean));
      const overlap = [...targetWords].filter((word) => candidateWords.has(word)).length;
      const union = new Set([...targetWords, ...candidateWords]).size;
      if (union > 0) score = Math.max(score, (overlap / union) * 70);
    }
  }
  const folder = expectedFolder(kind);
  if (folder && relativePath.startsWith(`${folder}/`)) score += 8;
  return score;
}

function safeEntityFilename(subject: string): string {
  const filename = subject.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  if (!filename || filename === "." || filename === "..") throw new ValidationError("Nombre de entidad inválido.");
  return `${filename}.md`;
}

function addBulletToSection(content: string, heading: string, bullet: string): { content: string; changed: boolean } {
  const firstBulletLine = normalizeMemoryValue(bullet.split("\n")[0].replace(/^-\s*/, ""));
  const alreadyExists = content.split("\n").some((line) =>
    normalizeMemoryValue(line.replace(/^\s*-\s*/, "")) === firstBulletLine
  );
  if (alreadyExists) {
    return { content, changed: false };
  }
  const headingPattern = new RegExp(`^##\\s+${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "mi");
  const match = headingPattern.exec(content);
  if (!match || match.index === undefined) {
    return { content: `${content.trimEnd()}\n\n## ${heading}\n${bullet}\n`, changed: true };
  }
  const insertAt = match.index + match[0].length;
  return {
    content: `${content.slice(0, insertAt)}\n${bullet}${content.slice(insertAt)}`,
    changed: true,
  };
}

async function atomicWriteMarkdown(target: string, content: string) {
  const temporary = `${target}.shadow-${process.pid}-${Date.now()}.tmp`;
  await fs.writeFile(temporary, content, "utf8");
  await fs.rename(temporary, target);
}

function contentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function recordObsidianRevision(input: {
  relativePath: string;
  beforeContent: string;
  afterContent: string;
  operation: "create" | "update";
}) {
  return prisma.obsidianRevision.create({
    data: {
      path: input.relativePath,
      operation: input.operation,
      beforeContent: input.beforeContent,
      afterContent: input.afterContent,
      beforeHash: contentHash(input.beforeContent),
      afterHash: contentHash(input.afterContent),
    },
  });
}

async function resolveCuratedTarget(input: CuratedMemory) {
  const fixed = fixedMemoryTarget(input.kind);
  if (fixed) {
    const target = await safeTarget(fixed, "append");
    return { target, relativePath: fixed, status: "matched" as const, candidates: [] as string[] };
  }

  const root = await vaultRoot();
  const files = await getAllMarkdownFiles(root, root);
  const scored = await Promise.all(files.map(async (file) => {
    const content = await fs.readFile(file, "utf8");
    const relativePath = path.relative(root, file);
    return {
      file,
      relativePath,
      score: candidateScore(input.subject, noteIdentities(file, content), relativePath, input.kind),
    };
  }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  const second = scored[1];

  if (best && best.score >= 90 && (!second || best.score - second.score >= 5)) {
    return { target: best.file, relativePath: best.relativePath, status: "matched" as const, candidates: [] as string[] };
  }
  if (best && best.score >= 65) {
    return {
      target: await safeTarget("000 - Inbox/Shadow Memory Inbox.md", "append"),
      relativePath: "000 - Inbox/Shadow Memory Inbox.md",
      status: "ambiguous" as const,
      candidates: scored.slice(0, 3).filter((item) => item.score >= 50).map((item) => item.relativePath),
    };
  }

  const folder = expectedFolder(input.kind) ?? "000 - Inbox";
  const relativePath = path.join(folder, safeEntityFilename(input.subject));
  return {
    target: await safeTarget(relativePath, "append"),
    relativePath,
    status: "new" as const,
    candidates: [] as string[],
  };
}

export async function curateObsidianMemory(rawInput: unknown) {
  const input = curatedMemorySchema.parse(rawInput);
  const resolved = await resolveCuratedTarget(input);
  let content: string;
  let created = false;

  try {
    content = await fs.readFile(resolved.target, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    created = true;
    content = `---\ntitle: ${input.subject}\naliases: []\ntags: [entity, ${input.kind}]\n---\n\n# ${input.subject}\n`;
  }

  if (resolved.status === "ambiguous") {
    const entry = `- **${input.subject}** (${input.kind}): ${input.fact}\n  - Posibles notas: ${resolved.candidates.map((candidate) => `[[${candidate.replace(/\.md$/, "")}]]`).join(", ") || "ninguna"}`;
    const update = addBulletToSection(content, "Memoria pendiente de resolver", entry);
    if (update.changed) {
      await atomicWriteMarkdown(resolved.target, update.content);
      await recordObsidianRevision({
        relativePath: resolved.relativePath,
        beforeContent: created ? "" : content,
        afterContent: update.content,
        operation: created ? "create" : "update",
      });
    }
    await prisma.shadowMemory.upsert({
      where: { kind_canonicalKey_content: { kind: input.kind, canonicalKey: normalizeMemoryValue(input.subject), content: input.fact } },
      create: {
        kind: input.kind,
        subject: input.subject,
        canonicalKey: normalizeMemoryValue(input.subject),
        content: input.fact,
        source: "conversation",
        sourceRef: resolved.relativePath,
        confidence: Math.min(input.confidence, 0.6),
        sensitive: input.sensitive,
      },
      update: { confidence: Math.min(input.confidence, 0.6), sourceRef: resolved.relativePath },
    });
    return { status: update.changed ? "queued" : "duplicate", path: resolved.relativePath, connectionsAdded: 0 };
  }

  let updated = addBulletToSection(content, "Memoria de Shadow", `- ${input.fact}`);
  let changed = updated.changed;
  let connectionsAdded = 0;
  for (const relatedEntity of input.relatedEntities) {
    const connection = addBulletToSection(updated.content, "🔗 Conexiones", `- [[${relatedEntity}]]`);
    if (connection.changed) connectionsAdded += 1;
    changed = changed || connection.changed;
    updated = connection;
  }
  if (created || changed) {
    await atomicWriteMarkdown(resolved.target, updated.content);
    await recordObsidianRevision({
      relativePath: resolved.relativePath,
      beforeContent: created ? "" : content,
      afterContent: updated.content,
      operation: created ? "create" : "update",
    });
  }

  const entity = await upsertLifeEntity({
    kind: input.kind,
    name: input.subject,
    description: input.fact,
    confidence: input.confidence,
  });

  await prisma.shadowMemory.upsert({
    where: { kind_canonicalKey_content: { kind: input.kind, canonicalKey: normalizeMemoryValue(input.subject), content: input.fact } },
    create: {
      kind: input.kind,
      subject: input.subject,
      canonicalKey: normalizeMemoryValue(input.subject),
      content: input.fact,
      source: "conversation",
      sourceRef: resolved.relativePath,
      entityId: entity.id,
      confidence: input.confidence,
      sensitive: input.sensitive,
      lastConfirmedAt: new Date(),
    },
    update: {
      confidence: input.confidence,
      sensitive: input.sensitive,
      sourceRef: resolved.relativePath,
      entityId: entity.id,
      lastConfirmedAt: new Date(),
      active: true,
    },
  });

  if (created || changed) {
    await publishLifeEvent({
      type: "memory.curated",
      source: "obsidian",
      sourceId: `${resolved.relativePath}:${contentHash(updated.content)}`,
      summary: `${input.subject} fue consolidado en la memoria personal.`,
      payload: { kind: input.kind, subject: input.subject, path: resolved.relativePath, connectionsAdded },
    });
  }

  return {
    status: created ? "created" : changed ? "updated" : "duplicate",
    path: resolved.relativePath,
    connectionsAdded,
  };
}

export async function restoreObsidianRevision(rawId: unknown) {
  const id = z.string().uuid().parse(rawId);
  const revision = await prisma.obsidianRevision.findUnique({ where: { id } });
  if (!revision || revision.status !== "applied") throw new ValidationError("La revisión no está disponible para restaurar.");
  const target = await safeTarget(revision.path, "append");
  const current = await fs.readFile(target, "utf8");
  if (contentHash(current) !== revision.afterHash) {
    throw new ValidationError("La nota cambió después de esta revisión; no se sobrescribió.");
  }

  if (revision.operation === "create" && revision.beforeContent === "") await fs.unlink(target);
  else await atomicWriteMarkdown(target, revision.beforeContent);
  await prisma.obsidianRevision.update({
    where: { id },
    data: { status: "reverted", revertedAt: new Date() },
  });
  await publishLifeEvent({
    type: "memory.reverted",
    source: "obsidian",
    sourceId: revision.id,
    summary: `Se restauró la revisión de ${revision.path}.`,
    payload: { revisionId: revision.id, path: revision.path },
  });
  return { success: true as const };
}
