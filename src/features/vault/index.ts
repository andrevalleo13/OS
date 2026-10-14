import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { walkVault, type VaultFile } from "./fs";
import {
  basenameOf,
  createLinkResolver,
  folderOf,
  foldText,
  nameKey,
  parseNote,
  type LinkResolver,
  type ParsedNote,
} from "./parse";

export type IndexedNote = VaultFile & {
  title: string;
  text: string;
  parsed: ParsedNote;
};

export type ResolvedLink = { target: string; resolved: string | null; line: number; embed: boolean };

export type VaultIndex = {
  root: string;
  builtAt: number;
  files: VaultFile[];
  folders: string[];
  notes: Map<string, IndexedNote>;
  resolve: LinkResolver;
  outgoing: Map<string, ResolvedLink[]>;
  backlinks: Map<string, { source: string; line: number }[]>;
  unresolved: Map<string, { count: number; sources: Set<string> }>;
  tags: Map<string, Set<string>>;
};

type Cache = {
  index: VaultIndex | null;
  building: Promise<VaultIndex> | null;
  dirty: boolean;
  parsed: Map<string, { mtime: number; size: number; note: IndexedNote }>;
};

const globalCache = globalThis as unknown as { __valleosVault?: Cache };
const cache: Cache = globalCache.__valleosVault ??= { index: null, building: null, dirty: true, parsed: new Map() };

/** El índice se reconstruye como máximo cada STALE_MS aunque no haya eventos del watcher. */
const STALE_MS = 4_000;

export function invalidateVaultIndex() {
  cache.dirty = true;
}

function noteTitle(file: VaultFile, parsed: ParsedNote): string {
  return basenameOf(file.path) || parsed.headings[0]?.text || file.name;
}

async function build(): Promise<VaultIndex> {
  const { root, files, folders } = await walkVault();
  const notes = new Map<string, IndexedNote>();
  const seen = new Set<string>();

  await Promise.all(files.filter((file) => file.ext === "md").map(async (file) => {
    seen.add(file.path);
    const cached = cache.parsed.get(file.path);
    if (cached && cached.mtime === file.mtime && cached.size === file.size) {
      notes.set(file.path, { ...cached.note, ...file });
      return;
    }
    const text = await fs.readFile(path.join(root, file.path), "utf8");
    const parsed = parseNote(text);
    const note: IndexedNote = { ...file, text, parsed, title: noteTitle(file, parsed) };
    cache.parsed.set(file.path, { mtime: file.mtime, size: file.size, note });
    notes.set(file.path, note);
  }));
  for (const key of cache.parsed.keys()) if (!seen.has(key)) cache.parsed.delete(key);

  const aliases = new Map<string, string>();
  for (const note of notes.values()) {
    for (const alias of note.parsed.aliases) if (!aliases.has(nameKey(alias))) aliases.set(nameKey(alias), note.path);
  }
  const resolve = createLinkResolver(files.map((file) => file.path), aliases);
  const outgoing = new Map<string, ResolvedLink[]>();
  const backlinks = new Map<string, { source: string; line: number }[]>();
  const unresolved = new Map<string, { count: number; sources: Set<string> }>();
  const tags = new Map<string, Set<string>>();

  for (const note of notes.values()) {
    const links: ResolvedLink[] = [];
    for (const link of note.parsed.links) {
      if (!link.target) continue;
      const resolved = resolve(link.target, note.path);
      links.push({ target: link.target, resolved, line: link.line, embed: link.embed });
      if (resolved) {
        if (resolved === note.path) continue;
        const list = backlinks.get(resolved) ?? [];
        list.push({ source: note.path, line: link.line });
        backlinks.set(resolved, list);
      } else {
        const entry = unresolved.get(link.target) ?? { count: 0, sources: new Set<string>() };
        entry.count += 1;
        entry.sources.add(note.path);
        unresolved.set(link.target, entry);
      }
    }
    outgoing.set(note.path, links);
    for (const tag of note.parsed.tags) {
      const set = tags.get(tag) ?? new Set<string>();
      set.add(note.path);
      tags.set(tag, set);
    }
  }

  return { root, builtAt: Date.now(), files, folders, notes, resolve, outgoing, backlinks, unresolved, tags };
}

export async function getVaultIndex(): Promise<VaultIndex> {
  const fresh = cache.index && !cache.dirty && Date.now() - cache.index.builtAt < STALE_MS;
  if (fresh && cache.index) return cache.index;
  if (!cache.building) {
    cache.dirty = false;
    cache.building = build()
      .then((index) => {
        cache.index = index;
        return index;
      })
      .finally(() => {
        cache.building = null;
      });
  }
  return cache.building;
}

// ---------------------------------------------------------------------------
// Consultas sobre el índice
// ---------------------------------------------------------------------------

function lineAt(text: string, line: number): string {
  return text.split("\n")[line] ?? "";
}

