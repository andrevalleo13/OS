import { basenameOf, folderOf, forEachLine, nameKey, splitLinkInner } from "./parse";

/**
 * Subconjunto de Dataview (DQL) que se ejecuta sobre el índice de la bóveda.
 *
 * Soporta TABLE [WITHOUT ID], LIST [WITHOUT ID] [expr] y TASK; FROM con
 * `#tag`, `"carpeta"`, `[[enlace]]` y `outgoing([[enlace]])` combinados con
 * and/or/-; WHERE, SORT (varias claves), LIMIT y un set de funciones comunes.
 * GROUP BY, FLATTEN y CALENDAR devuelven un error "no soportado".
 *
 * Tolerancia propia (no existe en Dataview): un texto entre comillas que es
 * exactamente un wikilink (`"[[Diego]]"`) se trata como enlace en WHERE y como
 * ruta en FROM. Así siguen funcionando las consultas que un auto-enlazador
 * reescribió dentro de la bóveda.
 *
 * Sin dependencias de servidor: se prueba con índices falsos.
 */

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export type DataviewPage = {
  /** Ruta relativa a la bóveda, con `.md`. */
  path: string;
  frontmatter: Record<string, unknown>;
  /** Tags sin `#` (frontmatter + en línea). */
  tags: string[];
  aliases?: string[];
  mtime: number;
  ctime: number;
  size: number;
  /** Destinos de los enlaces salientes: ruta resuelta o destino escrito si no existe. */
  outlinks: { path: string; resolved: boolean }[];
  /** Texto completo; solo se usa en consultas TASK. */
  text?: string;
};

export type DataviewSource = {
  pages: DataviewPage[];
  resolve: (target: string, from?: string) => string | null;
};

export type DataviewCell =
  | { kind: "empty" }
  | { kind: "text"; text: string }
  | { kind: "number"; value: number; text: string }
  | { kind: "date"; ms: number; text: string }
  | { kind: "link"; path: string; text: string; resolved: boolean; subpath?: string }
  | { kind: "list"; items: DataviewCell[] };

export type DataviewTask = { path: string; line: number; text: string; status: string; checked: boolean };
export type DataviewTaskGroup = { path: string; title: string; tasks: DataviewTask[] };

export type DataviewResult = {
  type: "table" | "list" | "task";
  /** TABLE: encabezados (incluye "Archivo" salvo WITHOUT ID). */
  headers?: string[];
  /** TABLE: filas de celdas. LIST: `[archivo, valor?]` o `[valor]` sin ID. */
  rows: DataviewCell[][];
  /** TASK: tareas agrupadas por archivo. */
  groups?: DataviewTaskGroup[];
  /** Si la primera columna es el enlace al archivo. */
  idColumn?: boolean;
  error?: string;
};

export class DataviewError extends Error {}

// ---------------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------------

type DLink = { kind: "link"; path: string; resolved: boolean; display?: string; subpath?: string };
type DDate = { kind: "date"; ms: number; time: boolean };
type DDuration = { kind: "duration"; ms: number };
type DObject = { kind: "object"; fields: Record<string, DValue> };
type DValue = null | string | number | boolean | DValue[] | DLink | DDate | DDuration | DObject;

const isLink = (value: DValue): value is DLink => isTagged(value) && value.kind === "link";
const isDate = (value: DValue): value is DDate => isTagged(value) && value.kind === "date";
const isDuration = (value: DValue): value is DDuration => isTagged(value) && value.kind === "duration";
const isObject = (value: DValue): value is DObject => isTagged(value) && value.kind === "object";

function isTagged(value: DValue): value is DLink | DDate | DDuration | DObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const DAY = 86_400_000;
const WIKILINK_ONLY = /^\s*\[\[([^[\]]+)\]\]\s*$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?)?(?:Z|[+-]\d{2}:?\d{2})?$/;

function parseIsoDate(text: string): DDate | null {
  const match = ISO_DATE.exec(text.trim());
  if (!match) return null;
  const [, y, m, d, hh, mm, ss] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh ?? 0), Number(mm ?? 0), Number(ss ?? 0));
  if (Number.isNaN(date.getTime())) return null;
  return { kind: "date", ms: date.getTime(), time: hh !== undefined };
}

