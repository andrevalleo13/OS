"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ViewMode = "live" | "source" | "reading";

export type VaultTab =
  | { id: string; kind: "note"; path: string; mode: ViewMode }
  | { id: string; kind: "graph" };

export type LeftPanel = "files" | "search" | "tags" | "bookmarks";
export type RightPanel = "links" | "outline" | "properties" | "graph" | "shadow";

type Reveal = { path: string; line?: number; heading?: string; nonce: number };

type VaultState = {
  tabs: VaultTab[];
  activeId: string | null;
  leftPanel: LeftPanel;
  leftOpen: boolean;
  rightPanel: RightPanel;
  rightOpen: boolean;
  searchQuery: string;
  defaultMode: ViewMode;
  bookmarks: string[];
  history: string[];
  future: string[];
  reveal: Reveal | null;
  switcherOpen: boolean;

  openNote: (path: string, options?: { newTab?: boolean; line?: number; heading?: string; mode?: ViewMode }) => void;
  openGraph: () => void;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  setActive: (id: string) => void;
  setMode: (id: string, mode: ViewMode) => void;
  moveTab: (from: number, to: number) => void;
  setLeftPanel: (panel: LeftPanel) => void;
  toggleLeft: () => void;
  setRightPanel: (panel: RightPanel) => void;
  toggleRight: () => void;
  search: (query: string) => void;
  setSearchQuery: (query: string) => void;
  toggleBookmark: (path: string) => void;
  renamePath: (from: string, to: string) => void;
  removePath: (path: string) => void;
  goBack: () => void;
  goForward: () => void;
  setSwitcherOpen: (open: boolean) => void;
  setDefaultMode: (mode: ViewMode) => void;
};

let counter = 0;
const tabId = () => `t${Date.now().toString(36)}${(counter++).toString(36)}`;

/** Ruta del tab activo si es una nota. */
export function activeNotePath(state: Pick<VaultState, "tabs" | "activeId">): string | null {
  const tab = state.tabs.find((item) => item.id === state.activeId);
  return tab?.kind === "note" ? tab.path : null;
}

function rewritePath(path: string, from: string, to: string): string {
  if (path === from) return to;
  if (path.startsWith(`${from}/`)) return `${to}${path.slice(from.length)}`;
  return path;
}

const safeStorage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // almacenamiento no disponible
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // almacenamiento no disponible
    }
  },
}));

