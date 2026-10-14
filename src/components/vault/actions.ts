"use client";

import type { EditorView } from "@codemirror/view";
import {
  createVaultFolder,
  createVaultNote,
  deleteVaultEntry,
  getVaultTemplates,
  openDailyNote,
  renameVaultEntry,
  renderVaultTemplate,
  type VaultSnapshot,
} from "@/app/actions/vault";
import { basenameOf, folderOf, splitLinkInner, type LinkResolver } from "@/features/vault/parse";
import { useVaultStore } from "./store";
import { askConfirm, askPick, askText, toast } from "./ui";
import { refreshVault } from "./useVault";

/** Carpeta para notas nuevas: el Inbox del sistema PARA si existe. */
export function defaultNoteFolder(snapshot: VaultSnapshot | null): string {
  return snapshot?.folders.includes("000 - Inbox") ? "000 - Inbox" : "";
}

function failure(error: unknown) {
  toast(error instanceof Error ? error.message : "Algo falló.");
}

export async function createNoteFlow(options: { folder?: string; name?: string; template?: string; newTab?: boolean; ask?: boolean } = {}) {
  try {
    let name = options.name;
    if (options.ask) {
      const answer = await askText("Nueva nota", name ?? "", { confirm: "Crear", label: options.folder ? `En ${options.folder}` : "En la raíz" });
      if (!answer) return null;
      name = answer;
    }
    const { path } = await createVaultNote({ folder: options.folder, name: name ?? "Sin título", template: options.template });
    refreshVault();
    useVaultStore.getState().openNote(path, { newTab: options.newTab });
    return path;
  } catch (error) {
    failure(error);
    return null;
  }
}

export async function createFolderFlow(parent = "") {
  const name = await askText("Nueva carpeta", "", { confirm: "Crear", label: parent ? `Dentro de ${parent}` : "En la raíz" });
  if (!name) return;
  try {
    await createVaultFolder(parent ? `${parent}/${name}` : name);
    refreshVault();
  } catch (error) {
    failure(error);
  }
}

export async function renameFlow(path: string, isFolder = false) {
  const current = isFolder ? path.split("/").pop() ?? path : (path.endsWith(".md") ? basenameOf(path) : path.split("/").pop() ?? path);
  const answer = await askText(isFolder ? "Renombrar carpeta" : "Renombrar nota", current, { confirm: "Renombrar", selectStem: !path.endsWith(".md") && !isFolder });
  if (!answer || answer === current) return;
  const folder = folderOf(path);
  const name = !isFolder && path.endsWith(".md") ? `${answer.replace(/\.md$/i, "")}.md` : answer;
  await moveEntry(path, folder ? `${folder}/${name}` : name);
}

export async function moveEntry(from: string, to: string) {
  try {
    const result = await renameVaultEntry(from, to);
    useVaultStore.getState().renamePath(from, result.path);
    refreshVault();
    if (result.updatedLinks) toast(`${result.updatedLinks} enlace${result.updatedLinks === 1 ? "" : "s"} actualizado${result.updatedLinks === 1 ? "" : "s"} en ${result.updatedNotes} nota${result.updatedNotes === 1 ? "" : "s"}`);
    return result.path;
  } catch (error) {
    failure(error);
    return null;
  }
}

export async function moveFlow(path: string, snapshot: VaultSnapshot | null) {
  if (!snapshot) return;
  const name = path.split("/").pop() ?? path;
  const options = [{ value: "", label: "/ (raíz)" }, ...snapshot.folders
    .filter((folder) => folder !== path && !folder.startsWith(`${path}/`) && folder !== folderOf(path))
    .sort((a, b) => a.localeCompare(b, "es", { numeric: true }))
    .map((folder) => ({ value: folder, label: folder }))];
  const target = await askPick(`Mover "${name.replace(/\.md$/, "")}" a…`, options, "Escribe una carpeta");
  if (target === null) return;
  await moveEntry(path, target ? `${target}/${name}` : name);
}

