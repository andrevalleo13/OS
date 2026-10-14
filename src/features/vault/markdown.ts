import { basenameOf, parseFrontmatter, parseNote, splitFrontmatter, splitLinkInner } from "./parse";

/**
 * Markdown de Obsidian → Markdown que react-markdown entiende.
 *
 * Dos capas:
 * 1. `prepareMarkdown` reescribe el texto línea a línea SIN cambiar el número
 *    de líneas (las posiciones de react-markdown siguen apuntando a la línea
 *    original): wikilinks, embeds, tags, comentarios `%%`, matemáticas y
 *    block ids. Nada de esto se toca dentro de código.
 * 2. `remarkObsidian` trabaja sobre el árbol mdast ya parseado: callouts,
 *    tareas con estados extra (`[/]`, `[-]`), `==resaltado==`, saltos de línea
 *    simples (Obsidian no usa "strict line breaks") y `<br>`.
 *
 * Puro y seguro para el cliente.
 */

export const WIKILINK_SCHEME = "wikilink:";
export const EMBED_SCHEME = "embed:";
export const TAG_SCHEME = "tag:";
/** Marca invisible al inicio de un `code` en línea que en realidad es `$math$`. */
export const MATH_MARK = "⁡";

export type PreparedMarkdown = {
  /** Cuerpo (sin frontmatter) ya transformado. Mismo número de líneas que el cuerpo original. */
  markdown: string;
  /** Línea 0-based del archivo completo donde empieza el cuerpo. */
  lineOffset: number;
  frontmatter: Record<string, unknown>;
  frontmatterRaw: string | null;
};

// ---------------------------------------------------------------------------
// Codificación de destinos
// ---------------------------------------------------------------------------

