"use client";

import { useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { getVaultNote } from "@/app/actions/vault";
import { basenameOf } from "@/features/vault/parse";
import { embedKind, extractSection, findSubpathLine, previewExcerpt, vaultFileUrl, wikilinkDisplay } from "@/features/vault/markdown";
import { MAX_EMBED_DEPTH, cn, isModifierClick, useReader, useVaultNote } from "./context";

const OPEN_DELAY = 600;
const CLOSE_DELAY = 180;
const CARD_WIDTH = 440;
const CARD_HEIGHT = 380;

type Anchor = { left: number; top?: number; bottom?: number };

function placeCard(rect: DOMRect): Anchor {
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - CARD_WIDTH - 8));
  const below = window.innerHeight - rect.bottom;
  if (below >= CARD_HEIGHT + 12 || below >= rect.top) return { left, top: rect.bottom + 6 };
  return { left, bottom: window.innerHeight - rect.top + 6 };
}

/** Abre una nota calculando la línea de `#Encabezado` / `#^bloque` si hace falta. */
export async function openWithSubpath(
  path: string,
  subpath: string | undefined,
  newTab: boolean,
  onOpen: (path: string, options?: { newTab?: boolean; line?: number }) => void,
) {
  if (!subpath || embedKind(path) !== "note") {
    onOpen(path, { newTab });
    return;
  }
  let line: number | undefined;
  try {
    const note = await getVaultNote(path);
    line = findSubpathLine(note.content, subpath) ?? undefined;
  } catch {
    line = undefined;
  }
  onOpen(path, { newTab, line });
}

function PreviewBody({ path, subpath }: { path: string; subpath?: string }) {
  const reader = useReader();
  const kind = embedKind(path);
  const { data, error, isLoading } = useVaultNote(kind === "note" ? path : null);
  const excerpt = useMemo(() => {
    if (!data) return null;
    if (subpath) return extractSection(data.content, subpath)?.text ?? null;
    return previewExcerpt(data.content);
  }, [data, subpath]);

  if (kind === "image") {
    return <img src={vaultFileUrl(path)} alt={basenameOf(path)} className="max-h-[340px] w-full rounded-md object-contain" />;
  }
  if (isLoading && !data) {
    return (
      <div className="flex items-center gap-2 py-6 text-[11px] text-white/30">
        <Loader2 className="size-3.5 animate-spin" /> Cargando…
      </div>
    );
  }
  if (error) return <p className="py-4 text-[11px] text-white/35">No se pudo cargar la nota.</p>;
  if (excerpt === null) return <p className="py-4 text-[11px] text-white/35">No se encontró «{subpath}».</p>;
  if (!excerpt.trim()) return <p className="py-4 text-[11px] italic text-white/30">Nota vacía.</p>;
  const { Reader } = reader;
  return (
    <Reader
      path={path}
      content={excerpt}
      depth={reader.depth + 1}
      resolve={reader.resolve}
      onOpen={reader.onOpen}
      onOpenUnresolved={reader.onOpenUnresolved}
      onSearchTag={reader.onSearchTag}
    />
  );
}

type InternalLinkProps = {
  /** Destino tal como se escribió (`Nota`, `carpeta/Nota`, ruta completa). Vacío = esta nota. */
  target: string;
  subpath?: string;
  children?: ReactNode;
  className?: string;
};

/**
 * Enlace interno estilo Obsidian: clic abre (Cmd/Ctrl o clic central en
 * pestaña nueva), los no resueltos se ven tenues y crean la nota, y al
 * dejar el puntero ~600 ms aparece la vista previa flotante.
 */
