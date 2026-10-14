"use client";

import { useState, type MouseEvent, type ReactNode } from "react";
import {
  ArrowUpRight,
  Binary,
  Braces,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Forward,
  List,
  SquareCheck,
  Tags,
  TextAlignStart,
  type LucideIcon,
} from "lucide-react";
import { splitLinkInner } from "@/features/vault/parse";
import { cn } from "./context";

export type PropertiesViewProps = {
  frontmatter: Record<string, unknown>;
  /** Nota a la que pertenecen (para resolver enlaces relativos). */
  path: string;
  resolve: (target: string, from?: string) => string | null;
  onOpen: (path: string, options?: { newTab?: boolean; line?: number }) => void;
  onSearchTag: (tag: string) => void;
  /** Opcional: crear la nota de un enlace sin resolver. Sin esto se muestran tenues y sin clic. */
  onOpenUnresolved?: (target: string) => void;
  /** Mostrar el encabezado plegable "Propiedades" (por defecto sí). */
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
};

type Kind = "text" | "list" | "number" | "checkbox" | "date" | "datetime" | "tags" | "aliases" | "object";

const ICONS: Record<Kind, LucideIcon> = {
  text: TextAlignStart,
  list: List,
  number: Binary,
  checkbox: SquareCheck,
  date: Calendar,
  datetime: Clock,
  tags: Tags,
  aliases: Forward,
  object: Braces,
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const URL_PATTERN = /^(?:https?|obsidian|mailto):\S+$/i;
const WIKILINK = /\[\[([^[\]\n]+?)\]\]/g;

/** YAML convierte `[[Nota]]` sin comillas en [["Nota"]]: lo tratamos como enlace. */
function asYamlLink(value: unknown): string | null {
  if (Array.isArray(value) && value.length === 1 && Array.isArray(value[0]) && value[0].length === 1 && typeof value[0][0] === "string") {
    return `[[${value[0][0]}]]`;
  }
  return null;
}

function kindOf(key: string, value: unknown): Kind {
  const lower = key.toLowerCase();
  if (lower === "tags" || lower === "tag") return "tags";
  if (lower === "aliases" || lower === "alias") return "aliases";
  if (asYamlLink(value)) return "text";
  if (Array.isArray(value)) return "list";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "checkbox";
  if (value instanceof Date) return "datetime";
  if (typeof value === "string") {
    if (DATE.test(value.trim())) return "date";
    if (DATETIME.test(value.trim())) return "datetime";
  }
  if (value && typeof value === "object") return "object";
  return "text";
}

function flatten(value: unknown): unknown[] {
  if (asYamlLink(value)) return [asYamlLink(value)];
  if (Array.isArray(value)) return value.flatMap((item) => (asYamlLink(item) ? [asYamlLink(item)] : Array.isArray(item) ? flatten(item) : [item]));
  if (value === null || value === undefined || value === "") return [];
  return [value];
}

type LinkProps = Pick<PropertiesViewProps, "path" | "resolve" | "onOpen" | "onOpenUnresolved">;

function PropertyLink({ inner, path, resolve, onOpen, onOpenUnresolved }: LinkProps & { inner: string }) {
  const { target, subpath, alias } = splitLinkInner(inner);
  const resolved = target ? resolve(target, path) : path;
  const label = alias ?? (subpath ? `${target} > ${subpath}` : target);
  const clickable = Boolean(resolved) || Boolean(onOpenUnresolved);
  const open = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (resolved) onOpen(resolved, { newTab: event.metaKey || event.ctrlKey });
    else onOpenUnresolved?.(target);
  };
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={open}
      title={resolved ? resolved : `«${target}» todavía no existe`}
      className={cn(
        "inline rounded-[3px] text-left underline decoration-1 underline-offset-[3px] transition-colors",
        resolved ? "text-[#f2f2f2] decoration-white/30 hover:decoration-white/80" : "text-[#8a8a8a] decoration-dashed decoration-white/20",
        clickable && "cursor-pointer",
      )}
    >
      {label}
    </button>
  );
}

/** Texto con `[[enlaces]]` clicables y URLs externas. */
function RichText({ text, ...link }: LinkProps & { text: string }) {
  const trimmed = text.trim();
  if (URL_PATTERN.test(trimmed)) {
    return (
      <a href={trimmed} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-0.5 break-all text-white/85 underline decoration-white/25 underline-offset-[3px] hover:decoration-white/70">
        {trimmed}
        <ArrowUpRight className="size-3 shrink-0 text-white/40" />
      </a>
    );
  }
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(WIKILINK)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    parts.push(<PropertyLink key={start} inner={match[1]} {...link} />);
    last = start + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <span className="break-words">{parts}</span>;
}