/** encodeURIComponent que además escapa `( ) ! ' * ~` para no romper `[x](url)`. */
export function encodeLinkTarget(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*~]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function decodeLinkTarget(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function wikilinkHref(target: string, subpath?: string): string {
  return `${WIKILINK_SCHEME}${encodeLinkTarget(subpath ? `${target}#${subpath}` : target)}`;
}

/** `wikilink:Nota%23Encabezado` → `{ target: "Nota", subpath: "Encabezado" }`. */
export function parseWikilinkHref(href: string | undefined | null): { target: string; subpath?: string } | null {
  if (!href?.startsWith(WIKILINK_SCHEME)) return null;
  const raw = decodeLinkTarget(href.slice(WIKILINK_SCHEME.length));
  const hash = raw.indexOf("#");
  if (hash === -1) return { target: raw };
  return { target: raw.slice(0, hash), subpath: raw.slice(hash + 1) || undefined };
}

export function embedSrc(inner: string): string {
  return `${EMBED_SCHEME}${encodeLinkTarget(inner)}`;
}

export type EmbedRef = { target: string; subpath?: string; alias?: string };

/** `embed:img.png%7C300` → `{ target: "img.png", alias: "300" }`. */
export function parseEmbedSrc(src: string | undefined | null): EmbedRef | null {
  if (!src?.startsWith(EMBED_SCHEME)) return null;
  return splitLinkInner(decodeLinkTarget(src.slice(EMBED_SCHEME.length)));
}

export function tagHref(tag: string): string {
  return `${TAG_SCHEME}${encodeLinkTarget(tag)}`;
}

export function parseTagHref(href: string | undefined | null): string | null {
  if (!href?.startsWith(TAG_SCHEME)) return null;
  return decodeLinkTarget(href.slice(TAG_SCHEME.length));
}

/** `300` → ancho; `300x200` → ancho y alto. Cualquier otra cosa → null. */
export function parseEmbedSize(alias: string | undefined): { width?: number; height?: number } | null {
  const match = /^\s*(\d+)(?:\s*x\s*(\d+))?\s*$/.exec(alias ?? "");
  if (!match) return null;
  return { width: Number(match[1]), height: match[2] ? Number(match[2]) : undefined };
}

// ---------------------------------------------------------------------------
// Transformación línea a línea
// ---------------------------------------------------------------------------

type LineState = {
  fence: { char: string; length: number } | null;
  math: boolean;
  comment: boolean;
};

const QUOTE_PREFIX = /^((?:[ \t]*>)*[ \t]*)/;
const FENCE_OPEN = /^(`{3,}|~{3,})(.*)$/;
const BLOCK_ID = /(^|\s)\^[A-Za-z0-9-]+\s*$/;
const TAG_PREV = /[\s(,;]/;

/**
 * Tokens que se procesan (o protegen) dentro de texto normal, en orden de
 * prioridad: escapes, wikilinks/embeds, enlaces Markdown, autolinks, URLs
 * desnudas, matemáticas en línea y tags.
 */
const TOKEN = new RegExp(
  [
    String.raw`(\\[\s\S])`,
    String.raw`(!?\[\[[^[\]\n]+?\]\])`,
    String.raw`(!?\[[^\]\n]*\]\([^)\n]*\))`,
    String.raw`(<[a-zA-Z][a-zA-Z0-9+.-]*:[^>\s]*>)`,
    String.raw`((?:https?|ftp|obsidian|file|mailto):\/*[^\s<>]+|www\.[^\s<>]+)`,
    String.raw`(\$\$[^$\n]+?\$\$|\$(?=[^\s$])[^$\n]*?[^\s\\$]\$(?!\d)|\$[^\s$\\]\$(?!\d))`,
    String.raw`(#[\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*)`,
  ].join("|"),
  "gu",
);

function escapeLinkText(text: string): string {
  return text.replace(/[\\`*_[\]<|~$]/g, "\\$&");
}

/** Envuelve texto como `code` en línea con suficientes backticks. */
function inlineCode(content: string): string {
  const longest = Math.max(0, ...Array.from(content.matchAll(/`+/g), (match) => match[0].length));
  const fence = "`".repeat(longest + 1);
  const pad = content.startsWith("`") || content.endsWith("`") ? " " : "";
  return `${fence}${pad}${content}${pad}${fence}`;
}

export function wikilinkDisplay(target: string, subpath?: string): string {
  if (!subpath) return target;
  const parts = subpath.split("#").map((part) => part.trim()).filter(Boolean);
  return target ? [target, ...parts].join(" > ") : parts.join(" > ");
}

function replaceWikilink(raw: string): string {
  const embed = raw.startsWith("!");
  // En tablas Obsidian exige escapar la barra del alias: [[Nota\|alias]].
  const inner = raw.slice(embed ? 3 : 2, -2).replace(/\\\|/g, "|");
  const { target, subpath, alias } = splitLinkInner(inner);
  if (!target && !subpath) return raw;
  if (embed) return `![](${embedSrc(inner)})`;
  return `[${escapeLinkText(alias ?? wikilinkDisplay(target, subpath))}](${wikilinkHref(target, subpath)})`;
}

/** Transforma un fragmento de texto que no es código ni comentario. */
function transformText(text: string, prevChar: string): string {
  if (!text) return text;
  return text.replace(TOKEN, (match, escape, wiki, mdLink, autolink, url, math, tag, offset: number) => {
    if (wiki) return replaceWikilink(wiki);
    if (math) return inlineCode(`${MATH_MARK}${math}`);
    if (tag) {
      const before = offset === 0 ? prevChar : text[offset - 1];
      if (before && !TAG_PREV.test(before)) return match;
      return `[${escapeLinkText(tag)}](${tagHref(tag.slice(1))})`;
    }
    return match;
  });
}

/** Busca el cierre de un `code` en línea con exactamente `length` backticks. */
function findClosingTicks(line: string, from: number, length: number): number {
  let index = from;
  while (index < line.length) {
    const start = line.indexOf("`", index);
    if (start === -1) return -1;
    let end = start;
    while (line[end] === "`") end += 1;
    if (end - start === length) return start;
    index = end;
  }
  return -1;
}

/** Texto, `code` en línea y comentarios `%%` (que pueden seguir en otras líneas). */
function transformInline(line: string, state: LineState): string {
  let out = "";
  let index = 0;
  while (index < line.length) {
    if (state.comment) {
      const end = line.indexOf("%%", index);
      if (end === -1) return out;
      state.comment = false;
      index = end + 2;
      continue;
    }
    const tick = line.indexOf("`", index);
    const comment = line.indexOf("%%", index);
    const prev = (at: number) => (at > 0 ? line[at - 1] : "");
    if (comment !== -1 && (tick === -1 || comment < tick)) {
      out += transformText(line.slice(index, comment), prev(index));
      state.comment = true;
      index = comment + 2;
      continue;
    }
    if (tick === -1) {
      out += transformText(line.slice(index), prev(index));
      break;
    }
    let runEnd = tick;
    while (line[runEnd] === "`") runEnd += 1;
    const close = findClosingTicks(line, runEnd, runEnd - tick);
    if (close === -1) {
      out += transformText(line.slice(index, runEnd), prev(index));
      index = runEnd;
      continue;
    }
    out += transformText(line.slice(index, tick), prev(index)) + line.slice(tick, close + runEnd - tick);
    index = close + runEnd - tick;
  }
  return out;
}

function transformLine(line: string, state: LineState): string {
  if (state.comment) return transformInline(line, state);

  const prefix = QUOTE_PREFIX.exec(line)?.[1] ?? "";
  const rest = line.slice(prefix.length);

  if (state.fence) {
    const close = FENCE_OPEN.exec(rest.trimEnd());
    if (close && close[1][0] === state.fence.char && close[1].length >= state.fence.length && !close[2].trim()) state.fence = null;
    return line;
  }
  if (state.math) {
    if (rest.trim() === "$$") {
      state.math = false;
      return `${prefix}\`\`\``;
    }
    return line;
  }

  const fence = FENCE_OPEN.exec(rest);
  if (fence && !(fence[1][0] === "`" && fence[2].includes("`"))) {
    state.fence = { char: fence[1][0], length: fence[1].length };
    return line;
  }
  const trimmed = rest.trim();
  if (trimmed === "$$") {
    state.math = true;
    return `${prefix}\`\`\`math`;
  }
  if (trimmed.length > 4 && trimmed.startsWith("$$") && trimmed.endsWith("$$") && !trimmed.slice(2, -2).includes("$$")) {
    return `${prefix}${inlineCode(`${MATH_MARK}${trimmed}`)}`;
  }

  return transformInline(line.replace(BLOCK_ID, ""), state);
}

/**
 * Transforma el cuerpo de una nota (sin frontmatter). Conserva exactamente
 * el número de líneas.
 */
export function transformObsidianMarkdown(body: string): string {
  const state: LineState = { fence: null, math: false, comment: false };
  return body.split("\n").map((line) => transformLine(line, state)).join("\n");
}

export function prepareMarkdown(content: string): PreparedMarkdown {
  const text = content.replace(/\r\n?/g, "\n");
  const { raw, bodyLine } = splitFrontmatter(text);
  const body = bodyLine > 0 ? text.split("\n").slice(bodyLine).join("\n") : text;
  return {
    markdown: transformObsidianMarkdown(body),
    lineOffset: bodyLine,
    frontmatter: parseFrontmatter(raw),
    frontmatterRaw: raw,
  };
}

// ---------------------------------------------------------------------------
// Utilidades de líneas: tareas, encabezados, secciones, bloques
// ---------------------------------------------------------------------------

const TASK_LINE = /^((?:[ \t]*>)*[ \t]*(?:[-*+]|\d+[.)])[ \t]+\[)([^\]])(\])/;

/**
 * Alterna la casilla de la tarea en `line` (0-based, archivo completo).
 * Devuelve el contenido nuevo o null si esa línea no es una tarea.
 */
export function toggleTaskLine(content: string, line: number): string | null {
  const lines = content.split("\n");
  const current = lines[line];
  if (current === undefined) return null;
  const match = TASK_LINE.exec(current);
  if (!match) return null;
  const next = match[2] === " " ? "x" : " ";
  lines[line] = `${match[1]}${next}${match[3]}${current.slice(match[0].length)}`;
  return lines.join("\n");
}

/** Normaliza un encabezado para compararlo con el subpath de un enlace. */
export function normalizeHeading(text: string): string {
  return text
    .normalize("NFC")
    .toLocaleLowerCase("es")
    .replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** `id` estable para un encabezado (para anclas y scroll). */
export function headingSlug(text: string): string {
  const slug = normalizeHeading(text).replace(/\s/g, "-");
  return slug || "encabezado";
}

/**
 * Línea (0-based, archivo completo) del encabezado al que apunta un subpath
 * (`Encabezado` o `Padre#Hijo`) o del bloque `^id`. Null si no existe.
 */
export function findSubpathLine(content: string, subpath: string): number | null {
  const clean = subpath.trim();
  if (!clean) return null;
  if (clean.startsWith("^")) return findBlockLine(content, clean.slice(1));
  const parts = clean.split("#").map((part) => part.trim()).filter(Boolean);
  const wanted = parts[parts.length - 1];
  if (!wanted) return null;
  const headings = parseNote(content).headings;
  const exact = headings.find((heading) => heading.text.trim() === wanted);
  if (exact) return exact.line;
  const key = normalizeHeading(wanted);
  const loose = headings.find((heading) => normalizeHeading(heading.text) === key);
  return loose ? loose.line : null;
}

export function findBlockLine(content: string, blockId: string): number | null {
  const pattern = new RegExp(`(^|\\s)\\^${blockId.replace(/[^A-Za-z0-9-]/g, "")}\\s*$`);
  const lines = content.split("\n");
  for (let index = 0; index < lines.length; index += 1) if (pattern.test(lines[index])) return index;
  return null;
}

/**
 * Extrae la sección de un encabezado (hasta el siguiente de igual o mayor
 * nivel) o el bloque `^id`. `startLine` es la línea de inicio en el archivo.
 */
export function extractSection(content: string, subpath: string): { text: string; startLine: number } | null {
  const text = content.replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  const clean = subpath.trim();
  if (clean.startsWith("^")) {
    const line = findBlockLine(text, clean.slice(1));
    if (line === null) return null;
    // Un `^id` solo en su línea apunta al bloque anterior.
    const own = lines[line].replace(BLOCK_ID, "").trim();
    let end = line;
    if (!own) end = line - 1;
    while (end >= 0 && !lines[end].trim()) end -= 1;
    if (end < 0) return null;
    const listItem = /^\s*(?:[-*+]|\d+[.)])\s/.test(lines[end]);
    let start = end;
    if (!listItem) while (start > 0 && lines[start - 1].trim() && !/^\s*#{1,6}\s/.test(lines[start - 1])) start -= 1;
    return { text: lines.slice(start, end + 1).join("\n"), startLine: start };
  }
  const line = findSubpathLine(text, clean);
  if (line === null) return null;
  const headings = parseNote(text).headings;
  const own = headings.find((heading) => heading.line === line);
  const level = own?.level ?? 6;
  const next = headings.find((heading) => heading.line > line && heading.level <= level);
  return { text: lines.slice(line, next ? next.line : lines.length).join("\n").replace(/\n+$/, ""), startLine: line };
}

/** Quita el frontmatter de una nota (para embeds y vistas previas). */
export function stripFrontmatter(content: string): { text: string; startLine: number } {
  const text = content.replace(/\r\n?/g, "\n");
  const { bodyLine } = splitFrontmatter(text);
  return { text: bodyLine > 0 ? text.split("\n").slice(bodyLine).join("\n") : text, startLine: bodyLine };
}

/**
 * Primer fragmento de una nota para la vista previa flotante. Si el corte cae
 * dentro de un bloque de código, lo cierra para no romper el render.
 */
export function previewExcerpt(content: string, maxLines = 60, maxChars = 5_000): string {
  const lines = stripFrontmatter(content).text.split("\n");
  const out: string[] = [];
  let chars = 0;
  let fence: string | null = null;
  for (const line of lines) {
    if (out.length >= maxLines || chars >= maxChars) break;
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (!fence) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
    }
    out.push(line);
    chars += line.length + 1;
  }
  if (fence) out.push(fence);
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Callouts
// ---------------------------------------------------------------------------

export type CalloutKind =
  | "note" | "abstract" | "info" | "todo" | "tip" | "success" | "question"
  | "warning" | "failure" | "danger" | "bug" | "example" | "quote";

const CALLOUT_ALIASES: Record<string, CalloutKind> = {
  note: "note",
  abstract: "abstract", summary: "abstract", tldr: "abstract",
  info: "info",
  todo: "todo",
  tip: "tip", hint: "tip", important: "tip",
  success: "success", check: "success", done: "success",
  question: "question", help: "question", faq: "question",
  warning: "warning", caution: "warning", attention: "warning",
  failure: "failure", fail: "failure", missing: "failure",
  danger: "danger", error: "danger",
  bug: "bug",
  example: "example",
  quote: "quote", cite: "quote",
};

export function calloutKind(type: string): CalloutKind {
  return CALLOUT_ALIASES[type.trim().toLowerCase()] ?? "note";
}

// ---------------------------------------------------------------------------
// Plugin remark
// ---------------------------------------------------------------------------

/** Nodo mdast mínimo (evita depender de @types/mdast). */
export type MdNode = {
  type: string;
  value?: string;
  children?: MdNode[];
  checked?: boolean | null;
  data?: { hName?: string; hProperties?: Record<string, unknown>; [key: string]: unknown };
  position?: { start: { line: number; column?: number; offset?: number }; end: { line: number; column?: number; offset?: number } };
  [key: string]: unknown;
};

const CALLOUT_HEAD = /^\[!([^\]\s]+)\]([+-]?)[ \t]*/;
const LITERAL_PARENTS = new Set(["inlineCode", "code", "math", "inlineMath", "html"]);

function text(value: string): MdNode {
  return { type: "text", value };
}

function capitalize(value: string): string {
  return value ? value[0].toLocaleUpperCase("es") + value.slice(1).toLocaleLowerCase("es") : value;
}

function convertCallout(node: MdNode): MdNode | null {
  const first = node.children?.[0];
  if (first?.type !== "paragraph" || !first.children?.length) return null;
  const head = first.children[0];
  if (head.type !== "text" || typeof head.value !== "string") return null;
  const match = CALLOUT_HEAD.exec(head.value);
  if (!match) return null;

  const rawType = match[1];
  const fold = match[2];
  const inline: MdNode[] = [{ ...head, value: head.value.slice(match[0].length) }, ...first.children.slice(1)];
  const title: MdNode[] = [];
  const rest: MdNode[] = [];
  let inTitle = true;
  for (const child of inline) {
    if (!inTitle) {
      rest.push(child);
    } else if (child.type === "text" && typeof child.value === "string") {
      const newline = child.value.indexOf("\n");
      if (newline === -1) {
        if (child.value) title.push(child);
        continue;
      }
      const before = child.value.slice(0, newline);
      const after = child.value.slice(newline + 1);
      if (before) title.push(text(before));
      if (after) rest.push(text(after));
      inTitle = false;
    } else if (child.type === "break") {
      inTitle = false;
    } else {
      title.push(child);
    }
  }
  const hasTitle = title.some((child) => child.type !== "text" || child.value?.trim());
  const body: MdNode[] = [];
  if (rest.some((child) => child.type !== "text" || child.value?.trim())) body.push({ type: "paragraph", children: rest });
  body.push(...(node.children ?? []).slice(1));

  return {
    type: "callout",
    position: node.position,
    data: {
      hName: "div",
      hProperties: { dataCallout: calloutKind(rawType), dataCalloutType: rawType.toLowerCase(), dataCalloutFold: fold },
    },
    children: [
      { type: "calloutTitle", data: { hName: "div", hProperties: { dataCalloutTitle: "" } }, children: hasTitle ? title : [text(capitalize(rawType))] },
      { type: "calloutBody", data: { hName: "div", hProperties: { dataCalloutBody: "" } }, children: body },
    ],
  };
}

/** `- [/] tarea` y demás estados que GFM no reconoce; marca todas con `data-task`. */
function markTask(node: MdNode) {
  const data = (node.data ??= {});
  const properties = (data.hProperties ??= {});
  if (typeof node.checked === "boolean") {
    properties.dataTask = node.checked ? "x" : " ";
    return;
  }
  const paragraph = node.children?.[0];
  const head = paragraph?.type === "paragraph" ? paragraph.children?.[0] : undefined;
  if (head?.type !== "text" || typeof head.value !== "string") return;
  const match = /^\[([^\]\s])\](?:[ \t]+|$)/.exec(head.value);
  if (!match) return;
  head.value = head.value.slice(match[0].length);
  node.checked = true;
  properties.dataTask = match[1];
}

/** `==resaltado==`, también cuando abarca énfasis o enlaces dentro del mismo padre. */
function highlight(parent: MdNode) {
  const children = parent.children;
  if (!children?.some((child) => child.type === "text" && child.value?.includes("=="))) return;
  const out: MdNode[] = [];
  let openAt = -1;
  for (const child of children) {
    if (child.type !== "text" || !child.value?.includes("==")) {
      out.push(child);
      continue;
    }
    child.value.split("==").forEach((part, index) => {
      if (index > 0) {
        if (openAt === -1) {
          openAt = out.length;
        } else {
          const inner = out.splice(openAt);
          const mark: MdNode = { type: "highlight", data: { hName: "mark" }, children: inner };
          softBreaks(mark);
          out.push(inner.length ? mark : text("===="));
          openAt = -1;
        }
      }
      if (part) out.push(text(part));
    });
  }
  if (openAt !== -1) out.splice(openAt, 0, text("=="));
  parent.children = out;
}

/** Saltos de línea simples → `<br>` (Obsidian por defecto). */
function softBreaks(parent: MdNode) {
  const children = parent.children;
  if (!children?.some((child) => child.type === "text" && child.value?.includes("\n"))) return;
  const out: MdNode[] = [];
  for (const child of children) {
    if (child.type !== "text" || !child.value?.includes("\n")) {
      out.push(child);
      continue;
    }
    child.value.split("\n").forEach((part, index) => {
      if (index > 0) out.push({ type: "break" });
      if (part) out.push(text(part));
    });
  }
  parent.children = out;
}

function visit(node: MdNode) {
  const children = node.children;
  if (!children || LITERAL_PARENTS.has(node.type)) return;
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (child.type === "blockquote") {
      const callout = convertCallout(child);
      if (callout) children[index] = callout;
    } else if (child.type === "listItem") {
      markTask(child);
    } else if (child.type === "html" && typeof child.value === "string") {
      if (/^<br\s*\/?>$/i.test(child.value.trim())) children[index] = { type: "break" };
      else if (/^<!--[\s\S]*-->$/.test(child.value.trim())) children[index] = text("");
    }
    visit(children[index]);
  }
  highlight(node);
  softBreaks(node);
}