function linkName(link: DLink): string {
  return basenameOf(link.path).split("/").pop() ?? link.path;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDataviewDate(ms: number, withTime = true): string {
  const date = new Date(ms);
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return withTime ? `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}` : day;
}

function formatDuration(ms: number): string {
  const sign = ms < 0 ? "-" : "";
  let rest = Math.abs(ms);
  const parts: string[] = [];
  const units: [number, string, string][] = [[DAY, "día", "días"], [3_600_000, "hora", "horas"], [60_000, "minuto", "minutos"], [1_000, "segundo", "segundos"]];
  for (const [size, one, many] of units) {
    const amount = Math.floor(rest / size);
    if (amount) parts.push(`${amount} ${amount === 1 ? one : many}`);
    rest -= amount * size;
  }
  return parts.length ? sign + parts.join(", ") : "0 segundos";
}

function toText(value: DValue): string {
  if (value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(toText).join(", ");
  if (isLink(value)) return value.display ?? linkName(value);
  if (isDate(value)) return formatDataviewDate(value.ms, value.time);
  if (isDuration(value)) return formatDuration(value.ms);
  return Object.entries(value.fields).map(([key, item]) => `${key}: ${toText(item)}`).join(", ");
}

// ---------------------------------------------------------------------------
// Base de datos en memoria
// ---------------------------------------------------------------------------

type Db = {
  pages: Map<string, DataviewPage>;
  sorted: DataviewPage[];
  inlinks: Map<string, string[]>;
  resolve: DataviewSource["resolve"];
  rows: Map<string, DObject>;
  now: number;
};

function makeLink(db: Db, target: string, from: string, display?: string): DLink {
  const { target: clean, subpath, alias } = splitLinkInner(target);
  const resolved = clean ? db.resolve(clean, from) : from;
  return { kind: "link", path: resolved ?? clean, resolved: Boolean(resolved), display: display ?? alias, subpath };
}

/** Frontmatter crudo → valores de Dataview (fechas ISO, wikilinks, listas). */
function fromFrontmatter(db: Db, raw: unknown, from: string): DValue {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "string") {
    const link = WIKILINK_ONLY.exec(raw);
    if (link) return makeLink(db, link[1], from);
    return parseIsoDate(raw) ?? raw;
  }
  if (typeof raw === "number" || typeof raw === "boolean") return raw;
  if (raw instanceof Date) return { kind: "date", ms: raw.getTime(), time: true };
  if (Array.isArray(raw)) {
    // YAML convierte un `[[Nota]]` sin comillas en [["Nota"]].
    if (raw.length === 1 && Array.isArray(raw[0]) && raw[0].length === 1 && typeof raw[0][0] === "string") {
      return makeLink(db, raw[0][0], from);
    }
    return raw.map((item) => fromFrontmatter(db, item, from));
  }
  if (typeof raw === "object") {
    const fields: Record<string, DValue> = {};
    for (const [key, item] of Object.entries(raw as Record<string, unknown>)) fields[key] = fromFrontmatter(db, item, from);
    return { kind: "object", fields };
  }
  return String(raw);
}

function canonicalKey(key: string): string {
  return key.normalize("NFC").toLocaleLowerCase("es").trim().replace(/[*_`~]/g, "").replace(/\s+/g, "-");
}

function getField(object: DObject, name: string): DValue {
  if (Object.prototype.hasOwnProperty.call(object.fields, name)) return object.fields[name];
  const wanted = canonicalKey(name);
  for (const [key, value] of Object.entries(object.fields)) if (canonicalKey(key) === wanted) return value;
  return null;
}

function hasField(object: DObject, name: string): boolean {
  const wanted = canonicalKey(name);
  return Object.keys(object.fields).some((key) => key === name || canonicalKey(key) === wanted);
}

function fileDay(page: DataviewPage, frontmatterDate: DValue): DValue {
  const name = basenameOf(page.path);
  const iso = /(\d{4})-(\d{2})-(\d{2})/.exec(name);
  if (iso) return parseIsoDate(iso[0]);
  const compact = /(?:^|\D)(\d{4})(\d{2})(\d{2})(?:\D|$)/.exec(name);
  if (compact) return parseIsoDate(`${compact[1]}-${compact[2]}-${compact[3]}`);
  return isDate(frontmatterDate) ? frontmatterDate : null;
}

function expandTags(tags: string[]): string[] {
  const out = new Set<string>();
  for (const tag of tags) {
    const parts = tag.replace(/^#/, "").split("/");
    for (let index = 1; index <= parts.length; index += 1) out.add(`#${parts.slice(0, index).join("/")}`);
  }
  return [...out];
}

function rowFor(db: Db, path: string): DObject | null {
  const cached = db.rows.get(path);
  if (cached) return cached;
  const page = db.pages.get(path);
  if (!page) return null;
  const fields: Record<string, DValue> = {};
  for (const [key, raw] of Object.entries(page.frontmatter)) fields[key] = fromFrontmatter(db, raw, page.path);
  const self: DLink = { kind: "link", path: page.path, resolved: true };
  const seenOut = new Set<string>();
  const outlinks: DLink[] = [];
  for (const link of page.outlinks) {
    if (seenOut.has(link.path)) continue;
    seenOut.add(link.path);
    outlinks.push({ kind: "link", path: link.path, resolved: link.resolved });
  }
  const frontmatterDate = getField({ kind: "object", fields }, "date");
  const file: DObject = {
    kind: "object",
    fields: {
      name: basenameOf(page.path).split("/").pop() ?? page.path,
      path: page.path,
      folder: folderOf(page.path),
      ext: page.path.split(".").pop() ?? "md",
      link: self,
      mtime: { kind: "date", ms: page.mtime, time: true },
      ctime: { kind: "date", ms: page.ctime, time: true },
      cday: { kind: "date", ms: startOfDay(page.ctime), time: false },
      mday: { kind: "date", ms: startOfDay(page.mtime), time: false },
      day: fileDay(page, frontmatterDate),
      size: page.size,
      tags: expandTags(page.tags),
      etags: page.tags.map((tag) => `#${tag.replace(/^#/, "")}`),
      aliases: page.aliases ?? [],
      inlinks: (db.inlinks.get(page.path) ?? []).map((source) => ({ kind: "link", path: source, resolved: true }) as DLink),
      outlinks,
      frontmatter: { kind: "object", fields: { ...fields } },
    },
  };
  const row: DObject = { kind: "object", fields: { ...fields, file } };
  db.rows.set(path, row);
  return row;
}

function buildDb(source: DataviewSource, now: number): Db {
  const pages = new Map<string, DataviewPage>();
  for (const page of source.pages) pages.set(page.path, page);
  const inlinks = new Map<string, string[]>();
  for (const page of source.pages) {
    const seen = new Set<string>();
    for (const link of page.outlinks) {
      if (!link.resolved || link.path === page.path || seen.has(link.path)) continue;
      seen.add(link.path);
      const list = inlinks.get(link.path) ?? [];
      list.push(page.path);
      inlinks.set(link.path, list);
    }
  }
  const sorted = [...source.pages].sort((a, b) => a.path.localeCompare(b.path, "es"));
  return { pages, sorted, inlinks, resolve: source.resolve, rows: new Map(), now };
}

// ---------------------------------------------------------------------------
// Léxico
// ---------------------------------------------------------------------------

type Token =
  | { type: "ident"; value: string; start: number; end: number }
  | { type: "string"; value: string; start: number; end: number }
  | { type: "number"; value: number; start: number; end: number }
  | { type: "link"; value: string; start: number; end: number }
  | { type: "tag"; value: string; start: number; end: number }
  | { type: "op"; value: string; start: number; end: number }
  | { type: "eof"; value: ""; start: number; end: number };

const OPERATORS = ["!=", "<=", ">=", "=", "<", ">", "+", "-", "*", "/", "%", "(", ")", ",", "!", "[", "]", ".", "&", "|"];

function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  const ident = /[\p{L}_][\p{L}\p{N}_]*(?:-[\p{L}\p{N}_]+)*/uy;
  const number = /\d+(?:\.\d+)?/y;
  const tag = /#[\p{L}\p{N}_/-]+/uy;
  while (index < source.length) {
    const char = source[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (char === "/" && source[index + 1] === "/") {
      while (index < source.length && source[index] !== "\n") index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      let value = "";
      let end = index + 1;
      while (end < source.length && source[end] !== char) {
        if (source[end] === "\\" && end + 1 < source.length) {
          end += 1;
          value += source[end] === "n" ? "\n" : source[end];
        } else {
          value += source[end];
        }
        end += 1;
      }
      if (end >= source.length) throw new DataviewError("Texto sin cerrar: falta una comilla.");
      tokens.push({ type: "string", value, start: index, end: end + 1 });
      index = end + 1;
      continue;
    }
    if (char === "[" && source[index + 1] === "[") {
      const end = source.indexOf("]]", index + 2);
      if (end === -1) throw new DataviewError("Enlace sin cerrar: falta `]]`.");
      tokens.push({ type: "link", value: source.slice(index + 2, end), start: index, end: end + 2 });
      index = end + 2;
      continue;
    }
    if (char === "#") {
      tag.lastIndex = index;
      const match = tag.exec(source);
      if (match) {
        tokens.push({ type: "tag", value: match[0].slice(1), start: index, end: index + match[0].length });
        index += match[0].length;
        continue;
      }
    }
    number.lastIndex = index;
    const numberMatch = /\d/.test(char) ? number.exec(source) : null;
    if (numberMatch) {
      tokens.push({ type: "number", value: Number(numberMatch[0]), start: index, end: index + numberMatch[0].length });
      index += numberMatch[0].length;
      continue;
    }
    ident.lastIndex = index;
    const identMatch = ident.exec(source);
    if (identMatch) {
      tokens.push({ type: "ident", value: identMatch[0], start: index, end: index + identMatch[0].length });
      index += identMatch[0].length;
      continue;
    }
    const operator = OPERATORS.find((candidate) => source.startsWith(candidate, index));
    if (operator) {
      tokens.push({ type: "op", value: operator, start: index, end: index + operator.length });
      index += operator.length;
      continue;
    }
    throw new DataviewError(`Carácter inesperado: «${char}».`);
  }
  tokens.push({ type: "eof", value: "", start: source.length, end: source.length });
  return tokens;
}

// ---------------------------------------------------------------------------
// Sintaxis
// ---------------------------------------------------------------------------

type Expr =
  | { kind: "literal"; value: DValue }
  | { kind: "linkLiteral"; target: string }
  | { kind: "dateWord"; word: string }
  | { kind: "field"; name: string }
  | { kind: "index"; object: Expr; key: Expr | string }
  | { kind: "call"; name: string; args: Expr[] }
  | { kind: "binary"; op: string; left: Expr; right: Expr }
  | { kind: "not"; value: Expr }
  | { kind: "negate"; value: Expr }
  | { kind: "list"; items: Expr[] };

type SourceExpr =
  | { kind: "tag"; tag: string }
  | { kind: "path"; path: string }
  | { kind: "link"; target: string }
  | { kind: "outgoing"; target: string }
  | { kind: "not"; value: SourceExpr }
  | { kind: "and" | "or"; left: SourceExpr; right: SourceExpr };

type Clause =
  | { kind: "where"; expr: Expr }
  | { kind: "sort"; keys: { expr: Expr; desc: boolean }[] }
  | { kind: "limit"; count: number };

type Query = {
  type: "table" | "list" | "task";
  withoutId: boolean;
  fields: { expr: Expr; header: string }[];
  listExpr: Expr | null;
  from: SourceExpr | null;
  clauses: Clause[];
};

const CLAUSES = new Set(["from", "where", "sort", "limit", "group", "flatten"]);
const DATE_WORDS = new Set(["today", "now", "yesterday", "tomorrow", "sow", "eow", "som", "eom", "soy", "eoy"]);

class Parser {
  private index = 0;

  constructor(private readonly tokens: Token[], private readonly source: string) {}

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.index + offset, this.tokens.length - 1)];
  }

  private next(): Token {
    const token = this.peek();
    if (token.type !== "eof") this.index += 1;
    return token;
  }

  private isWord(word: string, offset = 0): boolean {
    const token = this.peek(offset);
    return token.type === "ident" && token.value.toLowerCase() === word;
  }

  private isOp(op: string): boolean {
    const token = this.peek();
    return token.type === "op" && token.value === op;
  }

  private expectOp(op: string) {
    if (!this.isOp(op)) throw new DataviewError(`Se esperaba «${op}» cerca de «${this.describe(this.peek())}».`);
    this.next();
  }

  private describe(token: Token): string {
    return token.type === "eof" ? "fin de la consulta" : this.source.slice(token.start, token.end);
  }

  private atClauseBoundary(): boolean {
    const token = this.peek();
    return token.type === "eof" || (token.type === "ident" && CLAUSES.has(token.value.toLowerCase()));
  }

  parseQuery(): Query {
    const head = this.next();
    if (head.type !== "ident") throw new DataviewError("La consulta debe empezar con TABLE, LIST o TASK.");
    const kind = head.value.toLowerCase();
    const query: Query = { type: "table", withoutId: false, fields: [], listExpr: null, from: null, clauses: [] };
    if (kind === "calendar") throw new DataviewError("CALENDAR no soportado en la app.");
    if (kind !== "table" && kind !== "list" && kind !== "task") throw new DataviewError(`Tipo de consulta desconocido: ${head.value}.`);
    query.type = kind;
    if (kind !== "task" && this.isWord("without") && this.isWord("id", 1)) {
      this.next();
      this.next();
      query.withoutId = true;
    }
    if (kind === "table" && !this.atClauseBoundary()) {
      do {
        if (this.isOp(",")) this.next();
        const start = this.peek().start;
        const expr = this.parseExpr();
        const end = this.tokens[this.index - 1].end;
        let header = this.source.slice(start, end).trim();
        if (this.isWord("as")) {
          this.next();
          const name = this.next();
          if (name.type !== "string" && name.type !== "ident") throw new DataviewError("Se esperaba un nombre después de AS.");
          header = String(name.value);
        }
        query.fields.push({ expr, header });
      } while (this.isOp(","));
    } else if (kind === "list" && !this.atClauseBoundary()) {
      query.listExpr = this.parseExpr();
    }

    while (this.peek().type !== "eof") {
      const token = this.next();
      const word = token.type === "ident" ? token.value.toLowerCase() : "";
      if (word === "from") {
        if (query.from) throw new DataviewError("FROM solo puede aparecer una vez.");
        query.from = this.parseSourceOr();
      } else if (word === "where") {
        query.clauses.push({ kind: "where", expr: this.parseExpr() });
      } else if (word === "sort") {
        const keys: { expr: Expr; desc: boolean }[] = [];
        do {
          if (this.isOp(",")) this.next();
          const expr = this.parseExpr();
          let desc = false;
          if (this.isWord("desc") || this.isWord("descending")) {
            this.next();
            desc = true;
          } else if (this.isWord("asc") || this.isWord("ascending")) {
            this.next();
          }
          keys.push({ expr, desc });
        } while (this.isOp(","));
        query.clauses.push({ kind: "sort", keys });
      } else if (word === "limit") {
        const count = this.next();
        if (count.type !== "number") throw new DataviewError("LIMIT necesita un número.");
        query.clauses.push({ kind: "limit", count: Math.max(0, Math.floor(count.value)) });
      } else if (word === "group") {
        throw new DataviewError("GROUP BY no soportado en la app.");
      } else if (word === "flatten") {
        throw new DataviewError("FLATTEN no soportado en la app.");
      } else {
        throw new DataviewError(`Cláusula inesperada: «${this.describe(token)}».`);
      }
    }
    return query;
  }

  // --- FROM ---------------------------------------------------------------

  private parseSourceOr(): SourceExpr {
    let left = this.parseSourceAnd();
    while (this.isWord("or") || this.isOp("|")) {
      this.next();
      left = { kind: "or", left, right: this.parseSourceAnd() };
    }
    return left;
  }

  private parseSourceAnd(): SourceExpr {
    let left = this.parseSourceNot();
    while (this.isWord("and") || this.isOp("&")) {
      this.next();
      left = { kind: "and", left, right: this.parseSourceNot() };
    }
    return left;
  }

  private parseSourceNot(): SourceExpr {
    if (this.isOp("-") || this.isOp("!")) {
      this.next();
      return { kind: "not", value: this.parseSourceNot() };
    }
    return this.parseSourceAtom();
  }

  private parseSourceAtom(): SourceExpr {
    const token = this.next();
    if (token.type === "tag") return { kind: "tag", tag: token.value };
    if (token.type === "string") {
      const wrapped = WIKILINK_ONLY.exec(token.value);
      return { kind: "path", path: wrapped ? splitLinkInner(wrapped[1]).target : token.value };
    }
    if (token.type === "link") return { kind: "link", target: token.value };
    if (token.type === "ident" && token.value.toLowerCase() === "outgoing") {
      this.expectOp("(");
      const link = this.next();
      if (link.type !== "link") throw new DataviewError("outgoing() necesita un enlace [[...]].");
      this.expectOp(")");
      return { kind: "outgoing", target: link.value };
    }
    if (token.type === "op" && token.value === "(") {
      const inner = this.parseSourceOr();
      this.expectOp(")");
      return inner;
    }
    throw new DataviewError(`Fuente FROM inválida: «${this.describe(token)}».`);
  }

  // --- Expresiones ----------------------------------------------------------

  parseExpr(): Expr {
    return this.parseOr();
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.isWord("or") || this.isOp("|")) {
      this.next();
      left = { kind: "binary", op: "or", left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.isWord("and") || this.isOp("&")) {
      this.next();
      left = { kind: "binary", op: "and", left, right: this.parseNot() };
    }
    return left;
  }

  private parseNot(): Expr {
    if (this.isWord("not") || this.isOp("!")) {
      this.next();
      return { kind: "not", value: this.parseNot() };
    }
    return this.parseCompare();
  }

  private parseCompare(): Expr {
    let left = this.parseAdditive();
    while (["=", "!=", "<", ">", "<=", ">="].some((op) => this.isOp(op))) {
      const op = this.next().value as string;
      left = { kind: "binary", op, left, right: this.parseAdditive() };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (this.isOp("+") || this.isOp("-")) {
      const op = this.next().value as string;
      left = { kind: "binary", op, left, right: this.parseMultiplicative() };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.isOp("*") || this.isOp("/") || this.isOp("%")) {
      const op = this.next().value as string;
      left = { kind: "binary", op, left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.isOp("-")) {
      this.next();
      return { kind: "negate", value: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let expr = this.parsePrimary();
    while (true) {
      if (this.isOp(".")) {
        this.next();
        const name = this.next();
        if (name.type !== "ident") throw new DataviewError("Se esperaba un campo después de «.».");
        expr = { kind: "index", object: expr, key: name.value };
      } else if (this.isOp("[")) {
        this.next();
        const key = this.parseExpr();
        this.expectOp("]");
        expr = { kind: "index", object: expr, key };
      } else {
        return expr;
      }
    }
  }

  private parseCall(name: string): Expr {
    const lower = name.toLowerCase();
    this.expectOp("(");
    if (lower === "date" && this.peek().type === "ident" && DATE_WORDS.has(this.peek().value.toString().toLowerCase()) && this.peekIsOp(1, ")")) {
      const word = this.next().value.toString().toLowerCase();
      this.expectOp(")");
      return { kind: "dateWord", word };
    }
    if (lower === "dur" && this.peek().type !== "string") {
      const start = this.peek().start;
      let depth = 0;
      while (this.peek().type !== "eof") {
        if (this.isOp("(")) depth += 1;
        if (this.isOp(")")) {
          if (depth === 0) break;
          depth -= 1;
        }
        this.next();
      }
      const end = this.peek().start;
      this.expectOp(")");
      return { kind: "call", name: "dur", args: [{ kind: "literal", value: this.source.slice(start, end).trim() }] };
    }
    const args: Expr[] = [];
    if (!this.isOp(")")) {
      do {
        if (this.isOp(",")) this.next();
        args.push(this.parseExpr());
      } while (this.isOp(","));
    }
    this.expectOp(")");
    return { kind: "call", name: lower, args };
  }

  private peekIsOp(offset: number, op: string): boolean {
    const token = this.peek(offset);
    return token.type === "op" && token.value === op;
  }

  private parsePrimary(): Expr {
    const token = this.next();
    switch (token.type) {
      case "number":
        return { kind: "literal", value: token.value };
      case "string": {
        const wrapped = WIKILINK_ONLY.exec(token.value);
        return wrapped ? { kind: "linkLiteral", target: wrapped[1] } : { kind: "literal", value: token.value };
      }
      case "link":
        return { kind: "linkLiteral", target: token.value };
      case "ident": {
        const lower = token.value.toLowerCase();
        if (this.isOp("(")) return this.parseCall(token.value);
        if (lower === "null") return { kind: "literal", value: null };
        if (lower === "true") return { kind: "literal", value: true };
        if (lower === "false") return { kind: "literal", value: false };
        return { kind: "field", name: token.value };
      }
      case "op":
        if (token.value === "(") {
          const inner = this.parseExpr();
          this.expectOp(")");
          return inner;
        }
        if (token.value === "[") {
          const items: Expr[] = [];
          if (!this.isOp("]")) {
            do {
              if (this.isOp(",")) this.next();
              items.push(this.parseExpr());
            } while (this.isOp(","));
          }
          this.expectOp("]");
          return { kind: "list", items };
        }
        break;
      default:
        break;
    }
    throw new DataviewError(`Expresión inválida cerca de «${this.describe(token)}».`);
  }
}

export function parseDataviewQuery(source: string) {
  const clean = source.trim();
  if (!clean) throw new DataviewError("Consulta vacía.");
  return new Parser(tokenize(clean), clean).parseQuery();
}

// ---------------------------------------------------------------------------
// Evaluación
// ---------------------------------------------------------------------------

type Scope = { db: Db; row: DObject; fromPath: string; extra?: DObject };

function startOfDay(ms: number): number {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dateWord(word: string, now: number): DDate {
  const today = new Date(startOfDay(now));
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const weekday = (today.getDay() + 6) % 7; // lunes = 0
  const at = (date: Date, time = false): DDate => ({ kind: "date", ms: date.getTime(), time });
  switch (word) {
    case "now": return { kind: "date", ms: now, time: true };
    case "yesterday": return at(new Date(y, m, d - 1));
    case "tomorrow": return at(new Date(y, m, d + 1));
    case "sow": return at(new Date(y, m, d - weekday));
    case "eow": return at(new Date(y, m, d - weekday + 6, 23, 59, 59, 999), true);
    case "som": return at(new Date(y, m, 1));
    case "eom": return at(new Date(y, m + 1, 0, 23, 59, 59, 999), true);
    case "soy": return at(new Date(y, 0, 1));
    case "eoy": return at(new Date(y, 11, 31, 23, 59, 59, 999), true);
    default: return at(today);
  }
}

const DURATION_UNITS: [RegExp, number][] = [
  [/^(?:y|yr|yrs|year|years|año|años)$/, 365 * DAY],
  [/^(?:mo|month|months|mes|meses)$/, 30 * DAY],
  [/^(?:w|wk|wks|week|weeks|semana|semanas)$/, 7 * DAY],
  [/^(?:d|day|days|día|días|dia|dias)$/, DAY],
  [/^(?:h|hr|hrs|hour|hours|hora|horas)$/, 3_600_000],
  [/^(?:m|min|mins|minute|minutes|minuto|minutos)$/, 60_000],
  [/^(?:s|sec|secs|second|seconds|segundo|segundos)$/, 1_000],
];

function parseDuration(text: string): DDuration | null {
  const pattern = /(\d+(?:\.\d+)?)\s*([\p{L}]+)/gu;
  let ms = 0;
  let found = false;
  for (const match of text.matchAll(pattern)) {
    const unit = DURATION_UNITS.find(([regex]) => regex.test(match[2].toLowerCase()));
    if (!unit) return null;
    ms += Number(match[1]) * unit[1];
    found = true;
  }
  return found ? { kind: "duration", ms } : null;
}

function truthy(value: DValue): boolean {
  if (value === null) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (isObject(value)) return Object.keys(value.fields).length > 0;
  if (isDuration(value)) return value.ms !== 0;
  return true;
}

function sameLink(a: DLink, b: DLink): boolean {
  if (a.resolved && b.resolved) return nameKey(a.path) === nameKey(b.path);
  return nameKey(linkName(a)) === nameKey(linkName(b));
}

/** Compara un enlace con texto: por nombre de archivo (o ruta), sin distinguir mayúsculas. */
function linkMatchesText(link: DLink, value: string): boolean {
  const wanted = nameKey(value.trim().replace(/\.md$/i, ""));
  return wanted === nameKey(linkName(link)) || wanted === nameKey(link.path.replace(/\.md$/i, ""));
}

const TYPE_ORDER = ["null", "boolean", "number", "string", "date", "duration", "link", "array", "object"];

function typeName(value: DValue): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value !== "object") return typeof value;
  return value.kind;
}

function compareValues(a: DValue, b: DValue): number {
  if (isLink(a) && typeof b === "string") return linkMatchesText(a, b) ? 0 : compareStrings(linkName(a), b);
  if (typeof a === "string" && isLink(b)) return linkMatchesText(b, a) ? 0 : compareStrings(a, linkName(b));
  if (isDate(a) && typeof b === "string") {
    const parsed = parseIsoDate(b);
    if (parsed) return Math.sign(a.ms - parsed.ms);
  }
  if (typeof a === "string" && isDate(b)) {
    const parsed = parseIsoDate(a);
    if (parsed) return Math.sign(parsed.ms - b.ms);
  }
  const ta = typeName(a);
  const tb = typeName(b);
  if (ta !== tb) return Math.sign(TYPE_ORDER.indexOf(ta) - TYPE_ORDER.indexOf(tb));
  if (a === null || b === null) return 0;
  if (typeof a === "number" && typeof b === "number") return Math.sign(a - b);
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  if (typeof a === "string" && typeof b === "string") return compareStrings(a, b);
  if (isDate(a) && isDate(b)) return Math.sign(a.ms - b.ms);
  if (isDuration(a) && isDuration(b)) return Math.sign(a.ms - b.ms);
  if (isLink(a) && isLink(b)) return sameLink(a, b) ? 0 : compareStrings(linkName(a), linkName(b));
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
      const result = compareValues(a[index], b[index]);
      if (result) return result;
    }
    return Math.sign(a.length - b.length);
  }
  return compareStrings(toText(a), toText(b));
}