export function InternalLink({ target, subpath, children, className }: InternalLinkProps) {
  const reader = useReader();
  const resolved = target ? reader.resolve(target, reader.path) : reader.path;
  const samePage = !target || resolved === reader.path;
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const timers = useRef<{ open?: number; close?: number }>({});

  useEffect(() => () => {
    window.clearTimeout(timers.current.open);
    window.clearTimeout(timers.current.close);
  }, []);

  const previewable = Boolean(resolved) && !samePage && reader.depth < MAX_EMBED_DEPTH && ["note", "image"].includes(embedKind(resolved ?? ""));

  const cancelClose = () => window.clearTimeout(timers.current.close);
  const scheduleClose = () => {
    window.clearTimeout(timers.current.open);
    window.clearTimeout(timers.current.close);
    timers.current.close = window.setTimeout(() => setAnchor(null), CLOSE_DELAY);
  };

  const follow = (event: MouseEvent, forceNewTab = false) => {
    event.preventDefault();
    event.stopPropagation();
    window.clearTimeout(timers.current.open);
    setAnchor(null);
    const newTab = forceNewTab || isModifierClick(event);
    if (!resolved) {
      reader.onOpenUnresolved(target);
      return;
    }
    if (samePage && subpath && !newTab && reader.depth === 0) {
      reader.scrollToSubpath(subpath);
      return;
    }
    void openWithSubpath(resolved, subpath, newTab, reader.onOpen);
  };

  const label = children ?? wikilinkDisplay(target, subpath);
  return (
    <>
      <a
        href={resolved ? `#${encodeURIComponent(resolved)}` : undefined}
        role={resolved ? undefined : "button"}
        tabIndex={resolved ? undefined : 0}
        onKeyDown={resolved ? undefined : (event) => {
          if (event.key === "Enter") reader.onOpenUnresolved(target);
        }}
        title={resolved ? undefined : `«${target}» todavía no existe. Clic para crearla.`}
        data-href={target + (subpath ? `#${subpath}` : "")}
        className={cn(
          "cursor-pointer rounded-[3px] underline decoration-1 underline-offset-[3px] transition-colors",
          resolved
            ? "text-[#f2f2f2] decoration-white/30 hover:bg-white/[0.04] hover:decoration-white/80"
            : "text-[#8a8a8a] decoration-white/20 decoration-dashed hover:text-white/70",
          className,
        )}
        onClick={(event) => follow(event)}
        onAuxClick={(event) => {
          if (event.button === 1) follow(event, true);
        }}
        onMouseEnter={(event) => {
          if (!previewable) return;
          cancelClose();
          const element = event.currentTarget;
          window.clearTimeout(timers.current.open);
          timers.current.open = window.setTimeout(() => setAnchor(placeCard(element.getBoundingClientRect())), OPEN_DELAY);
        }}
        onMouseLeave={scheduleClose}
      >
        {label}
      </a>
      {anchor && resolved && createPortal(
        <motion.div
          initial={{ opacity: 0, y: anchor.top !== undefined ? -4 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          style={{ left: anchor.left, top: anchor.top, bottom: anchor.bottom, width: CARD_WIDTH, maxHeight: CARD_HEIGHT }}
          className="fixed z-[300] flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0e0e0e]/95 shadow-[0_24px_70px_rgba(0,0,0,0.6)] backdrop-blur-3xl"
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 py-1.5">
            <span className="min-w-0 flex-1 truncate text-[10px] text-white/40">
              {basenameOf(resolved)}{subpath ? ` › ${subpath.replace(/#/g, " › ")}` : ""}
            </span>
            <button
              type="button"
              aria-label="Abrir nota"
              onClick={(event) => follow(event)}
              className="rounded p-0.5 text-white/35 transition hover:bg-white/[0.06] hover:text-white active:scale-95"
            >
              <ArrowUpRight className="size-3.5" />
            </button>
          </div>
          <div className="min-h-0 overflow-y-auto px-4 py-3 text-[14px] [scrollbar-width:thin]">
            <PreviewBody path={resolved} subpath={subpath} />
          </div>
        </motion.div>,
        document.body,
      )}
    </>
  );
}
