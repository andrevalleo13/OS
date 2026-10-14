/**
 * Utilidades de texto para leer Markdown de Obsidian de forma defensiva.
 * Puras: sin fs ni dependencias del servidor.
 */

export function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Texto visible de un wikilink interno (`destino#sub|alias`). */
function linkLabel(inner: string): string {
  const pipe = inner.indexOf("|");
  if (pipe !== -1) return inner.slice(pipe + 1).trim();
  const hash = inner.indexOf("#");
  return (hash === -1 ? inner : inner.slice(0, hash)).trim();
}

/**
 * Convierte una línea de Markdown en texto plano: resuelve wikilinks (incluso
 * los anidados que a veces deja la bóveda), quita negritas, código y comentarios.
 */
export function cleanInline(value: string): string {
  let text = value.replace(/%%.*?%%/g, "");
  for (let guard = 0; guard < 6 && /\[\[[^[\]]*\]\]/.test(text); guard += 1) {
    text = text.replace(/!?\[\[([^[\]]*)\]\]/g, (_match, inner: string) => linkLabel(inner));
  }
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/(^|[\s(])\*(?!\s)([^*]+?)\*(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/(^|[\s(])_(?!\s)([^_]+?)_(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripFrontmatter(text: string): string {
  if (!text.startsWith("---")) return text;
  const lines = text.split("\n");
  if (lines[0].trim() !== "---") return text;
  for (let index = 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line === "---" || line === "...") return lines.slice(index + 1).join("\n");
  }
  return text;
}

export type Section = { heading: string; level: number; lines: string[] };

/** Divide el cuerpo en secciones por encabezado; ignora bloques de código. */
export function sections(text: string): Section[] {
  const result: Section[] = [{ heading: "", level: 0, lines: [] }];
  let inCode = false;
  for (const line of stripFrontmatter(text).split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      result.push({ heading: heading[2], level: heading[1].length, lines: [] });
      continue;
    }
    result[result.length - 1].lines.push(line);
  }
  return result;
}

/** Texto del encabezado sin emojis ni símbolos iniciales. */
export function headingText(heading: string): string {
  return cleanInline(heading).replace(/^[^\p{L}\p{N}]+/u, "").trim();
}

export type Bullet = { text: string; children: Bullet[] };

/** Árbol de viñetas (`-`, `*`, `+`, `1.`) según la sangría. */
export function bullets(lines: string[]): Bullet[] {
  const root: Bullet = { text: "", children: [] };
  const stack: { indent: number; node: Bullet }[] = [{ indent: -1, node: root }];
  for (const raw of lines) {
    const match = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/.exec(raw.replace(/\t/g, "  "));
    if (!match) continue;
    const indent = match[1].length;
    const node: Bullet = { text: match[2].trim(), children: [] };
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    stack[stack.length - 1].node.children.push(node);
    stack.push({ indent, node });
  }
  return root.children;
}

/** `**Etiqueta:** texto` → `{ label, text }` ya limpios. */
export function labeled(raw: string): { label: string | null; text: string } {
  const match = /^\*\*([^*]+?)\*\*\s*(?:[:\-–—]\s*)?(.*)$/.exec(raw.trim());
  if (!match) return { label: null, text: cleanInline(raw) };
  const label = cleanInline(match[1]).replace(/[:\s]+$/, "").trim();
  return { label: label || null, text: cleanInline(match[2]) };
}

/** Divide por comas fuera de paréntesis. */
export function splitList(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of value) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts.map((part) => part.trim().replace(/\.+$/, "").trim()).filter(Boolean);
}

/** Primer número de un valor de frontmatter (`7`, `"7.5"`, `"~7 h"`). */
export function parseNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  // Ignora denominadores de plantilla como `_/10_`.
  const match = /(?<![/\d.,])-?\d+(?:[.,]\d+)?/.exec(value);
  if (!match) return null;
  const number = Number(match[0].replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

/** Fecha `yyyy-MM-dd` contenida en un valor (`[[2026-08-29]]`, Date, string). */
export function parseDateKey(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value !== "string") return null;
  const match = /(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.]+$/, "")}…`;
}

/** Frase (terminada en punto) que contiene el patrón; si no hay, la línea completa. */
export function sentenceMatching(value: string, pattern: RegExp): string {
  const sentences = value.match(/[^.!?]+[.!?]?/g) ?? [value];
  const hit = sentences.find((sentence) => pattern.test(fold(sentence)));
  return (hit ?? value).trim();
}
