"use client";

import {
  Children,
  isValidElement,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ComponentProps,
  type ReactNode,
} from "react";
import Markdown, { defaultUrlTransform, type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseDocument } from "yaml";
import { ArrowUpRight, Check, Minus, TriangleAlert } from "lucide-react";
import {
  EMBED_SCHEME,
  MATH_MARK,
  TAG_SCHEME,
  WIKILINK_SCHEME,
  decodeLinkTarget,
  embedKind,
  findSubpathLine,
  headingSlug,
  parseEmbedSize,
  parseEmbedSrc,
  parseTagHref,
  parseWikilinkHref,
  prepareMarkdown,
  remarkObsidian,
  toggleTaskLine,
  vaultFileUrl,
} from "@/features/vault/markdown";
import { Callout } from "./Callout";
import { CodeBlock, MathBlock } from "./CodeBlock";
import { ReaderContext, TaskContext, cn, hastText, useReader, type NoteReaderProps, type ReaderContextValue } from "./context";
import { DataviewBlock, DataviewJsNotice } from "./DataviewBlock";
import { Embed } from "./Embed";
import { InternalLink } from "./InternalLink";
import { PropertiesView } from "./PropertiesView";

export type { NoteReaderProps } from "./context";

type Node = ExtraProps["node"];

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Línea 0-based en el archivo completo; solo en la nota principal (los embeds no compiten por `data-line`). */
function useLine(node: Node): number | undefined {
  const reader = useReader();
  if (reader.depth > 0 || !node?.position) return undefined;
  return node.position.start.line - 1 + reader.lineOffset;
}

function urlTransform(url: string): string {
  if (url.startsWith(WIKILINK_SCHEME) || url.startsWith(EMBED_SCHEME) || url.startsWith(TAG_SCHEME)) return url;
  return defaultUrlTransform(url);
}

function isExternal(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//");
}

const REMARK_PLUGINS = [remarkGfm, remarkObsidian];
const REHYPE_OPTIONS = { footnoteLabel: "Notas al pie", footnoteBackLabel: "Volver al texto" };

// ---------------------------------------------------------------------------
// Bloques
// ---------------------------------------------------------------------------

const HEADING_CLASSES: Record<number, string> = {
  1: "mt-[1.4em] mb-[0.5em] text-[1.95em] leading-[1.25]",
  2: "mt-[1.35em] mb-[0.45em] text-[1.55em] leading-[1.3]",
  3: "mt-[1.25em] mb-[0.4em] text-[1.28em] leading-[1.35]",
  4: "mt-[1.15em] mb-[0.35em] text-[1.1em] leading-[1.4]",
  5: "mt-[1.1em] mb-[0.3em] text-[1em] leading-[1.45]",
  6: "mt-[1.1em] mb-[0.3em] text-[0.92em] leading-[1.45] text-[#a8a8a8]",
};

function Heading({ level, node, children, className, id }: { level: number; node?: Node; children?: ReactNode; className?: string; id?: string }) {
  const reader = useReader();
  const line = useLine(node);
  const text = hastText(node);
  const props = {
    id: id ?? (reader.depth === 0 ? headingSlug(text) : undefined),
    "data-line": line,
    "data-heading": text,
    className: cn("scroll-mt-6 font-[650] tracking-[-0.015em] text-[#f4f4f4] first:mt-0", HEADING_CLASSES[level], className),
  };
  switch (level) {
    case 1: return <div role="heading" aria-level={1} {...props}>{children}</div>;
    case 2: return <h2 {...props}>{children}</h2>;
    case 3: return <h3 {...props}>{children}</h3>;
    case 4: return <h4 {...props}>{children}</h4>;
    case 5: return <h5 {...props}>{children}</h5>;
    default: return <h6 {...props}>{children}</h6>;
  }
}

function hasEmbed(node: Node): boolean {
  return Boolean(node?.children.some((child) => child.type === "element" && child.tagName === "img" && String(child.properties?.src ?? "").startsWith(EMBED_SCHEME)));
}

function Paragraph({ node, children }: ComponentProps<"p"> & ExtraProps) {
  const line = useLine(node);
  const className = "my-[0.65em] first:mt-0 last:mb-0";
  // Un embed de nota es un bloque: dentro de <p> sería HTML inválido.
  if (hasEmbed(node)) return <div className={className} data-line={line}>{children}</div>;
  return <p className={className} data-line={line}>{children}</p>;
}

function Blockquote({ node, children }: ComponentProps<"blockquote"> & ExtraProps) {
  const line = useLine(node);
  return (
    <blockquote data-line={line} className="my-4 border-l-2 border-white/20 pl-4 text-[#bdbdbd] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      {children}
    </blockquote>
  );
}

