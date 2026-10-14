import { parse as parseYaml } from "yaml";
import { forEachLine, foldText, splitFrontmatter } from "./parse";

/**
 * Convenciones de la bóveda de Andre (Protocolo de Conexiones y Directivas de
 * Shadow §5–§6) como funciones puras: encabezados tolerantes, bullets
 * fechados, enlaces sin anidar y validación de lo que Shadow escribe.
 *
 * Sin dependencias de servidor: se prueba sin bóveda real.
 */

export const MEMORY_HEADING = "Memoria de Shadow";
export const CONNECTIONS_HEADING = "🔗 Conexiones";
export const PROPAGATED_HEADING = "🔁 Propagado a";

const LINK_TEXT = /\[\[([^\]|]*\|)?([^\]]*)\]\]/g;

/**
 * Clave de comparación de un encabezado: sin emojis, puntuación, acentos ni
 * corchetes de enlace. `## Memoria de [[Shadow]]` y `## Memoria de Shadow`
 * son la misma sección; `## 🔗 Conexiones` y `## Conexiones` también.
 */
export function headingKey(value: string): string {
  return foldText(value.replace(LINK_TEXT, "$2"))
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export type Section = {
  /** Línea (0-based) del encabezado. */
  line: number;
  level: number;
  /** Texto del encabezado tal como está en la nota. */
  text: string;
  key: string;
  /** Primera línea que ya no pertenece a la sección. */
  end: number;
};

/** Encabezados del cuerpo (ignora frontmatter y bloques de código) con su rango. */
export function listSections(content: string): Section[] {
  const { bodyLine } = splitFrontmatter(content);
  const headings: Omit<Section, "end">[] = [];
  let total = 0;
  forEachLine(content, (line, index, inCode) => {
    total = index + 1;
    if (index < bodyLine || inCode) return;
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) headings.push({ line: index, level: match[1].length, text: match[2], key: headingKey(match[2]) });
  });
  return headings.map((heading, position) => {
    const next = headings.slice(position + 1).find((candidate) => candidate.level <= heading.level);
    return { ...heading, end: next ? next.line : total };
  });
}

/**
 * Busca una sección por nombre. Primero exacta (sin emojis ni acentos); si no
 * hay, acepta un prefijo único por palabras ("Trabajo" → "🚀 Trabajo / [[Cord]]").
 */
export function findSections(content: string, heading: string, options: { prefix?: boolean } = {}): Section[] {
  const wanted = headingKey(heading);
  if (!wanted) return [];
  const sections = listSections(content);
  const exact = sections.filter((section) => section.key === wanted);
  if (exact.length || !options.prefix) return exact;
  const prefixed = sections.filter((section) => section.key.startsWith(`${wanted} `));
  const distinct = new Set(prefixed.map((section) => section.key));
  return distinct.size === 1 ? prefixed : [];
}

function isEmptyBullet(line: string): boolean {
  return /^\s*[-*+]\s*$/.test(line);
}

function insertIntoSection(lines: string[], section: Section, text: string) {
  let end = section.end;
  // Quita bullets vacíos de plantilla ("- ") antes de escribir.
  for (let index = end - 1; index > section.line; index -= 1) {
    if (isEmptyBullet(lines[index])) {
      lines.splice(index, 1);
      end -= 1;
    }
  }
  let insertAt = end;
  while (insertAt > section.line + 1 && !lines[insertAt - 1].trim()) insertAt -= 1;
  const block = text.split("\n");
  // Deja una línea en blanco antes del siguiente encabezado.
  if (insertAt === end && insertAt < lines.length && lines[insertAt].trim()) block.push("");
  lines.splice(insertAt, 0, ...block);
}

/**
 * Agrega texto al final de una sección (la primera o la última que coincida).
 * Si no existe, la crea antes de la sección indicada en `before` o al final.
 */