function Scalar({ value, ...link }: LinkProps & { value: unknown }) {
  if (value === null || value === undefined || value === "") return <span className="italic text-white/25">Vacío</span>;
  if (typeof value === "boolean") {
    return (
      <span className="inline-flex items-center gap-1.5">
        <span className={cn("inline-flex size-[13px] items-center justify-center rounded-[3px] border", value ? "border-[#e8e8e8] bg-[#e8e8e8] text-[#0a0a0a]" : "border-white/30")}>
          {value && <Check className="size-[9px]" strokeWidth={3.5} />}
        </span>
      </span>
    );
  }
  if (typeof value === "number") return <span className="font-mono tabular-nums">{value}</span>;
  if (value instanceof Date) return <span className="font-mono">{value.toISOString().slice(0, 16).replace("T", " ")}</span>;
  if (typeof value === "string") return <RichText text={value} {...link} />;
  if (asYamlLink(value)) return <RichText text={asYamlLink(value) ?? ""} {...link} />;
  return <span className="break-all font-mono text-[0.92em] text-white/60">{JSON.stringify(value)}</span>;
}

function Chip({ children, onClick, title }: { children: ReactNode; onClick?: () => void; title?: string }) {
  const className = "inline-flex max-w-full items-center rounded-full bg-white/[0.07] px-2 py-px text-[0.92em] text-[#cfcfcf]";
  if (!onClick) return <span className={className}>{children}</span>;
  return (
    <button type="button" title={title} onClick={onClick} className={cn(className, "transition hover:bg-white/[0.12] hover:text-white active:scale-95")}>
      {children}
    </button>
  );
}

function Value({ name, value, kind, onSearchTag, ...link }: LinkProps & { name: string; value: unknown; kind: Kind; onSearchTag: (tag: string) => void }) {
  if (kind === "tags") {
    const tags = flatten(value).map((item) => String(item).replace(/^\[\[|\]\]$/g, "").replace(/^#/, "").trim()).filter(Boolean);
    if (!tags.length) return <Scalar value={null} {...link} />;
    return (
      <span className="flex flex-wrap gap-1">
        {tags.map((tag, index) => (
          <Chip key={`${tag}-${index}`} title={`Buscar #${tag}`} onClick={() => onSearchTag(tag)}>#{tag}</Chip>
        ))}
      </span>
    );
  }
  if (kind === "list" || kind === "aliases") {
    const items = flatten(value);
    if (!items.length) return <Scalar value={null} {...link} />;
    return (
      <span className="flex flex-wrap gap-1" data-property={name}>
        {items.map((item, index) => (
          <Chip key={index}>
            <Scalar value={item} {...link} />
          </Chip>
        ))}
      </span>
    );
  }
  return <Scalar value={value} {...link} />;
}

/**
 * Tabla de propiedades (frontmatter) como la de Obsidian: ícono según el
 * tipo, listas como chips, `[[enlaces]]` clicables y tags que buscan.
 */
export function PropertiesView({
  frontmatter,
  path,
  resolve,
  onOpen,
  onSearchTag,
  onOpenUnresolved,
  collapsible = true,
  defaultOpen = true,
  className,
}: PropertiesViewProps) {
  const [open, setOpen] = useState(defaultOpen);
  const entries = Object.entries(frontmatter);
  if (!entries.length) return null;
  const link: LinkProps = { path, resolve, onOpen, onOpenUnresolved };

  const rows = (
    <div className="space-y-px">
      {entries.map(([key, value]) => {
        const kind = kindOf(key, value);
        const Icon = ICONS[kind];
        return (
          <div key={key} className="grid grid-cols-[minmax(96px,34%)_1fr] items-start gap-x-3 rounded-md px-1.5 py-[5px] transition-colors hover:bg-white/[0.025]">
            <div className="flex min-w-0 items-center gap-2 pt-px text-white/45">
              <Icon className="size-3.5 shrink-0 text-white/30" />
              <span className="truncate" title={key}>{key}</span>
            </div>
            <div className="min-w-0 text-white/85">
              <Value name={key} value={value} kind={kind} onSearchTag={onSearchTag} {...link} />
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className={cn("text-[12.5px] leading-relaxed", className)} data-properties="">
      {collapsible && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="mb-1 flex items-center gap-1 rounded px-0.5 text-[11px] font-medium text-white/45 transition hover:text-white/80"
        >
          <ChevronRight className={cn("size-3.5 transition-transform duration-150", open && "rotate-90")} />
          Propiedades
        </button>
      )}
      {(!collapsible || open) && rows}
    </div>
  );
}

export default PropertiesView;