/** Plugin remark (sin opciones) con las extensiones de Obsidian que viven en el árbol. */
export function remarkObsidian() {
  return (tree: MdNode) => {
    visit(tree);
  };
}

// ---------------------------------------------------------------------------
// Varios
// ---------------------------------------------------------------------------

const MEDIA = {
  image: new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp"]),
  audio: new Set(["mp3", "m4a", "wav", "ogg", "flac", "aac"]),
  video: new Set(["mp4", "webm", "mov", "mkv", "ogv"]),
};

export type EmbedKind = "note" | "image" | "audio" | "video" | "pdf" | "base" | "canvas" | "excalidraw" | "file";

/** Tipo de embed según la extensión de la ruta (resuelta o escrita). */
export function embedKind(filePath: string): EmbedKind {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".excalidraw.md") || lower.endsWith(".excalidraw")) return "excalidraw";
  const name = lower.split("/").pop() ?? lower;
  const dot = name.lastIndexOf(".");
  const ext = dot <= 0 ? "" : name.slice(dot + 1);
  if (!ext || ext === "md") return "note";
  if (MEDIA.image.has(ext)) return "image";
  if (MEDIA.audio.has(ext)) return "audio";
  if (MEDIA.video.has(ext)) return "video";
  if (ext === "pdf") return "pdf";
  if (ext === "base") return "base";
  if (ext === "canvas") return "canvas";
  return "file";
}

/** URL del adjunto servido por la ruta local de la bóveda. */
export function vaultFileUrl(filePath: string): string {
  return `/api/vault/file?path=${encodeURIComponent(filePath)}`;
}

/** Nombre visible de un archivo de la bóveda. */
export function displayName(filePath: string): string {
  return basenameOf(filePath);
}