export function appendUnderHeading(
  content: string,
  heading: string,
  text: string,
  options: { which?: "first" | "last"; before?: string; prefix?: boolean } = {},
): string {
  const lines = content.split("\n");
  const matches = findSections(content, heading, { prefix: options.prefix });
  const section = options.which === "last" ? matches.at(-1) : matches[0];
  if (section) {
    insertIntoSection(lines, section, text);
    return lines.join("\n");
  }
  const anchor = options.before ? findSections(content, options.before)[0] : undefined;
  if (anchor) {
    const spacer = anchor.line > 0 && lines[anchor.line - 1].trim() ? [""] : [];
    lines.splice(anchor.line, 0, ...spacer, `## ${heading}`, ...text.split("\n"), "");
    return lines.join("\n");
  }
  const base = content.trimEnd();
  return `${base}${base ? "\n\n" : ""}## ${heading}\n${text}\n`;
}

/** Devuelve el texto exacto del encabezado existente que corresponde a `heading`. */
export function existingHeading(content: string, heading: string): string | null {
  return findSections(content, heading, { prefix: true })[0]?.text ?? null;
}

/** Quita bullets vacíos de plantilla (`- `) dentro de una sección. */
export function dropEmptyBullets(content: string, heading: string): string {
  const section = findSections(content, heading)[0];
  if (!section) return content;
  const lines = content.split("\n");
  const kept = lines.filter((line, index) => index <= section.line || index >= section.end || !isEmptyBullet(line));
  return kept.join("\n");
}

/** Texto de una sección (sin el encabezado). */
export function sectionBody(content: string, section: Section): string {
  return content.split("\n").slice(section.line + 1, section.end).join("\n");
}

// ---------------------------------------------------------------------------
// Enlaces
// ---------------------------------------------------------------------------

/**
 * Aplana enlaces anidados: `[[Jerry ([[UP]])]]` → `[[Jerry (UP)]]`. Los
 * enlaces nunca cruzan líneas, así que un `[[` sin cerrar se descarta al
 * terminar la línea.
 */
export function flattenNestedLinks(text: string): string {
  let out = "";
  let depth = 0;
  for (let index = 0; index < text.length;) {
    if (text.startsWith("[[", index)) {
      if (depth === 0) out += "[[";
      depth += 1;
      index += 2;
      continue;
    }
    if (depth > 0 && text.startsWith("]]", index)) {
      depth -= 1;
      if (depth === 0) out += "]]";
      index += 2;
      continue;
    }
    if (text[index] === "\n") depth = 0;
    out += text[index];
    index += 1;
  }
  return out;
}

/** Líneas (1-based) con un enlace dentro de otro enlace. */
export function nestedLinkLines(text: string): number[] {
  const found: number[] = [];
  text.split("\n").forEach((line, index) => {
    let depth = 0;
    for (let position = 0; position < line.length; position += 1) {
      if (line.startsWith("[[", position)) {
        depth += 1;
        position += 1;
        if (depth > 1) {
          found.push(index + 1);
          return;
        }
      } else if (depth > 0 && line.startsWith("]]", position)) {
        depth -= 1;
        position += 1;
      }
    }
  });
  return found;
}

/** Líneas (1-based) con wikilinks dentro de código en línea o bloques de código. */
export function codeLinkLines(text: string): number[] {
  const found: number[] = [];
  forEachLine(text, (line, index, inCode) => {
    if (!line.includes("[[")) return;
    if (inCode) {
      if (!/^\s*(`{3,}|~{3,})/.test(line)) found.push(index + 1);
      return;
    }
    for (const match of line.matchAll(/(`+)([\s\S]*?)\1/g)) {
      if (match[2].includes("[[")) {
        found.push(index + 1);
        return;
      }
    }
  });
  return found;
}

/**
 * Limpia un nombre de entidad que vino del modelo: sin `[[ ]]`, sin alias ni
 * subrutas, sin `.md` y sin caracteres que Obsidian no admite en enlaces.
 * `[[Jerry ([[UP]])]]` → `Jerry (UP)`; `[[Cord|el proyecto]]` → `Cord`.
 */