function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return Math.sign(a.localeCompare(b, "es", { numeric: true }));
}

function equals(a: DValue, b: DValue): boolean {
  if (a === null || b === null) return a === b;
  return compareValues(a, b) === 0;
}

/** Enlace buscado dentro de un texto: igual al nombre o como palabra completa (sin mayúsculas). */
function linkInText(haystack: string, link: DLink): boolean {
  const name = linkName(link);
  if (!name) return false;
  if (nameKey(haystack.trim()) === nameKey(name)) return true;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(haystack);
}

function contains(haystack: DValue, needle: DValue, mode: "default" | "insensitive" | "exact" = "default"): boolean {
  if (Array.isArray(haystack)) {
    if (mode === "exact") return haystack.some((item) => equals(item, needle));
    return haystack.some((item) => contains(item, needle, mode));
  }
  if (typeof haystack === "string") {
    if (typeof needle === "string") {
      return mode === "insensitive" ? haystack.toLocaleLowerCase("es").includes(needle.toLocaleLowerCase("es")) : haystack.includes(needle);
    }
    if (isLink(needle)) return linkInText(haystack, needle);
    if (typeof needle === "number") return haystack.includes(String(needle));
    return false;
  }
  if (isLink(haystack)) {
    if (isLink(needle)) return sameLink(haystack, needle);
    if (typeof needle === "string") {
      const name = linkName(haystack);
      if (mode === "insensitive") return name.toLocaleLowerCase("es").includes(needle.toLocaleLowerCase("es"));
      return name.includes(needle) || linkMatchesText(haystack, needle);
    }
    return false;
  }
  if (isObject(haystack) && typeof needle === "string") return Object.prototype.hasOwnProperty.call(haystack.fields, needle);
  return equals(haystack, needle);
}

