"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { serverConfig } from "@/lib/config";
import { dateKey } from "@/lib/dates";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { publishLifeEvent } from "@/features/shadow/events";
import { upsertLifeEntity } from "@/features/shadow/life-graph";
import {
  appendUnderHeading,
  cleanEntityName,
  CONNECTIONS_HEADING,
  datedBullet,
  entityNoteContent,
  findSections,
  hasFact,
  MEMORY_HEADING,
  oneLineFact,
  sectionBody,
  withoutQualifier,
  type EntityTipo,
} from "@/features/vault/conventions";
import { atomicWrite, cleanEntryName } from "@/features/vault/fs";
import { getVaultIndex, invalidateVaultIndex, type IndexedNote, type VaultIndex } from "@/features/vault/index";
import { readNote, saveNote } from "@/features/vault/ops";
import { basenameOf, nameKey, splitLinkInner } from "@/features/vault/parse";
import { contentHash, recordObsidianRevision } from "@/features/vault/revisions";
import { canonicalLink, dailyNoteName, propagateToDaily, resolveEntityLink } from "@/features/vault/shadow-writes";

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
  "group",
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

type MemoryKind = z.infer<typeof memoryKindSchema>;

const MEMORY_INBOX = "000 - Inbox/Shadow Memory Inbox.md";
const PENDING_HEADING = "Memoria pendiente de resolver";

const KIND_TIPO: Record<MemoryKind, EntityTipo> = {
  person: "persona",
  relationship: "persona",
  place: "lugar",
  project: "proyecto",
  concept: "concepto",
  group: "grupo",
  preference: "sistema",
  goal: "sistema",
  routine: "sistema",
};

function normalizeMemoryValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Nombres con los que una nota puede referirse a su entidad. */
function noteIdentities(note: IndexedNote): string[] {
  const identities = new Set<string>([note.title, ...note.parsed.aliases]);
  const title = note.parsed.frontmatter.title;
  if (typeof title === "string") identities.add(title);
  const heading = note.parsed.headings.find((item) => item.level === 1)?.text;
  if (heading) identities.add(heading.replace(/^[^\p{L}\p{N}]+/u, ""));
  return [...identities].filter(Boolean);
}

function expectedFolder(kind: MemoryKind): string | undefined {
  if (kind === "person" || kind === "relationship") return "500 - Entidades/Personas";
  if (kind === "place") return "500 - Entidades/Lugares";
  if (kind === "group") return "500 - Entidades/Grupos";
  if (kind === "project") return "100 - Proyectos";
  if (kind === "concept") return "500 - Entidades/Conceptos";
  return undefined;
}

function fixedMemoryTarget(kind: MemoryKind): string | undefined {
  if (kind === "preference") return "900 - Sistema/Directivas de Shadow.md";
  if (kind === "goal") return "001 - Status Board.md";
  if (kind === "routine") return "900 - Sistema/Rutina Diaria.md";
  return undefined;
}

