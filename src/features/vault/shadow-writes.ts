import "server-only";

import { NotFoundError, ValidationError } from "@/lib/errors";
import {
  appendUnderHeading,
  cleanEntityName,
  dropEmptyBullets,
  existingHeading,
  factKey,
  findSections,
  flattenNestedLinks,
  headingKey,
  MEMORY_HEADING,
  noteProblems,
  PROPAGATED_HEADING,
  shortFact,
  snippetProblems,
  withoutQualifier,
} from "./conventions";
import { cleanEntryName, cleanVaultPath } from "./fs";
import { getVaultIndex, type VaultIndex } from "./index";
import {
  appendToSection,
  createNote,
  dailySettings,
  getOrCreateDailyNote,
  readNote,
  saveNote,
  vaultNow,
} from "./ops";
import { basenameOf, foldText } from "./parse";
import { recordObsidianRevision } from "./revisions";
import { formatMoment } from "./template";

/**
 * Escrituras de Shadow en la bóveda: resuelven notas como lo hace un
 * `[[enlace]]`, respetan las convenciones (`conventions.ts`) y dejan una
 * revisión restaurable de cada cambio.
 */

// ---------------------------------------------------------------------------
// Resolución de notas
// ---------------------------------------------------------------------------

function uniqueMatch(index: VaultIndex, test: (names: string[]) => boolean): string | null {
  let found: string | null = null;
  for (const note of index.notes.values()) {
    if (!test([note.title, ...note.parsed.aliases])) continue;
    if (found) return null;
    found = note.path;
  }
  return found;
}

/**
 * Ruta de una nota a partir de lo que diría un enlace: ruta exacta, nombre
 * (sin importar mayúsculas), alias, y como último recurso un nombre único sin
 * acentos o sin el calificador entre paréntesis (`Jerry` → `Jerry (UP)`).
 */
export function resolveNotePath(index: VaultIndex, target: string): string | null {
  let clean = target.normalize("NFC").trim().replace(/^\/+/, "");
  const whole = /^!?\[\[([^\]]*)\]\]$/.exec(flattenNestedLinks(clean));
  if (whole) clean = whole[1].split("|")[0].split("#")[0].trim();
  if (!clean) return null;

  try {
    const exact = cleanVaultPath(/\.md$/i.test(clean) ? clean : `${clean}.md`);
    if (index.notes.has(exact)) return exact;
  } catch {
    // No es una ruta válida; se intenta como nombre.
  }
  const resolved = index.resolve(clean.replace(/\.md$/i, ""));
  if (resolved && index.notes.has(resolved)) return resolved;

  const name = foldText(basenameOf(clean));
  if (!name) return null;
  return uniqueMatch(index, (names) => names.some((candidate) => foldText(candidate) === name))
    ?? uniqueMatch(index, (names) => foldText(withoutQualifier(names[0])) === name);
}

/** Cómo enlazar una nota: su nombre si es inequívoco, si no la ruta. */
export function canonicalLink(index: VaultIndex, notePath: string): string {
  const title = basenameOf(notePath);
  return index.resolve(title) === notePath ? title : notePath.replace(/\.md$/i, "");
}

/** Enlace limpio a una entidad mencionada por el modelo (o null si no sirve). */
export function resolveEntityLink(index: VaultIndex, raw: string, selfPath?: string): { link: string; path: string | null } | null {
  const name = cleanEntityName(raw);
  if (!name) return null;
  const notePath = resolveNotePath(index, name);
  if (notePath && notePath === selfPath) return null;
  return { link: notePath ? canonicalLink(index, notePath) : name, path: notePath };
}

export async function readVaultNote(target: string) {
  const index = await getVaultIndex();
  const notePath = resolveNotePath(index, target);
  if (!notePath) throw new NotFoundError(`No encontré la nota “${target}”. Búscala con search_obsidian.`);
  return readNote(notePath);
}