function arithmetic(op: string, a: DValue, b: DValue): DValue {
  if (a === null || b === null) return null;
  if (typeof a === "number" && typeof b === "number") {
    switch (op) {
      case "+": return a + b;
      case "-": return a - b;
      case "*": return a * b;
      case "/": return b === 0 ? null : a / b;
      case "%": return b === 0 ? null : a % b;
    }
  }
  if (op === "+" && (typeof a === "string" || typeof b === "string")) return toText(a) + toText(b);
  if (op === "+" && Array.isArray(a) && Array.isArray(b)) return [...a, ...b];
  if (isDate(a) && isDuration(b)) {
    if (op === "+") return { kind: "date", ms: a.ms + b.ms, time: a.time || b.ms % DAY !== 0 };
    if (op === "-") return { kind: "date", ms: a.ms - b.ms, time: a.time || b.ms % DAY !== 0 };
  }
  if (isDuration(a) && isDate(b) && op === "+") return { kind: "date", ms: a.ms + b.ms, time: b.time };
  if (isDate(a) && isDate(b) && op === "-") return { kind: "duration", ms: a.ms - b.ms };
  if (isDuration(a) && isDuration(b)) {
    if (op === "+") return { kind: "duration", ms: a.ms + b.ms };
    if (op === "-") return { kind: "duration", ms: a.ms - b.ms };
  }
  if (isDuration(a) && typeof b === "number") {
    if (op === "*") return { kind: "duration", ms: a.ms * b };
    if (op === "/" && b !== 0) return { kind: "duration", ms: a.ms / b };
  }
  throw new DataviewError(`No se puede aplicar «${op}» a ${typeName(a)} y ${typeName(b)}.`);
}