export function cleanEntityName(raw: string): string {
  let value = flattenNestedLinks(raw.normalize("NFC").trim());
  const whole = /^!?\[\[([^\]]*)\]\]$/.exec(value);
  if (whole) value = whole[1];
  value = value.replace(/\[\[|\]\]/g, "");
  value = value.split("|")[0].split("#")[0];
  return value
    .replace(/\.md$/i, "")
    .replace(/[\\:*?"<>[\]^\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Nombre sin el calificador entre paréntesis: `Jerry (UP)` → `Jerry`. */
export function withoutQualifier(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

// ---------------------------------------------------------------------------
// Bullets de memoria
// ---------------------------------------------------------------------------

const DATE_PREFIX = /^\*{0,2}\[\d{4}-\d{2}-\d{2}\]\*{0,2}\s*/;
const DAILY_BACKLINK = /\s*\(\[\[\d{4}-\d{2}-\d{2}(\|[^\]]*)?\]\]\)\s*$/;

/**
 * Clave para deduplicar un hecho: ignora el bullet, la fecha
 * `**[YYYY-MM-DD]**`, el enlace de vuelta al diario y los corchetes.
 */
export function factKey(value: string): string {
  const text = value
    .replace(/^\s*[-*+]\s+/, "")
    .replace(DATE_PREFIX, "")
    .replace(DAILY_BACKLINK, "")
    .replace(LINK_TEXT, "$2");
  return foldText(text).replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/** Un hecho en una sola línea y sin enlaces anidados. */
export function oneLineFact(fact: string): string {
  return flattenNestedLinks(fact.replace(/\s*\n+\s*/g, " ").trim());
}

/** `- **[YYYY-MM-DD]** hecho ([[YYYY-MM-DD|diario]])` (Directivas §6.2). */
export function datedBullet(date: string, fact: string, dailyName?: string | null): string {
  const backlink = dailyName ? ` ([[${dailyName}|diario]])` : "";
  return `- **[${date}]** ${oneLineFact(fact)}${backlink}`;
}

/** ¿Alguna línea de la nota ya dice este hecho (con o sin fecha)? */
export function hasFact(content: string, fact: string): boolean {
  const wanted = factKey(fact);
  if (!wanted) return false;
  return content.split("\n").some((line) => factKey(line) === wanted);
}

/** Recorta un hecho para listas cortas sin partir un enlace a la mitad. */
export function shortFact(fact: string, max = 120): string {
  const text = oneLineFact(fact);
  if (text.length <= max) return text;
  let cut = text.lastIndexOf(" ", max);
  if (cut < max * 0.5) cut = max;
  const open = text.lastIndexOf("[[", cut - 1);
  if (open !== -1) {
    const close = text.indexOf("]]", open);
    if (close === -1 || close + 2 > cut) cut = open;
  }
  const head = text.slice(0, cut).replace(/[\s,;:.—-]+$/, "");
  return head ? `${head}…` : `${text.replace(LINK_TEXT, "$2").slice(0, max).trimEnd()}…`;
}

// ---------------------------------------------------------------------------
// Notas de entidad
// ---------------------------------------------------------------------------

export type EntityTipo = "persona" | "lugar" | "proyecto" | "concepto" | "grupo" | "sistema";

const ENTITY_TAGS: Record<EntityTipo, string[]> = {
  persona: ["entidad", "persona"],
  lugar: ["entidad", "lugar"],
  concepto: ["entidad", "concepto"],
  grupo: ["entidad", "grupo"],
  proyecto: ["proyecto"],
  sistema: ["sistema"],
};

/**
 * Nota nueva según el Protocolo de Conexiones §1: frontmatter en español,
 * `# Nombre`, resumen, `## 🔗 Conexiones` y `## Memoria de Shadow`.
 */
export function entityNoteContent(input: {
  name: string;
  tipo: EntityTipo;
  summary: string;
  connections: string[];
  bullet: string;
}): string {
  const frontmatter = [
    "---",
    `tipo: ${input.tipo}`,
    `tags: [${ENTITY_TAGS[input.tipo].join(", ")}]`,
    ...(input.tipo === "persona" || input.tipo === "proyecto" || input.tipo === "grupo" ? ["estado: activo"] : []),
    "---",
  ];
  return [
    ...frontmatter,
    "",
    `# ${input.name}`,
    "",
    "> [!info] Resumen",
    `> ${shortFact(input.summary, 280)}`,
    "",
    `## ${CONNECTIONS_HEADING}`,
    ...input.connections.map((link) => `- [[${link}]]`),
    "",
    `## ${MEMORY_HEADING}`,
    input.bullet,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Validación de lo que escribe Shadow
// ---------------------------------------------------------------------------

/** Claves en inglés que la bóveda escribe en español. */
const ENGLISH_KEYS: Record<string, string> = {
  title: "quítala: el título es el nombre del archivo y el `# H1`",
  type: "usa `tipo`",
  kind: "usa `tipo`",
  status: "usa `estado`",
  state: "usa `estado`",
  date: "usa `fecha`",
  created: "usa `fecha`",
  updated: "usa `fecha`",
  category: "usa `categoria`",
  relation: "usa `relacion`",
  relationship: "usa `relacion`",
  people: "usa `personas`",
  projects: "usa `proyectos`",
  places: "usa `lugares`",
  mood: "usa `animo`",
  energy: "usa `energia`",
  stress: "usa `estres`",
  focus: "usa `foco`",
  birthday: "usa `cumpleaños`",
  summary: "usa `resumen`",
  priority: "usa `prioridad`",
  source: "usa `fuente`",
  confidence: "usa `confianza`",
};

function containsLinkSyntax(value: unknown): boolean {
  if (typeof value === "string") return value.includes("[[") || value.includes("]]");
  if (Array.isArray(value)) return value.some((item) => Array.isArray(item) || containsLinkSyntax(item));
  return false;
}

function lineList(lines: number[]): string {
  return [...new Set(lines)].slice(0, 5).join(", ");
}

/**
 * Problemas de un fragmento de Markdown: enlaces anidados y enlaces dentro de
 * código. Devuelve mensajes en español listos para el modelo.
 */
export function snippetProblems(text: string): string[] {
  const problems: string[] = [];
  const nested = nestedLinkLines(text);
  if (nested.length) problems.push(`Enlaces anidados en la línea ${lineList(nested)}: escribe [[Jerry (UP)]], nunca [[Jerry ([[UP]])]].`);
  const inCode = codeLinkLines(text);
  if (inCode.length) problems.push(`Wikilinks dentro de código en la línea ${lineList(inCode)}: los enlaces nunca van dentro de \`código\` ni de bloques de código.`);
  return problems;
}

/**
 * Valida una nota completa antes de crearla: lo de `snippetProblems`, más un
 * frontmatter en español, sin enlaces en `tags`/`tipo`/`aliases` y una sola
 * sección de memoria. Las entidades exigen `tipo` y `tags`.
 */
export function noteProblems(content: string, options: { entity?: boolean } = {}): string[] {
  const problems = snippetProblems(content);
  const { raw } = splitFrontmatter(content);
  if (raw !== null) {
    let data: Record<string, unknown> = {};
    try {
      const parsed: unknown = parseYaml(raw, { uniqueKeys: false });
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) data = parsed as Record<string, unknown>;
      else if (parsed != null) problems.push("El frontmatter debe ser un mapa YAML de claves.");
    } catch {
      problems.push("El frontmatter no es YAML válido.");
    }
    for (const key of Object.keys(data)) {
      const hint = ENGLISH_KEYS[key.toLowerCase()];
      if (hint) problems.push(`Frontmatter en español: \`${key}\` → ${hint}.`);
    }
    for (const key of ["tags", "tag", "tipo", "aliases", "alias"]) {
      if (key in data && containsLinkSyntax(data[key])) problems.push(`\`${key}\` no puede llevar enlaces: escribe texto plano (p. ej. \`tags: [entidad, persona]\`).`);
    }
    if ("tipo" in data && typeof data.tipo !== "string") problems.push("`tipo` debe ser una sola palabra: persona, lugar, proyecto, concepto o grupo.");
    if (options.entity && (!("tipo" in data) || !("tags" in data))) {
      problems.push("Las entidades llevan frontmatter con `tipo` y `tags` (p. ej. `tipo: persona` y `tags: [entidad, persona]`).");
    }
  } else if (options.entity) {
    problems.push("Las entidades empiezan con frontmatter YAML: `tipo: persona|lugar|proyecto|concepto|grupo` y `tags: [entidad, …]`.");
  }
  const memorySections = findSections(content, MEMORY_HEADING);
  if (memorySections.length > 1) problems.push("Solo puede haber una sección `## Memoria de Shadow` por nota.");
  return problems;
}
