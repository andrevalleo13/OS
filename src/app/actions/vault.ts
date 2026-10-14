"use server";

import { z } from "zod";
import { assertLocalAction as assertLocal } from "@/lib/local-action";
import { serverConfig } from "@/lib/config";
import { getVaultIndex, localGraph, noteMeta, searchVault, vaultGraph } from "@/features/vault/index";
import {
  createFolder,
  createNote,
  dailySettings,
  deleteEntry,
  getOrCreateDailyNote,
  listTemplates,
  readNote,
  renameEntry,
  renderTemplateFile,
  saveNote,
} from "@/features/vault/ops";

const pathSchema = z.string().min(1).max(1_000);

export async function getVaultSnapshot() {
  await assertLocal();
  if (!serverConfig.paths.vault) return { available: false as const };
  const index = await getVaultIndex();
  const daily = await dailySettings();
  return {
    available: true as const,
    name: index.root.split("/").pop() ?? "Bóveda",
    files: index.files.map(({ path, name, ext, mtime, ctime, size }) => ({ path, name, ext, mtime, ctime, size })),
    folders: index.folders,
    notes: [...index.notes.values()].map((note) => ({
      path: note.path,
      title: note.title,
      aliases: note.parsed.aliases,
      kind: typeof note.parsed.frontmatter.tipo === "string" ? note.parsed.frontmatter.tipo : null,
    })),
    tags: [...index.tags.entries()].map(([tag, set]) => ({ tag, count: set.size })).sort((a, b) => b.count - a.count),
    unresolved: [...index.unresolved.entries()].map(([target, entry]) => ({ target, count: entry.count })),
    dailyFolder: daily.folder,
  };
}

export type VaultSnapshot = Extract<Awaited<ReturnType<typeof getVaultSnapshot>>, { available: true }>;

export async function getVaultNote(notePath: string) {
  await assertLocal();
  return readNote(pathSchema.parse(notePath));
}

export async function saveVaultNote(notePath: string, content: string, baseMtime?: number) {
  await assertLocal();
  return saveNote(pathSchema.parse(notePath), z.string().max(2_000_000).parse(content), z.number().optional().parse(baseMtime));
}

export async function getVaultNoteMeta(notePath: string) {
  await assertLocal();
  const index = await getVaultIndex();
  return noteMeta(index, pathSchema.parse(notePath));
}

export async function searchVaultNotes(query: string) {
  await assertLocal();
  const index = await getVaultIndex();
  return searchVault(index, z.string().max(500).parse(query));
}

export async function createVaultNote(input: { folder?: string; name?: string; template?: string; content?: string }) {
  await assertLocal();
  const parsed = z.object({
    folder: z.string().max(1_000).optional(),
    name: z.string().max(200).optional(),
    template: z.string().max(1_000).optional(),
    content: z.string().max(2_000_000).optional(),
  }).parse(input);
  return createNote(parsed);
}

export async function createVaultFolder(folderPath: string) {
  await assertLocal();
  return createFolder(pathSchema.parse(folderPath));
}

export async function renameVaultEntry(fromPath: string, toPath: string) {
  await assertLocal();
  return renameEntry(pathSchema.parse(fromPath), pathSchema.parse(toPath));
}

export async function deleteVaultEntry(entryPath: string) {
  await assertLocal();
  return deleteEntry(pathSchema.parse(entryPath));
}

export async function openDailyNote(dateKey?: string) {
  await assertLocal();
  return getOrCreateDailyNote(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().parse(dateKey));
}

export async function getVaultGraph(options: { local?: string; depth?: number; unresolved?: boolean; tags?: boolean; orphans?: boolean } = {}) {
  await assertLocal();
  const parsed = z.object({
    local: z.string().max(1_000).optional(),
    depth: z.number().int().min(1).max(3).optional(),
    unresolved: z.boolean().optional(),
    tags: z.boolean().optional(),
    orphans: z.boolean().optional(),
  }).parse(options);
  const index = await getVaultIndex();
  return parsed.local
    ? localGraph(index, parsed.local, parsed.depth ?? 1)
    : vaultGraph(index, { unresolved: parsed.unresolved, tags: parsed.tags, orphans: parsed.orphans });
}

export async function getVaultTemplates() {
  await assertLocal();
  return listTemplates();
}

export async function renderVaultTemplate(templatePath: string, title: string) {
  await assertLocal();
  return renderTemplateFile(pathSchema.parse(templatePath), z.string().max(200).parse(title));
}