function indexValue(scope: Scope, object: DValue, key: DValue): DValue {
  if (object === null || key === null) return null;
  if (Array.isArray(object)) {
    if (typeof key === "number") return object[key < 0 ? object.length + key : key] ?? null;
    return object.map((item) => indexValue(scope, item, key));
  }
  if (typeof key !== "string") return null;
  if (isObject(object)) return getField(object, key);
  if (isLink(object)) {
    const row = rowFor(scope.db, object.path);
    return row ? getField(row, key) : null;
  }
  if (isDate(object)) {
    const date = new Date(object.ms);
    const parts: Record<string, number> = {
      year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate(), hour: date.getHours(),
      minute: date.getMinutes(), second: date.getSeconds(), weekday: ((date.getDay() + 6) % 7) + 1,
    };
    return parts[key.toLowerCase()] ?? null;
  }
  if (isDuration(object)) {
    const parts: Record<string, number> = { days: object.ms / DAY, hours: object.ms / 3_600_000, minutes: object.ms / 60_000, seconds: object.ms / 1_000 };
    return parts[key.toLowerCase()] ?? null;
  }
  if (typeof object === "string" && key === "length") return object.length;
  return null;
}

function toDate(scope: Scope, value: DValue): DValue {
  if (value === null) return null;
  if (isDate(value)) return value;
  if (typeof value === "string") {
    const lower = value.trim().toLowerCase();
    if (DATE_WORDS.has(lower)) return dateWord(lower, scope.db.now);
    return parseIsoDate(value);
  }
  if (typeof value === "number") return { kind: "date", ms: value, time: true };
  if (isLink(value)) {
    const row = rowFor(scope.db, value.path);
    const file = row ? getField(row, "file") : null;
    return file && isObject(file) ? getField(file, "day") : parseIsoDate(linkName(value));
  }
  return null;
}

