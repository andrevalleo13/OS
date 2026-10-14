"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpRight,
  Brain,
  CalendarDays,
  Dumbbell,
  FileText,
  Globe,
  GraduationCap,
  Utensils,
  Wallet,
  Zap,
} from "lucide-react";
import type { ShadowSource } from "@/features/shadow/sources";

const SPRING = { type: "spring", bounce: 0.1, duration: 0.25 } as const;
/** Margen para que el puntero cruce del chip a la tarjeta sin cerrarla. */
const CLOSE_DELAY_MS = 120;
/** Chips visibles antes de agrupar el resto en "+n". */
const VISIBLE_LIMIT = 3;

const KIND_LABEL: Record<ShadowSource["kind"], string> = {
  domain: "Contexto",
  memory: "Memoria",
  note: "Obsidian",
  web: "Web",
  action: "Acción",
};

function SourceIcon({ source, className }: { source: ShadowSource; className?: string }) {
  if (source.kind === "domain") {
    if (source.domain === "nutrition") return <Utensils className={className} />;
    if (source.domain === "fitness") return <Dumbbell className={className} />;
    if (source.domain === "finance") return <Wallet className={className} />;
    if (source.domain === "university") return <GraduationCap className={className} />;
    return <CalendarDays className={className} />;
  }
  if (source.kind === "memory") return <Brain className={className} />;
  if (source.kind === "note") return <FileText className={className} />;
  if (source.kind === "web") return <Globe className={className} />;
  return <Zap className={className} />;
}

/**
 * Cita que se puede espiar. La tarjeta crece desde el chip (origen abajo a la
 * izquierda), así el ojo nunca pierde de dónde salió. Abre con hover y con
 * foco, y se cierra con Escape: una vista previa solo con hover no sirve con
 * teclado ni en táctil.
 */
export function ShadowCitation({ source, index, onOpenNote }: { source: ShadowSource; index: number; onOpenNote?: (notePath: string) => void }) {
  const reduced = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
    setOpen(true);
  };
  const hide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        onFocus={show}
        onBlur={hide}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className={`flex h-6 max-w-[180px] items-center gap-1.5 rounded-full border px-2 text-[9px] transition-colors ${open ? "border-white/[0.16] bg-white/[0.06] text-white/75" : "border-white/[0.06] bg-white/[0.02] text-white/38 hover:text-white/65"}`}
      >
        <span className="font-mono text-[8px] tabular-nums text-white/25">{index}</span>
        <SourceIcon source={source} className="h-3 w-3 shrink-0" />
        <span className="truncate">{source.label}</span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            role="tooltip"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.96, y: 2 }}
            transition={reduced ? { duration: 0 } : SPRING}
            style={{ transformOrigin: "bottom left" }}
            className="absolute bottom-full left-0 z-40 mb-2 w-64 rounded-2xl border border-white/10 bg-[#0a0a0a]/95 p-3 shadow-[0_18px_60px_rgba(0,0,0,0.6)] backdrop-blur-3xl"
          >
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04] text-white/55">
                <SourceIcon source={source} className="h-3 w-3" />
              </span>
              <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-white/30">{KIND_LABEL[source.kind]}</span>
            </div>
            <p className="mt-2.5 text-[11px] font-medium leading-snug text-white/80">{source.label}</p>
            {source.detail ? <p className="mt-1 line-clamp-3 break-words text-[10px] leading-relaxed text-white/38">{source.detail}</p> : null}
            {source.url ? (
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-2.5 inline-flex items-center gap-1 text-[9px] text-white/45 transition-colors hover:text-white">
                Abrir fuente <ArrowUpRight className="h-3 w-3" />
              </a>
            ) : null}
            {source.kind === "note" && source.notePath && onOpenNote ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onOpenNote(source.notePath as string);
                }}
                className="mt-2.5 inline-flex items-center gap-1 text-[9px] text-white/45 transition-colors hover:text-white"
              >
                Abrir nota <ArrowUpRight className="h-3 w-3" />
              </button>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

/**
 * Lo que Shadow consultó para responder. Plegado a tres chips y un "+n":
 * la procedencia tiene que estar disponible, no competir con la respuesta.
 */
export function ShadowSources({
  sources,
  className = "",
  onOpenNote,
}: {
  sources: ShadowSource[];
  className?: string;
  /** Si se pasa, las fuentes de notas ofrecen "Abrir nota". */
  onOpenNote?: (notePath: string) => void;
}) {
  const reduced = useReducedMotion() ?? false;
  const [expanded, setExpanded] = useState(false);
  if (sources.length === 0) return null;
  const visible = expanded ? sources : sources.slice(0, VISIBLE_LIMIT);
  const hidden = sources.length - visible.length;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <span className="mr-1 font-mono text-[8px] uppercase tracking-[0.16em] text-white/18">Fuentes</span>
      <AnimatePresence initial={false}>
        {visible.map((source, index) => (
          <motion.span
            key={source.id}
            layout={!reduced}
            initial={reduced ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={reduced ? { duration: 0 } : { ...SPRING, delay: expanded ? (index - VISIBLE_LIMIT) * 0.03 : 0 }}
          >
            <ShadowCitation source={source} index={index + 1} onOpenNote={onOpenNote} />
          </motion.span>
        ))}
      </AnimatePresence>
      {hidden > 0 ? (
        <button type="button" onClick={() => setExpanded(true)} className="h-6 rounded-full px-2 font-mono text-[9px] tabular-nums text-white/30 transition-colors hover:text-white/70">
          +{hidden}
        </button>
      ) : null}
    </div>
  );
}
