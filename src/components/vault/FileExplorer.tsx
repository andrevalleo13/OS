"use client";

import { useEffect, useMemo, useState, type DragEvent, type MouseEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownAZ,
  Bookmark,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
  File,
  FileImage,
  FilePlus2,
  FileText,
  FolderClosed,
  FolderInput,
  FolderOpen,
  FolderPlus,
  ListCollapse,
  PanelTopOpen,
  Pencil,
  Trash2,
} from "lucide-react";
import type { VaultSnapshot } from "@/app/actions/vault";
import { basenameOf, folderOf } from "@/features/vault/parse";
import { createFolderFlow, createNoteFlow, deleteFlow, moveEntry, moveFlow, obsidianUri, renameFlow } from "./actions";
import { activeNotePath, useVaultStore } from "./store";
import { IconButton, openContextMenu, toast } from "./ui";

type TreeNode = {
  name: string;
  path: string;
  folder: boolean;
  ext: string;
  mtime: number;
  children: TreeNode[];
};

type SortMode = "name" | "modified";

const collator = new Intl.Collator("es", { numeric: true, sensitivity: "base" });

function buildTree(snapshot: VaultSnapshot, sort: SortMode): TreeNode[] {
  const root: TreeNode = { name: "", path: "", folder: true, ext: "", mtime: 0, children: [] };
  const folders = new Map<string, TreeNode>([["", root]]);
  const ensureFolder = (path: string): TreeNode => {
    const existing = folders.get(path);
    if (existing) return existing;
    const parent = ensureFolder(folderOf(path));
    const node: TreeNode = { name: path.split("/").pop() ?? path, path, folder: true, ext: "", mtime: 0, children: [] };
    parent.children.push(node);
    folders.set(path, node);
    return node;
  };
  for (const folder of snapshot.folders) ensureFolder(folder);
  for (const file of snapshot.files) {
    const parent = ensureFolder(folderOf(file.path));
    parent.children.push({ name: file.ext === "md" ? basenameOf(file.path) : file.name, path: file.path, folder: false, ext: file.ext, mtime: file.mtime, children: [] });
    let cursor: TreeNode | undefined = parent;
    while (cursor) {
      cursor.mtime = Math.max(cursor.mtime, file.mtime);
      cursor = cursor.path ? folders.get(folderOf(cursor.path)) : undefined;
    }
  }
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.folder !== b.folder) return a.folder ? -1 : 1;
      if (sort === "modified" && !a.folder) return b.mtime - a.mtime;
      return collator.compare(a.name, b.name);
    });
    for (const node of nodes) sortNodes(node.children);
  };
  sortNodes(root.children);
  return root.children;
}

const EXPANDED_KEY = "valleos.vault.expanded";

function readExpanded(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function writeExpanded(expanded: Set<string>) {
  try {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expanded]));
  } catch {
    // sin almacenamiento
  }
}

function fileIcon(node: TreeNode) {
  if (node.ext === "md") return null;
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"].includes(node.ext)) return <FileImage className="h-3.5 w-3.5" />;
  return <File className="h-3.5 w-3.5" />;
}

type RowProps = {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (path: string) => void;
  activePath: string | null;
  snapshot: VaultSnapshot;
  dropTarget: string | null;
  setDropTarget: (path: string | null) => void;
};

