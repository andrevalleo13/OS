import { parse as parseYaml } from "yaml";

/**
 * Parser de notas al estilo Obsidian: frontmatter YAML, wikilinks, embeds,
 * tags, encabezados y tareas. Ignora todo lo que esté dentro de bloques de
 * código o código en línea, igual que Obsidian.
 */

export type WikiLink = {
  /** Destino sin subruta ni alias: `Nota`, `carpeta/Nota`, `imagen.png`. */
  target: string;
  /** `#Encabezado` o `#^bloque`, sin el `#`. */
  subpath?: string;
  alias?: string;
  embed: boolean;
  /** Línea (0-based) dentro del texto completo. */
  line: number;
};

export type NoteHeading = { level: number; text: string; line: number };

export type ParsedNote = {
  frontmatter: Record<string, unknown>;
  /** Texto YAML crudo o null si la nota no tiene frontmatter. */
  frontmatterRaw: string | null;
  /** Índice de la primera línea del cuerpo (después del frontmatter). */
  bodyLine: number;
  links: WikiLink[];
  tags: string[];
  headings: NoteHeading[];
  aliases: string[];
  tasks: { done: number; total: number };
  words: number;
};

const WIKILINK = /(!?)\[\[([^[\]\n]+?)\]\]/g;
const MD_LINK = /(!?)\[([^\]\n]*)\]\(([^)\s]+?\.md)(#[^)\s]*)?\)/g;
const INLINE_TAG = /(^|[\s(,;])#([\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*)/gu;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const TASK = /^\s*[-*+]\s+\[([ xX/-])\]\s/;

export function splitFrontmatter(text: string): { raw: string | null; bodyLine: number } {
  if (!text.startsWith("---")) return { raw: null, bodyLine: 0 };
  const lines = text.split("\n");
  if (lines[0].trim() !== "---") return { raw: null, bodyLine: 0 };
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "---" || lines[index].trim() === "...") {
      return { raw: lines.slice(1, index).join("\n"), bodyLine: index + 1 };
    }
  }
  return { raw: null, bodyLine: 0 };
}