function vectorize(value: DValue, fn: (item: DValue) => DValue): DValue {
  return Array.isArray(value) ? value.map((item) => vectorize(item, fn)) : fn(value);
}

function formatDate(ms: number, format: string): string {
  const date = new Date(ms);
  const tokens: Record<string, string> = {
    yyyy: String(date.getFullYear()), yy: String(date.getFullYear()).slice(2), MM: pad(date.getMonth() + 1), M: String(date.getMonth() + 1),
    dd: pad(date.getDate()), d: String(date.getDate()), HH: pad(date.getHours()), H: String(date.getHours()),
    mm: pad(date.getMinutes()), ss: pad(date.getSeconds()),
  };
  return format.replace(/yyyy|yy|MM|M|dd|d|HH|H|mm|ss/g, (token) => tokens[token] ?? token);
}

function callFunction(scope: Scope, name: string, args: DValue[]): DValue {
  const [a, b, c] = args;
  switch (name) {
    case "contains": return contains(a, b);
    case "icontains": return contains(a, b, "insensitive");
    case "econtains": return contains(a, b, "exact");
    case "containsword": {
      if (typeof a !== "string" || typeof b !== "string") return contains(a, b);
      const escaped = b.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(a);
    }
    case "length":
      if (a === null) return 0;
      if (Array.isArray(a) || typeof a === "string") return a.length;
      if (isObject(a)) return Object.keys(a.fields).length;
      return 0;
    case "lower": return vectorize(a, (item) => (typeof item === "string" ? item.toLocaleLowerCase("es") : item));
    case "upper": return vectorize(a, (item) => (typeof item === "string" ? item.toLocaleUpperCase("es") : item));
    case "startswith": return typeof a === "string" && typeof b === "string" ? a.startsWith(b) : false;
    case "endswith": return typeof a === "string" && typeof b === "string" ? a.endsWith(b) : false;
    case "replace": return typeof a === "string" && typeof b === "string" && typeof c === "string" ? a.split(b).join(c) : a;
    case "regexmatch":
    case "regextest":
      try {
        if (typeof a !== "string" || typeof b !== "string") return false;
        return name === "regexmatch" ? new RegExp(`^(?:${a})$`, "u").test(b) : new RegExp(a, "u").test(b);
      } catch {
        throw new DataviewError(`Expresión regular inválida: ${String(a)}`);
      }
    case "default": return vectorize(a, (item) => (item === null ? b ?? null : item));
    case "choice": return truthy(a) ? b ?? null : c ?? null;
    case "string": return a === null ? null : toText(a);
    case "number": {
      if (typeof a === "number") return a;
      const match = typeof a === "string" ? /-?\d+(?:\.\d+)?/.exec(a) : null;
      return match ? Number(match[0]) : null;
    }
    case "round": {
      if (typeof a !== "number") return null;
      const digits = typeof b === "number" ? b : 0;
      return Math.round(a * 10 ** digits) / 10 ** digits;
    }
    case "join": return Array.isArray(a) ? a.map(toText).join(typeof b === "string" ? b : ", ") : toText(a);
    case "list":
    case "array": return args;
    case "nonnull": return Array.isArray(a) ? a.filter((item) => item !== null) : args.filter((item) => item !== null);
    case "typeof": return typeName(a);
    case "min":
    case "max":
    case "sum": {
      const values = (args.length === 1 && Array.isArray(a) ? a : args).filter((item) => item !== null);
      if (!values.length) return null;
      if (name === "sum") return values.slice(1).reduce<DValue>((total, item) => arithmetic("+", total, item), values[0]);
      return values.reduce((best, item) => (compareValues(item, best) * (name === "min" ? -1 : 1) > 0 ? item : best));
    }
    case "link": {
      if (typeof a !== "string") return isLink(a) ? a : null;
      return makeLink(scope.db, a, scope.fromPath, typeof b === "string" ? b : undefined);
    }
    case "date": return toDate(scope, a);
    case "dur": return typeof a === "string" ? parseDuration(a) : isDuration(a) ? a : null;
    case "striptime": return isDate(a) ? { kind: "date", ms: startOfDay(a.ms), time: false } : null;
    case "dateformat": return isDate(a) && typeof b === "string" ? formatDate(a.ms, b) : null;
    default:
      throw new DataviewError(`Función no soportada: ${name}().`);
  }
}

