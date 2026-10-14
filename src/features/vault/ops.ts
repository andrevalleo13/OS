import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { toZonedTime } from "date-fns-tz";
import { serverConfig } from "@/lib/config";
import { ValidationError } from "@/lib/errors";
import {
  absoluteVaultPath,
  atomicWrite,
  cleanEntryName,
  cleanVaultPath,
  moveToTrash,
  pathExists,
  readObsidianConfig,
  vaultRoot,
} from "./fs";
import { getVaultIndex, invalidateVaultIndex } from "./index";
import { basenameOf, createLinkResolver, folderOf, nameKey, rewriteWikiLinks } from "./parse";
import { formatMoment, renderTemplate } from "./template";

const MAX_NOTE = 2_000_000;

export function vaultNow(): Date {
  return toZonedTime(new Date(), serverConfig.timezone);
}

export async function readNote(notePath: string) {
  const clean = cleanVaultPath(notePath);
  const absolute = await absoluteVaultPath(clean);
  const [content, stat] = await Promise.all([fs.readFile(absolute, "utf8"), fs.stat(absolute)]);
  return { path: clean, content, mtime: stat.mtimeMs };
}

export type SaveResult =
  | { ok: true; mtime: number }
  | { ok: false; conflict: true; content: string; mtime: number };

/**
 * Guarda el contenido completo de una nota. Si el archivo cambió en disco
 * desde `baseMtime` (Obsidian, Sync o Shadow lo tocaron) y el contenido es
 * distinto, no sobrescribe y devuelve la versión actual.
 */
export async function saveNote(notePath: string, content: string, baseMtime?: number): Promise<SaveResult> {
  if (content.length > MAX_NOTE) throw new ValidationError("La nota es demasiado grande.");
  const clean = cleanVaultPath(notePath);
  const absolute = await absoluteVaultPath(clean, "new");
  if (baseMtime !== undefined && await pathExists(absolute)) {
    const stat = await fs.stat(absolute);
    if (Math.abs(stat.mtimeMs - baseMtime) > 1) {
      const current = await fs.readFile(absolute, "utf8");
      if (current !== content) return { ok: false, conflict: true, content: current, mtime: stat.mtimeMs };
      return { ok: true, mtime: stat.mtimeMs };
    }
  }
  await atomicWrite(absolute, content);
  invalidateVaultIndex();
  return { ok: true, mtime: (await fs.stat(absolute)).mtimeMs };
}

async function uniquePath(folder: string, name: string, ext: string): Promise<string> {
  const root = await vaultRoot();
  for (let index = 0; index < 500; index += 1) {
    const candidate = [folder, `${name}${index ? ` ${index}` : ""}${ext}`].filter(Boolean).join("/");
    if (!await pathExists(path.join(root, candidate))) return candidate;
  }
  throw new ValidationError("No pude encontrar un nombre libre.");
}

