"use client";

import { useId, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Crosshair, Play, RotateCcw, Search, Settings, X } from "lucide-react";
import clsx from "clsx";
import { toneOf, type FolderGroup } from "./model";
import { SLIDER_RANGES, type GraphSection, type GraphSettings, type LocalDepth } from "./settings";

const ICON_BUTTON =
  "flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition hover:bg-white/[0.06] hover:text-white/85 active:scale-95";

const SLIDER =
  "h-3 w-full cursor-pointer appearance-none bg-transparent " +
  "[&::-webkit-slider-runnable-track]:h-[2px] [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/15 " +
  "[&::-webkit-slider-thumb]:-mt-[4px] [&::-webkit-slider-thumb]:h-[10px] [&::-webkit-slider-thumb]:w-[10px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#d4d4d4] [&::-webkit-slider-thumb]:transition hover:[&::-webkit-slider-thumb]:bg-[#ffffff] " +
  "[&::-moz-range-track]:h-[2px] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-white/15 " +
  "[&::-moz-range-thumb]:h-[10px] [&::-moz-range-thumb]:w-[10px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#d4d4d4]";

function formatCount(nodes: number, links: number, compact = false) {
  return compact ? `${nodes} · ${links}` : `${nodes} nodos · ${links} enlaces`;
}

// ---------------------------------------------------------------------------
// Piezas
// ---------------------------------------------------------------------------

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-md px-1 py-[5px] text-[11px] text-white/60 transition hover:text-white/90"
    >
      <span>{label}</span>
      <span className={clsx("relative h-[14px] w-[24px] shrink-0 rounded-full border transition-colors", checked ? "border-white/30 bg-white/70" : "border-white/10 bg-white/[0.05]")}>
        <span className={clsx("absolute left-0 top-[1px] h-[10px] w-[10px] rounded-full transition-transform", checked ? "translate-x-[11px] bg-[#0a0a0a]" : "translate-x-[1px] bg-white/35")} />
      </span>
    </button>
  );
}

function Slider({ label, value, range, onChange }: { label: string; value: number; range: { min: number; max: number; step: number }; onChange: (value: number) => void }) {
  const id = useId();
  const decimals = range.step >= 1 ? 0 : range.step >= 0.1 ? 1 : 2;
  return (
    <div className="px-1 py-[3px]">
      <div className="flex items-center justify-between text-[10px]">
        <label htmlFor={id} className="text-white/55">{label}</label>
        <span className="font-mono text-[9px] text-white/30">{value.toFixed(decimals)}</span>
      </div>
      <input id={id} type="range" min={range.min} max={range.max} step={range.step} value={value} onChange={(event) => onChange(Number(event.target.value))} className={SLIDER} />
    </div>
  );
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="border-t border-white/[0.06] first:border-t-0">
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full items-center gap-1 px-2 py-2 text-[11px] text-white/70 transition hover:text-white">
        <ChevronRight className={clsx("h-3 w-3 text-white/35 transition-transform", open && "rotate-90")} />
        {title}
      </button>
      {open && <div className="px-2 pb-2">{children}</div>}
    </div>
  );
}