export function parseFrontmatter(raw: string | null): Record<string, unknown> {
  if (!raw?.trim()) return {};
  try {
    const value = parseYaml(raw, { uniqueKeys: false, logLevel: "silent" });
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Divide un wikilink crudo (`destino#sub|alias`) en sus partes. */
export function splitLinkInner(inner: string): Pick<WikiLink, "target" | "subpath" | "alias"> {
  const pipe = inner.indexOf("|");
  const left = pipe === -1 ? inner : inner.slice(0, pipe);
  const alias = pipe === -1 ? undefined : inner.slice(pipe + 1).trim() || undefined;
  const hash = left.indexOf("#");
  const target = (hash === -1 ? left : left.slice(0, hash)).trim();
  const subpath = hash === -1 ? undefined : left.slice(hash + 1).trim() || undefined;
  return { target, subpath, alias };
}

type Segment = { text: string; code: boolean };

/** Parte una línea en segmentos de código en línea y texto normal. */
function inlineSegments(line: string): Segment[] {
  const segments: Segment[] = [];
  const pattern = /(`+)([\s\S]*?)\1/g;
  let last = 0;
  for (const match of line.matchAll(pattern)) {
    const start = match.index ?? 0;
    if (start > last) segments.push({ text: line.slice(last, start), code: false });
    segments.push({ text: match[0], code: true });
    last = start + match[0].length;
  }
  if (last < line.length) segments.push({ text: line.slice(last), code: false });
  return segments;
}

/**
 * Recorre las líneas indicando si cada una está dentro de un bloque de código.
 * Devuelve también el lenguaje del bloque para quien lo necesite (dataview).
 */
export function forEachLine(
  text: string,
  visit: (line: string, index: number, inCode: boolean) => void,
) {
  let fence: string | null = null;
  text.split("\n").forEach((line, index) => {
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line);
    if (fence) {
      visit(line, index, true);
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null;
      return;
    }
    if (fenceMatch) {
      fence = fenceMatch[1];
      visit(line, index, true);
      return;
    }
    visit(line, index, false);
  });
}

/**
 * Reescribe los wikilinks fuera de código. `replace` recibe el link y su texto
 * crudo y devuelve el nuevo texto o null para dejarlo igual.
 */
export function rewriteWikiLinks(
  text: string,
  replace: (link: Omit<WikiLink, "line">, raw: string) => string | null,
): { text: string; changed: number } {
  let changed = 0;
  const out: string[] = [];
  forEachLine(text, (line, _index, inCode) => {
    if (inCode || !line.includes("[[")) {
      out.push(line);
      return;
    }
    out.push(inlineSegments(line).map((segment) => {
      if (segment.code) return segment.text;
      return segment.text.replace(WIKILINK, (raw, bang: string, inner: string) => {
        const next = replace({ ...splitLinkInner(inner), embed: bang === "!" }, raw);
        if (next === null || next === raw) return raw;
        changed += 1;
        return next;
      });
    }).join(""));
  });
  return { text: out.join("\n"), changed };
}

function normalizeTag(tag: string): string {
  return tag.replace(/^#/, "").trim();
}

function frontmatterList(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap((item) => frontmatterList(item));
  if (typeof value === "string") return value.split(/[,\s]+/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function frontmatterLinks(frontmatter: Record<string, unknown>): WikiLink[] {
  const links: WikiLink[] = [];
  const visit = (value: unknown) => {
    if (typeof value === "string") {
      for (const match of value.matchAll(WIKILINK)) {
        const parts = splitLinkInner(match[2]);
        if (parts.target) links.push({ ...parts, embed: false, line: 0 });
      }
    } else if (Array.isArray(value)) value.forEach(visit);
  };
  Object.values(frontmatter).forEach(visit);
  return links;
}

export function parseNote(text: string): ParsedNote {
  const { raw, bodyLine } = splitFrontmatter(text);
  const frontmatter = parseFrontmatter(raw);
  const links: WikiLink[] = frontmatterLinks(frontmatter);
  const tags = new Set<string>(frontmatterList(frontmatter.tags ?? frontmatter.tag).map(normalizeTag).filter(Boolean));
  const aliasValue = frontmatter.aliases ?? frontmatter.alias;
  const aliases = (Array.isArray(aliasValue) ? aliasValue : aliasValue == null ? [] : [aliasValue])
    .map((alias) => String(alias ?? "").trim())
    .filter(Boolean);
  const headings: NoteHeading[] = [];
  const tasks = { done: 0, total: 0 };
  let words = 0;

  forEachLine(text, (line, index, inCode) => {
    if (index < bodyLine || inCode) return;
    const heading = HEADING.exec(line);
    if (heading) headings.push({ level: heading[1].length, text: heading[2].replace(/\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2"), line: index });
    const task = TASK.exec(line);
    if (task) {
      tasks.total += 1;
      if (task[1].toLowerCase() === "x") tasks.done += 1;
    }
    for (const segment of inlineSegments(line)) {
      if (segment.code) continue;
      words += segment.text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
      for (const match of segment.text.matchAll(WIKILINK)) {
        const parts = splitLinkInner(match[2]);
        if (parts.target || parts.subpath) links.push({ ...parts, embed: match[1] === "!", line: index });
      }
      for (const match of segment.text.matchAll(MD_LINK)) {
        if (/^[a-z]+:/i.test(match[3])) continue;
        const target = decodeURIComponent(match[3]).replace(/\.md$/, "");
        links.push({ target, subpath: match[4]?.slice(1), alias: match[2] || undefined, embed: match[1] === "!", line: index });
      }
      if (!heading || segment.text !== line) {
        for (const match of segment.text.matchAll(INLINE_TAG)) tags.add(match[2]);
      } else {
        for (const match of heading[2].matchAll(INLINE_TAG)) tags.add(match[2]);
      }
    }
  });

  return { frontmatter, frontmatterRaw: raw, bodyLine, links, tags: [...tags], headings, aliases, tasks, words };
}

/** Normaliza para comparar nombres: NFC, minúsculas. */
export function nameKey(value: string): string {
  return value.normalize("NFC").toLocaleLowerCase("es");
}

/** Minúsculas sin acentos, conservando la longitud de cada carácter NFC. */
export function foldText(value: string): string {
  return Array.from(value.normalize("NFC"), (char) => {
    const folded = char.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    return folded.length === char.length ? folded : char;
  }).join("");
}

export function basenameOf(filePath: string): string {
  const name = filePath.split("/").pop() ?? filePath;
  return name.replace(/\.md$/i, "");
}

export function extensionOf(filePath: string): string {
  const name = filePath.split("/").pop() ?? filePath;
  const dot = name.lastIndexOf(".");
  return dot <= 0 ? "" : name.slice(dot + 1).toLowerCase();
}

export function folderOf(filePath: string): string {
  const index = filePath.lastIndexOf("/");
  return index === -1 ? "" : filePath.slice(0, index);
}

/**
 * Resolución de enlaces como Obsidian: ruta exacta, luego nombre de archivo
 * (si hay varios, gana el de la misma carpeta y después la ruta más corta) y
 * por último los aliases del frontmatter.
 */
export function createLinkResolver(paths: string[], aliases: Map<string, string> = new Map()) {
  const byPath = new Map<string, string>();
  const byName = new Map<string, string[]>();
  for (const filePath of paths) {
    const key = nameKey(filePath);
    byPath.set(key, filePath);
    if (key.endsWith(".md")) byPath.set(key.slice(0, -3), filePath);
    const name = nameKey(filePath.split("/").pop() ?? filePath);
    for (const variant of name.endsWith(".md") ? [name, name.slice(0, -3)] : [name]) {
      const list = byName.get(variant) ?? [];
      list.push(filePath);
      byName.set(variant, list);
    }
  }
  for (const list of byName.values()) list.sort((a, b) => a.split("/").length - b.split("/").length || a.length - b.length);

  return function resolve(target: string, fromPath = ""): string | null {
    const clean = target.trim().replace(/^\/+/, "");
    if (!clean) return fromPath || null;
    const key = nameKey(clean);
    if (key.includes("/")) {
      const fromFolder = folderOf(fromPath);
      const relative = fromFolder ? nameKey(`${fromFolder}/${clean}`) : null;
      const direct = byPath.get(key) ?? (relative ? byPath.get(relative) : undefined);
      if (direct) return direct;
      const tail = key.split("/").pop() ?? key;
      const suffixMatch = (byName.get(tail) ?? []).find((candidate) => {
        const candidateKey = nameKey(candidate);
        return candidateKey === `${key}.md` || candidateKey.endsWith(`/${key}.md`) || candidateKey.endsWith(`/${key}`);
      });
      if (suffixMatch) return suffixMatch;
    }
    const candidates = byName.get(key.split("/").pop() ?? key);
    if (candidates?.length) {
      const sameFolder = candidates.find((candidate) => folderOf(candidate) === folderOf(fromPath));
      return sameFolder ?? candidates[0];
    }
    return aliases.get(key) ?? null;
  };
}

export type LinkResolver = ReturnType<typeof createLinkResolver>;
