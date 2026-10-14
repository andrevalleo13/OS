"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import useSWR from "swr";
import { twMerge } from "tailwind-merge";
import clsx from "clsx";
import { useShallow } from "zustand/react/shallow";
import { getVaultGraph } from "@/app/actions/vault";
import type { GraphData } from "@/features/vault/types";
import { useVaultChanges } from "../useVault";
import { GraphEngine } from "./engine";
import { GlobalGraphPanel, LocalGraphControls } from "./GraphControls";
import { folderGroups, neighborhood } from "./model";
import { DEFAULT_GRAPH_SETTINGS, useGraphSettings, useGraphSettingsHydrated } from "./settings";

export type GraphViewProps = {
  mode: "global" | "local";
  /** Nota activa: recibe un anillo. Obligatoria en modo local (es el centro del grafo). */
  activePath?: string | null;
  onOpen: (path: string, options?: { newTab?: boolean }) => void;
  className?: string;
};

const EMPTY_GRAPH: GraphData = { nodes: [], links: [] };

/**
 * Vista de grafo estilo Obsidian sobre un <canvas>. El motor (`GraphEngine`)
 * vive fuera de React: este componente solo le entrega datos y ajustes, así
 * que la simulación no provoca renders por tick.
 */
export function GraphView({ mode, activePath = null, onOpen, className }: GraphViewProps) {
  const local = mode === "local";
  const hydrated = useGraphSettingsHydrated();
  const store = useGraphSettings(useShallow((state) => ({
    settings: state.settings,
    panelOpen: state.panelOpen,
    sections: state.sections,
    localDepth: state.localDepth,
    update: state.update,
    reset: state.reset,
    setPanelOpen: state.setPanelOpen,
    toggleSection: state.toggleSection,
    setLocalDepth: state.setLocalDepth,
  })));
  const { settings, localDepth } = store;
  // El grafo local usa los ajustes por defecto (como en Obsidian, son independientes).
  const engineSettings = local ? DEFAULT_GRAPH_SETTINGS : settings;
  const [filter, setFilter] = useState("");

  const key = !hydrated
    ? null
    : local
      ? activePath ? `vault:graph:local:${localDepth}:${activePath}` : null
      : `vault:graph:global:u${Number(settings.showUnresolved)}:t${Number(settings.showTags)}:o${Number(settings.showOrphans)}`;

  const swr = useSWR<GraphData>(
    key,
    () => local
      ? getVaultGraph({ local: activePath ?? "", depth: localDepth })
      : getVaultGraph({ unresolved: settings.showUnresolved, tags: settings.showTags, orphans: settings.showOrphans }),
    { keepPreviousData: true, revalidateOnFocus: false },
  );
  const raw = key ? swr.data : undefined;
  // El grafo local se recorta a la profundidad pedida (BFS) aunque el servidor devuelva de más.
  const graph = useMemo(
    () => (raw && local && activePath ? neighborhood(raw, activePath, localDepth) : raw),
    [raw, local, activePath, localDepth],
  );
  const { mutate } = swr;

  // Cambios en disco (Obsidian, Sync, Shadow): revalida conservando el layout.
  useVaultChanges(() => {
    void mutate();
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GraphEngine | null>(null);
  const latest = useRef({ onOpen, local, engineSettings });
  useEffect(() => {
    latest.current = { onOpen, local, engineSettings };
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new GraphEngine(
      canvas,
      { onOpen: (path, options) => latest.current.onOpen(path, options) },
      { local: latest.current.local, settings: latest.current.engineSettings },
    );
    engineRef.current = engine;
    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => engineRef.current?.setLocal(local), [local]);
  useEffect(() => engineRef.current?.setSettings(engineSettings), [engineSettings]);
  useEffect(() => engineRef.current?.setActive(activePath), [activePath]);
  useEffect(() => engineRef.current?.setFilter(filter), [filter]);
  useEffect(() => engineRef.current?.setData(graph ?? EMPTY_GRAPH), [graph]);

  const groups = useMemo(() => (graph ? folderGroups(graph.nodes) : []), [graph]);
  const counts = { nodes: graph?.nodes.length ?? 0, links: graph?.links.length ?? 0 };
  const refreshing = swr.isValidating && Boolean(graph);
  const hintId = useId();

  let status: string | null = null;
  let loading = false;
  if (local && !activePath) status = "Abre una nota para ver su grafo local.";
  else if (swr.error && !graph) status = "No se pudo cargar el grafo.";
  else if (!graph) {
    status = "Cargando grafo…";
    loading = true;
  } else if (!graph.nodes.length) status = local ? "Esta nota aún no tiene conexiones." : "La bóveda no tiene notas.";

  const label = local
    ? `Grafo local: ${counts.nodes} notas y ${counts.links} enlaces`
    : `Grafo de la bóveda: ${counts.nodes} nodos y ${counts.links} enlaces`;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && filter) {
      event.stopPropagation();
      setFilter("");
    }
  };

  const onCanvasKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    if (!engine || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "+" || event.key === "=") engine.zoomBy(1.25);
    else if (event.key === "-" || event.key === "_") engine.zoomBy(0.8);
    else if (event.key === "0") engine.center();
    else return;
    event.preventDefault();
  };

  return (
    <div
      className={twMerge(clsx("relative h-full min-h-0 w-full overflow-hidden bg-[#0a0a0a]", className))}
      onKeyDown={onKeyDown}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={label}
        aria-describedby={hintId}
        tabIndex={0}
        onKeyDown={onCanvasKeyDown}
        className="absolute inset-0 h-full w-full touch-none select-none outline-none focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-white/20"
      />
      <p id={hintId} className="sr-only">
        Rueda o pellizco para acercar, arrastra el fondo para mover, arrastra un nodo para reacomodarlo, clic para abrir la nota
        (Cmd o Ctrl para nueva pestaña), doble clic para centrar. Teclas + y − para zoom, 0 para centrar, Escape limpia el filtro.
      </p>

      {status && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 text-center" role="status">
          <span className={clsx("text-[10px] text-white/30", loading && "animate-pulse")}>{status}</span>
        </div>
      )}

      {local ? (
        <LocalGraphControls
          depth={localDepth}
          onDepthChange={store.setLocalDepth}
          onCenter={() => engineRef.current?.center()}
          counts={counts}
          refreshing={refreshing}
        />
      ) : (
        <GlobalGraphPanel
          open={store.panelOpen}
          onOpenChange={store.setPanelOpen}
          settings={settings}
          onChange={store.update}
          onReset={store.reset}
          sections={store.sections}
          onToggleSection={store.toggleSection}
          filter={filter}
          onFilterChange={setFilter}
          groups={groups}
          counts={counts}
          refreshing={refreshing}
          onReheat={() => engineRef.current?.reheat()}
          onCenter={() => engineRef.current?.center()}
        />
      )}
    </div>
  );
}

export default GraphView;
