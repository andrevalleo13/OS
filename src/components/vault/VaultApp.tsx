"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, Reorder } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Bookmark,
  CalendarDays,
  FilePlus2,
  Files,
  FileText,
  Hash,
  Network,
  PanelLeft,
  PanelRight,
  Plus,
  Search,
  SquareTerminal,
  X,
} from "lucide-react";
import type { VaultSnapshot } from "@/app/actions/vault";
import { basenameOf, type LinkResolver } from "@/features/vault/parse";
import FileExplorer from "./FileExplorer";
import GraphView from "./graph/GraphView";
import NoteView from "./NoteView";
import RightSidebar from "./RightSidebar";
import { BookmarksPanel, SearchPanel, TagsPanel } from "./SidePanels";
import { QuickSwitcher, VaultCommandPalette } from "./Switcher";
import { createNoteFlow, defaultNoteFolder, insertTemplateFlow, openDailyFlow, renameFlow } from "./actions";
import { activeNotePath, useVaultStore, type LeftPanel, type VaultTab } from "./store";
import { IconButton, Kbd, VaultContextMenu, VaultDialogs, VaultToasts } from "./ui";
import { useVaultSnapshot } from "./useVault";

const LEFT_PANELS: { id: LeftPanel; label: string; icon: typeof Files; shortcut?: string }[] = [
  { id: "files", label: "Archivos", icon: Files },
  { id: "search", label: "Buscar", icon: Search, shortcut: "⌘⇧F" },
  { id: "tags", label: "Tags", icon: Hash },
  { id: "bookmarks", label: "Fijadas y recientes", icon: Bookmark },
];

