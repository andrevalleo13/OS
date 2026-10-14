"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Bookmark,
  CalendarDays,
  CornerDownLeft,
  FilePlus2,
  FileText,
  FolderInput,
  FolderPlus,
  LayoutTemplate,
  Network,
  PanelLeft,
  PanelRight,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import type { VaultSnapshot } from "@/app/actions/vault";
import { basenameOf, folderOf } from "@/features/vault/parse";
import {
  createFolderFlow,
  createNoteFlow,
  defaultNoteFolder,
  deleteFlow,
  insertTemplateFlow,
  moveFlow,
  newNoteFromTemplateFlow,
  openDailyFlow,
  renameFlow,
} from "./actions";
import { activeNotePath, useVaultStore } from "./store";
import { Kbd } from "./ui";

function Frame({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            className="w-full max-w-[620px] overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0d0d0d]/95 shadow-[0_40px_120px_rgba(0,0,0,0.65)] backdrop-blur-3xl"
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 560, damping: 38 }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const itemClass = "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-white/65 transition-colors data-[selected=true]:bg-white/[0.08] data-[selected=true]:text-white";

/** ⌘O: cambiar de nota rápido, como el "Quick switcher" de Obsidian. */
export function QuickSwitcher({ snapshot }: { snapshot: VaultSnapshot }) {
  const open = useVaultStore((state) => state.switcherOpen);
  const setOpen = useVaultStore((state) => state.setSwitcherOpen);
  const openNote = useVaultStore((state) => state.openNote);
  const history = useVaultStore((state) => state.history);
  const [query, setQuery] = useState("");

  const items = useMemo(() => {
    const recent = [...new Set([...history].reverse())];
    const rank = new Map(recent.map((path, index) => [path, index]));
    const mtime = new Map(snapshot.files.map((file) => [file.path, file.mtime]));
    return [...snapshot.notes].sort((a, b) => (rank.get(a.path) ?? 999) - (rank.get(b.path) ?? 999) || (mtime.get(b.path) ?? 0) - (mtime.get(a.path) ?? 0));
  }, [snapshot, history]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <Frame open={open} onClose={close}>
      <Command
        label="Cambiar de nota"
        loop
        onKeyDown={async (event) => {
          if (event.key === "Escape") close();
          if (event.key === "Enter" && event.shiftKey && query.trim()) {
            event.preventDefault();
            close();
            await createNoteFlow({ folder: defaultNoteFolder(snapshot), name: query.trim() });
          }
        }}
      >
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
          <Search className="h-4 w-4 text-white/35" />
          <Command.Input autoFocus value={query} onValueChange={setQuery} placeholder="Busca una nota o escribe un nombre nuevo…" className="vault-plain-input h-12 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/30" />
        </div>
        <Command.List className="max-h-[52vh] overflow-y-auto p-1.5 [scrollbar-width:thin]">
          <Command.Empty className="px-3 py-6 text-center text-[12px] text-white/35">
            <span className="text-white/60">⇧ Enter</span> para crear “{query}”
          </Command.Empty>
          {items.slice(0, query ? 400 : 60).map((note) => (
            <Command.Item
              key={note.path}
              value={`${note.title} ${note.aliases.join(" ")} ${note.path}`}
              onSelect={() => {
                close();
                openNote(note.path);
              }}
              className={itemClass}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-white/30" />
              <span className="min-w-0 flex-1 truncate">{note.title}{note.aliases.length > 0 && <span className="ml-2 text-[11px] text-white/30">{note.aliases.join(", ")}</span>}</span>
              <span className="max-w-[40%] shrink-0 truncate font-mono text-[10px] text-white/25">{folderOf(note.path)}</span>
            </Command.Item>
          ))}
        </Command.List>
        <div className="flex items-center gap-4 border-t border-white/[0.06] px-4 py-2 text-[10px] text-white/30">
          <span className="flex items-center gap-1.5"><Kbd>↵</Kbd> abrir</span>
          <span className="flex items-center gap-1.5"><Kbd>⇧↵</Kbd> crear</span>
          <span className="flex items-center gap-1.5"><Kbd>esc</Kbd> cerrar</span>
        </div>
      </Command>
    </Frame>
  );
}

type VaultCommand = { id: string; label: string; icon: ReactNode; shortcut?: string; run: () => void; needsNote?: boolean };

/** ⌘P: paleta de comandos de la bóveda. */
export function VaultCommandPalette({ snapshot, open, onClose }: { snapshot: VaultSnapshot; open: boolean; onClose: () => void }) {
  const state = useVaultStore();
  const path = activeNotePath(state);
  const commands: VaultCommand[] = [
    { id: "new", label: "Nueva nota", icon: <FilePlus2 className="h-3.5 w-3.5" />, shortcut: "⌘N", run: () => void createNoteFlow({ folder: defaultNoteFolder(snapshot), ask: true }) },
    { id: "new-template", label: "Nueva nota desde plantilla", icon: <LayoutTemplate className="h-3.5 w-3.5" />, run: () => void newNoteFromTemplateFlow(snapshot) },
    { id: "daily", label: "Abrir la nota de hoy", icon: <CalendarDays className="h-3.5 w-3.5" />, shortcut: "⌥D", run: () => void openDailyFlow() },
    { id: "switch", label: "Cambiar de nota", icon: <CornerDownLeft className="h-3.5 w-3.5" />, shortcut: "⌘O", run: () => state.setSwitcherOpen(true) },
    { id: "search", label: "Buscar en la bóveda", icon: <Search className="h-3.5 w-3.5" />, shortcut: "⌘⇧F", run: () => state.search(state.searchQuery) },
    { id: "graph", label: "Abrir vista de grafo", icon: <Network className="h-3.5 w-3.5" />, shortcut: "⌘G", run: () => state.openGraph() },
    { id: "folder", label: "Nueva carpeta", icon: <FolderPlus className="h-3.5 w-3.5" />, run: () => void createFolderFlow() },
    { id: "toggle-reading", label: "Alternar lectura / edición", icon: <BookOpen className="h-3.5 w-3.5" />, shortcut: "⌘E", needsNote: true, run: () => {
      const tab = state.tabs.find((item) => item.id === state.activeId);
      if (tab?.kind === "note") state.setMode(tab.id, tab.mode === "reading" ? state.defaultMode === "reading" ? "live" : state.defaultMode : "reading");
    } },
    { id: "template", label: "Insertar plantilla", icon: <LayoutTemplate className="h-3.5 w-3.5" />, shortcut: "⌘⇧T", needsNote: true, run: () => void insertTemplateFlow(path) },
    { id: "rename", label: "Renombrar nota", icon: <Pencil className="h-3.5 w-3.5" />, shortcut: "F2", needsNote: true, run: () => path && void renameFlow(path) },
    { id: "move", label: "Mover nota a otra carpeta", icon: <FolderInput className="h-3.5 w-3.5" />, needsNote: true, run: () => path && void moveFlow(path, snapshot) },
    { id: "bookmark", label: "Fijar / quitar nota", icon: <Bookmark className="h-3.5 w-3.5" />, shortcut: "⌘⇧B", needsNote: true, run: () => path && state.toggleBookmark(path) },
    { id: "delete", label: "Eliminar nota", icon: <Trash2 className="h-3.5 w-3.5" />, needsNote: true, run: () => path && void deleteFlow(path) },
    { id: "left", label: "Mostrar / ocultar panel izquierdo", icon: <PanelLeft className="h-3.5 w-3.5" />, shortcut: "⌘\\", run: () => state.toggleLeft() },
    { id: "right", label: "Mostrar / ocultar panel derecho", icon: <PanelRight className="h-3.5 w-3.5" />, shortcut: "⌘⇧\\", run: () => state.toggleRight() },
  ];

  return (
    <Frame open={open} onClose={onClose}>
      <Command label="Comandos de la bóveda" loop onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}>
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
          <span className="font-mono text-[11px] text-white/30">›</span>
          <Command.Input autoFocus placeholder="Escribe un comando…" className="vault-plain-input h-12 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/30" />
          {path && <span className="max-w-[40%] truncate text-[10px] text-white/30">{basenameOf(path)}</span>}
        </div>
        <Command.List className="max-h-[52vh] overflow-y-auto p-1.5 [scrollbar-width:thin]">
          <Command.Empty className="px-3 py-6 text-center text-[12px] text-white/35">Sin comandos</Command.Empty>
          {commands.filter((command) => !command.needsNote || path).map((command) => (
            <Command.Item key={command.id} value={command.label} onSelect={() => {
              onClose();
              command.run();
            }} className={itemClass}>
              <span className="text-white/40">{command.icon}</span>
              <span className="flex-1">{command.label}</span>
              {command.shortcut && <span className="font-mono text-[10px] text-white/25">{command.shortcut}</span>}
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </Frame>
  );
}