function Div({ node, children, ...rest }: ComponentProps<"div"> & ExtraProps) {
  const line = useLine(node);
  const data = rest as Record<string, unknown>;
  if ("data-callout" in data) {
    return (
      <Callout type={String(data["data-callout-type"] ?? data["data-callout"])} fold={String(data["data-callout-fold"] ?? "")} line={line}>
        {children}
      </Callout>
    );
  }
  if ("data-callout-title" in data) return <div data-callout-title="" className="min-w-0 flex-1 [&_p]:m-0">{children}</div>;
  if ("data-callout-body" in data) {
    if (!Children.count(children)) return null;
    return <div data-callout-body="" className="mt-1.5 text-[0.97em] font-normal text-[#d4d4d4] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{children}</div>;
  }
  return <div {...rest}>{children}</div>;
}

function Pre({ node }: ComponentProps<"pre"> & ExtraProps) {
  const line = useLine(node);
  const code = node?.children.find((child) => child.type === "element" && child.tagName === "code");
  const classes = code && code.type === "element" ? code.properties?.className : undefined;
  const lang = (Array.isArray(classes) ? classes : [])
    .map(String)
    .find((name) => name.startsWith("language-"))
    ?.slice("language-".length)
    .toLowerCase();
  const text = hastText(code).replace(/\n$/, "");
  if (lang === "dataview") return <div data-line={line}><DataviewBlock source={text} /></div>;
  if (lang === "dataviewjs") return <div data-line={line}><DataviewJsNotice source={text} /></div>;
  if (lang === "math") return <MathBlock code={text} line={line} />;
  return <CodeBlock code={text} lang={lang} line={line} />;
}

function InlineCode({ node, children }: ComponentProps<"code"> & ExtraProps) {
  const text = hastText(node);
  if (text.startsWith(MATH_MARK)) {
    const math = text.slice(MATH_MARK.length);
    if (math.startsWith("$$")) {
      return <span className="my-2 block overflow-x-auto text-center font-mono text-[0.9em] text-white/80">{math.slice(2, -2)}</span>;
    }
    return <span className="font-mono text-[0.9em] text-[#c8c8c8]">{math.slice(1, -1)}</span>;
  }
  return <code className="rounded-[4px] bg-white/[0.06] px-[5px] py-px font-mono text-[0.86em] text-[#dcdcdc]">{children}</code>;
}

const NESTED_LIST = "[li>&]:my-0 [li>&]:-ml-[0.95em] [li>&]:border-l [li>&]:border-white/[0.07] [li>&]:pl-[2.55em]";

function UnorderedList({ node, children, className }: ComponentProps<"ul"> & ExtraProps) {
  const line = useLine(node);
  const tasks = className?.includes("contains-task-list");
  return (
    <ul data-line={line} className={cn("my-[0.6em] list-disc pl-[1.6em] marker:text-[#8e8e8e] [li_&]:list-[circle] [li_li_&]:list-[square]", tasks && "contains-task-list", NESTED_LIST)}>
      {children}
    </ul>
  );
}

function OrderedList({ node, children, start }: ComponentProps<"ol"> & ExtraProps) {
  const line = useLine(node);
  return (
    <ol start={start} data-line={line} className={cn("my-[0.6em] list-decimal pl-[1.6em] marker:font-mono marker:text-[0.86em] marker:text-[#8e8e8e]", NESTED_LIST)}>
      {children}
    </ol>
  );
}

function isNestedList(child: ReactNode): boolean {
  return isValidElement(child) && (child.type === UnorderedList || child.type === OrderedList);
}

function ListItem({ node, children, className, ...rest }: ComponentProps<"li"> & ExtraProps) {
  const line = useLine(node);
  const reader = useReader();
  const status = (rest as Record<string, unknown>)["data-task"];
  const isTask = typeof status === "string" && Boolean(className?.includes("task-list-item"));
  const id = (rest as Record<string, unknown>).id as string | undefined;
  if (!isTask) {
    return <li id={id} data-line={line} className={cn("my-[0.12em] pl-[0.15em]", className)}>{children}</li>;
  }
  const done = status === "x" || status === "X" || status === "-";
  const items = Children.toArray(children);
  const fullLine = reader.depth === 0 && node?.position ? node.position.start.line - 1 + reader.lineOffset : null;
  return (
    <TaskContext.Provider value={{ line: fullLine, status }}>
      <li data-line={line} data-task={status} className={cn("task-list-item relative my-[0.12em] list-none pl-[0.15em]", done && "is-checked")}>
        <div className={cn(done && "text-[#6f6f6f] line-through decoration-white/25")}>{items.filter((child) => !isNestedList(child))}</div>
        {items.filter(isNestedList)}
      </li>
    </TaskContext.Provider>
  );
}