export function noteMeta(index: VaultIndex, notePath: string) {
  const note = index.notes.get(notePath);
  const backlinkGroups = new Map<string, { line: number; text: string }[]>();
  for (const { source, line } of index.backlinks.get(notePath) ?? []) {
    const sourceNote = index.notes.get(source);
    if (!sourceNote) continue;
    const list = backlinkGroups.get(source) ?? [];
    if (!list.some((item) => item.line === line)) list.push({ line, text: line === 0 && sourceNote.parsed.frontmatterRaw ? "(propiedades)" : lineAt(sourceNote.text, line).trim() });
    backlinkGroups.set(source, list);
  }

  const outgoing = new Map<string, { target: string; path: string | null; count: number }>();
  for (const link of index.outgoing.get(notePath) ?? []) {
    const key = link.resolved ?? `?${link.target}`;
    const entry = outgoing.get(key) ?? { target: link.target, path: link.resolved, count: 0 };
    entry.count += 1;
    outgoing.set(key, entry);
  }

  // Menciones sin enlazar: notas que dicen el nombre (o un alias) sin enlazarlo.
  const unlinked: { path: string; title: string; contexts: { line: number; text: string }[] }[] = [];
  if (note) {
    const names = [note.title, ...note.parsed.aliases].filter((name) => name.length >= 3).map(foldText);
    const patterns = names.map((name) => new RegExp(`(^|[^\\p{L}\\p{N}])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "u"));
    for (const other of index.notes.values()) {
      if (other.path === notePath || backlinkGroups.has(other.path) || unlinked.length >= 40) continue;
      const foldedText = foldText(other.text);
      if (!names.some((name) => foldedText.includes(name))) continue;
      const contexts: { line: number; text: string }[] = [];
      other.text.split("\n").forEach((line, lineIndex) => {
        if (contexts.length >= 3 || lineIndex < other.parsed.bodyLine) return;
        const withoutLinks = foldText(line.replace(/!?\[\[[^\]]*\]\]/g, " "));
        if (patterns.some((pattern) => pattern.test(withoutLinks))) contexts.push({ line: lineIndex, text: line.trim() });
      });
      if (contexts.length) unlinked.push({ path: other.path, title: other.title, contexts });
    }
  }

  return {
    path: notePath,
    exists: Boolean(note),
    title: note?.title ?? basenameOf(notePath),
    frontmatter: note?.parsed.frontmatter ?? {},
    tags: note?.parsed.tags ?? [],
    aliases: note?.parsed.aliases ?? [],
    headings: note?.parsed.headings ?? [],
    tasks: note?.parsed.tasks ?? { done: 0, total: 0 },
    words: note?.parsed.words ?? 0,
    characters: note?.text.length ?? 0,
    mtime: note?.mtime ?? 0,
    ctime: note?.ctime ?? 0,
    backlinks: [...backlinkGroups.entries()]
      .map(([source, contexts]) => ({ path: source, title: index.notes.get(source)?.title ?? basenameOf(source), contexts: contexts.sort((a, b) => a.line - b.line) }))
      .sort((a, b) => a.title.localeCompare(b.title, "es")),
    outgoing: [...outgoing.values()].sort((a, b) => Number(Boolean(b.path)) - Number(Boolean(a.path)) || a.target.localeCompare(b.target, "es")),
    unlinked,
  };
}

export type NoteMeta = ReturnType<typeof noteMeta>;

type SearchTerm = { value: string; negate: boolean; field: "any" | "file" | "path" | "tag" | "line" };

function parseQuery(query: string): SearchTerm[] {
  const terms: SearchTerm[] = [];
  const pattern = /(-?)(?:(file|path|tag|line):)?(?:"([^"]+)"|(\S+))/gi;
  for (const match of query.matchAll(pattern)) {
    const raw = (match[3] ?? match[4] ?? "").trim();
    if (!raw) continue;
    const field = (match[2]?.toLowerCase() ?? "any") as SearchTerm["field"];
    terms.push({ value: foldText(field === "tag" ? raw.replace(/^#/, "") : raw), negate: match[1] === "-", field });
  }
  return terms;
}

export type SearchHit = {
  path: string;
  title: string;
  score: number;
  matches: { line: number; text: string; ranges: [number, number][] }[];
};

export function searchVault(index: VaultIndex, query: string, limit = 60): SearchHit[] {
  const terms = parseQuery(query);
  if (!terms.length) return [];
  const textTerms = terms.filter((term) => !term.negate && (term.field === "any" || term.field === "line"));
  const hits: SearchHit[] = [];

  for (const note of index.notes.values()) {
    const foldedPath = foldText(note.path);
    const foldedTitle = foldText(note.title);
    const foldedText = foldText(note.text);
    const noteTags = note.parsed.tags.map(foldText);
    let score = 0;
    let ok = true;
    for (const term of terms) {
      let found: boolean;
      if (term.field === "file") found = foldedTitle.includes(term.value);
      else if (term.field === "path") found = foldedPath.includes(term.value);
      else if (term.field === "tag") found = noteTags.some((tag) => tag === term.value || tag.startsWith(`${term.value}/`));
      else found = foldedTitle.includes(term.value) || foldedText.includes(term.value) || note.parsed.aliases.some((alias) => foldText(alias).includes(term.value));
      if (term.negate ? found : !found) {
        ok = false;
        break;
      }
      if (!term.negate) {
        if (foldedTitle === term.value) score += 120;
        else if (foldedTitle.includes(term.value)) score += 50;
        if (term.field !== "file" && term.field !== "path") score += Math.min(20, foldedText.split(term.value).length - 1);
      }
    }
    if (!ok) continue;

    const matches: SearchHit["matches"] = [];
    if (textTerms.length) {
      const lines = note.text.split("\n");
      for (let lineIndex = 0; lineIndex < lines.length && matches.length < 6; lineIndex += 1) {
        const line = lines[lineIndex];
        const folded = foldText(line);
        const ranges: [number, number][] = [];
        for (const term of textTerms) {
          let from = folded.indexOf(term.value);
          while (from !== -1 && ranges.length < 12) {
            ranges.push([from, from + term.value.length]);
            from = folded.indexOf(term.value, from + term.value.length);
          }
        }
        if (ranges.length) {
          ranges.sort((a, b) => a[0] - b[0]);
          matches.push({ line: lineIndex, text: line, ranges });
        }
      }
    }
    hits.push({ path: note.path, title: note.title, score, matches });
  }

  return hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, "es")).slice(0, limit);
}

export type GraphData = {
  nodes: { id: string; name: string; folder: string; kind: string | null; degree: number; unresolved: boolean; tag?: boolean }[];
  links: { source: string; target: string }[];
};

export function vaultGraph(index: VaultIndex, options: { unresolved?: boolean; tags?: boolean; orphans?: boolean } = {}): GraphData {
  const degree = new Map<string, number>();
  const links = new Map<string, { source: string; target: string }>();
  const add = (source: string, target: string) => {
    if (source === target) return;
    const key = source < target ? `${source}\u0000${target}` : `${target}\u0000${source}`;
    if (links.has(key)) return;
    links.set(key, { source, target });
    degree.set(source, (degree.get(source) ?? 0) + 1);
    degree.set(target, (degree.get(target) ?? 0) + 1);
  };

  for (const [source, outgoing] of index.outgoing) {
    for (const link of outgoing) {
      if (link.resolved) {
        if (index.notes.has(link.resolved)) add(source, link.resolved);
      } else if (options.unresolved) add(source, `?${link.target}`);
    }
  }
  if (options.tags) {
    for (const [tag, sources] of index.tags) for (const source of sources) add(source, `#${tag}`);
  }

  const nodes: GraphData["nodes"] = [];
  for (const note of index.notes.values()) {
    if (options.orphans === false && !degree.get(note.path)) continue;
    const kind = note.parsed.frontmatter.tipo ?? note.parsed.frontmatter.type;
    nodes.push({
      id: note.path,
      name: note.title,
      folder: note.path.includes("/") ? note.path.split("/")[0] : "",
      kind: typeof kind === "string" ? kind : null,
      degree: degree.get(note.path) ?? 0,
      unresolved: false,
    });
  }
  const known = new Set(nodes.map((node) => node.id));
  for (const id of degree.keys()) {
    if (known.has(id)) continue;
    const isTag = id.startsWith("#");
    nodes.push({ id, name: isTag ? id : id.replace(/^\?/, ""), folder: "", kind: null, degree: degree.get(id) ?? 0, unresolved: !isTag, tag: isTag });
  }
  return { nodes, links: [...links.values()] };
}

/** Grafo local: la nota, sus vecinos y (opcional) los vecinos de sus vecinos. */
export function localGraph(index: VaultIndex, notePath: string, depth = 1): GraphData {
  const full = vaultGraph(index, { unresolved: false });
  const keep = new Set<string>([notePath]);
  for (let level = 0; level < depth; level += 1) {
    // Frontera fija por nivel: si no, un solo recorrido se expande en cadena.
    const frontier = new Set(keep);
    for (const link of full.links) {
      if (frontier.has(link.source)) keep.add(link.target);
      if (frontier.has(link.target)) keep.add(link.source);
    }
  }
  return {
    nodes: full.nodes.filter((node) => keep.has(node.id)),
    links: full.links.filter((link) => keep.has(link.source) && keep.has(link.target)),
  };
}

export function folderSummary(index: VaultIndex) {
  return index.folders.map((folder) => ({
    path: folder,
    notes: [...index.notes.values()].filter((note) => folderOf(note.path) === folder).length,
  }));
}