function candidateScore(subject: string, identities: string[], relativePath: string, kind: MemoryKind): number {
  const target = normalizeMemoryValue(subject);
  let score = 0;
  for (const identity of identities) {
    const candidate = normalizeMemoryValue(identity);
    if (candidate === target) score = Math.max(score, 100);
    else if (normalizeMemoryValue(withoutQualifier(identity)) === target) score = Math.max(score, 95);
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

type CuratedTarget =
  | { status: "matched" | "new"; path: string }
  | { status: "ambiguous"; path: string; candidates: string[] };

function resolveCuratedTarget(index: VaultIndex, kind: MemoryKind, subject: string): CuratedTarget {
  const fixed = fixedMemoryTarget(kind);
  if (fixed) return { status: "matched", path: fixed };

  const scored = [...index.notes.values()]
    .filter((note) => note.path !== MEMORY_INBOX && !/(^|\/)plantillas?\//i.test(note.path))
    .map((note) => ({ path: note.path, score: candidateScore(subject, noteIdentities(note), note.path, kind) }))
    .sort((a, b) => b.score - a.score);
  const [best, second] = scored;

  if (best && best.score >= 90 && (!second || best.score - second.score >= 5)) return { status: "matched", path: best.path };
  if (best && best.score >= 65) {
    return {
      status: "ambiguous",
      path: MEMORY_INBOX,
      candidates: scored.slice(0, 3).filter((item) => item.score >= 50).map((item) => item.path),
    };
  }
  const folder = expectedFolder(kind) ?? "000 - Inbox";
  return { status: "new", path: `${folder}/${cleanEntryName(subject)}.md` };
}

async function readIfExists(notePath: string): Promise<string | null> {
  try {
    return (await readNote(notePath)).content;
  } catch (error) {
    if (error instanceof NotFoundError) return null;
    throw error;
  }
}

/** ¿La sección de conexiones ya enlaza a esta entidad? */
function hasConnection(index: VaultIndex, content: string, notePath: string, link: { link: string; path: string | null }): boolean {
  const wanted = nameKey(link.link);
  return findSections(content, CONNECTIONS_HEADING).some((section) => {
    for (const match of sectionBody(content, section).matchAll(/\[\[([^\]]+)\]\]/g)) {
      const { target } = splitLinkInner(match[1]);
      if (!target) continue;
      if (nameKey(target) === wanted) return true;
      if (link.path && index.resolve(target, notePath) === link.path) return true;
    }
    return false;
  });
}

async function saveRevisioned(notePath: string, before: string | null, after: string) {
  await saveNote(notePath, after);
  await recordObsidianRevision({
    relativePath: notePath,
    beforeContent: before ?? "",
    afterContent: after,
    operation: before === null ? "create" : "update",
  });
}

const INBOX_SKELETON = `---
tipo: sistema
tags: [inbox, shadow]
---

# Shadow Memory Inbox

> [!info] Resumen
> Hechos que [[Shadow]] no pudo asignar con certeza a una nota. Muévelos a su entidad y bórralos de aquí.
`;

/**
 * Memoria silenciosa de Shadow (`remember_personal_context`). Sigue el
 * Protocolo de Conexiones: encuentra la nota de la entidad (o la crea con el
 * formato de la bóveda), agrega un bullet fechado al final de la única
 * `## Memoria de Shadow`, conecta entidades reales en `## 🔗 Conexiones` y
 * propaga el hecho a la sección “🔁 Propagado a” del diario (Directivas §6).
 */
export async function curateObsidianMemory(rawInput: unknown) {
  const input = curatedMemorySchema.parse(rawInput);
  const subject = cleanEntityName(input.subject);
  if (!subject) throw new ValidationError("Nombre de entidad inválido.");
  const fact = oneLineFact(input.fact);
  const canonicalKey = normalizeMemoryValue(subject);
  const today = dateKey(new Date(), serverConfig.timezone);
  const index = await getVaultIndex();
  const resolved = resolveCuratedTarget(index, input.kind, subject);

  if (resolved.status === "ambiguous") {
    const before = await readIfExists(resolved.path);
    const candidates = resolved.candidates.map((candidate) => `[[${canonicalLink(index, candidate)}]]`).join(", ") || "ninguna";
    const headline = `**${subject}** (${input.kind}): ${fact}`;
    const changed = !hasFact(before ?? "", headline);
    if (changed) {
      const entry = `- **[${today}]** ${headline}\n  - Posibles notas: ${candidates}`;
      await saveRevisioned(resolved.path, before, appendUnderHeading(before ?? INBOX_SKELETON, PENDING_HEADING, entry));
    }
    await prisma.shadowMemory.upsert({
      where: { kind_canonicalKey_content: { kind: input.kind, canonicalKey, content: input.fact } },
      create: {
        kind: input.kind,
        subject: input.subject,
        canonicalKey,
        content: input.fact,
        source: "conversation",
        sourceRef: resolved.path,
        confidence: Math.min(input.confidence, 0.6),
        sensitive: input.sensitive,
      },
      update: { confidence: Math.min(input.confidence, 0.6), sourceRef: resolved.path },
    });
    return { status: changed ? "queued" as const : "duplicate" as const, path: resolved.path, connectionsAdded: 0, propagatedTo: null };
  }

  const notePath = resolved.path;
  const before = await readIfExists(notePath);
  const created = before === null;
  const dailyName = await dailyNoteName().catch(() => null);
  const bullet = datedBullet(today, fact, dailyName);

  const seen = new Set<string>();
  const links = input.relatedEntities
    .map((name) => resolveEntityLink(index, name, notePath))
    .filter((link): link is NonNullable<typeof link> => {
      if (!link || seen.has(nameKey(link.link))) return false;
      seen.add(nameKey(link.link));
      return true;
    });

  let after: string;
  let memoryAdded = false;
  let connectionsAdded = 0;
  if (created) {
    after = entityNoteContent({
      name: basenameOf(notePath),
      tipo: KIND_TIPO[input.kind],
      summary: fact,
      connections: links.map((link) => link.link),
      bullet,
    });
    memoryAdded = true;
    connectionsAdded = links.length;
  } else {
    after = before;
    if (!hasFact(before, fact)) {
      after = appendUnderHeading(after, MEMORY_HEADING, bullet, { which: "last" });
      memoryAdded = true;
    }
    for (const link of links) {
      if (hasConnection(index, after, notePath, link)) continue;
      after = appendUnderHeading(after, CONNECTIONS_HEADING, `- [[${link.link}]]`, { before: MEMORY_HEADING });
      connectionsAdded += 1;
    }
  }
  const changed = created || after !== before;
  if (changed) await saveRevisioned(notePath, before, after);

  const entity = await upsertLifeEntity({
    kind: input.kind,
    name: input.subject,
    description: input.fact,
    confidence: input.confidence,
  });

  await prisma.shadowMemory.upsert({
    where: { kind_canonicalKey_content: { kind: input.kind, canonicalKey, content: input.fact } },
    create: {
      kind: input.kind,
      subject: input.subject,
      canonicalKey,
      content: input.fact,
      source: "conversation",
      sourceRef: notePath,
      entityId: entity.id,
      confidence: input.confidence,
      sensitive: input.sensitive,
      lastConfirmedAt: new Date(),
    },
    update: {
      confidence: input.confidence,
      sensitive: input.sensitive,
      sourceRef: notePath,
      entityId: entity.id,
      lastConfirmedAt: new Date(),
      active: true,
    },
  });

  // Los hechos nacen en el diario: la nota del día lista qué se tocó.
  let propagatedTo: string | null = null;
  if (memoryAdded) {
    const title = basenameOf(notePath);
    const link = created ? (index.resolve(title) ? notePath.replace(/\.md$/i, "") : title) : canonicalLink(index, notePath);
    try {
      propagatedTo = (await propagateToDaily(link, fact)).path;
    } catch (error) {
      console.error(`Shadow daily propagation failed: ${error instanceof Error ? error.message : "error desconocido"}`);
    }
  }

  if (changed) {
    await publishLifeEvent({
      type: "memory.curated",
      source: "obsidian",
      sourceId: `${notePath}:${contentHash(after)}`,
      summary: `${input.subject} fue consolidado en la memoria personal.`,
      payload: { kind: input.kind, subject: input.subject, path: notePath, connectionsAdded, propagatedTo },
    });
  }

  return {
    status: created ? "created" as const : changed ? "updated" as const : "duplicate" as const,
    path: notePath,
    connectionsAdded,
    propagatedTo,
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
  else await atomicWrite(target, revision.beforeContent);
  invalidateVaultIndex();
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