function Checkbox({ type, checked }: ComponentProps<"input"> & ExtraProps) {
  const task = useContext(TaskContext);
  const reader = useReader();
  if (type !== "checkbox") return null;
  const status = task?.status ?? (checked ? "x" : " ");
  const interactive = Boolean(reader.toggleTask) && task?.line !== null && task?.line !== undefined;
  const isChecked = status !== " ";
  const lower = status.toLowerCase();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={status === "/" ? "mixed" : isChecked}
      aria-label={isChecked ? "Marcar como pendiente" : "Marcar como hecha"}
      disabled={!interactive}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (interactive && task?.line !== null && task?.line !== undefined) reader.toggleTask?.(task.line);
      }}
      className={cn(
        "absolute -left-[1.4em] top-[0.36em] inline-flex size-[15px] items-center justify-center rounded-[4px] border-[1.5px] no-underline transition",
        isChecked && lower !== "/" ? "border-[#e8e8e8] bg-[#e8e8e8] text-[#0a0a0a]" : "border-white/35",
        interactive ? "cursor-pointer hover:border-white/75 active:scale-[0.88]" : "cursor-default",
      )}
    >
      {lower === "x" ? (
        <Check className="size-[11px]" strokeWidth={3.5} />
      ) : status === "-" ? (
        <Minus className="size-[11px]" strokeWidth={3.5} />
      ) : status === "/" ? (
        <span className="size-[6px] rounded-[1.5px] bg-[#e8e8e8]" />
      ) : isChecked ? (
        <span className="font-mono text-[9px] font-bold leading-none">{status}</span>
      ) : null}
    </button>
  );
}

function Table({ node, children }: ComponentProps<"table"> & ExtraProps) {
  const line = useLine(node);
  return (
    <div data-line={line} className="my-4 overflow-x-auto [scrollbar-width:thin]">
      <table className="border-collapse text-[0.93em]">{children}</table>
    </div>
  );
}

function TableHeader({ children, style }: ComponentProps<"th"> & ExtraProps) {
  return <th style={style} className="border border-white/[0.1] bg-white/[0.035] px-3 py-1.5 text-left font-semibold text-[#ececec]">{children}</th>;
}

function TableCell({ children, style }: ComponentProps<"td"> & ExtraProps) {
  return <td style={style} className="border border-white/[0.08] px-3 py-1.5 align-top">{children}</td>;
}

function Rule({ node }: ComponentProps<"hr"> & ExtraProps) {
  const line = useLine(node);
  return <hr data-line={line} className="my-7 border-0 border-t border-white/[0.12]" />;
}

// ---------------------------------------------------------------------------
// En línea
// ---------------------------------------------------------------------------

function Anchor({ href, children, id, ...rest }: ComponentProps<"a"> & ExtraProps) {
  const reader = useReader();
  const wikilink = parseWikilinkHref(href);
  if (wikilink) return <InternalLink target={wikilink.target} subpath={wikilink.subpath}>{children}</InternalLink>;

  const tag = parseTagHref(href);
  if (tag !== null) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          reader.onSearchTag(tag);
        }}
        className="inline rounded-full bg-white/[0.07] px-[7px] py-px text-[0.84em] text-[#cfcfcf] transition hover:bg-white/[0.12] hover:text-white"
      >
        {children}
      </button>
    );
  }

  if (!href) return <a id={id}>{children}</a>;

  if (href.startsWith("#")) {
    const footnote = "data-footnote-ref" in rest || "data-footnote-backref" in rest;
    return (
      <a
        id={id}
        href={href}
        onClick={(event) => {
          event.preventDefault();
          reader.scrollToId(decodeLinkTarget(href.slice(1)));
        }}
        className={cn(footnote ? "px-px font-mono text-[0.8em] text-white/60 no-underline hover:text-white" : "text-[#f2f2f2] underline decoration-white/30 underline-offset-[3px] hover:decoration-white/80")}
      >
        {children}
      </a>
    );
  }

  if (isExternal(href)) {
    return (
      <a
        id={id}
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-[#f2f2f2] underline decoration-white/30 decoration-1 underline-offset-[3px] transition-colors hover:decoration-white/80"
      >
        {children}
        <ArrowUpRight className="ml-px inline size-[0.8em] -translate-y-px text-white/40" />
      </a>
    );
  }

  // Enlace Markdown relativo: `[texto](Carpeta/Nota.md#Encabezado)` o un adjunto.
  const decoded = decodeLinkTarget(href);
  const hash = decoded.indexOf("#");
  const target = (hash === -1 ? decoded : decoded.slice(0, hash)).replace(/\.md$/i, "");
  const subpath = hash === -1 ? undefined : decoded.slice(hash + 1) || undefined;
  if (target && embedKind(target) !== "note") {
    const resolved = reader.resolve(target, reader.path);
    return (
      <a href={resolved ? vaultFileUrl(resolved) : undefined} target="_blank" rel="noreferrer" className="text-[#f2f2f2] underline decoration-white/30 underline-offset-[3px] hover:decoration-white/80">
        {children}
      </a>
    );
  }
  return <InternalLink target={target} subpath={subpath}>{children}</InternalLink>;
}

