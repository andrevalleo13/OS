"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GraphEngineSettings } from "./engine";

/** Ajustes del grafo global (como el panel de Obsidian) + profundidad del grafo local. */
export type GraphFilterSettings = { showOrphans: boolean; showUnresolved: boolean; showTags: boolean };
export type GraphSettings = GraphFilterSettings & GraphEngineSettings;
export type GraphSection = "filters" | "groups" | "display" | "forces";
export type LocalDepth = 1 | 2 | 3;

/** Valores por defecto de Obsidian (graph.json recién creado). */
export const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  showOrphans: true,
  showUnresolved: true,
  showTags: false,
  textFade: 0,
  nodeSize: 1,
  linkWidth: 1,
  centerStrength: 0.52,
  repelStrength: 10,
  linkStrength: 1,
  linkDistance: 250,
};

/** Rangos de los deslizadores (los mismos de Obsidian). */
export const SLIDER_RANGES = {
  textFade: { min: -3, max: 3, step: 0.1 },
  nodeSize: { min: 0.1, max: 5, step: 0.05 },
  linkWidth: { min: 0.1, max: 5, step: 0.05 },
  centerStrength: { min: 0, max: 1, step: 0.01 },
  repelStrength: { min: 0, max: 20, step: 0.1 },
  linkStrength: { min: 0, max: 1, step: 0.01 },
  linkDistance: { min: 30, max: 500, step: 1 },
} as const satisfies Record<keyof GraphEngineSettings, { min: number; max: number; step: number }>;

type GraphSettingsState = {
  settings: GraphSettings;
  panelOpen: boolean;
  sections: Record<GraphSection, boolean>;
  localDepth: LocalDepth;
  update: (patch: Partial<GraphSettings>) => void;
  reset: () => void;
  setPanelOpen: (open: boolean) => void;
  toggleSection: (section: GraphSection) => void;
  setLocalDepth: (depth: LocalDepth) => void;
};

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

export const useGraphSettings = create<GraphSettingsState>()(persist((set) => ({
  settings: DEFAULT_GRAPH_SETTINGS,
  panelOpen: false,
  sections: { filters: true, groups: false, display: false, forces: false },
  localDepth: 1,
  update: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
  reset: () => set({ settings: DEFAULT_GRAPH_SETTINGS }),
  setPanelOpen: (open) => set({ panelOpen: open }),
  toggleSection: (section) => set((state) => ({ sections: { ...state.sections, [section]: !state.sections[section] } })),
  setLocalDepth: (depth) => set({ localDepth: depth }),
}), {
  name: "valleos.vault.graph",
  version: 1,
  storage: safeStorage,
  // Se hidrata en el cliente tras montar para no desincronizar el HTML del servidor.
  skipHydration: true,
  partialize: (state) => ({ settings: state.settings, panelOpen: state.panelOpen, sections: state.sections, localDepth: state.localDepth }),
  merge: (persisted, current) => {
    const saved = (persisted ?? {}) as Partial<Pick<GraphSettingsState, "settings" | "panelOpen" | "sections" | "localDepth">>;
    return {
      ...current,
      ...saved,
      settings: { ...DEFAULT_GRAPH_SETTINGS, ...saved.settings },
      sections: { ...current.sections, ...saved.sections },
    };
  },
}));

/** Hidrata los ajustes guardados una vez montado; devuelve si ya están listos. */
export function useGraphSettingsHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsubscribe = useGraphSettings.persist.onFinishHydration(() => setHydrated(true));
    if (useGraphSettings.persist.hasHydrated()) setHydrated(true);
    else void useGraphSettings.persist.rehydrate();
    return unsubscribe;
  }, []);
  return hydrated;
}
