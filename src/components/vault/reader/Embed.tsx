"use client";

import { useMemo, type MouseEvent } from "react";
import { ArrowUpRight, Database, FileText, LayoutGrid, Loader2, Paperclip, PenTool, type LucideIcon } from "lucide-react";
import { basenameOf } from "@/features/vault/parse";
import { embedKind, extractSection, parseEmbedSize, stripFrontmatter, vaultFileUrl, type EmbedRef } from "@/features/vault/markdown";
import { MAX_EMBED_DEPTH, cn, isModifierClick, useReader, useVaultNote } from "./context";
import { InternalLink, openWithSubpath } from "./InternalLink";

function fileName(path: string): string {
  return path.split("/").pop() ?? path;
}

const CARDS: Record<"base" | "canvas" | "excalidraw" | "file", { icon: LucideIcon; label: string }> = {
  base: { icon: Database, label: "Vista de Obsidian Bases" },
  canvas: { icon: LayoutGrid, label: "Canvas" },
  excalidraw: { icon: PenTool, label: "Dibujo de Excalidraw" },
  file: { icon: Paperclip, label: "Archivo adjunto" },
};

function ObsidianCard({ kind, path }: { kind: keyof typeof CARDS; path: string }) {
  const { icon: Icon, label } = CARDS[kind];
  return (
    <span className="my-2 flex max-w-md items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 align-middle">
      <Icon className="size-4 shrink-0 text-white/40" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] text-white/80">{fileName(path)}</span>
        <span className="block text-[10px] text-white/35">
          {label}{kind === "file" ? "" : ": ábrela en Obsidian"}
        </span>
      </span>
    </span>
  );
}

function Unresolved({ target }: { target: string }) {
  const reader = useReader();
  return (
    <button
      type="button"
      onClick={() => reader.onOpenUnresolved(target)}
      className="my-2 flex w-full max-w-md items-center gap-2 rounded-lg border border-dashed border-white/[0.12] px-3 py-2.5 text-left text-[12px] text-white/40 transition hover:border-white/25 hover:text-white/70 active:scale-[0.99]"
    >
      <FileText className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">«{target}» todavía no existe. Clic para crearla.</span>
    </button>
  );
}

function NoteEmbed({ path, subpath }: { path: string; subpath?: string }) {
  const reader = useReader();
  const depth = reader.depth + 1;
  const selfEmbed = path === reader.path && !subpath;
  const tooDeep = depth > MAX_EMBED_DEPTH || selfEmbed;
  const { data, error, isLoading } = useVaultNote(tooDeep ? null : path);
  const body = useMemo(() => {
    if (!data) return null;
    if (subpath) return extractSection(data.content, subpath);
    return stripFrontmatter(data.content);
  }, [data, subpath]);

  if (tooDeep) {
    return (
      <span className="my-1 inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] px-2 py-0.5 text-[12.5px]">
        <FileText className="size-3 text-white/35" />
        <InternalLink target={path} subpath={subpath} />
      </span>
    );
  }

  const open = (event: MouseEvent) => {
    event.preventDefault();
    void openWithSubpath(path, subpath, isModifierClick(event), reader.onOpen);
  };
  const { Reader } = reader;

  return (
    <div className="group/embed relative my-3 rounded-r-lg border-l-2 border-white/20 bg-white/[0.015] py-1 pl-5 pr-3" data-embed={path}>
      <div className="flex items-center gap-2 pb-1 pt-1">
        <span className="min-w-0 flex-1 truncate text-[10px] uppercase tracking-[0.08em] text-white/30">
          {basenameOf(path).split("/").pop()}{subpath ? ` › ${subpath.replace(/#/g, " › ")}` : ""}
        </span>
        <button
          type="button"
          aria-label="Abrir nota embebida"
          title="Abrir nota (Cmd/Ctrl: pestaña nueva)"
          onClick={open}
          className="rounded p-0.5 text-white/30 opacity-60 transition hover:bg-white/[0.06] hover:text-white group-hover/embed:opacity-100 active:scale-95"
        >
          <ArrowUpRight className="size-3.5" />
        </button>
      </div>
      <div className="max-h-[640px] overflow-y-auto [scrollbar-width:thin]">
        {isLoading && !data ? (
          <div className="flex items-center gap-2 py-3 text-[11px] text-white/30">
            <Loader2 className="size-3.5 animate-spin" /> Cargando…
          </div>
        ) : error ? (
          <p className="py-2 text-[11px] text-white/35">No se pudo cargar «{basenameOf(path)}».</p>
        ) : !body ? (
          <p className="py-2 text-[11px] text-white/35">No se encontró «{subpath}» en {basenameOf(path)}.</p>
        ) : !body.text.trim() ? (
          <p className="py-2 text-[11px] italic text-white/30">Nota vacía.</p>
        ) : (
          <Reader
            path={path}
            content={body.text}
            depth={depth}
            resolve={reader.resolve}
            onOpen={reader.onOpen}
            onOpenUnresolved={reader.onOpenUnresolved}
            onSearchTag={reader.onSearchTag}
          />
        )}
      </div>
    </div>
  );
}

/**
 * `![[...]]`: transclusión de notas (o de una sección), imágenes con tamaño,
 * audio, video, PDF y tarjetas para Bases, Canvas y Excalidraw.
 */
export function Embed({ target, subpath, alias }: EmbedRef) {
  const reader = useReader();
  const resolved = target ? reader.resolve(target, reader.path) : reader.path;
  const kind = embedKind(resolved ?? target);

  if (kind === "base" || kind === "canvas" || kind === "excalidraw") return <ObsidianCard kind={kind} path={resolved ?? target} />;
  if (!resolved) return <Unresolved target={target} />;

  const size = parseEmbedSize(alias);
  const url = vaultFileUrl(resolved);
  switch (kind) {
    case "image":
      return (
        <img
          src={url}
          alt={size ? fileName(resolved) : alias ?? fileName(resolved)}
          width={size?.width}
          height={size?.height}
          loading="lazy"
          className={cn("inline-block max-w-full rounded-lg border border-white/[0.08] align-middle", Boolean(size?.height) && "object-cover")}
          style={size?.width ? { width: size.width, height: size.height ?? "auto" } : undefined}
        />
      );
    case "audio":
      return <audio controls preload="metadata" src={url} className="my-2 block w-full max-w-md" />;
    case "video":
      return (
        <video
          controls
          preload="metadata"
          src={url}
          className="my-2 block max-w-full rounded-lg border border-white/[0.08]"
          style={size?.width ? { width: size.width } : undefined}
        />
      );
    case "pdf":
      return (
        <iframe
          src={subpath ? `${url}#${subpath}` : url}
          title={fileName(resolved)}
          className="my-3 block h-[640px] w-full rounded-lg border border-white/[0.08] bg-[#111]"
          style={size?.height ? { height: size.height } : undefined}
        />
      );
    case "note":
      return <NoteEmbed path={resolved} subpath={subpath} />;
    default:
      return <ObsidianCard kind="file" path={resolved} />;
  }
}