function usePanelWidth(key: string, initial: number, min: number, max: number) {
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem(key));
      if (stored >= min && stored <= max) setWidth(stored);
    } catch {
      // sin almacenamiento
    }
  }, [key, min, max]);
  const startResize = (event: ReactPointerEvent, direction: 1 | -1) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    let latest = startWidth;
    const move = (moveEvent: PointerEvent) => {
      latest = Math.min(max, Math.max(min, startWidth + (moveEvent.clientX - startX) * direction));
      setWidth(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      try {
        localStorage.setItem(key, String(latest));
      } catch {
        // sin almacenamiento
      }
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return { width, startResize };
}

function TabBar({ tabs, activeId }: { tabs: VaultTab[]; activeId: string | null }) {
  const setActive = useVaultStore((state) => state.setActive);
  const closeTab = useVaultStore((state) => state.closeTab);
  const goBack = useVaultStore((state) => state.goBack);
  const goForward = useVaultStore((state) => state.goForward);
  const canBack = useVaultStore((state) => state.history.length > 0);
  const canForward = useVaultStore((state) => state.future.length > 0);
  const setSwitcherOpen = useVaultStore((state) => state.setSwitcherOpen);

  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b border-white/[0.05] pl-1.5 pr-1">
      <IconButton label="Atrás" shortcut="⌘⌥←" onClick={goBack} className={canBack ? "" : "pointer-events-none opacity-30"}><ArrowLeft className="h-3.5 w-3.5" /></IconButton>
      <IconButton label="Adelante" shortcut="⌘⌥→" onClick={goForward} className={canForward ? "" : "pointer-events-none opacity-30"}><ArrowRight className="h-3.5 w-3.5" /></IconButton>
      <Reorder.Group
        as="div"
        axis="x"
        values={tabs}
        onReorder={(next) => useVaultStore.setState({ tabs: next })}
        className="flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto [scrollbar-width:none]"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeId;
          const label = tab.kind === "graph" ? "Vista de grafo" : basenameOf(tab.path);
          return (
            <Reorder.Item
              as="div"
              key={tab.id}
              value={tab}
              onMouseDown={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  closeTab(tab.id);
                }
              }}
              onClick={() => setActive(tab.id)}
              title={tab.kind === "note" ? tab.path : label}
              className={`group relative flex h-8 min-w-[120px] max-w-[220px] cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 text-[12px] transition-colors duration-150 ${active ? "text-white" : "text-white/45 hover:bg-white/[0.035] hover:text-white/80"}`}
            >
              {active && <motion.span layoutId="vault-active-tab" className="absolute inset-0 rounded-lg border border-white/[0.08] bg-white/[0.065]" transition={{ type: "spring", stiffness: 520, damping: 40 }} />}
              <span className="relative shrink-0 text-white/35">{tab.kind === "graph" ? <Network className="h-3 w-3" /> : <FileText className="h-3 w-3" />}</span>
              <span className="relative min-w-0 flex-1 truncate">{label}</span>
              <button
                type="button"
                aria-label={`Cerrar ${label}`}
                onClick={(event) => {
                  event.stopPropagation();
                  closeTab(tab.id);
                }}
                className={`relative flex h-4 w-4 shrink-0 items-center justify-center rounded text-white/40 transition hover:bg-white/[0.1] hover:text-white active:scale-90 ${active ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
      <IconButton label="Nueva pestaña" shortcut="⌘T" onClick={() => setSwitcherOpen(true)}><Plus className="h-3.5 w-3.5" /></IconButton>
    </div>
  );
}

function VaultHome({ snapshot }: { snapshot: VaultSnapshot }) {
  const openNote = useVaultStore((state) => state.openNote);
  const openGraph = useVaultStore((state) => state.openGraph);
  const setSwitcherOpen = useVaultStore((state) => state.setSwitcherOpen);
  const bookmarks = useVaultStore((state) => state.bookmarks);
  const recent = useMemo(() => [...snapshot.files].filter((file) => file.ext === "md").sort((a, b) => b.mtime - a.mtime).slice(0, 8), [snapshot.files]);
  const unresolved = snapshot.unresolved.reduce((sum, item) => sum + item.count, 0);
  const people = snapshot.notes.filter((note) => note.path.includes("/Personas/")).length;
  const daily = snapshot.files.filter((file) => file.path.startsWith(`${snapshot.dailyFolder}/`) && /\d{4}-\d{2}-\d{2}/.test(file.name)).length;

  const actions = [
    { label: "Nota de hoy", hint: "⌥D", icon: CalendarDays, run: () => void openDailyFlow() },
    { label: "Nueva nota", hint: "⌘N", icon: FilePlus2, run: () => void createNoteFlow({ folder: defaultNoteFolder(snapshot), ask: true }) },
    { label: "Cambiar de nota", hint: "⌘O", icon: Search, run: () => setSwitcherOpen(true) },
    { label: "Vista de grafo", hint: "⌘G", icon: Network, run: () => openGraph() },
  ];

  return (
    <div className="h-full overflow-y-auto [scrollbar-width:thin]">
      <div className="mx-auto flex max-w-[720px] flex-col px-8 pb-16 pt-[9vh]">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/30">Segundo cerebro</div>
          <div role="heading" aria-level={1} className="mt-2 text-[34px] font-semibold tracking-[-0.03em] text-white">{snapshot.name}</div>
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.06] sm:grid-cols-4">
            {[
              { value: snapshot.notes.length, label: "notas" },
              { value: people, label: "personas" },
              { value: daily, label: "días en el diario" },
              { value: snapshot.tags.length, label: "tags" },
            ].map((stat) => (
              <div key={stat.label} className="bg-[#0b0b0b] px-4 py-3.5">
                <div className="font-mono text-[22px] tabular-nums text-white">{stat.value}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-white/35">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {actions.map((action, index) => (
            <motion.button
              key={action.label}
              type="button"
              onClick={action.run}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 + index * 0.04, duration: 0.22 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className="group flex flex-col items-start gap-6 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5 text-left transition-colors hover:border-white/[0.14] hover:bg-white/[0.045]"
            >
              <action.icon className="h-4 w-4 text-white/45 transition group-hover:text-white" />
              <div className="flex w-full items-center justify-between">
                <span className="text-[12px] text-white/80">{action.label}</span>
                <span className="font-mono text-[9.5px] text-white/25">{action.hint}</span>
              </div>
            </motion.button>
          ))}
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div>
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-white/30">Recientes</div>
            {recent.map((file, index) => (
              <motion.button
                key={file.path}
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 + index * 0.025 }}
                onClick={(event) => openNote(file.path, { newTab: event.metaKey || event.ctrlKey })}
                className="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.04]"
              >
                <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/70 group-hover:text-white">{basenameOf(file.path)}</span>
                <span className="shrink-0 font-mono text-[9.5px] text-white/25">{new Date(file.mtime).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span>
              </motion.button>
            ))}
          </div>
          <div>
            <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-white/30">Fijadas</div>
            {bookmarks.length ? bookmarks.map((path) => (
              <button key={path} type="button" onClick={() => openNote(path)} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-white/70 transition hover:bg-white/[0.04] hover:text-white">
                <Bookmark className="h-3 w-3 fill-white/30 text-white/30" />
                <span className="truncate">{basenameOf(path)}</span>
              </button>
            )) : <p className="px-2 text-[11px] leading-relaxed text-white/30">Fija tus notas maestras (HQ, Ficha Rápida, Conexiones Cruzadas) para tenerlas a un clic.</p>}
            {unresolved > 0 && (
              <div className="mt-5 rounded-xl border border-white/[0.06] p-3 text-[11px] leading-relaxed text-white/40">
                <span className="font-mono text-white/70">{unresolved}</span> enlaces apuntan a notas que aún no existen. Ábrelos para crearlas.
              </div>
            )}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap gap-x-5 gap-y-2 text-[10px] text-white/30">
          <span className="flex items-center gap-1.5"><Kbd>⌘O</Kbd> cambiar</span>
          <span className="flex items-center gap-1.5"><Kbd>⌘P</Kbd> comandos</span>
          <span className="flex items-center gap-1.5"><Kbd>⌘E</Kbd> leer / editar</span>
          <span className="flex items-center gap-1.5"><Kbd>[[</Kbd> enlazar</span>
          <span className="flex items-center gap-1.5"><Kbd>⌘↵</Kbd> tarea</span>
        </div>
      </div>
    </div>
  );
}

function useVaultShortcuts(snapshot: VaultSnapshot | null, openCommands: () => void) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const state = useVaultStore.getState();
      const path = activeNotePath(state);
      const key = event.key.toLowerCase();
      const run = (action: () => void) => {
        event.preventDefault();
        event.stopPropagation();
        action();
      };
      if (mod && !event.shiftKey && key === "o") return run(() => state.setSwitcherOpen(true));
      if (mod && !event.shiftKey && key === "p") return run(openCommands);
      if (mod && event.shiftKey && key === "f") return run(() => state.search(state.searchQuery));
      if (mod && !event.shiftKey && key === "n") return run(() => void createNoteFlow({ folder: defaultNoteFolder(snapshot), ask: true }));
      if (mod && !event.shiftKey && key === "t") return run(() => state.setSwitcherOpen(true));
      if (mod && !event.shiftKey && key === "g") return run(() => state.openGraph());
      if (mod && !event.shiftKey && key === "w" && state.activeId) return run(() => state.closeTab(state.activeId as string));
      if (mod && !event.shiftKey && key === "\\") return run(() => state.toggleLeft());
      if (mod && event.shiftKey && key === "\\") return run(() => state.toggleRight());
      if (mod && event.shiftKey && key === "b" && path) return run(() => state.toggleBookmark(path));
      if (mod && event.shiftKey && key === "t" && path) return run(() => void insertTemplateFlow(path));
      if (event.altKey && !mod && (key === "d" || event.code === "KeyD")) return run(() => void openDailyFlow());
      if (mod && event.altKey && event.key === "ArrowLeft") return run(() => state.goBack());
      if (mod && event.altKey && event.key === "ArrowRight") return run(() => state.goForward());
      if (event.key === "F2" && path && !(event.target as HTMLElement).closest("input,textarea,[contenteditable]")) return run(() => void renameFlow(path));
      if (mod && !event.shiftKey && key === "e") {
        const tab = state.tabs.find((item) => item.id === state.activeId);
        if (tab?.kind === "note") return run(() => state.setMode(tab.id, tab.mode === "reading" ? (state.defaultMode === "reading" ? "live" : state.defaultMode) : "reading"));
      }
      if (event.ctrlKey && event.key === "Tab" && state.tabs.length > 1) {
        const index = state.tabs.findIndex((tab) => tab.id === state.activeId);
        const next = (index + (event.shiftKey ? -1 : 1) + state.tabs.length) % state.tabs.length;
        return run(() => state.setActive(state.tabs[next].id));
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [snapshot, openCommands]);
}

/** Abre `?note=` (ruta o nombre) que mandan el dashboard, la paleta o Shadow. */
function useNoteParam(snapshot: VaultSnapshot | null, resolve: LinkResolver) {
  const params = useSearchParams();
  const router = useRouter();
  const note = params.get("note");
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!note || !snapshot || handled.current === note) return;
    handled.current = note;
    const target = resolve(note.replace(/\.md$/, "")) ?? (snapshot.files.some((file) => file.path === note) ? note : null);
    if (target) useVaultStore.getState().openNote(target);
    router.replace("/obsidian", { scroll: false });
  }, [note, snapshot, resolve, router]);
}

export default function VaultApp() {
  const { snapshot, unavailable, error, isLoading, resolve } = useVaultSnapshot();
  const tabs = useVaultStore((state) => state.tabs);
  const activeId = useVaultStore((state) => state.activeId);
  const leftPanel = useVaultStore((state) => state.leftPanel);
  const leftOpen = useVaultStore((state) => state.leftOpen);
  const rightOpen = useVaultStore((state) => state.rightOpen);
  const setLeftPanel = useVaultStore((state) => state.setLeftPanel);
  const toggleLeft = useVaultStore((state) => state.toggleLeft);
  const toggleRight = useVaultStore((state) => state.toggleRight);
  const openGraph = useVaultStore((state) => state.openGraph);
  const openNote = useVaultStore((state) => state.openNote);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const left = usePanelWidth("valleos.vault.leftWidth", 268, 200, 460);
  const right = usePanelWidth("valleos.vault.rightWidth", 300, 240, 520);

  useVaultShortcuts(snapshot, () => setCommandsOpen(true));
  useNoteParam(snapshot, resolve);

  // Pestañas de notas que ya no existen (borradas o movidas fuera de la app).
  useEffect(() => {
    if (!snapshot) return;
    const known = new Set(snapshot.files.map((file) => file.path));
    const stale = tabs.filter((tab) => tab.kind === "note" && !known.has(tab.path));
    for (const tab of stale) if (tab.kind === "note") useVaultStore.getState().removePath(tab.path);
  }, [snapshot, tabs]);

  if (unavailable) {
    return (
      <div className="os-surface flex h-full flex-col items-center justify-center gap-3 rounded-[22px] p-10 text-center">
        <SquareTerminal className="h-6 w-6 text-white/40" />
        <div className="text-[14px] text-white/80">La bóveda vive en tu Mac</div>
        <p className="max-w-sm text-[12px] leading-relaxed text-white/40">Abre ValleOS en <span className="font-mono text-white/60">localhost:3000</span> con <span className="font-mono text-white/60">OBSIDIAN_VAULT_PATH</span> configurado para ver y editar tus notas.</p>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="os-surface flex h-full items-center justify-center rounded-[22px]">
        {error ? <p className="text-[12px] text-white/40">{error.message}</p> : <motion.div animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 1.6, repeat: Infinity }} className="text-[11px] tracking-[0.2em] text-white/40">{isLoading ? "CARGANDO BÓVEDA" : ""}</motion.div>}
      </div>
    );
  }

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? null;

  return (
    <div className="os-surface relative flex h-full min-h-0 overflow-hidden rounded-[22px]">
      {/* Ribbon */}
      <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-white/[0.05] py-2">
        <IconButton label={leftOpen ? "Ocultar panel" : "Mostrar panel"} shortcut="⌘\" onClick={toggleLeft}><PanelLeft className="h-3.5 w-3.5" /></IconButton>
        <div className="my-1 h-px w-5 bg-white/[0.06]" />
        {LEFT_PANELS.map(({ id, label, icon: Icon, shortcut }) => (
          <IconButton key={id} label={label} shortcut={shortcut} active={leftOpen && leftPanel === id} onClick={() => setLeftPanel(id)}><Icon className="h-3.5 w-3.5" /></IconButton>
        ))}
        <div className="my-1 h-px w-5 bg-white/[0.06]" />
        <IconButton label="Nota de hoy" shortcut="⌥D" onClick={() => void openDailyFlow()}><CalendarDays className="h-3.5 w-3.5" /></IconButton>
        <IconButton label="Vista de grafo" shortcut="⌘G" onClick={openGraph}><Network className="h-3.5 w-3.5" /></IconButton>
        <IconButton label="Nueva nota" shortcut="⌘N" onClick={() => void createNoteFlow({ folder: defaultNoteFolder(snapshot), ask: true })}><FilePlus2 className="h-3.5 w-3.5" /></IconButton>
        <div className="mt-auto" />
        <IconButton label={rightOpen ? "Ocultar panel derecho" : "Mostrar panel derecho"} shortcut="⌘⇧\" onClick={toggleRight}><PanelRight className="h-3.5 w-3.5" /></IconButton>
      </div>

      {/* Panel izquierdo */}
      <AnimatePresence initial={false}>
        {leftOpen && (
          <motion.aside
            key="left"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: left.width, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-y-0 left-11 z-20 flex shrink-0 flex-col overflow-hidden border-r border-white/[0.05] bg-[#0b0b0b]/95 backdrop-blur-2xl md:relative md:left-0 md:z-auto md:bg-transparent md:backdrop-blur-none"
          >
            <div className="flex h-10 shrink-0 items-center px-3 text-[10px] font-medium uppercase tracking-[0.14em] text-white/35">
              {LEFT_PANELS.find((panel) => panel.id === leftPanel)?.label}
            </div>
            <div className="min-h-0 flex-1" style={{ width: left.width }}>
              {leftPanel === "files" && <FileExplorer snapshot={snapshot} />}
              {leftPanel === "search" && <SearchPanel />}
              {leftPanel === "tags" && <TagsPanel snapshot={snapshot} />}
              {leftPanel === "bookmarks" && <BookmarksPanel snapshot={snapshot} />}
            </div>
            <div onPointerDown={(event) => left.startResize(event, 1)} className="absolute inset-y-0 right-0 hidden w-1.5 cursor-col-resize transition-colors hover:bg-white/[0.08] md:block" />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Centro */}
      <main className="flex min-w-0 flex-1 flex-col">
        <TabBar tabs={tabs} activeId={activeId} />
        <div className="relative min-h-0 flex-1">
          {!activeTab && <VaultHome snapshot={snapshot} />}
          {tabs.map((tab) => (
            <div key={tab.id} className={`absolute inset-0 ${tab.id === activeId ? "" : "pointer-events-none invisible"}`} aria-hidden={tab.id !== activeId}>
              {tab.kind === "note" ? (
                <NoteView key={tab.path} tabId={tab.id} path={tab.path} mode={tab.mode} active={tab.id === activeId} snapshot={snapshot} resolve={resolve} />
              ) : tab.id === activeId ? (
                <GraphView mode="global" activePath={null} onOpen={(path, options) => openNote(path, options)} className="h-full" />
              ) : null}
            </div>
          ))}
        </div>
      </main>

      {/* Panel derecho */}
      <AnimatePresence initial={false}>
        {rightOpen && (
          <motion.aside
            key="right"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: right.width, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-y-0 right-0 z-20 flex shrink-0 flex-col overflow-hidden border-l border-white/[0.05] bg-[#0b0b0b]/95 backdrop-blur-2xl lg:relative lg:z-auto lg:bg-transparent lg:backdrop-blur-none"
          >
            <div onPointerDown={(event) => right.startResize(event, -1)} className="absolute inset-y-0 left-0 z-10 hidden w-1.5 cursor-col-resize transition-colors hover:bg-white/[0.08] lg:block" />
            <div className="flex min-h-0 flex-1 flex-col" style={{ width: right.width }}>
              <RightSidebar snapshot={snapshot} resolve={resolve} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <QuickSwitcher snapshot={snapshot} />
      <VaultCommandPalette snapshot={snapshot} open={commandsOpen} onClose={() => setCommandsOpen(false)} />
      <VaultDialogs />
      <VaultContextMenu />
      <VaultToasts />
    </div>
  );
}