function Image({ src, alt }: ComponentProps<"img"> & ExtraProps) {
  const reader = useReader();
  const source = typeof src === "string" ? src : "";
  const embed = parseEmbedSrc(source);
  if (embed) return <Embed {...embed} />;
  if (!source) return null;

  // `![alt|300](ruta)`: Obsidian acepta el tamaño en el texto alternativo.
  const sizeMatch = /\|([^|]*)$/.exec(alt ?? "");
  const size = parseEmbedSize(sizeMatch?.[1]);
  const label = size ? (alt ?? "").slice(0, sizeMatch?.index) : alt;
  const style = size?.width ? { width: size.width, height: size.height ?? "auto" } : undefined;
  if (isExternal(source) || source.startsWith("data:")) {
    return <img src={source} alt={label ?? ""} loading="lazy" style={style} className="inline-block max-w-full rounded-lg align-middle" />;
  }
  const resolved = reader.resolve(decodeLinkTarget(source), reader.path);
  if (!resolved) {
    return <span className="rounded border border-dashed border-white/[0.12] px-2 py-0.5 text-[0.85em] text-white/35">Imagen no encontrada: {decodeLinkTarget(source)}</span>;
  }
  return <img src={vaultFileUrl(resolved)} alt={label ?? ""} loading="lazy" style={style} className="inline-block max-w-full rounded-lg border border-white/[0.08] align-middle" />;
}

function Highlight({ children }: ComponentProps<"mark"> & ExtraProps) {
  return <mark className="rounded-[3px] bg-white/[0.16] px-[2px] text-white">{children}</mark>;
}

function Strike({ children }: ComponentProps<"del"> & ExtraProps) {
  return <del className="text-[#7a7a7a] decoration-white/40">{children}</del>;
}

function Strong({ children }: ComponentProps<"strong"> & ExtraProps) {
  return <strong className="font-bold text-white">{children}</strong>;
}

function Section({ children, className, ...rest }: ComponentProps<"section"> & ExtraProps) {
  const footnotes = "data-footnotes" in (rest as Record<string, unknown>);
  return (
    <section className={cn(className, footnotes && "mt-10 border-t border-white/[0.08] pt-4 text-[0.86em] text-white/55 [&_ol]:pl-[1.4em]")}>
      {children}
    </section>
  );
}

function Sup({ children }: ComponentProps<"sup"> & ExtraProps) {
  return <sup className="text-[0.75em] leading-none">{children}</sup>;
}

const COMPONENTS: Components = {
  h1: ({ node, children, className, id }) => <Heading level={1} node={node} className={className} id={id}>{children}</Heading>,
  h2: ({ node, children, className, id }) => <Heading level={2} node={node} className={className} id={id}>{children}</Heading>,
  h3: ({ node, children, className, id }) => <Heading level={3} node={node} className={className} id={id}>{children}</Heading>,
  h4: ({ node, children, className, id }) => <Heading level={4} node={node} className={className} id={id}>{children}</Heading>,
  h5: ({ node, children, className, id }) => <Heading level={5} node={node} className={className} id={id}>{children}</Heading>,
  h6: ({ node, children, className, id }) => <Heading level={6} node={node} className={className} id={id}>{children}</Heading>,
  p: Paragraph,
  blockquote: Blockquote,
  div: Div,
  pre: Pre,
  code: InlineCode,
  ul: UnorderedList,
  ol: OrderedList,
  li: ListItem,
  input: Checkbox,
  table: Table,
  th: TableHeader,
  td: TableCell,
  hr: Rule,
  a: Anchor,
  img: Image,
  mark: Highlight,
  del: Strike,
  strong: Strong,
  section: Section,
  sup: Sup,
};

// ---------------------------------------------------------------------------
// Lector
// ---------------------------------------------------------------------------