function evaluate(expr: Expr, scope: Scope): DValue {
  switch (expr.kind) {
    case "literal": return expr.value;
    case "linkLiteral": return makeLink(scope.db, expr.target, scope.fromPath);
    case "dateWord": return dateWord(expr.word, scope.db.now);
    case "list": return expr.items.map((item) => evaluate(item, scope));
    case "field": {
      const lower = expr.name.toLowerCase();
      if (lower === "this") return rowFor(scope.db, scope.fromPath) ?? null;
      if (scope.extra && hasField(scope.extra, expr.name)) return getField(scope.extra, expr.name);
      return getField(scope.row, expr.name);
    }
    case "index": {
      const object = evaluate(expr.object, scope);
      const key = typeof expr.key === "string" ? expr.key : evaluate(expr.key, scope);
      return indexValue(scope, object, key);
    }
    case "call": return callFunction(scope, expr.name, expr.args.map((arg) => evaluate(arg, scope)));
    case "not": return !truthy(evaluate(expr.value, scope));
    case "negate": {
      const value = evaluate(expr.value, scope);
      if (typeof value === "number") return -value;
      if (isDuration(value)) return { kind: "duration", ms: -value.ms };
      return null;
    }
    case "binary": {
      if (expr.op === "and") return truthy(evaluate(expr.left, scope)) && truthy(evaluate(expr.right, scope));
      if (expr.op === "or") return truthy(evaluate(expr.left, scope)) || truthy(evaluate(expr.right, scope));
      const left = evaluate(expr.left, scope);
      const right = evaluate(expr.right, scope);
      switch (expr.op) {
        case "=": return equals(left, right);
        case "!=": return !equals(left, right);
        case "<": return left !== null && right !== null && compareValues(left, right) < 0;
        case ">": return left !== null && right !== null && compareValues(left, right) > 0;
        case "<=": return left !== null && right !== null && compareValues(left, right) <= 0;
        case ">=": return left !== null && right !== null && compareValues(left, right) >= 0;
        default: return arithmetic(expr.op, left, right);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// FROM
// ---------------------------------------------------------------------------

function pagesInPath(db: Db, raw: string): Set<string> {
  const target = nameKey(raw.trim().replace(/^\/+|\/+$/g, ""));
  const out = new Set<string>();
  for (const page of db.sorted) {
    const key = nameKey(page.path);
    if (!target || key === target || key === `${target}.md` || key.startsWith(`${target}/`)) out.add(page.path);
  }
  return out;
}

function evaluateSource(source: SourceExpr, db: Db, fromPath: string): Set<string> {
  switch (source.kind) {
    case "tag": {
      const wanted = nameKey(source.tag.replace(/^#/, ""));
      return new Set(db.sorted.filter((page) => page.tags.some((tag) => {
        const key = nameKey(tag.replace(/^#/, ""));
        return key === wanted || key.startsWith(`${wanted}/`);
      })).map((page) => page.path));
    }
    case "path": return pagesInPath(db, source.path);
    case "link": {
      const { target } = splitLinkInner(source.target);
      const resolved = target ? db.resolve(target, fromPath) : fromPath;
      return new Set(resolved ? db.inlinks.get(resolved) ?? [] : []);
    }
    case "outgoing": {
      const { target } = splitLinkInner(source.target);
      const resolved = target ? db.resolve(target, fromPath) : fromPath;
      const page = resolved ? db.pages.get(resolved) : undefined;
      return new Set((page?.outlinks ?? []).filter((link) => link.resolved && db.pages.has(link.path)).map((link) => link.path));
    }
    case "not": {
      const excluded = evaluateSource(source.value, db, fromPath);
      return new Set(db.sorted.map((page) => page.path).filter((path) => !excluded.has(path)));
    }
    case "and": {
      const right = evaluateSource(source.right, db, fromPath);
      return new Set([...evaluateSource(source.left, db, fromPath)].filter((path) => right.has(path)));
    }
    case "or": return new Set([...evaluateSource(source.left, db, fromPath), ...evaluateSource(source.right, db, fromPath)]);
  }
}

// ---------------------------------------------------------------------------
// Ejecución
// ---------------------------------------------------------------------------

function toCell(value: DValue): DataviewCell {
  if (value === null) return { kind: "empty" };
  if (typeof value === "string") return value ? { kind: "text", text: value } : { kind: "empty" };
  if (typeof value === "number") return { kind: "number", value, text: Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000) };
  if (typeof value === "boolean") return { kind: "text", text: value ? "true" : "false" };
  if (Array.isArray(value)) return value.length ? { kind: "list", items: value.map(toCell) } : { kind: "empty" };
  if (isLink(value)) return { kind: "link", path: value.path, text: value.display ?? linkName(value), resolved: value.resolved, subpath: value.subpath };
  if (isDate(value)) return { kind: "date", ms: value.ms, text: formatDataviewDate(value.ms, value.time) };
  return { kind: "text", text: toText(value) };
}

function fileCell(path: string): DataviewCell {
  return { kind: "link", path, text: basenameOf(path).split("/").pop() ?? path, resolved: true };
}

type Item = { path: string; scope: Scope; task?: DataviewTask };

function applyClauses(items: Item[], clauses: Clause[]): Item[] {
  let current = items;
  for (const clause of clauses) {
    if (clause.kind === "where") {
      current = current.filter((item) => truthy(evaluate(clause.expr, item.scope)));
    } else if (clause.kind === "sort") {
      const keyed = current.map((item, order) => ({ item, order, keys: clause.keys.map((key) => evaluate(key.expr, item.scope)) }));
      keyed.sort((a, b) => {
        for (let index = 0; index < clause.keys.length; index += 1) {
          const result = compareValues(a.keys[index], b.keys[index]);
          if (result) return clause.keys[index].desc ? -result : result;
        }
        return a.order - b.order;
      });
      current = keyed.map((entry) => entry.item);
    } else {
      current = current.slice(0, clause.count);
    }
  }
  return current;
}

const TASK_PATTERN = /^\s*(?:>\s*)*(?:[-*+]|\d+[.)])\s+\[(.)\]\s?(.*)$/;

function pageTasks(page: DataviewPage): DataviewTask[] {
  if (!page.text) return [];
  const tasks: DataviewTask[] = [];
  forEachLine(page.text, (line, index, inCode) => {
    if (inCode) return;
    const match = TASK_PATTERN.exec(line);
    if (match) tasks.push({ path: page.path, line: index, text: match[2].replace(/\s\^[A-Za-z0-9-]+\s*$/, "").trim(), status: match[1], checked: match[1] !== " " });
  });
  return tasks;
}

function taskObject(task: DataviewTask): DObject {
  const tags = Array.from(task.text.matchAll(/(?:^|\s)(#[\p{L}\p{N}_/-]+)/gu), (match) => match[1]);
  return {
    kind: "object",
    fields: {
      text: task.text,
      status: task.status,
      checked: task.checked,
      completed: task.status.toLowerCase() === "x",
      fullyCompleted: task.status.toLowerCase() === "x",
      line: task.line,
      path: task.path,
      tags,
      link: { kind: "link", path: task.path, resolved: true },
    },
  };
}

/** Ejecuta una consulta DQL. Nunca lanza: los errores vuelven en `error`. */
export function runDataviewQuery(sourceText: string, source: DataviewSource, fromPath: string, options: { now?: number } = {}): DataviewResult {
  let type: DataviewResult["type"] = /^\s*list\b/i.test(sourceText) ? "list" : /^\s*task\b/i.test(sourceText) ? "task" : "table";
  try {
    const query = parseDataviewQuery(sourceText);
    type = query.type;
    const db = buildDb(source, options.now ?? Date.now());
    const paths = query.from ? evaluateSource(query.from, db, fromPath) : new Set(db.sorted.map((page) => page.path));
    const pages = db.sorted.filter((page) => paths.has(page.path));

    if (query.type === "task") {
      const items: Item[] = [];
      for (const page of pages) {
        const row = rowFor(db, page.path);
        if (!row) continue;
        for (const task of pageTasks(page)) items.push({ path: page.path, task, scope: { db, row, fromPath, extra: taskObject(task) } });
      }
      const groups = new Map<string, DataviewTaskGroup>();
      for (const item of applyClauses(items, query.clauses)) {
        if (!item.task) continue;
        const group = groups.get(item.path) ?? { path: item.path, title: basenameOf(item.path).split("/").pop() ?? item.path, tasks: [] };
        group.tasks.push(item.task);
        groups.set(item.path, group);
      }
      return { type: "task", rows: [], groups: [...groups.values()] };
    }

    const items: Item[] = [];
    for (const page of pages) {
      const row = rowFor(db, page.path);
      if (row) items.push({ path: page.path, scope: { db, row, fromPath } });
    }
    const selected = applyClauses(items, query.clauses);

    if (query.type === "list") {
      const rows = selected.map((item) => {
        const cells: DataviewCell[] = [];
        if (!query.withoutId) cells.push(fileCell(item.path));
        if (query.listExpr) cells.push(toCell(evaluate(query.listExpr, item.scope)));
        return cells;
      });
      return { type: "list", rows, idColumn: !query.withoutId };
    }

    const headers = [...(query.withoutId ? [] : ["Archivo"]), ...query.fields.map((field) => field.header)];
    const rows = selected.map((item) => [
      ...(query.withoutId ? [] : [fileCell(item.path)]),
      ...query.fields.map((field) => toCell(evaluate(field.expr, item.scope))),
    ]);
    return { type: "table", headers, rows, idColumn: !query.withoutId };
  } catch (error) {
    const message = error instanceof DataviewError ? error.message : error instanceof Error ? `Error al ejecutar la consulta: ${error.message}` : "Error al ejecutar la consulta.";
    return { type, rows: [], error: message };
  }
}

// ---------------------------------------------------------------------------
// Adaptador desde el índice real
// ---------------------------------------------------------------------------

/** Lo mínimo del `VaultIndex` que necesita el motor (para no importar código de servidor). */
export type DataviewIndexLike = {
  notes: Map<string, {
    path: string;
    text: string;
    mtime: number;
    ctime: number;
    size: number;
    parsed: { frontmatter: Record<string, unknown>; tags: string[]; aliases: string[] };
  }>;
  outgoing: Map<string, { target: string; resolved: string | null }[]>;
  resolve: (target: string, from?: string) => string | null;
};

const sourceCache = new WeakMap<object, DataviewSource>();

export function dataviewSourceFromIndex(index: DataviewIndexLike): DataviewSource {
  const cached = sourceCache.get(index);
  if (cached) return cached;
  const pages: DataviewPage[] = [];
  for (const note of index.notes.values()) {
    pages.push({
      path: note.path,
      frontmatter: note.parsed.frontmatter,
      tags: note.parsed.tags,
      aliases: note.parsed.aliases,
      mtime: note.mtime,
      ctime: note.ctime,
      size: note.size,
      text: note.text,
      outlinks: (index.outgoing.get(note.path) ?? []).map((link) => ({ path: link.resolved ?? link.target, resolved: Boolean(link.resolved) })),
    });
  }
  const source: DataviewSource = { pages, resolve: index.resolve };
  sourceCache.set(index, source);
  return source;
}