/** Nombre de la nota diaria (sin crearla), igual que `getOrCreateDailyNote`. */
export async function dailyNoteName(dateKey?: string): Promise<string> {
  const settings = await dailySettings();
  const date = dateKey ? new Date(`${dateKey}T12:00:00`) : vaultNow();
  return basenameOf(formatMoment(date, settings.format));
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

type WriteOptions = {
  /** Registra una revisión restaurable (cambios de Shadow). */
  record?: boolean;
  /** Valida enlaces anidados y enlaces en código (texto de Shadow). */
  validate?: boolean;
};

export type WriteResult = { path: string; changed: boolean; created: boolean; revisionId?: string };

async function commit(notePath: string, before: string, after: string, created: boolean, record: boolean) {
  await saveNote(notePath, after);
  if (!record) return undefined;
  const revision = await recordObsidianRevision({
    relativePath: notePath,
    beforeContent: created ? "" : before,
    afterContent: after,
    operation: created ? "create" : "update",
  });
  return revision.id;
}

function cleanHeading(section: string): string {
  const heading = flattenNestedLinks(section.replace(/^#+\s*/, "").replace(/\s+/g, " ").trim()).replace(/\[\[|\]\]/g, "");
  if (!headingKey(heading)) throw new ValidationError("Sección inválida.");
  return heading;
}

function assertSnippet(text: string) {
  const problems = snippetProblems(text);
  if (problems.length) throw new ValidationError(problems.join(" "));
}

/** ¿Todo lo que se quiere escribir ya está en la nota? (reintentos idempotentes) */
function alreadyWritten(content: string, text: string, byFact: boolean): boolean {
  const wanted = text.split("\n").map((line) => line.trim()).filter((line) => line && !/^[-*+]$/.test(line));
  if (!wanted.length) return false;
  const lines = content.split("\n").map((line) => line.trim());
  const existing = new Set(lines);
  const facts = byFact ? new Set(lines.map(factKey).filter(Boolean)) : null;
  return wanted.every((line) => existing.has(line) || Boolean(facts?.has(factKey(line))));
}

function appendAtEnd(content: string, text: string): string {
  const base = content.replace(/\s+$/, "");
  if (!base) return `${text}\n`;
  const list = /^\s*(?:[-*+]|\d+\.)\s/;
  const glue = list.test(base.split("\n").at(-1) ?? "") && list.test(text) ? "\n" : "\n\n";
  return `${base}${glue}${text}\n`;
}

/**
 * Inserta texto en una sección existente (tolerando emojis, acentos y
 * corchetes) o la crea al final. La memoria de Shadow siempre va a la última
 * sección `Memoria de Shadow` para mantener el orden cronológico.
 */
function appendInSection(content: string, section: string, text: string): string {
  const heading = existingHeading(content, section) ?? cleanHeading(section);
  if (headingKey(heading) === headingKey(MEMORY_HEADING)) return appendUnderHeading(content, heading, text, { which: "last" });
  return appendToSection(dropEmptyBullets(content, heading), heading, text);
}

/** Carpetas donde Shadow puede crear notas: las raíces PARA numeradas y sus subcarpetas. */
function creatableFolders(index: VaultIndex): string[] {
  return index.folders
    .filter((folder) => /^\d{3} - /.test(folder) && !/(^|\/)plantillas?(\/|$)/i.test(folder))
    .sort((a, b) => a.localeCompare(b, "es"));
}

function matchFolder(index: VaultIndex, input: string): string | null {
  const wanted = foldText(cleanVaultPath(input));
  const folders = creatableFolders(index);
  const exact = folders.find((folder) => foldText(folder) === wanted);
  if (exact) return exact;
  const byLeaf = folders.filter((folder) => foldText(folder.split("/").pop() ?? folder) === wanted);
  return byLeaf.length === 1 ? byLeaf[0] : null;
}

export async function createVaultNote(input: { folder: string; title: string; content: string }, options: WriteOptions = {}) {
  const index = await getVaultIndex();
  const folder = matchFolder(index, input.folder);
  if (!folder) {
    const roots = creatableFolders(index).filter((candidate) => !candidate.includes("/") || candidate.startsWith("500 - Entidades/"));
    throw new ValidationError(`Carpeta no válida: “${input.folder}”. Usa una existente: ${roots.join(", ")}.`);
  }

  const title = cleanEntryName(cleanEntityName(input.title).replace(/\//g, " "));
  const existing = resolveNotePath(index, title);
  if (existing) {
    throw new ValidationError(`Ya existe [[${canonicalLink(index, existing)}]] (${existing}). No la dupliques: usa append_to_obsidian_note para agregarle contenido.`);
  }

  const content = `${input.content.replace(/\r\n/g, "\n").replace(/\s+$/, "")}\n`;
  const problems = noteProblems(content, { entity: folder.startsWith("500 - Entidades/") });
  if (problems.length) throw new ValidationError(`La nota no sigue las convenciones de la bóveda: ${problems.join(" ")}`);

  const { path: notePath } = await createNote({ folder, name: title, content });
  let revisionId: string | undefined;
  if (options.record !== false) {
    const revision = await recordObsidianRevision({ relativePath: notePath, beforeContent: "", afterContent: content, operation: "create" });
    revisionId = revision.id;
  }
  return { path: notePath, title: basenameOf(notePath), changed: true, created: true, revisionId };
}

export async function appendToVaultNote(
  input: { target: string; section?: string; content: string },
  options: WriteOptions = {},
): Promise<WriteResult> {
  const index = await getVaultIndex();
  const notePath = resolveNotePath(index, input.target);
  if (!notePath) {
    throw new NotFoundError(`No encontré la nota “${input.target}”. Búscala con search_obsidian o, si es nueva, créala con create_obsidian_note.`);
  }
  const text = input.content.replace(/\r\n/g, "\n").trim();
  if (!text) throw new ValidationError("No hay contenido que agregar.");
  if (options.validate !== false) assertSnippet(text);

  const { content: before } = await readNote(notePath);
  if (findSections(text, MEMORY_HEADING).length && findSections(before, MEMORY_HEADING).length) {
    throw new ValidationError("La nota ya tiene “## Memoria de Shadow”: agrega los bullets con section: \"Memoria de Shadow\" en lugar de crear otra sección.");
  }
  const toMemory = input.section ? headingKey(input.section) === headingKey(MEMORY_HEADING) : false;
  if (alreadyWritten(before, text, toMemory)) return { path: notePath, changed: false, created: false };

  const after = input.section ? appendInSection(before, input.section, text) : appendAtEnd(before, text);
  const revisionId = await commit(notePath, before, after, false, options.record !== false);
  return { path: notePath, changed: true, created: false, revisionId };
}

/**
 * Escribe en la nota diaria (la crea desde la plantilla si hace falta). Con
 * `replaceLinePrefix`, sustituye la línea de la sección que empiece así en
 * lugar de duplicarla (p. ej. el resumen de nutrición al cerrar el día).
 */
export async function appendToDaily(
  input: { section: string; content: string; date?: string; replaceLinePrefix?: string },
  options: WriteOptions = {},
): Promise<WriteResult> {
  const text = input.content.replace(/\r\n/g, "\n").trim();
  if (!text) throw new ValidationError("No hay contenido que agregar.");
  if (options.validate !== false) assertSnippet(text);

  const daily = await getOrCreateDailyNote(input.date);
  const { content: before } = await readNote(daily.path);
  let after: string | null = null;

  if (input.replaceLinePrefix) {
    const section = findSections(before, input.section, { prefix: true })[0];
    if (section) {
      const lines = before.split("\n");
      const target = lines.findIndex((line, index) => index > section.line && index < section.end && line.trim().startsWith(input.replaceLinePrefix as string));
      if (target !== -1) {
        if (lines[target].trim() === text) return { path: daily.path, changed: false, created: daily.created };
        lines.splice(target, 1, ...text.split("\n"));
        after = lines.join("\n");
      }
    }
  }
  if (after === null) {
    if (alreadyWritten(before, text, false)) return { path: daily.path, changed: false, created: daily.created };
    after = appendInSection(before, input.section, text);
  }

  const revisionId = await commit(daily.path, before, after, daily.created, options.record !== false);
  return { path: daily.path, changed: true, created: daily.created, revisionId };
}

/**
 * Directivas §6.2: tras escribir en una nota de entidad, se lista en la
 * sección “🔁 Propagado a” del día como `- [[Nota]] — hecho corto`.
 */
export async function propagateToDaily(link: string, fact: string): Promise<WriteResult> {
  return appendToDaily({ section: PROPAGATED_HEADING, content: `- [[${link}]] — ${shortFact(fact)}` }, { validate: false });
}