export async function listTemplates(): Promise<{ path: string; name: string }[]> {
  const core = await readObsidianConfig<{ folder?: string }>("templates.json");
  const templater = await readObsidianConfig<{ templates_folder?: string }>("plugins/templater-obsidian/data.json");
  const folders = [core?.folder, templater?.templates_folder, "900 - Sistema/Plantillas"]
    .filter((folder): folder is string => Boolean(folder))
    .map((folder) => folder.replace(/^\/+|\/+$/g, ""));
  const index = await getVaultIndex();
  const seen = new Set<string>();
  const templates: { path: string; name: string }[] = [];
  for (const note of index.notes.values()) {
    if (!folders.some((folder) => note.path.startsWith(`${folder}/`))) continue;
    if (!/plantilla|template/i.test(note.path) && !folders.includes(folderOf(note.path))) continue;
    if (seen.has(note.path)) continue;
    seen.add(note.path);
    templates.push({ path: note.path, name: note.title });
  }
  return templates.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

export async function renderTemplateFile(templatePath: string, title: string, date = vaultNow()): Promise<string> {
  const { content } = await readNote(templatePath);
  return renderTemplate(content, { title, date });
}

export async function createNote(input: { folder?: string; name?: string; template?: string; content?: string }) {
  const folder = input.folder ? cleanVaultPath(input.folder) : "";
  const name = cleanEntryName((input.name ?? "Sin título").replace(/\.md$/i, ""));
  const notePath = await uniquePath(folder, name, ".md");
  const title = basenameOf(notePath);
  const body = input.template
    ? await renderTemplateFile(input.template, title)
    : input.content ?? "";
  await atomicWrite(await absoluteVaultPath(notePath, "new"), body);
  invalidateVaultIndex();
  return { path: notePath };
}

export async function createFolder(folderPath: string) {
  const clean = cleanVaultPath(folderPath);
  if (!clean) throw new ValidationError("Nombre de carpeta inválido.");
  cleanEntryName(clean.split("/").pop() ?? "");
  await fs.mkdir(await absoluteVaultPath(clean, "new"), { recursive: true });
  invalidateVaultIndex();
  return { path: clean };
}

/**
 * Renombra o mueve un archivo o carpeta y actualiza todos los enlaces que
 * apuntaban ahí, como hace Obsidian con "Actualizar enlaces internos".
 */
export async function renameEntry(fromPath: string, toPath: string) {
  const from = cleanVaultPath(fromPath);
  const to = cleanVaultPath(toPath);
  if (!from || !to) throw new ValidationError("Ruta inválida.");
  if (from === to) return { path: to, updatedLinks: 0, updatedNotes: 0 };
  cleanEntryName(to.split("/").pop() ?? "");
  if (to.startsWith(`${from}/`)) throw new ValidationError("No puedes mover una carpeta dentro de sí misma.");

  const source = await absoluteVaultPath(from);
  const destination = await absoluteVaultPath(to, "new");
  if (await pathExists(destination) && nameKey(from) !== nameKey(to)) throw new ValidationError("Ya existe un archivo con ese nombre.");

  const before = await getVaultIndex();
  const isFolder = (await fs.stat(source)).isDirectory();
  const moved = new Map<string, string>();
  for (const file of before.files) {
    if (isFolder ? file.path.startsWith(`${from}/`) : file.path === from) {
      moved.set(file.path, isFolder ? `${to}${file.path.slice(from.length)}` : to);
    }
  }

  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.rename(source, destination);

  const afterPaths = before.files.map((file) => moved.get(file.path) ?? file.path);
  const aliases = new Map<string, string>();
  for (const note of before.notes.values()) {
    for (const alias of note.parsed.aliases) aliases.set(nameKey(alias), moved.get(note.path) ?? note.path);
  }
  const resolveAfter = createLinkResolver(afterPaths, aliases);
  const root = before.root;
  let updatedLinks = 0;
  let updatedNotes = 0;

  for (const note of before.notes.values()) {
    const notePathAfter = moved.get(note.path) ?? note.path;
    const result = rewriteWikiLinks(note.text, (link, raw) => {
      const resolvedBefore = before.resolve(link.target, note.path);
      if (!resolvedBefore || !moved.has(resolvedBefore)) return null;
      const newPath = moved.get(resolvedBefore) as string;
      const isMarkdown = newPath.endsWith(".md");
      const shortName = isMarkdown ? basenameOf(newPath) : newPath.split("/").pop() ?? newPath;
      const unique = resolveAfter(shortName, notePathAfter) === newPath;
      const pathStyle = link.target.includes("/") || !unique;
      const newTarget = pathStyle ? (isMarkdown ? newPath.replace(/\.md$/, "") : newPath) : shortName;
      if (nameKey(newTarget) === nameKey(link.target)) return null;
      const inner = `${newTarget}${link.subpath ? `#${link.subpath}` : ""}${link.alias ? `|${link.alias}` : ""}`;
      return raw.startsWith("!") ? `![[${inner}]]` : `[[${inner}]]`;
    });
    if (result.changed) {
      updatedLinks += result.changed;
      updatedNotes += 1;
      await atomicWrite(path.join(root, notePathAfter), result.text);
    }
  }

  invalidateVaultIndex();
  return { path: to, updatedLinks, updatedNotes };
}

export async function deleteEntry(entryPath: string) {
  const trashed = await moveToTrash(cleanVaultPath(entryPath));
  invalidateVaultIndex();
  return { trashed };
}

type DailySettings = { folder: string; format: string; template: string | null };

export async function dailySettings(): Promise<DailySettings> {
  const core = await readObsidianConfig<{ folder?: string; format?: string; template?: string }>("daily-notes.json");
  return {
    folder: (core?.folder ?? "Diario").replace(/^\/+|\/+$/g, ""),
    format: core?.format || "YYYY-MM-DD",
    template: core?.template ? core.template.replace(/\.md$/, "") : null,
  };
}

/** Abre (o crea desde la plantilla) la nota diaria de una fecha `YYYY-MM-DD`. */
export async function getOrCreateDailyNote(dateKey?: string) {
  const settings = await dailySettings();
  const date = dateKey ? new Date(`${dateKey}T12:00:00`) : vaultNow();
  if (Number.isNaN(date.getTime())) throw new ValidationError("Fecha inválida.");
  const name = formatMoment(date, settings.format);
  const notePath = cleanVaultPath([settings.folder, `${name}.md`].filter(Boolean).join("/"));
  const absolute = await absoluteVaultPath(notePath, "new");
  if (await pathExists(absolute)) return { path: notePath, created: false };

  let body = "";
  if (settings.template) {
    const index = await getVaultIndex();
    const templatePath = index.resolve(settings.template) ?? index.resolve(basenameOf(settings.template));
    if (templatePath) body = await renderTemplateFile(templatePath, basenameOf(notePath), date);
  }
  await atomicWrite(absolute, body);
  invalidateVaultIndex();
  return { path: notePath, created: true };
}

/**
 * Inserta texto al final de una sección `## Encabezado` (comparando sin
 * emojis ni enlaces). Si la sección no existe, la crea al final.
 */
export function appendToSection(content: string, heading: string, text: string): string {
  const key = (value: string) => value
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim()
    .toLocaleLowerCase("es");
  const wanted = key(heading);
  const lines = content.split("\n");
  const start = lines.findIndex((line) => /^#{1,6}\s/.test(line) && key(line.replace(/^#+\s*/, "")) === wanted);
  if (start === -1) return `${content.trimEnd()}\n\n## ${heading}\n${text}\n`;
  const level = (/^#+/.exec(lines[start]) ?? ["##"])[0].length;
  let end = start + 1;
  while (end < lines.length && !(new RegExp(`^#{1,${level}}\\s`).test(lines[end]))) end += 1;
  let insertAt = end;
  while (insertAt > start + 1 && !lines[insertAt - 1].trim()) insertAt -= 1;
  // Quita un bullet vacío de plantilla ("- ") si es lo único en la sección.
  const sectionLines = lines.slice(start + 1, insertAt).filter((line) => line.trim());
  if (sectionLines.length && sectionLines.every((line) => /^\s*-\s*$/.test(line) || /^_.*_$/.test(line.trim()))) {
    const emptyBullet = lines.slice(start + 1, insertAt).findIndex((line) => /^\s*-\s*$/.test(line));
    if (emptyBullet !== -1) {
      lines.splice(start + 1 + emptyBullet, 1);
      insertAt -= 1;
    }
  }
  lines.splice(insertAt, 0, ...text.split("\n"));
  return lines.join("\n");
}

export async function appendToNoteSection(notePath: string, heading: string, text: string) {
  const { content } = await readNote(notePath);
  const next = appendToSection(content, heading, text);
  await atomicWrite(await absoluteVaultPath(notePath, "new"), next);
  invalidateVaultIndex();
  return { path: cleanVaultPath(notePath) };
}