export async function deleteFlow(path: string, isFolder = false) {
  const name = isFolder ? path : basenameOf(path);
  const ok = await askConfirm(
    isFolder ? `¿Eliminar la carpeta "${name}"?` : `¿Eliminar "${name}"?`,
    "Se mueve a la papelera de la bóveda (.trash), igual que en Obsidian. Puedes recuperarlo desde ahí.",
    { confirm: "Mover a la papelera", danger: true },
  );
  if (!ok) return;
  try {
    await deleteVaultEntry(path);
    useVaultStore.getState().removePath(path);
    refreshVault();
    toast("Movido a la papelera");
  } catch (error) {
    failure(error);
  }
}

export async function openDailyFlow(options: { newTab?: boolean; date?: string } = {}) {
  try {
    const { path, created } = await openDailyNote(options.date);
    if (created) refreshVault();
    useVaultStore.getState().openNote(path, { newTab: options.newTab });
  } catch (error) {
    failure(error);
  }
}

/** Abre un wikilink; si no existe, crea la nota como Obsidian. */
export async function followLink(rawTarget: string, fromPath: string, resolve: LinkResolver, snapshot: VaultSnapshot | null, options: { newTab?: boolean } = {}) {
  const { target, subpath } = splitLinkInner(rawTarget);
  if (!target && subpath) {
    useVaultStore.getState().openNote(fromPath, { heading: subpath });
    return;
  }
  const resolved = resolve(target, fromPath);
  if (resolved) {
    useVaultStore.getState().openNote(resolved, { newTab: options.newTab, heading: subpath });
    return;
  }
  const folder = target.includes("/") ? folderOf(target) : defaultNoteFolder(snapshot);
  await createNoteFlow({ folder, name: target.split("/").pop() ?? target, newTab: options.newTab });
}

// ---------------------------------------------------------------------------
// Editor activo (para insertar plantillas o texto desde comandos)
// ---------------------------------------------------------------------------

let activeEditor: { view: EditorView; path: string } | null = null;

export function setActiveEditor(view: EditorView | null, path?: string) {
  activeEditor = view && path ? { view, path } : null;
}

export function insertAtCursor(text: string): boolean {
  if (!activeEditor) return false;
  const { view } = activeEditor;
  const { from, to } = view.state.selection.main;
  view.dispatch({ changes: { from, to, insert: text }, selection: { anchor: from + text.length }, scrollIntoView: true });
  view.focus();
  return true;
}

export async function insertTemplateFlow(notePath: string | null) {
  if (!notePath) return;
  try {
    const templates = await getVaultTemplates();
    if (!templates.length) {
      toast("No encontré plantillas");
      return;
    }
    const choice = await askPick("Insertar plantilla", templates.map((template) => ({ value: template.path, label: template.name, hint: folderOf(template.path) })), "Elige una plantilla");
    if (!choice) return;
    const text = await renderVaultTemplate(choice, basenameOf(notePath));
    if (!insertAtCursor(text)) toast("Abre la nota en modo edición para insertar la plantilla");
  } catch (error) {
    failure(error);
  }
}

export async function newNoteFromTemplateFlow(snapshot: VaultSnapshot | null) {
  try {
    const templates = await getVaultTemplates();
    const choice = await askPick("Nueva nota desde plantilla", templates.map((template) => ({ value: template.path, label: template.name, hint: folderOf(template.path) })), "Elige una plantilla");
    if (!choice) return;
    const lower = choice.toLowerCase();
    const folder = lower.includes("persona") ? "500 - Entidades/Personas"
      : lower.includes("proyecto") ? "100 - Proyectos"
        : lower.includes("deducc") ? "500 - Entidades/Deducciones"
          : defaultNoteFolder(snapshot);
    await createNoteFlow({ folder: snapshot?.folders.includes(folder) ? folder : defaultNoteFolder(snapshot), template: choice, ask: true });
  } catch (error) {
    failure(error);
  }
}

export function obsidianUri(vaultName: string, path: string): string {
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(path.replace(/\.md$/, ""))}`;
}
