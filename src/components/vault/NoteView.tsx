"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";
import {
  BookOpen,
  Bookmark,
  Code2,
  Copy,
  ExternalLink,
  FolderInput,
  LayoutTemplate,
  Loader2,
  MoreHorizontal,
  PenLine,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { getVaultNote, saveVaultNote, type VaultSnapshot } from "@/app/actions/vault";
import { basenameOf, folderOf, foldText, parseNote, type LinkResolver } from "@/features/vault/parse";
import NoteEditor from "./editor/NoteEditor";
import type { VaultEditorContext } from "./editor/context";
import NoteReader from "./reader/NoteReader";
import { deleteFlow, followLink, insertTemplateFlow, moveEntry, moveFlow, obsidianUri, setActiveEditor } from "./actions";
import { useVaultStore, type ViewMode } from "./store";
import { openContextMenu, toast } from "./ui";
import { useVaultChanges } from "./useVault";

type SaveState = "saved" | "dirty" | "saving" | "conflict" | "error";

const MODES: { mode: ViewMode; label: string; icon: typeof PenLine }[] = [
  { mode: "live", label: "Vista en vivo", icon: PenLine },
  { mode: "source", label: "Código fuente", icon: Code2 },
  { mode: "reading", label: "Lectura", icon: BookOpen },
];

function headingLine(content: string, heading: string): number | undefined {
  const wanted = foldText(heading.replace(/^#+\s*/, "")).trim();
  const lines = content.split("\n");
  const index = lines.findIndex((line) => {
    const match = /^#{1,6}\s+(.*)$/.exec(line);
    return match ? foldText(match[1].replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")).trim() === wanted : false;
  });
  return index === -1 ? undefined : index;
}

type NoteViewProps = {
  tabId: string;
  path: string;
  mode: ViewMode;
  active: boolean;
  snapshot: VaultSnapshot;
  resolve: LinkResolver;
};

export default function NoteView({ tabId, path, mode, active, snapshot, resolve }: NoteViewProps) {
  const setMode = useVaultStore((state) => state.setMode);
  const search = useVaultStore((state) => state.search);
  const toggleBookmark = useVaultStore((state) => state.toggleBookmark);
  const bookmarked = useVaultStore((state) => state.bookmarks.includes(path));
  const reveal = useVaultStore((state) => state.reveal);

  const { data, error, mutate } = useSWR(`vault:note:${path}`, () => getVaultNote(path), {
    revalidateOnFocus: true,
    revalidateIfStale: true,
    dedupingInterval: 500,
  });

  const [draft, setDraft] = useState<string | null>(null);
  const [externalVersion, setExternalVersion] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [conflict, setConflict] = useState<{ content: string; mtime: number } | null>(null);
  const [title, setTitle] = useState(basenameOf(path));
  const baseMtime = useRef<number | undefined>(undefined);
  const lastSaved = useRef<string | null>(null);
  const draftRef = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useVaultChanges((paths) => {
    if (paths.includes(path)) void mutate();
  });

  // Carga inicial y cambios externos (Obsidian, Sync, Shadow).
  useEffect(() => {
    if (!data) return;
    if (draftRef.current === null) {
      draftRef.current = data.content;
      lastSaved.current = data.content;
      baseMtime.current = data.mtime;
      setDraft(data.content);
      setExternalVersion((version) => version + 1);
      return;
    }
    if (data.content === lastSaved.current) {
      baseMtime.current = data.mtime;
      return;
    }
    const dirty = draftRef.current !== lastSaved.current;
    if (!dirty) {
      draftRef.current = data.content;
      lastSaved.current = data.content;
      baseMtime.current = data.mtime;
      setDraft(data.content);
      setExternalVersion((version) => version + 1);
    } else if (data.content !== draftRef.current) {
      setConflict({ content: data.content, mtime: data.mtime });
      setSaveState("conflict");
    }
  }, [data]);

  const save = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const content = draftRef.current;
    if (content === null || content === lastSaved.current) return;
    setSaveState("saving");
    try {
      const result = await saveVaultNote(path, content, baseMtime.current);
      if (result.ok) {
        lastSaved.current = content;
        baseMtime.current = result.mtime;
        setSaveState(draftRef.current === content ? "saved" : "dirty");
        void mutate({ path, content, mtime: result.mtime }, { revalidate: false });
      } else {
        setConflict({ content: result.content, mtime: result.mtime });
        setSaveState("conflict");
      }
    } catch (saveError) {
      setSaveState("error");
      toast(saveError instanceof Error ? saveError.message : "No se pudo guardar");
    }
  }, [mutate, path]);

  const onChange = useCallback((content: string) => {
    draftRef.current = content;
    setDraft(content);
    setSaveState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 650);
  }, [save]);

  // Guardar al salir de la nota, al ocultar la pestaña o al cerrar la ventana.
  useEffect(() => {
    const flush = () => {
      if (draftRef.current !== null && draftRef.current !== lastSaved.current && !conflict) void save();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [save, conflict]);

  const resolveConflict = async (keep: "disk" | "mine") => {
    if (!conflict) return;
    if (keep === "disk") {
      draftRef.current = conflict.content;
      lastSaved.current = conflict.content;
      baseMtime.current = conflict.mtime;
      setDraft(conflict.content);
      setExternalVersion((version) => version + 1);
      setSaveState("saved");
    } else {
      baseMtime.current = conflict.mtime;
      lastSaved.current = conflict.content;
      setConflict(null);
      await save();
      return;
    }
    setConflict(null);
  };

  const openLinkInternal = useCallback((target: string, options: { newTab: boolean }) => {
    void followLink(target, path, resolve, snapshot, options);
  }, [path, resolve, snapshot]);

  const editorContext = useMemo<VaultEditorContext>(() => ({
    path,
    resolve,
    openLink: openLinkInternal,
    openUrl: (url) => window.open(url, "_blank", "noreferrer"),
    searchTag: (tag) => search(`tag:#${tag}`),
    notes: snapshot.notes.map((note) => ({ title: note.title, path: note.path, aliases: note.aliases, folder: folderOf(note.path) })),
    tags: snapshot.tags.map((item) => item.tag),
  }), [path, resolve, openLinkInternal, search, snapshot]);

  // Revelar línea o encabezado pedido por backlinks, búsqueda o esquema.
  const revealTarget = useMemo(() => {
    if (!reveal || reveal.path !== path || draft === null) return null;
    const line = reveal.heading ? headingLine(draft, reveal.heading) : reveal.line;
    return line === undefined ? null : { line, nonce: reveal.nonce };
  }, [reveal, path, draft]);

  // Solo cuando llega una petición nueva (nonce), no en cada tecla.
  const revealNonce = revealTarget?.nonce;
  const revealLine = revealTarget?.line;
  useEffect(() => {
    if (revealLine === undefined || mode !== "reading") return;
    const element = scrollRef.current?.querySelector<HTMLElement>(`[data-line="${revealLine}"]`);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealNonce, mode]);

  const stats = useMemo(() => {
    if (draft === null) return null;
    const parsed = parseNote(draft);
    return { words: parsed.words, characters: draft.length };
  }, [draft]);

  const commitTitle = async () => {
    const next = title.trim();
    if (!next || next === basenameOf(path)) {
      setTitle(basenameOf(path));
      return;
    }
    await save();
    const folder = folderOf(path);
    const moved = await moveEntry(path, `${folder ? `${folder}/` : ""}${next.replace(/[\\/:*?"<>|]/g, " ")}.md`);
    if (!moved) setTitle(basenameOf(path));
  };

  const moreMenu = (event: React.MouseEvent) => openContextMenu({ clientX: event.currentTarget.getBoundingClientRect().right - 210, clientY: event.currentTarget.getBoundingClientRect().bottom + 6, preventDefault: () => event.preventDefault() }, [
    { label: bookmarked ? "Quitar de fijadas" : "Fijar nota", icon: <Bookmark className="h-3.5 w-3.5" />, shortcut: "⌘⇧B", onSelect: () => toggleBookmark(path) },
    { label: "Insertar plantilla", icon: <LayoutTemplate className="h-3.5 w-3.5" />, shortcut: "⌘⇧T", onSelect: () => void insertTemplateFlow(path) },
    { label: "Copiar enlace", icon: <Copy className="h-3.5 w-3.5" />, onSelect: () => void navigator.clipboard.writeText(`[[${basenameOf(path)}]]`).then(() => toast("Enlace copiado")) },
    { label: "Abrir en Obsidian", icon: <ExternalLink className="h-3.5 w-3.5" />, onSelect: () => window.open(obsidianUri(snapshot.name, path), "_self") },
    "separator",
    { label: "Mover a…", icon: <FolderInput className="h-3.5 w-3.5" />, onSelect: () => void moveFlow(path, snapshot) },
    { label: "Eliminar", icon: <Trash2 className="h-3.5 w-3.5" />, danger: true, onSelect: () => void deleteFlow(path) },
  ]);

  const folder = folderOf(path);

  return (
    <div className="flex h-full min-h-0 flex-col" data-tab={tabId}>
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-white/[0.05] px-3">
        <div className="flex min-w-0 flex-1 items-center gap-1 text-[11px] text-white/35">
          {folder.split("/").filter(Boolean).map((segment, index, all) => (
            <span key={`${segment}-${index}`} className="flex min-w-0 items-center gap-1">
              <button type="button" onClick={() => search(`path:"${all.slice(0, index + 1).join("/")}"`)} className="truncate transition hover:text-white/75">{segment}</button>
              <span className="text-white/15">/</span>
            </span>
          ))}
          <span className="truncate text-white/70">{basenameOf(path)}</span>
          <span className={`ml-2 h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-300 ${saveState === "saved" ? "bg-white/15" : saveState === "saving" ? "animate-pulse bg-white/60" : saveState === "conflict" || saveState === "error" ? "bg-white" : "bg-white/40"}`} title={saveState === "saved" ? "Guardado" : saveState === "saving" ? "Guardando…" : saveState === "dirty" ? "Sin guardar" : "Revisar"} />
        </div>
        <div className="flex items-center rounded-lg border border-white/[0.06] bg-white/[0.02] p-0.5">
          {MODES.map(({ mode: option, label, icon: Icon }) => (
            <button
              key={option}
              type="button"
              aria-label={label}
              title={`${label}${option === "reading" ? " (⌘E)" : ""}`}
              aria-pressed={mode === option}
              onClick={() => setMode(tabId, option)}
              className={`relative flex h-6 w-7 items-center justify-center rounded-md transition-colors active:scale-90 ${mode === option ? "text-white" : "text-white/35 hover:text-white/75"}`}
            >
              {mode === option && <motion.span layoutId={`mode-${tabId}`} className="absolute inset-0 rounded-md bg-white/[0.09]" transition={{ type: "spring", stiffness: 600, damping: 40 }} />}
              <Icon className="relative h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        <button type="button" aria-label="Más opciones" onClick={moreMenu} className="flex h-7 w-7 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/[0.05] hover:text-white/85 active:scale-90">
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>

      <AnimatePresence>
        {conflict && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="shrink-0 overflow-hidden border-b border-white/[0.08] bg-white/[0.04]">
            <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[11.5px] text-white/70">
              <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-white" />
              <span className="flex-1">Esta nota cambió en disco (Obsidian, Sync o Shadow) mientras la editabas.</span>
              <button type="button" onClick={() => void resolveConflict("disk")} className="h-7 rounded-lg border border-white/[0.1] px-2.5 text-[11px] text-white/80 transition hover:bg-white/[0.06] active:scale-95">Usar la del disco</button>
              <button type="button" onClick={() => void resolveConflict("mine")} className="h-7 rounded-lg bg-white px-2.5 text-[11px] font-medium text-black transition hover:bg-white/90 active:scale-95">Conservar la mía</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable] [scrollbar-width:thin]">
        {error && !data ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-[12px] text-white/40">
            <TriangleAlert className="h-5 w-5" />
            <p>No pude abrir esta nota.</p>
            <p className="font-mono text-[10px] text-white/25">{error instanceof Error ? error.message : ""}</p>
          </div>
        ) : draft === null ? (
          <div className="mx-auto w-full max-w-[760px] space-y-3 px-7 pt-10">
            <div className="h-8 w-1/2 animate-pulse rounded-lg bg-white/[0.05]" />
            {[0.9, 0.75, 0.82, 0.6].map((width, index) => <div key={index} className="h-3 animate-pulse rounded bg-white/[0.04]" style={{ width: `${width * 100}%` }} />)}
            <Loader2 className="mx-auto mt-8 h-4 w-4 animate-spin text-white/20" />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: "easeOut" }} className="px-7 pt-8">
            <div className="mx-auto w-full max-w-[760px]">
              <input
                aria-label="Título de la nota"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onBlur={() => void commitTitle()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    (event.target as HTMLInputElement).blur();
                  }
                  if (event.key === "Escape") {
                    setTitle(basenameOf(path));
                    (event.target as HTMLInputElement).blur();
                  }
                }}
                spellCheck={false}
                className="vault-plain-input mb-3 w-full bg-transparent text-[30px] font-semibold leading-tight tracking-[-0.025em] text-white outline-none placeholder:text-white/20"
                placeholder="Sin título"
              />
            </div>
            {mode === "reading" ? (
              <div className="mx-auto w-full max-w-[760px] pb-[40vh]">
                <NoteReader
                  path={path}
                  content={draft}
                  resolve={resolve}
                  onOpen={(target, options) => useVaultStore.getState().openNote(target, options)}
                  onOpenUnresolved={(target) => void followLink(target, path, resolve, snapshot)}
                  onSearchTag={(tag) => search(`tag:#${tag}`)}
                  onChange={(next) => {
                    onChange(next);
                    setExternalVersion((version) => version + 1);
                  }}
                />
              </div>
            ) : (
              <NoteEditor
                key={path}
                content={draft}
                externalVersion={externalVersion}
                mode={mode}
                context={editorContext}
                onChange={onChange}
                onSave={() => void save()}
                reveal={revealTarget}
                autoFocus={active && !revealTarget}
                onView={(view) => setActiveEditor(view, view ? path : undefined)}
              />
            )}
          </motion.div>
        )}
      </div>

      {stats && (
        <div className="flex h-7 shrink-0 items-center justify-end gap-3 border-t border-white/[0.04] px-4 font-mono text-[9.5px] text-white/25">
          <span>{stats.words.toLocaleString("es-MX")} palabras</span>
          <span>{stats.characters.toLocaleString("es-MX")} caracteres</span>
          <span className="min-w-[64px] text-right">{saveState === "saving" ? "guardando…" : saveState === "dirty" ? "editando" : saveState === "conflict" ? "conflicto" : saveState === "error" ? "error" : "guardado"}</span>
        </div>
      )}
    </div>
  );
}