function TreeRow({ node, depth, expanded, toggle, activePath, snapshot, dropTarget, setDropTarget }: RowProps) {
  const openNote = useVaultStore((state) => state.openNote);
  const toggleBookmark = useVaultStore((state) => state.toggleBookmark);
  const bookmarked = useVaultStore((state) => state.bookmarks.includes(node.path));
  const isOpen = expanded.has(node.path);
  const isActive = activePath === node.path;
  const isDrop = dropTarget === node.path;

  const onDragStart = (event: DragEvent) => {
    event.dataTransfer.setData("application/x-vault-path", node.path);
    event.dataTransfer.setData("text/plain", node.folder ? node.path : `[[${node.name}]]`);
    event.dataTransfer.effectAllowed = "move";
  };
  const onDrop = async (event: DragEvent) => {
    event.preventDefault();
    setDropTarget(null);
    const from = event.dataTransfer.getData("application/x-vault-path");
    const targetFolder = node.folder ? node.path : folderOf(node.path);
    if (!from || folderOf(from) === targetFolder || from === targetFolder || targetFolder.startsWith(`${from}/`)) return;
    const name = from.split("/").pop() ?? from;
    await moveEntry(from, targetFolder ? `${targetFolder}/${name}` : name);
  };

  const menu = (event: MouseEvent) => openContextMenu(event, node.folder ? [
    { label: "Nueva nota", icon: <FilePlus2 className="h-3.5 w-3.5" />, onSelect: () => void createNoteFlow({ folder: node.path, ask: true }) },
    { label: "Nueva carpeta", icon: <FolderPlus className="h-3.5 w-3.5" />, onSelect: () => void createFolderFlow(node.path) },
    "separator",
    { label: "Renombrar", icon: <Pencil className="h-3.5 w-3.5" />, onSelect: () => void renameFlow(node.path, true) },
    { label: "Mover a…", icon: <FolderInput className="h-3.5 w-3.5" />, onSelect: () => void moveFlow(node.path, snapshot) },
    { label: "Copiar ruta", icon: <Copy className="h-3.5 w-3.5" />, onSelect: () => void navigator.clipboard.writeText(node.path).then(() => toast("Ruta copiada")) },
    "separator",
    { label: "Eliminar", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, onSelect: () => void deleteFlow(node.path, true) },
  ] : [
    { label: "Abrir en pestaña nueva", icon: <PanelTopOpen className="h-3.5 w-3.5" />, shortcut: "⌘ clic", onSelect: () => openNote(node.path, { newTab: true }) },
    { label: "Abrir en Obsidian", icon: <ExternalLink className="h-3.5 w-3.5" />, onSelect: () => window.open(obsidianUri(snapshot.name, node.path), "_self") },
    "separator",
    { label: bookmarked ? "Quitar de fijadas" : "Fijar", icon: <Bookmark className="h-3.5 w-3.5" />, onSelect: () => toggleBookmark(node.path) },
    { label: "Copiar enlace", icon: <Copy className="h-3.5 w-3.5" />, onSelect: () => void navigator.clipboard.writeText(`[[${node.name}]]`).then(() => toast("Enlace copiado")) },
    { label: "Renombrar", icon: <Pencil className="h-3.5 w-3.5" />, shortcut: "F2", onSelect: () => void renameFlow(node.path) },
    { label: "Mover a…", icon: <FolderInput className="h-3.5 w-3.5" />, onSelect: () => void moveFlow(node.path, snapshot) },
    "separator",
    { label: "Eliminar", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, onSelect: () => void deleteFlow(node.path) },
  ]);

  return (
    <div>
      <div
        role="treeitem"
        aria-expanded={node.folder ? isOpen : undefined}
        aria-selected={isActive}
        tabIndex={-1}
        draggable
        onDragStart={onDragStart}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes("application/x-vault-path")) return;
          event.preventDefault();
          setDropTarget(node.folder ? node.path : folderOf(node.path));
        }}
        onDragLeave={() => setDropTarget(null)}
        onDrop={onDrop}
        onContextMenu={menu}
        onClick={(event) => {
          if (node.folder) toggle(node.path);
          else if (node.ext === "md") openNote(node.path, { newTab: event.metaKey || event.ctrlKey });
          else window.open(`/api/vault/file?path=${encodeURIComponent(node.path)}`, "_blank", "noreferrer");
        }}
        onKeyDown={(event) => {
          if (event.key === "F2") void renameFlow(node.path, node.folder);
        }}
        style={{ paddingLeft: 8 + depth * 14 }}
        className={`group relative flex h-[26px] cursor-pointer select-none items-center gap-1.5 rounded-md pr-2 text-[12.5px] transition-colors duration-100 ${
          isActive ? "bg-white/[0.09] text-white" : isDrop ? "bg-white/[0.07] text-white" : "text-white/62 hover:bg-white/[0.045] hover:text-white/90"
        }`}
      >
        {depth > 0 && <span className="pointer-events-none absolute top-0 bottom-0 w-px bg-white/[0.05]" style={{ left: 8 + (depth - 1) * 14 + 6 }} />}
        {node.folder ? (
          <motion.span animate={{ rotate: isOpen ? 90 : 0 }} transition={{ duration: 0.15 }} className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-white/35">
            <ChevronRight className="h-3 w-3" />
          </motion.span>
        ) : (
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center text-white/30">{fileIcon(node)}</span>
        )}
        {node.folder && <span className="shrink-0 text-white/35">{isOpen ? <FolderOpen className="h-3.5 w-3.5" /> : <FolderClosed className="h-3.5 w-3.5" />}</span>}
        <span className={`truncate ${node.folder ? "font-medium text-white/72" : ""}`}>{node.name}</span>
        {!node.folder && node.ext !== "md" && <span className="ml-auto shrink-0 rounded border border-white/[0.08] px-1 font-mono text-[8.5px] uppercase text-white/30">{node.ext}</span>}
        {bookmarked && <Bookmark className="ml-auto h-3 w-3 shrink-0 fill-white/40 text-white/40" />}
      </div>
      <AnimatePresence initial={false}>
        {node.folder && isOpen && (
          <motion.div
            role="group"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            {node.children.map((child) => (
              <TreeRow key={child.path} node={child} depth={depth + 1} expanded={expanded} toggle={toggle} activePath={activePath} snapshot={snapshot} dropTarget={dropTarget} setDropTarget={setDropTarget} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FileExplorer({ snapshot }: { snapshot: VaultSnapshot }) {
  const activePath = useVaultStore(activeNotePath);
  const [sort, setSort] = useState<SortMode>("name");
  const [expanded, setExpanded] = useState<Set<string>>(() => readExpanded());
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const tree = useMemo(() => buildTree(snapshot, sort), [snapshot, sort]);
  const defaultFolder = snapshot.folders.includes("000 - Inbox") ? "000 - Inbox" : "";

  // Revela la nota activa: abre sus carpetas padre.
  useEffect(() => {
    if (!activePath) return;
    const parents: string[] = [];
    let folder = folderOf(activePath);
    while (folder) {
      parents.push(folder);
      folder = folderOf(folder);
    }
    if (parents.every((parent) => expanded.has(parent))) return;
    const next = new Set(expanded);
    for (const parent of parents) next.add(parent);
    setExpanded(next);
    writeExpanded(next);
    // Solo al cambiar de nota.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath]);

  const toggle = (path: string) => {
    const next = new Set(expanded);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setExpanded(next);
    writeExpanded(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-1 px-2 pb-2 pt-1">
        <div className="flex items-center gap-0.5">
          <IconButton label="Nueva nota" shortcut="⌘N" onClick={() => void createNoteFlow({ folder: defaultFolder, ask: true })}><FilePlus2 className="h-3.5 w-3.5" /></IconButton>
          <IconButton label="Nueva carpeta" onClick={() => void createFolderFlow()}><FolderPlus className="h-3.5 w-3.5" /></IconButton>
          <IconButton label={sort === "name" ? "Ordenar por modificación" : "Ordenar por nombre"} active={sort === "modified"} onClick={() => setSort(sort === "name" ? "modified" : "name")}>
            {sort === "name" ? <ArrowDownAZ className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
          </IconButton>
          <IconButton label="Colapsar todo" onClick={() => {
            setExpanded(new Set());
            writeExpanded(new Set());
          }}><ListCollapse className="h-3.5 w-3.5" /></IconButton>
        </div>
        <span className="font-mono text-[9.5px] text-white/25">{snapshot.notes.length} notas</span>
      </div>
      <div
        role="tree"
        aria-label="Archivos de la bóveda"
        className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-6 [scrollbar-width:thin]"
        onDragOver={(event) => {
          if (event.target === event.currentTarget && event.dataTransfer.types.includes("application/x-vault-path")) {
            event.preventDefault();
            setDropTarget("");
          }
        }}
        onDrop={async (event) => {
          if (event.target !== event.currentTarget) return;
          event.preventDefault();
          setDropTarget(null);
          const from = event.dataTransfer.getData("application/x-vault-path");
          if (from && folderOf(from)) await moveEntry(from, from.split("/").pop() ?? from);
        }}
      >
        {tree.map((node) => (
          <TreeRow key={node.path} node={node} depth={0} expanded={expanded} toggle={toggle} activePath={activePath} snapshot={snapshot} dropTarget={dropTarget} setDropTarget={setDropTarget} />
        ))}
        {!tree.length && (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-[11px] text-white/30">
            <FileText className="h-5 w-5" />
            La bóveda está vacía
          </div>
        )}
      </div>
    </div>
  );
}