export const useVaultStore = create<VaultState>()(persist((set, get) => ({
  tabs: [],
  activeId: null,
  leftPanel: "files",
  leftOpen: true,
  rightPanel: "links",
  rightOpen: true,
  searchQuery: "",
  defaultMode: "live",
  bookmarks: [],
  history: [],
  future: [],
  reveal: null,
  switcherOpen: false,

  openNote: (path, options = {}) => set((state) => {
    const current = activeNotePath(state);
    const history = current && current !== path ? [...state.history, current].slice(-100) : state.history;
    const reveal = options.line !== undefined || options.heading ? { path, line: options.line, heading: options.heading, nonce: Date.now() } : state.reveal;
    const existing = state.tabs.find((tab) => tab.kind === "note" && tab.path === path);
    if (existing && !options.newTab) {
      const tabs = options.mode ? state.tabs.map((tab) => tab.id === existing.id && tab.kind === "note" ? { ...tab, mode: options.mode as ViewMode } : tab) : state.tabs;
      return { tabs, activeId: existing.id, history, future: [], reveal };
    }
    const mode = options.mode ?? state.defaultMode;
    const active = state.tabs.find((tab) => tab.id === state.activeId);
    if (!options.newTab && active?.kind === "note") {
      return {
        tabs: state.tabs.map((tab) => tab.id === active.id && tab.kind === "note" ? { ...tab, path } : tab),
        history,
        future: [],
        reveal,
      };
    }
    const tab: VaultTab = { id: tabId(), kind: "note", path, mode };
    const index = state.tabs.findIndex((item) => item.id === state.activeId);
    const tabs = [...state.tabs];
    tabs.splice(index === -1 ? tabs.length : index + 1, 0, tab);
    return { tabs, activeId: tab.id, history, future: [], reveal };
  }),

  openGraph: () => set((state) => {
    const existing = state.tabs.find((tab) => tab.kind === "graph");
    if (existing) return { activeId: existing.id };
    const tab: VaultTab = { id: tabId(), kind: "graph" };
    return { tabs: [...state.tabs, tab], activeId: tab.id };
  }),

  closeTab: (id) => set((state) => {
    const index = state.tabs.findIndex((tab) => tab.id === id);
    if (index === -1) return {};
    const tabs = state.tabs.filter((tab) => tab.id !== id);
    const activeId = state.activeId === id ? (tabs[index] ?? tabs[index - 1])?.id ?? null : state.activeId;
    return { tabs, activeId };
  }),

  closeOtherTabs: (id) => set((state) => ({ tabs: state.tabs.filter((tab) => tab.id === id), activeId: id })),
  setActive: (id) => set({ activeId: id }),
  setMode: (id, mode) => set((state) => ({ tabs: state.tabs.map((tab) => tab.id === id && tab.kind === "note" ? { ...tab, mode } : tab) })),
  moveTab: (from, to) => set((state) => {
    const tabs = [...state.tabs];
    const [tab] = tabs.splice(from, 1);
    if (!tab) return {};
    tabs.splice(to, 0, tab);
    return { tabs };
  }),
  setLeftPanel: (panel) => set((state) => ({ leftPanel: panel, leftOpen: state.leftPanel === panel ? !state.leftOpen : true })),
  toggleLeft: () => set((state) => ({ leftOpen: !state.leftOpen })),
  setRightPanel: (panel) => set((state) => ({ rightPanel: panel, rightOpen: state.rightPanel === panel ? !state.rightOpen : true })),
  toggleRight: () => set((state) => ({ rightOpen: !state.rightOpen })),
  search: (query) => set({ searchQuery: query, leftPanel: "search", leftOpen: true }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  toggleBookmark: (path) => set((state) => ({
    bookmarks: state.bookmarks.includes(path) ? state.bookmarks.filter((item) => item !== path) : [...state.bookmarks, path],
  })),
  renamePath: (from, to) => set((state) => ({
    tabs: state.tabs.map((tab) => tab.kind === "note" ? { ...tab, path: rewritePath(tab.path, from, to) } : tab),
    bookmarks: state.bookmarks.map((path) => rewritePath(path, from, to)),
    history: state.history.map((path) => rewritePath(path, from, to)),
  })),
  removePath: (path) => set((state) => {
    const gone = (candidate: string) => candidate === path || candidate.startsWith(`${path}/`);
    const tabs = state.tabs.filter((tab) => tab.kind !== "note" || !gone(tab.path));
    return {
      tabs,
      activeId: tabs.some((tab) => tab.id === state.activeId) ? state.activeId : tabs.at(-1)?.id ?? null,
      bookmarks: state.bookmarks.filter((item) => !gone(item)),
      history: state.history.filter((item) => !gone(item)),
    };
  }),
  goBack: () => {
    const state = get();
    const previous = state.history.at(-1);
    const current = activeNotePath(state);
    if (!previous) return;
    set({ history: state.history.slice(0, -1), future: current ? [current, ...state.future] : state.future });
    const active = state.tabs.find((tab) => tab.id === state.activeId);
    if (active?.kind === "note") set({ tabs: state.tabs.map((tab) => tab.id === active.id ? { ...tab, path: previous } as VaultTab : tab) });
    else get().openNote(previous);
  },
  goForward: () => {
    const state = get();
    const next = state.future[0];
    const current = activeNotePath(state);
    if (!next) return;
    set({ future: state.future.slice(1), history: current ? [...state.history, current] : state.history });
    const active = state.tabs.find((tab) => tab.id === state.activeId);
    if (active?.kind === "note") set({ tabs: state.tabs.map((tab) => tab.id === active.id ? { ...tab, path: next } as VaultTab : tab) });
    else get().openNote(next);
  },
  setSwitcherOpen: (open) => set({ switcherOpen: open }),
  setDefaultMode: (mode) => set({ defaultMode: mode }),
}), {
  name: "valleos.vault.workspace",
  storage: safeStorage,
  partialize: (state) => ({
    tabs: state.tabs,
    activeId: state.activeId,
    leftPanel: state.leftPanel,
    leftOpen: state.leftOpen,
    rightPanel: state.rightPanel,
    rightOpen: state.rightOpen,
    defaultMode: state.defaultMode,
    bookmarks: state.bookmarks,
  }),
}));
