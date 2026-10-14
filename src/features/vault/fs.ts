import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { serverConfig } from "@/lib/config";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";

/** Archivos que la app muestra en el explorador (igual que Obsidian por defecto). */
const VISIBLE_EXTENSIONS = new Set([
  "md", "canvas", "base", "png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp",
  "pdf", "mp3", "m4a", "wav", "ogg", "mp4", "webm", "mov", "excalidraw",
]);

export type VaultFile = {
  path: string;
  name: string;
  ext: string;
  size: number;
  mtime: number;
  ctime: number;
};

export async function vaultRoot(): Promise<string> {
  if (!serverConfig.paths.vault) throw new ValidationError("OBSIDIAN_VAULT_PATH no está configurado.");
  return fs.realpath(serverConfig.paths.vault);
}

function assertInside(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new ForbiddenError("Intento de acceso fuera de la bóveda.");
}

/** Normaliza una ruta relativa de la bóveda (siempre con `/`, NFC, sin `./`). */
export function cleanVaultPath(input: string): string {
  if (typeof input !== "string" || input.includes("\0") || input.length > 1_000) throw new ValidationError("Ruta inválida.");
  const normalized = input.normalize("NFC").replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").replace(/\/{2,}/g, "/");
  const parts = normalized.split("/").filter((part) => part !== "" && part !== ".");
  if (parts.some((part) => part === "..")) throw new ForbiddenError("Ruta fuera de la bóveda.");
  if (parts.some((part) => part.startsWith("."))) throw new ForbiddenError("No se permiten rutas ocultas.");
  return parts.join("/");
}

/** Valida un nombre de archivo o carpeta (sin `/`). */
export function cleanEntryName(input: string): string {
  const name = input.normalize("NFC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim();
  if (!name || name === "." || name === ".." || name.startsWith(".")) throw new ValidationError("Nombre inválido.");
  if (name.length > 200) throw new ValidationError("El nombre es demasiado largo.");
  return name;
}

async function nearestExisting(target: string): Promise<string> {
  let current = target;
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

/**
 * Convierte una ruta relativa en absoluta y verifica que siga dentro de la
 * bóveda incluso después de resolver enlaces simbólicos.
 */
export async function absoluteVaultPath(relativePath: string, mode: "existing" | "new" = "existing"): Promise<string> {
  const root = await vaultRoot();
  const clean = cleanVaultPath(relativePath);
  const target = path.resolve(root, clean);
  assertInside(root, target);
  if (mode === "existing") {
    let real: string;
    try {
      real = await fs.realpath(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new NotFoundError(`No existe: ${clean}`);
      throw error;
    }
    assertInside(root, real);
    return real;
  }
  assertInside(root, await nearestExisting(path.dirname(target)));
  try {
    const stat = await fs.lstat(target);
    if (stat.isSymbolicLink()) throw new ForbiddenError("No se permite escribir mediante enlaces simbólicos.");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  return target;
}

export async function pathExists(absolutePath: string): Promise<boolean> {
  try {
    await fs.lstat(absolutePath);
    return true;
  } catch {
    return false;
  }
}

/** Escritura atómica: archivo temporal oculto y luego rename. */
export async function atomicWrite(absolutePath: string, content: string) {
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  const temporary = path.join(path.dirname(absolutePath), `.${path.basename(absolutePath)}.valleos-${process.pid}-${Date.now()}.tmp`);
  await fs.writeFile(temporary, content, "utf8");
  await fs.rename(temporary, absolutePath);
}

/** Recorre la bóveda sin entrar a carpetas ocultas (.obsidian, .trash) ni seguir symlinks. */
export async function walkVault(): Promise<{ root: string; files: VaultFile[]; folders: string[] }> {
  const root = await vaultRoot();
  const files: VaultFile[] = [];
  const folders: string[] = [];

  async function walk(directory: string, relative: string) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    await Promise.all(entries.map(async (entry) => {
      if (entry.name.startsWith(".") || entry.isSymbolicLink()) return;
      const name = entry.name.normalize("NFC");
      const childRelative = relative ? `${relative}/${name}` : name;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        folders.push(childRelative);
        await walk(absolute, childRelative);
        return;
      }
      if (!entry.isFile()) return;
      const dot = name.lastIndexOf(".");
      const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
      if (!VISIBLE_EXTENSIONS.has(ext)) return;
      const stat = await fs.stat(absolute);
      files.push({ path: childRelative, name, ext, size: stat.size, mtime: stat.mtimeMs, ctime: stat.birthtimeMs || stat.ctimeMs });
    }));
  }

  await walk(root, "");
  return { root, files, folders };
}

/** Mueve un archivo o carpeta a `.trash/` (la papelera propia de Obsidian). */
export async function moveToTrash(relativePath: string): Promise<string> {
  const root = await vaultRoot();
  const source = await absoluteVaultPath(relativePath, "existing");
  const trashDir = path.join(root, ".trash");
  await fs.mkdir(trashDir, { recursive: true });
  const base = path.basename(source);
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  let destination = path.join(trashDir, base);
  for (let index = 1; await pathExists(destination); index += 1) {
    destination = path.join(trashDir, `${stem} ${index}${ext}`);
  }
  await fs.rename(source, destination);
  return path.relative(root, destination);
}

/** Lee un JSON de configuración de `.obsidian/` sin fallar si no existe. */
export async function readObsidianConfig<T>(file: string): Promise<T | null> {
  try {
    const root = await vaultRoot();
    const content = await fs.readFile(path.join(root, ".obsidian", file), "utf8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}