function Swatch({ tone }: { tone: number }) {
  const { fill, shape } = toneOf(tone);
  return (
    <svg viewBox="0 0 14 14" className="h-3 w-3 shrink-0" aria-hidden>
      {shape === "core" ? (
        <>
          <circle cx="7" cy="7" r="4.4" fill="#1c1c1c" stroke={fill} strokeWidth="1.3" />
          <circle cx="7" cy="7" r="2" fill={fill} />
        </>
      ) : (
        <>
          <circle cx="7" cy="7" r={shape === "halo" ? 3.6 : 4.6} fill={fill} />
          {shape === "halo" && <circle cx="7" cy="7" r="6" fill="none" stroke={fill} strokeOpacity="0.7" strokeWidth="0.9" />}
        </>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Panel del grafo global
// ---------------------------------------------------------------------------

export type GlobalGraphPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: GraphSettings;
  onChange: (patch: Partial<GraphSettings>) => void;
  onReset: () => void;
  sections: Record<GraphSection, boolean>;
  onToggleSection: (section: GraphSection) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  groups: FolderGroup[];
  counts: { nodes: number; links: number };
  refreshing: boolean;
  onReheat: () => void;
  onCenter: () => void;
};

export function GlobalGraphPanel(props: GlobalGraphPanelProps) {
  const { open, onOpenChange, settings, onChange, sections, onToggleSection, filter, onFilterChange, groups, counts } = props;
  return (
    <div className="pointer-events-none absolute right-2 top-2 z-10 flex max-h-[calc(100%-16px)] flex-col items-end">
      <AnimatePresence initial={false} mode="wait">
        {open ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="pointer-events-auto flex max-h-full w-[232px] flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0a0a0a]/90 shadow-2xl backdrop-blur-3xl"
            role="region"
            aria-label="Ajustes del grafo"
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] py-1 pl-2.5 pr-1">
              <span className={clsx("font-mono text-[9px] text-white/35 transition-opacity", props.refreshing && "opacity-50")}>{formatCount(counts.nodes, counts.links)}</span>
              <div className="flex items-center">
                <button type="button" className={ICON_BUTTON} onClick={props.onReset} title="Restablecer ajustes" aria-label="Restablecer ajustes">
                  <RotateCcw className="h-3 w-3" />
                </button>
                <button type="button" className={ICON_BUTTON} onClick={() => onOpenChange(false)} title="Cerrar ajustes" aria-label="Cerrar ajustes">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <Section title="Filtros" open={sections.filters} onToggle={() => onToggleSection("filters")}>
                <label className="mb-1.5 flex h-7 items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 focus-within:border-white/25">
                  <Search className="h-3 w-3 shrink-0 text-white/30" />
                  <input
                    type="search"
                    value={filter}
                    onChange={(event) => onFilterChange(event.target.value)}
                    placeholder="Buscar archivos…"
                    aria-label="Filtrar nodos"
                    // El foco ya lo marca el borde del campo (focus-within); el contorno global quedaría duplicado.
                    style={{ outline: "none" }}
                    className="h-full min-w-0 flex-1 bg-transparent text-[11px] text-white/85 placeholder:text-white/25 [&::-webkit-search-cancel-button]:hidden"
                  />
                  {filter && (
                    <button type="button" onClick={() => onFilterChange("")} className="text-white/30 hover:text-white/80" aria-label="Limpiar filtro">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </label>
                <Toggle label="Tags" checked={settings.showTags} onChange={(value) => onChange({ showTags: value })} />
                <Toggle label="No resueltas" checked={settings.showUnresolved} onChange={(value) => onChange({ showUnresolved: value })} />
                <Toggle label="Huérfanas" checked={settings.showOrphans} onChange={(value) => onChange({ showOrphans: value })} />
              </Section>

              <Section title="Grupos" open={sections.groups} onToggle={() => onToggleSection("groups")}>
                {groups.length === 0 ? (
                  <p className="px-1 py-1 text-[10px] text-white/30">Sin carpetas.</p>
                ) : (
                  <ul className="space-y-px">
                    {groups.map((group) => (
                      <li key={group.folder || "/"}>
                        <button
                          type="button"
                          disabled={!group.folder}
                          onClick={() => onFilterChange(group.folder)}
                          title={group.folder ? `Filtrar por ${group.folder}` : undefined}
                          className="flex w-full items-center gap-2 rounded-md px-1 py-[3px] text-left text-[10px] text-white/55 transition enabled:hover:bg-white/[0.04] enabled:hover:text-white/90"
                        >
                          <Swatch tone={group.tone} />
                          <span className="min-w-0 flex-1 truncate">{group.folder || "Raíz"}</span>
                          <span className="font-mono text-[9px] text-white/25">{group.count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>

              <Section title="Visualización" open={sections.display} onToggle={() => onToggleSection("display")}>
                <Slider label="Umbral de texto" value={settings.textFade} range={SLIDER_RANGES.textFade} onChange={(value) => onChange({ textFade: value })} />
                <Slider label="Tamaño de nodos" value={settings.nodeSize} range={SLIDER_RANGES.nodeSize} onChange={(value) => onChange({ nodeSize: value })} />
                <Slider label="Grosor de enlaces" value={settings.linkWidth} range={SLIDER_RANGES.linkWidth} onChange={(value) => onChange({ linkWidth: value })} />
              </Section>

              <Section title="Fuerzas" open={sections.forces} onToggle={() => onToggleSection("forces")}>
                <Slider label="Fuerza de centro" value={settings.centerStrength} range={SLIDER_RANGES.centerStrength} onChange={(value) => onChange({ centerStrength: value })} />
                <Slider label="Repulsión" value={settings.repelStrength} range={SLIDER_RANGES.repelStrength} onChange={(value) => onChange({ repelStrength: value })} />
                <Slider label="Fuerza de enlace" value={settings.linkStrength} range={SLIDER_RANGES.linkStrength} onChange={(value) => onChange({ linkStrength: value })} />
                <Slider label="Distancia" value={settings.linkDistance} range={SLIDER_RANGES.linkDistance} onChange={(value) => onChange({ linkDistance: value })} />
              </Section>
            </div>

            <div className="flex gap-1 border-t border-white/[0.06] p-1.5">
              <button type="button" onClick={props.onReheat} className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md border border-white/[0.08] text-[10px] text-white/60 transition hover:bg-white/[0.05] hover:text-white active:scale-95">
                <Play className="h-3 w-3" />
                Reanimar
              </button>
              <button type="button" onClick={props.onCenter} className="flex h-7 flex-1 items-center justify-center gap-1.5 rounded-md border border-white/[0.08] text-[10px] text-white/60 transition hover:bg-white/[0.05] hover:text-white active:scale-95">
                <Crosshair className="h-3 w-3" />
                Centrar
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="closed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-white/10 bg-[#0a0a0a]/80 p-0.5 backdrop-blur-3xl"
          >
            <button type="button" className={ICON_BUTTON} onClick={props.onCenter} title="Centrar" aria-label="Centrar grafo">
              <Crosshair className="h-3.5 w-3.5" />
            </button>
            <button type="button" className={clsx(ICON_BUTTON, "relative")} onClick={() => onOpenChange(true)} title="Ajustes del grafo" aria-label="Abrir ajustes del grafo" aria-expanded={false}>
              <Settings className="h-3.5 w-3.5" />
              {filter && <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-white/80" aria-hidden />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Controles del grafo local (barra lateral estrecha)
// ---------------------------------------------------------------------------

export type LocalGraphControlsProps = {
  depth: LocalDepth;
  onDepthChange: (depth: LocalDepth) => void;
  onCenter: () => void;
  counts: { nodes: number; links: number };
  refreshing: boolean;
};

export function LocalGraphControls({ depth, onDepthChange, onCenter, counts, refreshing }: LocalGraphControlsProps) {
  return (
    <>
      <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5 rounded-md border border-white/10 bg-[#0a0a0a]/80 p-0.5 backdrop-blur-3xl">
        <div role="group" aria-label="Profundidad" className="flex items-center" title="Profundidad">
          {([1, 2, 3] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={depth === value}
              aria-label={`Profundidad ${value}`}
              onClick={() => onDepthChange(value)}
              className={clsx(
                "h-5 w-5 rounded font-mono text-[10px] transition active:scale-95",
                depth === value ? "bg-white/[0.12] text-white" : "text-white/35 hover:text-white/80",
              )}
            >
              {value}
            </button>
          ))}
        </div>
        <span className="mx-0.5 h-3 w-px bg-white/10" aria-hidden />
        <button type="button" onClick={onCenter} title="Centrar" aria-label="Centrar grafo" className="flex h-5 w-5 items-center justify-center rounded text-white/40 transition hover:text-white/85 active:scale-95">
          <Crosshair className="h-3 w-3" />
        </button>
      </div>
      <span className={clsx("pointer-events-none absolute bottom-1.5 left-2 z-10 font-mono text-[9px] text-white/25 transition-opacity", refreshing && "opacity-50")} aria-hidden>
        {formatCount(counts.nodes, counts.links, true)}
      </span>
    </>
  );
}