const MarkdownBody = memo(function MarkdownBody({ markdown }: { markdown: string }) {
  return (
    <Markdown remarkPlugins={REMARK_PLUGINS} remarkRehypeOptions={REHYPE_OPTIONS} urlTransform={urlTransform} components={COMPONENTS}>
      {markdown}
    </Markdown>
  );
});

function InvalidProperties({ raw }: { raw: string }) {
  return (
    <details className="mb-4 rounded-md border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-[11px] text-white/45">
      <summary className="flex cursor-pointer list-none items-center gap-1.5">
        <TriangleAlert className="size-3.5" /> Las propiedades tienen YAML inválido
      </summary>
      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-white/40">{raw}</pre>
    </details>
  );
}

function flash(element: HTMLElement) {
  element.scrollIntoView({ behavior: "smooth", block: "start" });
  element.animate?.([{ backgroundColor: "rgba(255, 255, 255, 0.08)" }, { backgroundColor: "rgba(255, 255, 255, 0)" }], { duration: 1_400, easing: "ease-out" });
}

/**
 * Vista de lectura de Obsidian: propiedades, Markdown con wikilinks, embeds,
 * callouts, tareas clicables, Dataview y vista previa al pasar el puntero.
 */
export function NoteReader({ path, content, resolve, onOpen, onOpenUnresolved, onSearchTag, onChange, depth = 0 }: NoteReaderProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  // Los callbacks del padre suelen ser flechas nuevas en cada render: se leen
  // desde una ref para que el contexto (y todos los enlaces) no se rehagan.
  const handlers = useRef({ onOpen, onOpenUnresolved, onSearchTag, onChange });
  useEffect(() => {
    handlers.current = { onOpen, onOpenUnresolved, onSearchTag, onChange };
  });
  const open = useCallback<NoteReaderProps["onOpen"]>((target, options) => handlers.current.onOpen(target, options), []);
  const openUnresolved = useCallback((target: string) => handlers.current.onOpenUnresolved(target), []);
  const searchTag = useCallback((tag: string) => handlers.current.onSearchTag(tag), []);
  const editable = Boolean(onChange) && depth === 0;
  const prepared = useMemo(() => prepareMarkdown(content), [content]);
  const invalidYaml = useMemo(() => {
    if (depth > 0 || !prepared.frontmatterRaw?.trim()) return false;
    try {
      return parseDocument(prepared.frontmatterRaw).errors.length > 0;
    } catch {
      return true;
    }
  }, [depth, prepared.frontmatterRaw]);

  const toggleTask = useCallback((line: number) => {
    const next = toggleTaskLine(content, line);
    if (next !== null) handlers.current.onChange?.(next);
  }, [content]);

  const scrollToSubpath = useCallback((subpath: string) => {
    const line = findSubpathLine(content, subpath);
    if (line === null) return;
    const element = depth === 0 ? rootRef.current?.querySelector<HTMLElement>(`[data-line="${line}"]`) : null;
    if (element) flash(element);
    else open(path, { line });
  }, [content, depth, open, path]);

  const scrollToId = useCallback((id: string) => {
    const root = rootRef.current;
    if (!root) return;
    const element = root.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (element) flash(element);
  }, []);

  const value = useMemo<ReaderContextValue>(() => ({
    path,
    content,
    depth,
    lineOffset: prepared.lineOffset,
    resolve,
    onOpen: open,
    onOpenUnresolved: openUnresolved,
    onSearchTag: searchTag,
    toggleTask: editable ? toggleTask : null,
    scrollToSubpath,
    scrollToId,
    Reader: NoteReader,
  }), [path, content, depth, prepared.lineOffset, resolve, open, openUnresolved, searchTag, editable, toggleTask, scrollToSubpath, scrollToId]);

  const showProperties = depth === 0 && Object.keys(prepared.frontmatter).length > 0;

  return (
    <ReaderContext.Provider value={value}>
      <div
        ref={rootRef}
        data-note-reader={path}
        className={cn(
          "note-reader w-full min-w-0 break-words leading-[1.75] text-[#e4e4e4]",
          depth === 0 && "text-[15px]",
        )}
      >
        {showProperties && (
          <div className="mb-6 border-b border-white/[0.06] pb-4">
            <PropertiesView
              frontmatter={prepared.frontmatter}
              path={path}
              resolve={resolve}
              onOpen={open}
              onSearchTag={searchTag}
              onOpenUnresolved={openUnresolved}
            />
          </div>
        )}
        {invalidYaml && prepared.frontmatterRaw && <InvalidProperties raw={prepared.frontmatterRaw} />}
        <MarkdownBody markdown={prepared.markdown} />
      </div>
    </ReaderContext.Provider>
  );
}

export default NoteReader;
